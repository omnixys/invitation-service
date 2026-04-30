import {
  Invitation,
  InvitationStatus,
  InvitationType,
  Prisma,
  PhoneNumber,
  PhoneNumberType as PrismaPhoneNumberType,
  RsvpChoice,
} from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RsvpDomain } from '../models/domain/rsvp.domain.js';
import { CreatePlusOneInput } from '../models/input/plus-one.input.js';
import { PublicRsvpInput } from '../models/input/public-rsvp.input.js';
import { RSVPInput } from '../models/input/rsvp.input.js';
import { UpdatePlusOneInput } from '../models/input/update-plus-one.input.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  ClientContext,
  CreatePendingUserDTO,
  createTmpUsername,
  getPrimaryPhoneNumber,
  MissingContactMethodException,
  MissingRsvpContactDetailsException,
  n2u,
  PhoneNumberDTO,
  PhoneNumberType as SharedPhoneNumberType,
} from '@omnixys/shared';

type InvitationWithPhones = Prisma.InvitationGetPayload<{
  include: { phoneNumbers: true };
}>;

/**
 * Maps Prisma enum → Shared enum
 */
export function mapPhoneNumberType(type: PrismaPhoneNumberType): SharedPhoneNumberType {
  return type as unknown as SharedPhoneNumberType;
}

function mapPhoneNumber(ph: PhoneNumber): PhoneNumberDTO {
  return {
    number: ph.number,
    type: mapPhoneNumberType(ph.type),
    label: ph.label ?? undefined,
    isPrimary: ph.isPrimary,
    countryCode: ph.countryCode,
  };
}

@Injectable()
export class GuestWriteService extends InvitationBaseService {
  constructor(
    prisma: PrismaService,
    logger: OmnixysLogger,
    private readonly cache: ValkeyService,
    private readonly producer: KafkaProducerService,
  ) {
    super(logger, prisma);
  }

