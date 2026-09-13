import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GuestMagicLinkMetricsService } from '../metrics/guest-magic-link.metrics.service.js';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ContextAccessor, type ClientContext } from '@omnixys/context-ts';
import type { GuestMagicLinkChannel, GuestMagicLinkRequestDTO } from '@omnixys/contracts-ts';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka-ts';
import { OmnixysLogger } from '@omnixys/logger-ts';
import type { RateLimitStore } from '@omnixys/security-ts';
import { createHmac, randomUUID } from 'node:crypto';

type InternalResult =
  | 'DISPATCH_QUEUED'
  | 'INVALID_IDENTIFIER'
  | 'NO_MATCH'
  | 'AMBIGUOUS'
  | 'INELIGIBLE_STATUS'
  | 'EVENT_EXPIRED'
  | 'MISSING_GUEST_PROFILE'
  | 'RATE_LIMITED'
  | 'INTERNAL_FAILURE';

interface ContactMatch {
  guestProfileId: string | null;
  status: string;
  eventEndsAt: Date | null;
}

interface NormalizedIdentifier {
  channel: GuestMagicLinkChannel;
  value: string;
}

const ELIGIBLE_STATUSES = new Set(['APPROVED', 'ACCEPTED']);

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_PER_WINDOW = 10;

function normalizeIdentifier(raw: string): NormalizedIdentifier | null {
  const value = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { channel: 'EMAIL', value: value.toLowerCase() };
  }
  if (value.startsWith('+')) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return { channel: 'WHATSAPP', value: `+${digits}` };
    }
  }
  return null;
}

@Injectable()
export class GuestMagicLinkService {
  private readonly logger;

  constructor(
    loggerService: OmnixysLogger,
    private readonly prisma: PrismaService,
    private readonly producer: KafkaProducerService,
    @Optional() private readonly metricsService?: GuestMagicLinkMetricsService,
    @Optional()
    @Inject('RATE_LIMIT_STORE')
    private readonly rateLimitStore?: RateLimitStore,
  ) {
    this.logger = loggerService.log('service:invitation', this.constructor.name);
  }

  async request(identifier: string, client: ClientContext): Promise<void> {
    const context = ContextAccessor.get();
    const correlationId = context?.correlationId ?? context?.requestId ?? randomUUID();
    const normalized = normalizeIdentifier(identifier);
    const fingerprint = this.fingerprint(normalized?.value ?? identifier.trim());

    if (await this.isRateLimited(client.ip)) {
      this.record('RATE_LIMITED', correlationId, fingerprint, normalized?.channel);
      return;
    }

    if (!normalized) {
      this.record('INVALID_IDENTIFIER', correlationId, fingerprint);
      return;
    }

    try {
      const tenantId =
        context?.tenant?.tenantId ?? context?.principal?.tenantId ?? env.DEFAULT_TENANT_ID;
      if (!tenantId) {
        this.record('INTERNAL_FAILURE', correlationId, fingerprint, normalized.channel);
        return;
      }

      const matches = await this.findMatches(normalized, tenantId);
      if (matches.length > 1) {
        this.record('AMBIGUOUS', correlationId, fingerprint, normalized.channel);
        return;
      }
      const eligible = matches.filter(
        (match) =>
          ELIGIBLE_STATUSES.has(match.status) &&
          !!match.eventEndsAt &&
          new Date(match.eventEndsAt).getTime() > Date.now() &&
          match.guestProfileId,
      );
      const guestIds = [...new Set(eligible.map((match) => match.guestProfileId as string))];

      if (matches.length === 0) {
        this.record('NO_MATCH', correlationId, fingerprint, normalized.channel);
        return;
      }
      if (guestIds.length === 0) {
        this.record(this.ineligibleReason(matches), correlationId, fingerprint, normalized.channel);
        return;
      }

      const payload: GuestMagicLinkRequestDTO = {
        userId: guestIds[0]!,
        tenantId,
        recipient: normalized.value,
        channel: normalized.channel,
        locale: client.locale,
        device: client.device,
        ...(client.ip ? { ip: client.ip } : {}),
        location: client.location,
        correlationId,
        ...(context?.trace?.traceId ? { traceId: context.trace.traceId } : {}),
      };
      await this.producer.send({
        topic: KafkaTopics.authentication.requestGuestMagicLink,
        payload,
        meta: {
          service: 'invitation-service',
          operation: 'request guest magic link',
          version: '1',
          type: 'EVENT',
          tenantId,
        },
      });
      this.record('DISPATCH_QUEUED', correlationId, fingerprint, normalized.channel);
    } catch {
      this.record('INTERNAL_FAILURE', correlationId, fingerprint, normalized.channel);
    }
  }

