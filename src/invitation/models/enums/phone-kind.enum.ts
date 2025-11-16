import { registerEnumType } from '@nestjs/graphql';

export enum PhoneKind {
  PRIVATE = 'PRIVATE',
  WORK = 'WORK',
  WHATSAPP = 'WHATSAPP',
  OTHER = 'OTHER',
}
registerEnumType(PhoneKind, { name: 'PhoneKind' });
