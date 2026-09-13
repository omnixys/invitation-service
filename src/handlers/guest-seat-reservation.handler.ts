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

import { GuestConfirmationService } from '../invitation/service/guest-confirmation.service.js';
import {
  SEAT_RESERVATION_FAILED_TOPIC,
  SEAT_RESERVED_TOPIC,
  type SeatReservationFailedDTO,
  type SeatReservedDTO,
} from '../invitation/service/guest-seat-reservation.js';
import { Injectable } from '@nestjs/common';
import { KafkaEvent, KafkaEventHandler } from '@omnixys/kafka-ts';
import { OmnixysLogger, type ScopedLogger } from '@omnixys/logger-ts';
import { TraceRunner } from '@omnixys/observability-ts';

/**
 * Consumes the Seat service's reservation acknowledgement for a guest
 * invitation. A confirmation is only sent to the guest once a seat has been
 * reserved, which guarantees the invitation → seat → ticket → link chain:
 * no confirmation link exists without a seatable ticket.
 */
@KafkaEventHandler('seat')
@Injectable()
export class GuestSeatReservationHandler {
  private readonly logger: ScopedLogger;

  constructor(
    loggerService: OmnixysLogger,
    private readonly guestConfirmation: GuestConfirmationService,
  ) {
    this.logger = loggerService.log(
      'service:invitation',
      this.constructor.name,
    );
  }

  @KafkaEvent(SEAT_RESERVED_TOPIC)
  async handleReserved(payload: SeatReservedDTO): Promise<void> {
    return TraceRunner.run('[HANDLER] seatReserved', async () => {
      this.logger.debug(
        'Seat reserved for invitation: invitationId=%s seatId=%s',
        payload.invitationId,
        payload.seatId,
      );

      await this.guestConfirmation.sendFirstConfirmation({
        invitationId: payload.invitationId,
        seatId: payload.seatId,
        actorId: payload.actorId,
      });
    });
  }

  @KafkaEvent(SEAT_RESERVATION_FAILED_TOPIC)
  async handleReservationFailed(
    payload: SeatReservationFailedDTO,
  ): Promise<void> {
    return TraceRunner.run('[HANDLER] seatReservationFailed', async () => {
      this.logger.warn(
        'Seat reservation failed, confirmation postponed until a seat is free: invitationId=%s eventId=%s',
        payload.invitationId,
        payload.eventId,
      );
    });
  }
}
