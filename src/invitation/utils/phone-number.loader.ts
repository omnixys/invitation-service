// src/modules/invitation/loaders/phone-number.loader.ts

import { PrismaService } from '../../prisma/prisma.service.js';
import { PhoneNumberMapper } from '../models/mappers/phone-number.mapper.js';
import { Injectable } from '@nestjs/common';
import { PhoneNumberPayload } from '@omnixys/graphql';
import DataLoader from 'dataloader';

@Injectable()
export class PhoneNumberLoader {
  constructor(private readonly prisma: PrismaService) {}

  createLoader(): DataLoader<string, PhoneNumberPayload[]> {
    return new DataLoader<string, PhoneNumberPayload[]>(async (ids) =>
      this.batch(ids),
    );
  }

  private async batch(ids: readonly string[]): Promise<PhoneNumberPayload[][]> {
    const rows = await this.prisma.phoneNumber.findMany({
      where: {
        invitationId: { in: [...ids] },
      },
    });

    const map = new Map<string, PhoneNumberPayload[]>();

    // Initialize empty arrays (important for stable ordering)
    for (const id of ids) {
      map.set(id, []);
    }

    for (const row of rows) {
      const mapped = PhoneNumberMapper.toPayload(row);
      map.get(row.invitationId)?.push(mapped);
    }

    return ids.map((id) => map.get(id)!);
  }
}
