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
  IKafkaEventHandler,
  KafkaEvent,
  KafkaEventHandler,
  KafkaTopics,
} from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import {
  AddGuestIdToInvitationDTO,
  AddGuestIdToInvitationMessageDTO,
} from '@omnixys/shared';

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
export class TicketHandler implements IKafkaEventHandler {
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

  /**
   * Handles incoming Kafka user events and executes the appropriate useristrative command.
   *
   * @param topic - The Kafka topic representing the user command (e.g. shutdown, restart).
   * @param data - The payload associated with the Kafka message.
   * @param context - The Kafka context metadata containing headers and partition info.
   *
   * @returns A Promise that resolves once the command has been processed.
   */
  @KafkaEvent(KafkaTopics.invitation.addGuestId)
  async handle(
    topic: string,
    data: AddGuestIdToInvitationMessageDTO,
    context: IKafkaEventContext,
  ): Promise<void> {
    this.logger.warn(`User command received: ${topic}`);
    this.logger.debug('Kafka context: %o', context);

    switch (topic) {
      case KafkaTopics.invitation.addGuestId:
        await this.addGuestId(data.payload);
        break;

      default:
        this.logger.warn(`Unknown ticket topic: ${topic}`);
    }
  }

  private async addGuestId(payload: AddGuestIdToInvitationDTO): Promise<void> {
    this.logger.debug(`AuthenticationHandler: addGuestId= %o`, payload);
    void this.invitationWriteService.addGuestId(payload);
  }
}
