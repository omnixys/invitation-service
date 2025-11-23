/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { LoggerPlusService } from '../../logger/logger-plus.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RsvpDomain } from '../models/domain/rsvp.domain.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { InvitationStatus } from '../models/enums/invitation-status.enum.js';
import { RSVPInput } from '../models/input/rsvp.input.js';
import { mapInvitation } from '../models/mappers/invitation.mapper.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { PendingContactService } from './pending-contact.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// FIX 2: strongly typed
export interface CreatePlusOneInput {
  eventId: string;
  invitedByInvitationId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class GuestWriteService extends InvitationBaseService {
  constructor(
    prisma: PrismaService,
    logger: LoggerPlusService,
    private readonly pending: PendingContactService,
  ) {
    super(logger, prisma);
  }

  async reply(input: RSVPInput): Promise<Invitation> {
    const { invitationId: id, choice, replyInput } = input;
    this.logger.debug(`reply: id=${id} choice=${choice}`);

    const invitation = await this.ensureExists(id);
    const now = new Date();

    // FIX 3: Avoid undefined → force null fallback
    const previous = invitation.rsvpChoice ?? null;

    const decision = RsvpDomain.decide(previous, choice, !!replyInput);

    // optional pending contact
    let pendingContactId: string | undefined = undefined;

    if (decision.needsContactDetails) {
      if (!replyInput) {
        throw new BadRequestException('Missing RSVP contact details');
      }

      pendingContactId = await this.pending.put({
        invitationId: id,
        // FIX 4: Convert null → undefined
        email: replyInput.email ?? undefined,
        phoneNumbers: replyInput.phoneNumbers ?? undefined,
      });
    }

    const updated = await this.prismaService.invitation.update({
      where: { id },
      data: {
        rsvpChoice: decision.newChoice,
        status: decision.newStatus,
        rsvpAt: now,
        ...(replyInput?.firstName ? { firstName: replyInput.firstName } : {}),
        ...(replyInput?.lastName ? { lastName: replyInput.lastName } : {}),
        ...(pendingContactId ? { pendingContactId } : {}),
      },
    });

    return mapInvitation(updated);
  }

  async createPlusOne(input: CreatePlusOneInput, userId?: string): Promise<Invitation> {
    const { eventId, invitedByInvitationId, firstName, lastName } = input;

    if (!eventId) {
      throw new BadRequestException('eventId required');
    }
    if (!invitedByInvitationId) {
      throw new BadRequestException('invitedByInvitationId required');
    }

    return this.prismaService.$transaction(async (tx): Promise<Invitation> => {
      const updateParent = await tx.invitation.updateMany({
        where: { id: invitedByInvitationId, eventId, maxInvitees: { gt: 0 } },
        data: { maxInvitees: { decrement: 1 } },
      });

      if (updateParent.count !== 1) {
        const exists = await tx.invitation.findUnique({
          where: { id: invitedByInvitationId },
          select: { id: true },
        });

        if (!exists) {
          throw new NotFoundException('Parent invitation does not exist');
        }
        throw new BadRequestException('No Plus-Ones remaining');
      }

      const child = await tx.invitation.create({
        data: {
          eventId,
          status: InvitationStatus.PENDING,
          invitedByInvitationId,
          invitedByUserId: userId,
          firstName,
          lastName,
          maxInvitees: 0,
        },
      });

      await tx.invitation.update({
        where: { id: invitedByInvitationId },
        data: { plusOnes: { push: child.id } },
      });

      return mapInvitation(child);
    });
  }

  async deletePlusOne(id: string): Promise<Invitation> {
    return this.prismaService.$transaction(async (tx) => {
      const child = await tx.invitation.findUnique({
        where: { id },
        select: {
          id: true,
          eventId: true,
          invitedByInvitationId: true,
          pendingContactId: true,
        },
      });

      // FIX 5: Validate child non-null early
      if (!child) {
        throw new NotFoundException('Invitation not found');
      }

      this.ensureIsPlusOne(child);

      const parent = await tx.invitation.findUnique({
        where: { id: child.invitedByInvitationId! },
        select: { id: true, plusOnes: true },
      });

      // FIX 6: Validate parent non-null early
      if (!parent) {
        throw new NotFoundException('Parent invitation not found');
      }

      if (child.pendingContactId) {
        await this.pending.delete(child.pendingContactId).catch(() => void 0);
      }

      const deleted = await tx.invitation.delete({ where: { id } });

      await tx.invitation.update({
        where: { id: parent.id },
        data: {
          maxInvitees: { increment: 1 },
          plusOnes: { set: parent.plusOnes.filter((x) => x !== id) },
        },
      });

      return mapInvitation(deleted);
    });
  }

  async deleteAllPlusOnes(parentId: string): Promise<Invitation[]> {
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
          await this.pending.delete(c.pendingContactId).catch(() => void 0);
        }
        const deleted = await tx.invitation.delete({ where: { id: c.id } });
        fullChildren.push(mapInvitation(deleted));
      }

      await tx.invitation.update({
        where: { id: parentId },
        data: {
          maxInvitees: { increment: children.length },
          plusOnes: { set: [] },
        },
      });
      return fullChildren;
    });
  }

  private ensureIsPlusOne(child: any): void {
    if (!child?.invitedByInvitationId) {
      throw new Error('This invitation is not a Plus-One');
    }
  }
}
