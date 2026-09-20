import { env } from '../../config/env.js';
import { EventAccessGrantException } from '../errors/invitation-domain.error.js';
import { Injectable } from '@nestjs/common';
import { TraceRunner } from '@omnixys/observability-ts';

const { EVENT_INTERNAL_URI, INTERNAL_GATEWAY_TOKEN } = env;

export interface GrantGuestEventAccessInput {
  eventId: string;
  userId: string;
  actorId: string;
}

/**
 * Client for the event service's internal guest-access grant endpoint.
 *
 * The role is always GUEST and is fixed server-side by the event service;
 * the invitation service only forwards the trusted admission context
 * (`eventId`, `userId`, `actorId`) after an invitation was approved.
 *
 * @category Client
 * @since 1.0.0
 */
@Injectable()
export class EventAccessClient {
  async grantGuestAccess(input: GrantGuestEventAccessInput): Promise<void> {
    return TraceRunner.run('[CLIENT] grantGuestAccess', async () => {
      const url = new URL(
        '/internal/event-access/grant',
        new URL(EVENT_INTERNAL_URI).origin,
      );

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-token': INTERNAL_GATEWAY_TOKEN,
          },
          body: JSON.stringify(input),
        });
      } catch (cause) {
        throw new EventAccessGrantException(
          {
            eventId: input.eventId,
            userId: input.userId,
            actorId: input.actorId,
            dependency: 'event',
          },
          cause,
        );
      }

      if (!response.ok) {
        throw new EventAccessGrantException({
          eventId: input.eventId,
          userId: input.userId,
          actorId: input.actorId,
          dependency: 'event',
          status: response.status,
        });
      }
    });
  }
}
