import { LoggerPlusService } from '../../logger/logger-plus.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { mapInvitation } from '../models/mappers/invitation.mapper.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class InvitationReadService extends InvitationBaseService {
  constructor(prismaService: PrismaService, loggerService: LoggerPlusService) {
    super(loggerService, prismaService);
  }

  /**
   * Returns all invitations in the system.
   */
  async findAll(): Promise<Invitation[]> {
    const list = await this.prismaService.invitation.findMany();
    return list.map(mapInvitation);
  }

  /**
   * Returns all invitations for a given eventId.
   * Never throws — returns an empty array if none exist.
   */
  async findByEventId(eventId: string): Promise<Invitation[]> {
    const list = await this.prismaService.invitation.findMany({
      where: { eventId },
    });
    return list.map(mapInvitation);
  }

  /**
   * Returns one invitation by id.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string): Promise<Invitation> {
    const found = await this.prismaService.invitation.findUnique({
      where: { id },
    });

    if (!found) {
      throw new NotFoundException('Invitation not found');
    }

    return found as Invitation;
  }

  /**
   * Returns all invitations that were invited by a specific invitation (invite-chain).
   * Never throws — empty array means no child invitations exist.
   */
  async findAllByInvitedByInvitationId(invitationId: string): Promise<Invitation[]> {
    const list = await this.prismaService.invitation.findMany({
      where: { invitedByInvitationId: invitationId },
    });
    return list.map(mapInvitation);
  }

  async findByUser(userId: string): Promise<Invitation[]> {
    this.logger.debug('Finding invitations for userId=%s', userId);
    const list = await this.prismaService.invitation.findMany({
      where: { guestProfileId: userId },
    });
    return list.map(mapInvitation);
  }
}
