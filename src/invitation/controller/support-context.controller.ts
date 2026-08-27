import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Public } from '@omnixys/security-ts';
import { timingSafeEqual } from 'node:crypto';

const { INTERNAL_GATEWAY_TOKEN } = env;

const INVALID_SUPPORT_STATUSES = new Set(['DECLINED', 'CANCELED', 'REJECTED']);

export interface SupportContextPayload {
  invitationId: string;
  eventId: string;
  guestName: string;
  guestContact: string | null;
}

@Public()
@Controller('internal/rsvp-support')
export class SupportContextController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('context')
  async supportContext(
    @Headers('x-internal-token') token: string | undefined,
    @Query('invitationId') invitationId: string | undefined,
  ): Promise<SupportContextPayload> {
    if (!matchesInternalToken(token)) {
      throw new ForbiddenException({
        code: 'INTERNAL_TOKEN_INVALID',
        message: 'A valid internal gateway token is required',
      });
    }

    if (!invitationId) {
      throw new UnprocessableEntityException({
        code: 'SUPPORT_CONTEXT_INVALID',
        message: 'invitationId is required',
      });
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        eventId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        status: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: 'SUPPORT_CONTEXT_INVITATION_NOT_FOUND',
        message: 'Invitation was not found',
      });
    }

    if (INVALID_SUPPORT_STATUSES.has(invitation.status)) {
      throw new UnprocessableEntityException({
        code: 'SUPPORT_CONTEXT_INVITATION_INVALID',
        message: 'Invitation is not valid for support',
      });
    }

    const guestName = `${invitation.firstName ?? ''} ${invitation.lastName ?? ''}`.trim();
    const guestContact = invitation.phoneNumber ?? invitation.email ?? null;

    return {
      invitationId: invitation.id,
      eventId: invitation.eventId,
      guestName,
      guestContact,
    };
  }
}

function matchesInternalToken(candidate: string | undefined): boolean {
  if (!candidate) {
    return false;
  }
  const expected = Buffer.from(INTERNAL_GATEWAY_TOKEN);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
