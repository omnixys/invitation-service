import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';

@Injectable()
export class InvitationLoader {
  constructor(private readonly prisma: PrismaService) {}

  createLoader(): DataLoader<string, InvitationPayload[]> {
    return new DataLoader<string, InvitationPayload[]>(async (ids) =>
      this.batch(ids),
    );
  }

  private async batch(ids: readonly string[]): Promise<InvitationPayload[][]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        invitedByInvitationId: { in: [...ids] },
      },
    });

    const map = new Map<string, InvitationPayload[]>();

    // Initialize empty arrays (important for stable ordering)
    for (const id of ids) {
      map.set(id, []);
    }

    for (const row of rows) {
      const mapped = InvitationMapper.toPayload(row);
      map.get(row.invitedByInvitationId!)?.push(mapped);
    }

    return ids.map((id) => map.get(id)!);
  }
}