  private async findMatches(
    identifier: NormalizedIdentifier,
    tenantId: string,
  ): Promise<ContactMatch[]> {
    if (identifier.channel === 'EMAIL') {
      return this.prisma.$queryRaw<ContactMatch[]>`
        SELECT i.guest_profile_id AS "guestProfileId", i.status::text AS status,
               COALESCE(i.event_ends_at, esp.ends_at) AS "eventEndsAt"
        FROM invitation i
        INNER JOIN event_settings_projection esp ON esp.event_id = i.event_id
        WHERE esp.tenant_id = ${tenantId}::uuid AND lower(i.email) = ${identifier.value}
      `;
    }
    const digits = identifier.value.slice(1);
    return this.prisma.$queryRaw<ContactMatch[]>`
      SELECT i.guest_profile_id AS "guestProfileId", i.status::text AS status,
             COALESCE(i.event_ends_at, esp.ends_at) AS "eventEndsAt"
      FROM invitation i
      INNER JOIN event_settings_projection esp ON esp.event_id = i.event_id
      WHERE esp.tenant_id = ${tenantId}::uuid
        AND (
          regexp_replace(COALESCE(i.phone_number, ''), '[^0-9]', '', 'g') = ${digits}
          OR EXISTS (
            SELECT 1 FROM phone_number p
            WHERE p.invitation_id = i.id
              AND regexp_replace(p.country_code || p.number, '[^0-9]', '', 'g') = ${digits}
          )
        )
    `;
  }

  private ineligibleReason(matches: ContactMatch[]): InternalResult {
    if (matches.some((match) => !ELIGIBLE_STATUSES.has(match.status))) {
      return 'INELIGIBLE_STATUS';
    }
    if (matches.some((match) => !match.guestProfileId)) {
      return 'MISSING_GUEST_PROFILE';
    }
    if (
      matches.some(
        (match) => !match.eventEndsAt || new Date(match.eventEndsAt).getTime() <= Date.now(),
      )
    ) {
      return 'EVENT_EXPIRED';
    }
    return 'INTERNAL_FAILURE';
  }

  private fingerprint(identifier: string): string {
    return createHmac('sha256', env.ENCRYPTION_KEY)
      .update('guest-magic-link\0')
      .update(identifier)
      .digest('hex');
  }

  private async isRateLimited(ip: string | undefined): Promise<boolean> {
    if (!ip || !this.rateLimitStore) {
      return false;
    }

    const key = `guest-magic-link:ip:${ip}`;
    const count = await this.rateLimitStore.incr(key);
    if (count === 1) {
      await this.rateLimitStore.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }
    return count > RATE_LIMIT_MAX_PER_WINDOW;
  }

  private record(
    result: InternalResult,
    correlationId: string,
    identifierFingerprint: string,
    channel?: GuestMagicLinkChannel,
  ): void {
    this.metricsService?.record(result, channel);
    this.logger.info('guest_magic_link_request: %o', {
      result,
      correlationId,
      identifierFingerprint,
      ...(channel ? { channel } : {}),
    });
  }
}
