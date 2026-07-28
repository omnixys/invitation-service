/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

import { PrismaService } from '../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import type { EventCreatedDTO, EventUpdatedDTO } from '@omnixys/contracts';
import {
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
  type IKafkaEventContext,
} from '@omnixys/kafka';
import { OmnixysLogger, type ScopedLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';

interface EventSettingsApprovalPayload {
  requireApprovalForPlusOnes?: boolean;
  scheduleTicketRelease?: boolean;
}

@KafkaEventHandler('event')
@Injectable()
export class EventSettingsHandler {
  private readonly logger: ScopedLogger;

  constructor(
    private readonly omnixysLogger: OmnixysLogger,
    private readonly prisma: PrismaService,
  ) {
    this.logger = this.omnixysLogger.log(this.constructor.name);
  }

  @KafkaEvent(KafkaTopics.event.created)
  async handleEventCreated(
    payload: EventCreatedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.created', async () => {
      const {
        eventId,
        name,
        endsAt,
        approvalMode,
        allowPublicRsvp,
        requireApprovalForPlusOnes,
        scheduleTicketRelease,
        rsvpDeadline,
        maxSeats,
        ticketReleaseAt,
      } = payload as EventCreatedDTO & EventSettingsApprovalPayload;

      this.logger.info('event_created_received', { eventId, name });

      try {
        await this.prisma.eventSettingsProjection.upsert({
          where: { eventId },
          create: {
            eventId,
            name,
            endsAt: endsAt ? new Date(endsAt) : null,
            approvalMode,
            allowPublicRsvp,
            requireApprovalForPlusOnes: requireApprovalForPlusOnes ?? true,
            scheduleTicketRelease: scheduleTicketRelease ?? false,
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
            maxSeats,
            ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
          },
          update: {
            name,
            endsAt: endsAt ? new Date(endsAt) : null,
            approvalMode,
            allowPublicRsvp,
            requireApprovalForPlusOnes: requireApprovalForPlusOnes ?? true,
            scheduleTicketRelease: scheduleTicketRelease ?? false,
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
            maxSeats,
            ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
          },
        });
        this.logger.info('event_created_settings_upserted', { eventId });
      } catch (error) {
        this.logger.error('event_created_settings_failed', {
          eventId,
          error,
        });
        throw error;
      }
    });
  }

  @KafkaEvent(KafkaTopics.event.updated)
  async handleEventUpdated(
    payload: EventUpdatedDTO,
    _context: IKafkaEventContext,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] event.updated', async () => {
      const {
        eventId,
        name,
        endsAt,
        approvalMode,
        allowPublicRsvp,
        requireApprovalForPlusOnes,
        scheduleTicketRelease,
        rsvpDeadline,
        maxSeats,
        ticketReleaseAt,
        occurredAt,
      } = payload as EventUpdatedDTO & EventSettingsApprovalPayload;

      this.logger.info('event_updated_received', { eventId, name });

      const existing = await this.prisma.eventSettingsProjection.findUnique({
        where: { eventId },
        select: { updatedAt: true },
      });

      if (
        existing?.updatedAt &&
        new Date(occurredAt).getTime() < existing.updatedAt.getTime()
      ) {
        this.logger.debug('Skipping stale event.updated', { eventId });
        return;
      }

      try {
        await this.prisma.eventSettingsProjection.upsert({
          where: { eventId },
          create: {
            eventId,
            name: name ?? null,
            endsAt: endsAt ? new Date(endsAt) : null,
            approvalMode: approvalMode ?? null,
            allowPublicRsvp: allowPublicRsvp ?? false,
            requireApprovalForPlusOnes: requireApprovalForPlusOnes ?? true,
            scheduleTicketRelease: scheduleTicketRelease ?? false,
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
            maxSeats: maxSeats ?? null,
            ticketReleaseAt: ticketReleaseAt ? new Date(ticketReleaseAt) : null,
          },
          update: {
            name: name ?? undefined,
            endsAt:
              endsAt !== undefined
                ? endsAt
                  ? new Date(endsAt)
                  : null
                : undefined,
            approvalMode: approvalMode ?? undefined,
            allowPublicRsvp: allowPublicRsvp ?? undefined,
            requireApprovalForPlusOnes: requireApprovalForPlusOnes ?? undefined,
            scheduleTicketRelease: scheduleTicketRelease ?? undefined,
            rsvpDeadline:
              rsvpDeadline !== undefined
                ? rsvpDeadline
                  ? new Date(rsvpDeadline)
                  : null
                : undefined,
            maxSeats: maxSeats ?? undefined,
            ticketReleaseAt:
              ticketReleaseAt !== undefined
                ? ticketReleaseAt
                  ? new Date(ticketReleaseAt)
                  : null
                : undefined,
          },
        });
        this.logger.info('event_updated_settings_upserted', { eventId });
      } catch (error) {
        this.logger.error('event_updated_settings_failed', {
          eventId,
          error,
        });
        throw error;
      }
    });
  }
}
