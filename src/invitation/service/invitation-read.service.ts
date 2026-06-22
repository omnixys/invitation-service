import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationNotFoundException } from '../errors/invitation-domain.error.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { Injectable } from '@nestjs/common';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';

@Injectable()
export class InvitationReadService extends InvitationBaseService {
  constructor(prismaService: PrismaService, loggerService: OmnixysLogger) {
    super(loggerService, prismaService);
  }

  /**
   * Returns all invitations in the system.
   */
  async findAll(): Promise<InvitationPayload[]> {
    const list = await this.prismaService.invitation.findMany();
    return InvitationMapper.toPayloadList(list);
  }

  /**
   * Returns all invitations for a given eventId.
   * Never throws — returns an empty array if none exist.
   */
  async findByEventId(eventId: string): Promise<InvitationPayload[]> {
    const list = await this.prismaService.invitation.findMany({
      where: { eventId },
    });
    return InvitationMapper.toPayloadList(list);
  }

  async findFullByEventIds(eventIds: string[]): Promise<InvitationPayload[]> {
    return TraceRunner.run('[SERVICE] findFullByEventIds', async () => {
      this.logger.debug('findFullByEventIds: eventIds=%o', eventIds);
      const list = await this.prismaService.invitation.findMany({
        where: {
          eventId: {
            in: eventIds,
          },
        },
      });
      return InvitationMapper.toPayloadList(list);
    });
  }

  /**
   * Returns one invitation by id.
   * Throws NotFoundException if not found.
   */
  async findOne(id: string): Promise<InvitationPayload> {
    this.logger.debug('Finding invitation for InvitationId=%s', id);

    const found = await this.prismaService.invitation.findUnique({
      where: { id },
    });

    if (!found) {
      this.logger.error('Invitation not found: %s', id);
      throw new InvitationNotFoundException(id);
    }

    this.logger.debug('Invitation found: InvitationId=%s', id);

    return InvitationMapper.toPayload(found);
  }

  /**
   * Returns all invitations that were invited by a specific invitation (invite-chain).
   * Never throws — empty array means no child invitations exist.
   */
  async findAllByInvitedByInvitationId(invitationId: string): Promise<InvitationPayload[]> {
    const list = await this.prismaService.invitation.findMany({
      where: { invitedByInvitationId: invitationId },
    });
    return InvitationMapper.toPayloadList(list);
  }

  async findByUser(userId: string): Promise<InvitationPayload[]> {
    return TraceRunner.run('[SERVICE] findByUser Event Invitation', async () => {
      this.logger.debug('Finding invitations for userId=%s', userId);
      const list = await this.prismaService.invitation.findMany({
        where: { guestProfileId: userId },
      });
      return InvitationMapper.toPayloadList(list);
    });
  }

  async findPlusOnesByInvitation(invitationId: string): Promise<InvitationPayload[]> {
    this.logger.debug('Finding invitations for InvitationId=%s', invitationId);
    const list = await this.prismaService.invitation.findMany({
      where: { invitedByInvitationId: invitationId },
    });

    return InvitationMapper.toPayloadList(list);
  }
}
