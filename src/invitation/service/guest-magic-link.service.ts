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
  firstName?: string | null;
  lastName?: string | null;
  invitedByInvitationId?: string | null;
  updatedAt?: Date | string | null;
}

interface GuestMagicLinkRequest {
  identifier: string;
  firstName?: string;
  lastName?: string;
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

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function fullName(match: Pick<ContactMatch, 'firstName' | 'lastName'>): string {
  return `${normalizeNamePart(match.firstName)} ${normalizeNamePart(match.lastName)}`;
}

/**
 * Deterministically picks a single eligible invitation for dispatch.
 *
 * Priority ladder:
 * 1. If a full name was provided: keep only matches with the exact normalized full name.
 *    If none match, the identifier cannot be safely scoped → null (AMBIGUOUS).
 * 2. A single candidate wins.
 * 3. Prefer root invitations (invitedByInvitationId IS NULL) over plus-one children.
 * 4. If multiple roots remain with a matching full name, the requester is the same
 *    person across events → newest updatedAt wins (deterministic).
 * 5. Anything else (no name, multiple roots) → null (AMBIGUOUS, fail closed).
 */
function resolveEligibleMatch(
  candidates: ContactMatch[],
  name?: { firstName?: string; lastName?: string },
): ContactMatch | null {
  if (!candidates.length) {
    return null;
  }

  let subset = candidates;

  const firstName = name?.firstName?.trim();
  const lastName = name?.lastName?.trim();
  if (firstName && lastName) {
    const provided = `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`;
    subset = candidates.filter((candidate) => fullName(candidate) === provided);
    if (!subset.length) {
      return null;
    }
  }

  if (subset.length === 1) {
    return subset[0] ?? null;
  }

  const roots = subset.filter((candidate) => !candidate.invitedByInvitationId);
  if (roots.length === 1) {
    return roots[0] ?? null;
  }

  if (firstName && lastName && roots.length > 1) {
    const sorted = [...roots].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    );
    const newest = sorted[0] ?? null;
    const second = sorted[1] ?? null;
    if (
      newest &&
      second &&
      new Date(newest.updatedAt ?? 0).getTime() !== new Date(second.updatedAt ?? 0).getTime()
    ) {
      return newest;
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

  async request(input: GuestMagicLinkRequest, client: ClientContext): Promise<void> {
    const context = ContextAccessor.get();
    const correlationId = context?.correlationId ?? context?.requestId ?? randomUUID();
    const normalized = normalizeIdentifier(input.identifier);
    const fingerprint = this.fingerprint(normalized?.value ?? input.identifier.trim());

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
      if (matches.length === 0) {
        this.record('NO_MATCH', correlationId, fingerprint, normalized.channel);
        return;
      }

      const eligible = matches.filter(
        (match) =>
          ELIGIBLE_STATUSES.has(match.status) &&
          !!match.eventEndsAt &&
          new Date(match.eventEndsAt).getTime() > Date.now() &&
          match.guestProfileId,
      );
      if (eligible.length === 0) {
        this.record(this.ineligibleReason(matches), correlationId, fingerprint, normalized.channel);
        return;
      }

      const chosen = resolveEligibleMatch(eligible, {
        firstName: input.firstName,
        lastName: input.lastName,
      });
      if (!chosen?.guestProfileId) {
        this.record('AMBIGUOUS', correlationId, fingerprint, normalized.channel);
        return;
      }

      const payload: GuestMagicLinkRequestDTO = {
        userId: chosen.guestProfileId,
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
               COALESCE(i.event_ends_at, esp.ends_at) AS "eventEndsAt",
               i.first_name AS "firstName", i.last_name AS "lastName",
               i.invited_by_invitation_id::text AS "invitedByInvitationId",
               i.updated_at AS "updatedAt"
        FROM invitation i
        INNER JOIN event_settings_projection esp ON esp.event_id = i.event_id
        WHERE esp.tenant_id = ${tenantId}::uuid AND lower(i.email) = ${identifier.value}
      `;
    }
    const digits = identifier.value.slice(1);
    return this.prisma.$queryRaw<ContactMatch[]>`
      SELECT i.guest_profile_id AS "guestProfileId", i.status::text AS status,
             COALESCE(i.event_ends_at, esp.ends_at) AS "eventEndsAt",
             i.first_name AS "firstName", i.last_name AS "lastName",
             i.invited_by_invitation_id::text AS "invitedByInvitationId",
             i.updated_at AS "updatedAt"
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
