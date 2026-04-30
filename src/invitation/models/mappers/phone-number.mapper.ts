import type { PhoneNumber } from '../../../prisma/generated/client.js';
import type { PhoneNumberPayload } from '@omnixys/graphql';
import type { PhoneNumberType } from '@omnixys/shared';

export class PhoneNumberMapper {
  static toPayload(entity: PhoneNumber): PhoneNumberPayload {
    return {
      id: entity.id,
      number: entity.number,
      type: entity.type as PhoneNumberType,
      infoId: entity.invitationId, // naming bewusst gleichgezogen
      label: entity.label ?? undefined,
      isPrimary: entity.isPrimary,
      countryCode: entity.countryCode,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toPayloadList(list: PhoneNumber[]): PhoneNumberPayload[] {
    return list.map((x) => this.toPayload(x));
  }
}
