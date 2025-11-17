import { LoggerPlusService } from '../../logger/logger-plus.service.js';
// import { KafkaProducerService } from '../../messaging/kafka-producer.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
// import { withSpan } from '../../trace/utils/span.utils.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { InvitationStatus } from '../models/enums/invitation-status.enum.js';
import { RsvpChoice } from '../models/enums/rsvp-choice.enum.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { InvitationUpdateInput } from '../models/input/update-invitation.input.js';
import { mapInvitation } from '../models/mappers/invitation.mapper.js';
import { InvitationBaseService } from './invitation-base.service.js';
// import { PendingContactService } from './pending-contact.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AdminWriteService extends InvitationBaseService {
  constructor(
    prisma: PrismaService,
    loggerService: LoggerPlusService,
    // private readonly kafka: KafkaProducerService,
    // private readonly pending: PendingContactService,
  ) {
    super(loggerService, prisma);
  }

  /**
   * Creates a new invitation. Guest profile is created later during RSVP/ticket flow.
   */
  async create(input: InvitationCreateInput, eventAdminId?: string): Promise<Invitation> {
    this.logger.debug('create: admin=%s input=%o', eventAdminId, input);

    if (!input.eventId) {
      throw new BadRequestException('eventId is required');
    }
    if (input.maxInvitees !== undefined && input.maxInvitees < 0) {
      throw new BadRequestException('maxInvitees must be >= 0');
    }

    const created = await this.prismaService.invitation.create({
      data: {
        eventId: input.eventId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        invitedByInvitationId: input.invitedByInvitationId ?? null,
        invitedByUserId: eventAdminId ?? null,
        maxInvitees: input.maxInvitees ?? 0,
        status: InvitationStatus.PENDING,
      },
    });

    return created as Invitation;
  }

  /**
   * Approves or unapproves an invitation. Only allowed for admins.
   * Approval creates the guest profile if missing and sends a Kafka event.
   */
  async approve(id: string, approve: boolean, eventAdminId?: string): Promise<Invitation> {
    // return withSpan(this.tracer, this.logger, 'invitation.approve', async (span) => {
    this.logger.debug('approve: input=%o', { id, approve });

    const invitation = await this.ensureExists(id);

    // Enforce that guest must have RSVPed before approval
    if (!invitation.rsvpChoice) {
      this.logger.error('Guest has not submitted an RSVP yet.');
      throw new BadRequestException('RSVP required before approval.');
    }

    const updated = await this.prismaService.invitation.update({
      where: { id },
      data: {
        approved: approve,
        approvedByUserId: eventAdminId ?? null,
        approvedAt: new Date(),
        status: InvitationStatus.APPROVED,
      },
    });

    // Fire Kafka event only if newly approved
    if (approve) {
      this.logger.debug('Invite approved');

      if (!updated.guestProfileId) {
        // GuestProfile is created by another service → send event
        if (!updated.firstName || !updated.lastName) {
          throw new Error('Missing firstName or lastName for profile creation.');
        }

        // const sc = span.spanContext();

        // void this.kafka.approved(
        //   {
        //     invitationId: id,
        //     firstName: updated.firstName,
        //     lastName: updated.lastName,
        //     pendingContactId: updated.pendingContactId ?? null,
        //   },
        //   'invitation.write-service',
        //   { traceId: sc.traceId, spanId: sc.spanId },
        // );
      } else {
        this.logger.debug('Guest profile already exists – skip Kafka event.');
      }
    } else {
      this.logger.debug('Approval revoked by admin');
    }

    return mapInvitation(updated);
    // });
  }

  /**
   * Updates RSVP, maxInvitees or approval.
   * This is a catch-all mutation for both guests and admins.
   */
  async update(id: string, input: InvitationUpdateInput): Promise<Invitation> {
    const invitation = await this.ensureExists(id);

    const data: Record<string, unknown> = {};

    // Guest RSVP update ---------------------------------------
    if (typeof input.rsvpChoice !== 'undefined') {
      data.rsvpChoice = input.rsvpChoice;

      if (input.rsvpChoice === RsvpChoice.YES) {
        data.status = InvitationStatus.ACCEPTED;
      } else if (input.rsvpChoice === RsvpChoice.NO) {
        data.status = InvitationStatus.DECLINED;
      } else if (input.rsvpChoice === RsvpChoice.MAYBE) {
        data.status = InvitationStatus.PENDING;
      }
    }

    // Admin maxInvitees update --------------------------------
    if (typeof input.maxInvitees === 'number') {
      if (input.maxInvitees < 0) {
        throw new BadRequestException('maxInvitees must be >= 0');
      }
      data.maxInvitees = input.maxInvitees;
    }

    // Admin approval update -----------------------------------
    if (typeof input.approved === 'boolean') {
      data.approved = input.approved;
      data.approvedByUserId = invitation.approvedByUserId;
      data.approvedAt = new Date();
    }

    const updated = await this.prismaService.invitation.update({
      where: { id },
      data,
    });

    return mapInvitation(updated);
  }

  /**
   * Deletes an invitation after rejecting it (cleanup PII + revoke approval).
   */
  async delete(id: string, eventAdminId: string): Promise<boolean> {
    await this.ensureExists(id);
    await this.reject(id, eventAdminId);
    await this.prismaService.invitation.delete({ where: { id } });
    return true;
  }

  /**
   * Rejects an invitation. Removes pending PII and sends Kafka event.
   */
  async reject(invitationId: string, eventAdminId: string): Promise<Invitation> {
    // return withSpan(this.tracer, this.logger, 'invitation.reject', async (span) => {
    const inv = await this.prismaService.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!inv) {
      throw new NotFoundException('Invitation not found');
    }

    // // Delete ephemeral PII from Redis
    // if (inv.pendingContactId) {
    //   await this.pending.del(inv.pendingContactId).catch(() => void 0);
    // }

    const updated = await this.prismaService.invitation.update({
      where: { id: invitationId },
      data: {
        pendingContactId: null,
        status: InvitationStatus.REJECTED,
        approved: false,
        approvedByUserId: eventAdminId,
        approvedAt: new Date(),
      },
    });

    // const sc = span.spanContext();

    // await this.kafka.rejectRsvp(
    //   {
    //     key: updated.id,
    //     value: {
    //       invitationId: updated.id,
    //       eventId: updated.eventId,
    //       approvedByUserId: eventAdminId,
    //       approvedAt: updated.approvedAt?.toISOString(),
    //     },
    //   },
    //   'invitation.admin-service',
    //   { traceId: sc.traceId, spanId: sc.spanId },
    // );

    return mapInvitation(updated);
    // });
  }
}
