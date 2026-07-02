import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import {
  DelayedJob,
  DelayedJobHandler,
  DelayedJobKeys,
  ValkeyLockService,
} from '@omnixys/cache';
import { ContextAccessor } from '@omnixys/context';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';

function currentTenantId(): string {
  const context = ContextAccessor.get();
  return context?.tenant?.tenantId ?? context?.principal?.tenantId ?? 'omnixys';
}

@Injectable()
@DelayedJobHandler()
export class TicketGenerationHandler {
  private readonly logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: KafkaProducerService,
    private readonly lock: ValkeyLockService,
    logger: OmnixysLogger,
  ) {
    this.logger = logger.log(this.constructor.name);
  }

  @DelayedJob(DelayedJobKeys.ticket.generate)
  async generateTicket(payload: {
    invitationId: string;
    eventId: string;
    seatId: string | null;
    actorId: string;
  }): Promise<void> {
    const { invitationId, seatId, actorId } = payload;

    const lockKey = `lock:ticket-generate:${invitationId}`;
    const token = await this.lock.acquireLock(lockKey, 60000);

    if (!token) {
      this.logger.debug('Lock already held for ticket generation', {
        invitationId,
      });
      return;
    }

    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { id: invitationId },
        select: {
          status: true,
          guestProfileId: true,
          pendingContactId: true,
          firstName: true,
          lastName: true,
          eventName: true,
          eventEndsAt: true,
        },
      });

      if (!invitation) {
        this.logger.warn('Invitation not found for delayed ticket generation', {
          invitationId,
        });
        return;
      }

      if (invitation.status !== 'APPROVED') {
        this.logger.debug(
          'Invitation no longer approved – skipping ticket generation',
          {
            invitationId,
            status: invitation.status,
          },
        );
        return;
      }

      if (invitation.guestProfileId) {
        this.logger.debug(
          'Guest profile already exists – ticket was already generated',
          {
            invitationId,
          },
        );
        return;
      }

      if (!invitation.pendingContactId) {
        this.logger.warn(
          'Pending contact missing for delayed ticket generation',
          { invitationId },
        );
        return;
      }

      if (!invitation.firstName || !invitation.lastName) {
        this.logger.warn(
          'Guest name incomplete for delayed ticket generation',
          { invitationId },
        );
        return;
      }

      this.logger.info('Delayed ticket generation firing', { invitationId });

      await this.producer.send({
        topic: KafkaTopics.notification.confirmGuest,
        payload: {
          token: invitation.pendingContactId,
          eventName: invitation.eventName ?? '',
          seatId: seatId ?? undefined,
          eventEndsAt: invitation.eventEndsAt ?? new Date(),
        },
        meta: {
          service: 'invitation-service',
          operation: 'Delayed ticket generation',
          version: '1',
          type: 'EVENT',
          actorId,
          tenantId: currentTenantId(),
        },
      });

      this.logger.info('Delayed ticket generation completed', { invitationId });
    } finally {
      await this.lock.releaseLock(lockKey, token);
    }
  }
}
