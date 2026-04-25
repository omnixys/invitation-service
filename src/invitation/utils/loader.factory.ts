import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationLoader } from './invitation.loader.js';
import { PhoneNumberLoader } from './phone-number.loader.js';
import { Injectable, Scope } from '@nestjs/common';
import { PhoneNumberPayload } from '@omnixys/graphql';
import DataLoader from 'dataloader';

@Injectable({ scope: Scope.REQUEST })
export class LoaderFactory {
  public readonly phoneNumberLoader: DataLoader<string, PhoneNumberPayload[]>;
  public readonly plusOnesLoader: DataLoader<string, InvitationPayload[]>;

  constructor(private readonly prisma: PrismaService) {
    this.phoneNumberLoader = new PhoneNumberLoader(this.prisma).createLoader();
    this.plusOnesLoader = new InvitationLoader(this.prisma).createLoader();
  }
}
