import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { LoaderFactory } from '../utils/loader.factory.js';
import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { PhoneNumberPayload } from '@omnixys/graphql';

@Resolver(() => InvitationPayload)
export class InvitationFieldResolver {
  constructor(private readonly loaderFactory: LoaderFactory) {}

  @ResolveField(() => [PhoneNumberPayload])
  async phoneNumbers(
    @Parent() invitation: InvitationPayload,
  ): Promise<PhoneNumberPayload[]> {
    return this.loaderFactory.phoneNumberLoader.load(invitation.id);
  }

  @ResolveField(() => [InvitationPayload])
  async plusOnes(
    @Parent() parent: InvitationPayload,
  ): Promise<InvitationPayload[]> {
    return this.loaderFactory.plusOnesLoader.load(parent.id);
  }
}
