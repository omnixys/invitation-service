import { CreatePlusOneInput } from '../models/input/plus-one.input.js';
import { PublicRsvpInput } from '../models/input/public-rsvp.input.js';
import { RSVPInput } from '../models/input/rsvp.input.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import {
  // CreatePlusOneInput,
  GuestWriteService,
} from '../service/guest-write.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { ClientInfo } from '@omnixys/context';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';
import { ClientContext } from '@omnixys/shared';

@Resolver(() => InvitationPayload)
export class GuestMutationResolver {
  private readonly logger;
  constructor(
    private readonly loggerService: OmnixysLogger,
    private readonly guestService: GuestWriteService,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => InvitationPayload)
  async createPlusOnesInvitation(
    @Args('input')
    input: CreatePlusOneInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPayload> {
    return this.guestService.createPlusOne(input, user.id);
  }

  @Mutation(() => InvitationPayload)
  async replyInvitation(
    @Args('input', {
      type: () => RSVPInput,
    })
    input: RSVPInput,
    @ClientInfo() clientInfo: ClientContext,
  ): Promise<InvitationPayload> {
    return TraceRunner.run('[RESOLVER] approve', async () => {
      return this.guestService.reply(input,clientInfo);
    });
  }

  // 🔻 NEU: Einzelnes Plus-One löschen (gibt 1 Slot an Parent zurück)
  @Mutation(() => InvitationPayload)
  @UseGuards(CookieAuthGuard)
  async removePlusOneInvitation(
    @Args('id', {
      type: () => ID,
    })
    id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPayload> {
    console.debug(user.username);
    return this.guestService.deletePlusOne(id);
  }

  // 🔻 NEU: Alle Plus-Ones einer Parent-Einladung löschen (gibt alle Slots zurück)
  @Mutation(() => [InvitationPayload])
  async removeAllPlusOnesByInvitationId(
    @Args('invitedByInvitationId', {
      type: () => ID,
    })
    invitedByInvitationId: string,
  ): Promise<InvitationPayload[]> {
    return this.guestService.deleteAllPlusOnes(invitedByInvitationId);
  }

  @Mutation(() => InvitationPayload)
  async createInvitationFromRsvp(
    @Args('input') input: PublicRsvpInput,
    @ClientInfo() clientContext: ClientContext
  ): Promise<InvitationPayload> {
    return TraceRunner.run('[RESOLVER] createInvitationFromRsvp', async () => {
      this.logger.debug(
        '[RSVP] Public RSVP submission for event %s',
        input.eventId,
      );
      return this.guestService.createFromPublicRsvp(input, clientContext);
    });
  }
}
