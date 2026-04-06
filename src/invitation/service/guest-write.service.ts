/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Invitation, InvitationStatus, PhoneNumberType, Prisma, RsvpChoice } from '../../prisma/generated/client.js';
import { PhoneNumberType as PrismaPhoneNumberType } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RsvpDomain } from '../models/domain/rsvp.domain.js';
import { CreatePlusOneInput } from '../models/input/plus-one.input.js';
import { PublicRsvpInput } from '../models/input/public-rsvp.input.js';
import { RSVPInput } from '../models/input/rsvp.input.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  createTmpUsername,
  MissingRsvpContactDetailsException,
  MissingContactMethodException,
  ClientContext,
  CreatePendingUserDTO,
  n2u,
  PhoneNumberDTO,
} from '@omnixys/shared';
import { PhoneNumberType as SharedPhoneNumberType } from '@omnixys/shared';

type InvitationWithPhones = Prisma.InvitationGetPayload<{
  include: { phoneNumbers: true };
}>;

/**
 * Maps Prisma enum → Shared enum
 */
export function mapPhoneNumberType(
  type: PrismaPhoneNumberType,
): SharedPhoneNumberType {
  return type as unknown as SharedPhoneNumberType;
}

function mapPhoneNumber(
  ph: any, // better: Prisma.PhoneNumber
): PhoneNumberDTO {
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

      /**
       * Validate plusOnes
       */
      if (decision.newChoice === RsvpChoice.YES) {
        for (const p of inputPlusOnes) {
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
          },
        });

        /**
         * 2. Create plusOnes ONLY if YES
         */
        const createdPlusOnes: InvitationWithPhones[] = [];

        if (decision.newChoice === RsvpChoice.YES && inputPlusOnes.length > 0) {
          for (const p of inputPlusOnes) {
            const created = await tx.invitation.create({
              data: {
                eventId: invitation.eventId,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email ?? null,

                status: InvitationStatus.ACCEPTED,
                rsvpChoice: RsvpChoice.YES,
                rsvpAt: now,

                invitedByInvitationId: invitation.id,

                /**
                 * Nested phone numbers
                 */
                phoneNumbers: p.phoneNumbers?.length
                  ? {
                      createMany: {
                        data: p.phoneNumbers.map((ph) => ({
                          number: ph.number,
                          type: ph.type as PhoneNumberType,
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
          const pendingUser: CreatePendingUserDTO = {
            firstName: replyInput!.firstName ?? invitation.firstName,
            lastName: replyInput!.lastName ?? invitation.lastName,
            invitationId: invitation.id,
            email: replyInput!.email,
            phoneNumbers: replyInput!.phoneNumbers,
            eventId: invitation.eventId,
            tenantId: 'omnixys',
            locale: clientInfo.locale,
            actorId: createTmpUsername(
              replyInput!.firstName ?? invitation.firstName,
              replyInput!.lastName ?? invitation.lastName,
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

      return InvitationMapper.toPayload(result);
    });
  }

  /**
   * Creates a plus-one invitation.
   */
  async createPlusOne(input: CreatePlusOneInput, userId?: string): Promise<InvitationPayload> {
    const { eventId, invitedByInvitationId, firstName, lastName } = input;

    if (!eventId || !invitedByInvitationId) {
      throw new BadRequestException('Missing required fields');
    }

    return this.prismaService.$transaction(async (tx) => {
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
          eventId,
          invitedByInvitationId,
          invitedByUserId: userId,
          firstName,
          lastName,
          status: InvitationStatus.PENDING,
          maxInvitees: 0,
        },
      });

      return InvitationMapper.toPayload(child);
    });
  }

  /**
   * Deletes a plus-one invitation.
   */
  async deletePlusOne(id: string): Promise<InvitationPayload> {
    return this.prismaService.$transaction(async (tx) => {
      const child = await tx.invitation.findUnique({
        where: { id },
      });

      if (!child) {
        throw new NotFoundException('Invitation not found');
      }

      this.ensureIsPlusOne(child);

      if (child.pendingContactId) {
        await this.cache.delete(ValkeyKey.pendingContact, child.pendingContactId);
      }

      const deleted = await tx.invitation.delete({ where: { id } });

      await tx.invitation.update({
        where: { id: child.invitedByInvitationId! },
        data: {
          maxInvitees: { increment: 1 },
        },
      });

      return InvitationMapper.toPayload(deleted);
    });
  }

  /**
   * Public RSVP → creates invitation + plusOnes + pending user
   */
  async createFromPublicRsvp(
    input: PublicRsvpInput,
    clientInfo: ClientContext,
  ): Promise<InvitationPayload> {
    /**
     * 1. Create main invitation
     */
    const invitee = await this.prismaService.invitation.create({
      data: {
        eventId: input.eventId,
        firstName: input.firstName,
        lastName: input.lastName,
        status: InvitationStatus.ACCEPTED,
        rsvpChoice: RsvpChoice.YES,
        rsvpAt: new Date(),
        maxInvitees: input.plusOnes?.length ?? 0,
      },
    });

    /**
     * 2. Create plusOnes WITH IDs
     */
    const plusOneInvitations: Invitation[] = [];

    for (const p of input.plusOnes ?? []) {
      if (!p.firstName || !p.lastName) continue;

      const created = await this.prismaService.invitation.create({
        data: {
          eventId: input.eventId,
          firstName: p.firstName,
          lastName: p.lastName,
          status: InvitationStatus.ACCEPTED,
          rsvpChoice: RsvpChoice.YES,
          rsvpAt: new Date(),
          invitedByInvitationId: invitee.id,
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
  }

  async deleteAllPlusOnes(parentId: string): Promise<InvitationPayload[]> {
    return this.prismaService.$transaction(async (tx) => {
      const parent = await tx.invitation.findUnique({
        where: { id: parentId },
        select: { id: true, eventId: true, plusOnes: true },
      });

      if (!parent) {
        throw new NotFoundException('Invitation not found');
      }

      const children = await tx.invitation.findMany({
        where: { invitedByInvitationId: parentId, eventId: parent.eventId },
        select: { id: true, pendingContactId: true },
      });

      const fullChildren = [];

      for (const c of children) {
        if (c.pendingContactId) {
          const kp = await this.cache.delete(ValkeyKey.pendingContact, c.pendingContactId);
          console.log({ kp });
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
      return fullChildren;
    });
  }

  private ensureIsPlusOne(child: Invitation): void {
    if (!child.invitedByInvitationId) {
      throw new BadRequestException('Not a plus-one');
    }
  }
}