  /**
   * RSVP reply for an existing invitation.
   *
   * Business rules:
   * - PlusOnes ONLY exist when RSVP = YES
   * - For MAYBE / NO → no plusOnes must be processed
   */
  async reply(input: RSVPInput, clientInfo: ClientContext): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] reply', async () => {
      const { invitationId: id, choice, replyInput } = input;

      this.logger.debug(`reply: id=${id} choice=${choice}`);

      const invitation = await this.ensureExists(id);

      /**
       * Prevent double RSVP
       */
      if (invitation.rsvpChoice === RsvpChoice.YES || invitation.rsvpChoice === RsvpChoice.NO) {
        throw new BadRequestException('Already RSVPed');
      }

      const now = new Date();
      const previous = invitation.rsvpChoice ?? null;

      const decision = RsvpDomain.decide(previous, choice, !!replyInput);

      /**
       * Validate contact details for YES
       */
      if (decision.newChoice === RsvpChoice.YES) {
        if (!replyInput) {
          throw new MissingRsvpContactDetailsException();
        }

        if (!replyInput.email && !replyInput.phoneNumbers?.length) {
          throw new MissingContactMethodException();
        }
      }

      const inputPlusOnes = replyInput?.plusOnes ?? [];

      const maxInvitees = invitation.maxInvitees ?? 0;
      /**
       * Enforce maxInvitees limit (hard cap)
       */
      const allowedPlusOnes =
        decision.newChoice === RsvpChoice.YES ? inputPlusOnes.slice(0, maxInvitees) : [];

      /**
       * Validate plusOnes
       */
      if (decision.newChoice === RsvpChoice.YES) {
        for (const p of allowedPlusOnes) {
          if (!p.firstName || !p.lastName) {
            throw new BadRequestException('PlusOne must have firstName and lastName');
          }
        }
      }

      /**
       * 🔥 TRANSACTION (CRITICAL)
       */
      const result = await this.prismaService.$transaction(async (tx) => {
        /**
         * 1. Update parent invitation
         */
        const updatedInvitation = await tx.invitation.update({
          where: { id },
          data: {
            rsvpChoice: decision.newChoice,
            status: decision.newStatus,
            rsvpAt: now,
            firstName: replyInput?.firstName ?? invitation.firstName,
            lastName: replyInput?.lastName ?? invitation.lastName,
            phoneNumber: getPrimaryPhoneNumber(replyInput?.phoneNumbers) ?? invitation.phoneNumber,
            email: replyInput?.email ?? invitation.email,
          },
        });

        /**
         * 2. Create plusOnes ONLY if YES
         */
        const createdPlusOnes: InvitationWithPhones[] = [];

        if (decision.newChoice === RsvpChoice.YES && inputPlusOnes.length > 0) {
          for (const p of allowedPlusOnes) {
            const created = await tx.invitation.create({
              data: {
                type: InvitationType.PRIVATE,
                eventId: invitation.eventId,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email ?? null,

                status: InvitationStatus.ACCEPTED,
                rsvpChoice: RsvpChoice.YES,
                rsvpAt: now,

                invitedByInvitationId: invitation.id,
                phoneNumber: getPrimaryPhoneNumber(p?.phoneNumbers),

                /**
                 * Nested phone numbers
                 */
                phoneNumbers: p.phoneNumbers?.length
                  ? {
                      createMany: {
                        data: p.phoneNumbers.map((ph) => ({
                          number: ph.number,
                          type: ph.type,
                          label: ph.label ?? null,
                          isPrimary: ph.isPrimary ?? false,
                          countryCode: ph.countryCode,
                        })),
                      },
                    }
                  : undefined,
              },
              include: {
                phoneNumbers: true,
              },
            });

            createdPlusOnes.push(created);
          }
        }

        /**
         * 3. Build pending contact (optional flow)
         */
        let pendingContactId: string | undefined;

        if (decision.needsContactDetails) {
          if (!replyInput) {
            throw new MissingRsvpContactDetailsException();
          }

          const pendingUser: CreatePendingUserDTO = {
            firstName: replyInput.firstName ?? invitation.firstName,
            lastName: replyInput.lastName ?? invitation.lastName,
            invitationId: invitation.id,
            email: replyInput.email,
            phoneNumbers: replyInput.phoneNumbers,
            eventId: invitation.eventId,
            tenantId: 'omnixys',
            locale: clientInfo.locale,
            actorId: createTmpUsername(
              replyInput.firstName ?? invitation.firstName,
              replyInput.lastName ?? invitation.lastName,
            ),

            /**
             * Now mapped from DB-created plusOnes
             */
            plusOnes: createdPlusOnes.map((p) => ({
              invitationId: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              email: n2u(p.email),
              phoneNumbers: p.phoneNumbers.map(mapPhoneNumber),
            })),
          };

          pendingContactId = await this.cache.set(
            ValkeyKey.pendingContact,
            JSON.stringify(pendingUser),
            60 * 60 * 24,
          );

          /**
           * Attach pendingContactId AFTER creation
           */
          await tx.invitation.update({
            where: { id },
            data: { pendingContactId },
          });
        }

        return updatedInvitation;
      });
      const truncated = inputPlusOnes.length > maxInvitees;

      if (inputPlusOnes.length > maxInvitees) {
        this.logger.warn(
          `PlusOnes truncated: invitation=${id} requested=${inputPlusOnes.length} allowed=${maxInvitees}`,
        );
      }

      return {
        ...InvitationMapper.toPayload(result),
        plusOnesTruncated: truncated,
      };
    });
  }

  /**
   * Creates a plus-one invitation.
   */
  async createPlusOne(
    input: CreatePlusOneInput,
    actorId: string,
    clientInfo: ClientContext,
  ): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] createPlusOne', async () => {
      const { eventId, invitedByInvitationId, firstName, lastName, email, phoneNumbers } = input;

      if (!eventId || !invitedByInvitationId) {
        throw new BadRequestException('Missing required fields');
      }

      if (!firstName || !lastName) {
        throw new BadRequestException('PlusOne must have firstName and lastName');
      }

      /**
       * Optional: validate phoneNumbers
       */
      if (phoneNumbers?.length) {
        for (const ph of phoneNumbers) {
          if (!ph.number || !ph.countryCode || !ph.type) {
            throw new BadRequestException('Invalid phone number');
          }
        }
      }

      return this.prismaService.$transaction(async (tx) => {
        const parent = await tx.invitation.findUnique({
          where: { id: invitedByInvitationId },
        });

        if (!parent) {
          throw new NotFoundException('Parent invitation not found');
        }

        if (parent.eventId !== eventId) {
          throw new BadRequestException('Event mismatch');
        }

        const updated = await tx.invitation.updateMany({
          where: {
            id: invitedByInvitationId,
            eventId,
            maxInvitees: { gt: 0 },
          },
          data: { maxInvitees: { decrement: 1 } },
        });

        if (updated.count !== 1) {
          throw new BadRequestException('No Plus-Ones remaining');
        }

        const child = await tx.invitation.create({
          data: {
            type: InvitationType.PRIVATE,
            eventId,
            invitedByInvitationId,
            invitedByUserId: actorId,

            firstName,
            lastName,
            email: email ?? null,

            status: InvitationStatus.PENDING,
            maxInvitees: 0,
            phoneNumber: getPrimaryPhoneNumber(phoneNumbers),
            phoneNumbers: phoneNumbers?.length
              ? {
                  createMany: {
                    data: phoneNumbers.map((ph) => ({
                      number: ph.number,
                      type: ph.type,
                      label: ph.label ?? null,
                      isPrimary: ph.isPrimary ?? false,
                      countryCode: ph.countryCode,
                    })),
                  },
                }
              : undefined,
          },
        });

        const pendingUser: CreatePendingUserDTO = {
          firstName,
          lastName,
          invitationId: child.id,
          email: email ?? undefined,
          phoneNumbers,
          eventId,
          tenantId: 'omnixys',
          locale: clientInfo.locale,
          actorId,
        };

        const pendingContactId = await this.cache.set(
          ValkeyKey.pendingContact,
          JSON.stringify(pendingUser),
          60 * 60 * 24,
        );

        await tx.invitation.update({
          where: { id: child.id },
          data: { pendingContactId },
        });

        return InvitationMapper.toPayload(child);
      });
    });
  }

  /**
   * Updates a plus-one invitation.
   *
   * This operation:
   * - validates the target invitation
   * - ensures the target is really a plus-one
   * - ensures the authenticated user may manage the parent invitation
   * - fully replaces phone numbers for deterministic updates
   */
  async updatePlusOne(input: UpdatePlusOneInput, userId: string): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] updatePlusOne', async () => {
      const { id, firstName, lastName, email, phoneNumbers } = input;

      if (!id) {
        throw new BadRequestException('Missing plus-one id');
      }

      if (!firstName || !lastName) {
        throw new BadRequestException('PlusOne must have firstName and lastName');
      }

      if (phoneNumbers?.length) {
        for (const phoneNumber of phoneNumbers) {
          if (!phoneNumber.number || !phoneNumber.countryCode || !phoneNumber.type) {
            throw new BadRequestException('Invalid phone number');
          }
        }
      }

      return this.prismaService.$transaction(async (tx) => {
        const existing = await tx.invitation.findUnique({
          where: {
            id,
          },
          include: {
            phoneNumbers: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Invitation not found');
        }

        this.ensureIsPlusOne(existing);

        const parentInvitationId = existing.invitedByInvitationId;
        if (!parentInvitationId) {
          throw new BadRequestException('Plus-one parent invitation not found');
        }

        await this.ensureUserCanManageParentInvitation(tx, parentInvitationId, userId);

        await tx.phoneNumber.deleteMany({
          where: {
            invitationId: existing.id,
          },
        });

        const updated = await tx.invitation.update({
          where: {
            id: existing.id,
          },
          data: {
            firstName,
            lastName,
            email: email ?? null,
            phoneNumber: getPrimaryPhoneNumber(phoneNumbers) ?? null,
            phoneNumbers: phoneNumbers?.length
              ? {
                  createMany: {
                    data: phoneNumbers.map((phoneNumber) => ({
                      number: phoneNumber.number,
                      type: phoneNumber.type,
                      label: phoneNumber.label ?? null,
                      isPrimary: phoneNumber.isPrimary ?? false,
                      countryCode: phoneNumber.countryCode,
                    })),
                  },
                }
              : undefined,
          },
        });

        return InvitationMapper.toPayload(updated);
      });
    });
  }

  /**
   * Deletes a plus-one invitation.
   */
  async deletePlusOne(id: string, actorId: string): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] deletePlusOne', async () => {
      this.logger.debug('removing Plus One %s | actorId=%s', id, actorId);
      return this.prismaService.$transaction(async (tx) => {
        const child = await tx.invitation.findUnique({
          where: { id },
        });

        if (!child) {
          throw new NotFoundException('Invitation not found');
        }

        this.ensureIsPlusOne(child);

        const parentInvitationId = child.invitedByInvitationId;
        if (!parentInvitationId) {
          throw new BadRequestException('Plus-one parent invitation not found');
        }

        const guestId = child.guestProfileId;
        if (child.pendingContactId) {
          await this.cache.delete(ValkeyKey.pendingContact, child.pendingContactId);
        }

        const deleted = await tx.invitation.delete({ where: { id } });

        await tx.invitation.update({
          where: { id: parentInvitationId },
          data: {
            maxInvitees: { increment: 1 },
          },
        });

        if (guestId) {
          await this.producer.send({
            topic: KafkaTopics.authentication.deleteGuest,
            payload: {
              userId: guestId,
            },
            meta: {
              service: 'invitation-service',
              operation: 'Send confirm guest notification',
              version: '1',
              type: 'EVENT',
              actorId,
              tenantId: 'omnixys',
            },
          });
        }

        return InvitationMapper.toPayload(deleted);
      });
    });
  }

  /**
   * Public RSVP → creates invitation + plusOnes + pending user
   */
  async createFromPublicRsvp(
    input: PublicRsvpInput,
    clientInfo: ClientContext,
  ): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] createFromPublicRsvp', async () => {
      console.debug({ input });
      /**
       * 1. Create main invitation
       */
      const invitee = await this.prismaService.invitation.create({
        data: {
          type: InvitationType.PUBLIC,
          eventId: input.eventId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          status: InvitationStatus.ACCEPTED,
          rsvpChoice: RsvpChoice.YES,
          rsvpAt: new Date(),
          maxInvitees: input.plusOnes?.length ?? 0,

          phoneNumber: getPrimaryPhoneNumber(input.phoneNumbers),
          phoneNumbers: input.phoneNumbers?.length
            ? {
                createMany: {
                  data: input.phoneNumbers.map((ph) => ({
                    number: ph.number,
                    type: ph.type,
                    label: ph.label ?? null,
                    isPrimary: ph.isPrimary ?? false,
                    countryCode: ph.countryCode,
                  })),
                },
              }
            : undefined,
        },
      });

      /**
       * 2. Create plusOnes WITH IDs
       */
      const plusOneInvitations = [];

      for (const p of input.plusOnes ?? []) {
        if (!p.firstName || !p.lastName) {
          continue;
        }
        const created = await this.prismaService.invitation.create({
          data: {
            type: InvitationType.PUBLIC,
            eventId: input.eventId,
            firstName: p.firstName,
            lastName: p.lastName,
            status: InvitationStatus.ACCEPTED,
            rsvpChoice: RsvpChoice.YES,
            rsvpAt: new Date(),
            invitedByInvitationId: invitee.id,
            email: p.email,

            phoneNumber: getPrimaryPhoneNumber(input.phoneNumbers),
            phoneNumbers: p.phoneNumbers?.length
              ? {
                  createMany: {
                    data: p.phoneNumbers.map((ph) => ({
                      number: ph.number,
                      type: ph.type,
                      label: ph.label ?? null,
                      isPrimary: ph.isPrimary ?? false,
                      countryCode: ph.countryCode,
                    })),
                  },
                }
              : undefined,
          },
          include: {
            phoneNumbers: true,
          },
        });

        plusOneInvitations.push(created);
      }

      /**
       * 3. Build pending user (deterministic!)
       */
      const pendingUser: CreatePendingUserDTO = {
        firstName: input.firstName,
        lastName: input.lastName,
        invitationId: invitee.id,
        email: input.email,
        phoneNumbers: input.phoneNumbers,
        eventId: input.eventId,
        tenantId: 'omnixys',
        locale: clientInfo.locale,
        actorId: createTmpUsername(input.firstName, input.lastName),

        plusOnes: plusOneInvitations.map((p) => ({
          invitationId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: n2u(p.email),
          phoneNumbers: p.phoneNumbers.map((ph) => ({
            type: ph.type as SharedPhoneNumberType,
            countryCode: ph.countryCode,
            number: ph.number,
            label: n2u(ph.label),
            isPrimary: n2u(ph.isPrimary),
          })),
        })),
      };

      const pendingContactId = await this.cache.set(
        ValkeyKey.pendingContact,
        JSON.stringify(pendingUser),
        60 * 60 * 24 * 7,
      );

      const updated = await this.prismaService.invitation.update({
        where: { id: invitee.id },
        data: { pendingContactId },
      });

      return InvitationMapper.toPayload(updated);
    });
  }

  async deleteAllPlusOnes(parentId: string, actorId: string): Promise<InvitationPayload[]> {
    return TraceRunner.run('[SERVICE] deleteAllPlusOnes', async () =>
      this.prismaService.$transaction(async (tx) => {
        const parent = await tx.invitation.findUnique({
          where: { id: parentId },
          select: { id: true, eventId: true, plusOnes: true },
        });

        if (!parent) {
          throw new NotFoundException('Invitation not found');
        }

        const children = await tx.invitation.findMany({
          where: { invitedByInvitationId: parentId, eventId: parent.eventId },
          select: { id: true, pendingContactId: true, guestProfileId: true },
        });

        const fullChildren = [];
        const plusOneIds = [];

        for (const c of children) {
          if (c.pendingContactId) {
            await this.cache.delete(ValkeyKey.pendingContact, c.pendingContactId);
          }

          if (c.guestProfileId) {
            plusOneIds.push(c.guestProfileId);
          }

          const deleted = await tx.invitation.delete({ where: { id: c.id } });
          fullChildren.push(InvitationMapper.toPayload(deleted));
        }

        await tx.invitation.update({
          where: { id: parentId },
          data: {
            maxInvitees: { increment: children.length },
            // plusOnes: { set: [] },
          },
        });

        if (plusOneIds.length > 0) {
          await this.producer.send({
            topic: KafkaTopics.authentication.deleteGuestList,
            payload: {
              userIds: plusOneIds,
            },
            meta: {
              service: 'invitation-service',
              operation: 'Delete Guest Accounts',
              version: '1',
              type: 'EVENT',
              actorId,
              tenantId: 'omnixys',
            },
          });
        }
        return fullChildren;
      }),
    );
  }

  private ensureIsPlusOne(child: Invitation): void {
    if (!child.invitedByInvitationId) {
      throw new BadRequestException('Not a plus-one');
    }
  }

  /**
   * Ensures the authenticated user may manage the parent invitation.
   *
   * Rule:
   * - the parent invitation must belong to the current guestProfileId
   * - alternatively, the parent invitation may have been created by the same user
   */
  private async ensureUserCanManageParentInvitation(
    tx: Prisma.TransactionClient,
    parentInvitationId: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('Missing authenticated user');
    }

    const parent = await tx.invitation.findUnique({
      where: {
        id: parentInvitationId,
      },
      select: {
        id: true,
        guestProfileId: true,
        invitedByUserId: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent invitation not found');
    }

    const isOwner = parent.guestProfileId === userId;
    const isCreator = parent.invitedByUserId === userId;

    if (!isOwner && !isCreator) {
      throw new ForbiddenException('You are not allowed to manage this plus-one');
    }
  }
}
