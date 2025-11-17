import { LoggerPlusService } from '../../logger/logger-plus.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { InvitationStatus } from '../models/enums/invitation-status.enum.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { mapInvitation } from '../models/mappers/invitation.mapper.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { Injectable } from '@nestjs/common';

// ✔ Deine lokale Trigger-Konstante (NICHT abhängig von Redis)
export const TRIGGER = {
  INVITATION_UPDATED: 'INVITATION_UPDATED',
} as const;

export type Trigger = (typeof TRIGGER)[keyof typeof TRIGGER];

@Injectable()
export class InvitationWriteService extends InvitationBaseService {
  constructor(prisma: PrismaService, logger: LoggerPlusService) {
    super(logger, prisma);
  }

  /**
   * Assigns a guestProfileId to an invitation.
   * (PubSub removed — event publishing handled later in Gateway)
   */
  async addGuestProfileToInvitation(invitationId: string, userId: string): Promise<Invitation> {
    this.logger.debug(`addGuestProfileToInvitation: invitation=${invitationId}, user=${userId}`);

    await this.ensureExists(invitationId);

    const updated = await this.prismaService.invitation.update({
      where: { id: invitationId },
      data: { guestProfileId: userId },
    });

    // ❌ Redis PubSub removed
    //   Wenn du später WebSockets willst → Federation Gateway macht das!

    return mapInvitation(updated);
  }

  /**
   * Sets or removes the guestProfileId on an invitation.
   */
  async setGuestProfileId(
    invitationId: string,
    guestProfileId: string | null,
  ): Promise<Invitation> {
    this.logger.debug(`setGuestProfileId: invitation=${invitationId}, value=${guestProfileId}`);

    await this.ensureExists(invitationId);

    const updated = await this.prismaService.invitation.update({
      where: { id: invitationId },
      data: { guestProfileId },
    });

    return mapInvitation(updated);
  }

  /**
   * Imports many invitations at once.
   */
  async importMany(records: InvitationCreateInput[]): Promise<{ inserted: number }> {
    this.logger.debug(`importMany: count=${records?.length ?? 0}`);

    if (!records?.length) {
      return { inserted: 0 };
    }

    const ops = records.map((r) =>
      this.prismaService.invitation.create({
        data: {
          eventId: r.eventId,
          status: InvitationStatus.PENDING,
          maxInvitees: r.maxInvitees ?? 0,
          invitedByInvitationId: r.invitedByInvitationId ?? null,
        },
      }),
    );

    const result = await this.prismaService.$transaction(ops);

    return { inserted: result.length };
  }
}
