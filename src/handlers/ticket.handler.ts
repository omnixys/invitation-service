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

import { Injectable } from '@nestjs/common';

import { InvitationWriteService } from '../invitation/service/invitation-write.service.js';
import {
  IKafkaEventContext,
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
} from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import { AddGuestIdToInvitationDTO } from '@omnixys/shared';

/**
 * Kafka event handler responsible for useristrative commands such as
 * shutdown and restart. It listens for specific user-related topics
 * and delegates the actual process control logic to the {@link UserService}.
 *
 * @category Messaging
 * @since 1.0.0
 */
@KafkaEventHandler('ticket')
@Injectable()
export class TicketHandler {
  private readonly logger;

  /**
   * Creates a new instance of {@link UserHandler}.
   *
   * @param loggerService - The central logger service used for structured logging.
   * @param userService - The service responsible for handling system-level user operations.
   */
  constructor(
    loggerService: OmnixysLogger,
    private readonly invitationWriteService: InvitationWriteService,
  ) {
    this.logger = loggerService.log(this.constructor.name);
  }

  @KafkaEvent(KafkaTopics.invitation.addGuestId)
  async handleAddGuestId(
    payload: AddGuestIdToInvitationDTO,
    _context: IKafkaEventContext,
  ) {
    return TraceRunner.run('[HANDLER] addGuestId', async () => {
      this.logger.debug(`AuthenticationHandler: addGuestId= %o`, payload);
      void this.invitationWriteService.addGuestId(payload);
    });
  }
}
