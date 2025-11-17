// TODO Disaprove
import {
  CurrentUser,
  CurrentUserData,
} from '../../auth/decorators/current-user.decorator.js';
import { CookieAuthGuard } from '../../auth/guards/cookie-auth.guard.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { RSVPInput } from '../models/input/rsvp.input.js';
import {
  // CreatePlusOneInput,
  GuestWriteService,
} from '../service/guest-write.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

@Resolver(() => Invitation)
export class GuestMutationResolver {
  constructor(private readonly guestService: GuestWriteService) {}

  // @UseGuards(CookieAuthGuard)
  // @Mutation(() => Invitation)
  // async createPlusOnesInvitation(
  //   @Args('input')
  //   input: CreatePlusOneInput,
  //   @CurrentUser() user: CurrentUserData,
  // ): Promise<Invitation> {
  //   return this.guestService.createPlusOne(input, user.id);
  // }

  @Mutation(() => Invitation)
  async replyInvitation(
    @Args('input', {
      type: () => RSVPInput,
    })
    input: RSVPInput,
  ): Promise<Invitation> {
    return this.guestService.reply(input);
  }

  // 🔻 NEU: Einzelnes Plus-One löschen (gibt 1 Slot an Parent zurück)
  @Mutation(() => Invitation)
  @UseGuards(CookieAuthGuard)
  async removePlusOneInvitation(
    @Args('id', {
      type: () => ID,
    })
    id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<Invitation> {
    console.log(user.username);
    return this.guestService.deletePlusOne(id);
  }

  // 🔻 NEU: Alle Plus-Ones einer Parent-Einladung löschen (gibt alle Slots zurück)
  @Mutation(() => [Invitation])
  async removeAllPlusOnesByInvitationId(
    @Args('invitedByInvitationId', {
      type: () => ID,
    })
    invitedByInvitationId: string,
  ): Promise<Invitation[]> {
    return this.guestService.deleteAllPlusOnes(invitedByInvitationId);
  }
}
