import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Public } from '@omnixys/security';
import { timingSafeEqual } from 'node:crypto';

type PublicAnalyticsReference = { type: 'event'; id: string } | { type: 'invitation'; id: string };

@Public()
@Controller('internal/analytics')
export class AnalyticsTenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('tenant')
  async resolveTenant(
    @Headers('x-internal-token') token: string | undefined,
    @Body() reference: PublicAnalyticsReference,
  ): Promise<{ tenantId: string }> {
    if (!matchesInternalToken(token)) {
      throw new ForbiddenException({
        code: 'INTERNAL_TOKEN_INVALID',
        message: 'A valid internal gateway token is required',
      });
    }

    const eventId =
      reference?.type === 'invitation'
        ? await this.resolveInvitationEvent(reference.id)
        : reference?.type === 'event'
          ? reference.id
          : undefined;
    if (!eventId) {
      throw new NotFoundException({
        code: 'PUBLIC_ANALYTICS_REFERENCE_NOT_FOUND',
        message: 'Public analytics reference was not found',
      });
    }

    const projection = await this.prisma.eventSettingsProjection.findUnique({
      where: { eventId },
      select: { tenantId: true, allowPublicRsvp: true },
    });
    const referenceAllowed =
      reference.type === 'invitation' || projection?.allowPublicRsvp === true;
    if (!projection?.tenantId || !referenceAllowed) {
      throw new NotFoundException({
        code: 'PUBLIC_ANALYTICS_REFERENCE_NOT_FOUND',
        message: 'Public analytics reference was not found',
      });
    }
    return { tenantId: projection.tenantId };
  }

  private async resolveInvitationEvent(invitationId: string): Promise<string | undefined> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { eventId: true },
    });
    return invitation?.eventId;
  }
}

function matchesInternalToken(candidate: string | undefined): boolean {
  if (!candidate) return false;
  const expected = Buffer.from(env.INTERNAL_GATEWAY_TOKEN);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
