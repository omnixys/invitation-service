import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationReadService } from '../service/invitation-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

@Resolver(() => InvitationPayload)
export class InvitationQueryResolver {
  constructor(private readonly service: InvitationReadService) {}

  @Query(() => [InvitationPayload], {
    name: 'invitations',
  })
  get(): Promise<InvitationPayload[]> {
    return this.service.findAll();
  }

  @Query(() => [InvitationPayload], {
    name: 'eventInvitation',
  })
  getByEventId(
    @Args('eventId', {
      type: () => ID,
    })
    eventId: string,
  ): Promise<InvitationPayload[]> {
    return this.service.findByEventId(eventId);
  }

  @Query(() => [InvitationPayload], {
    name: 'getFullByEventIds',
  })
  getFullByEventIds(
    @Args('eventIds', {
      type: () => [ID],
    })
    eventIds: string[],
  ): Promise<InvitationPayload[]> {
    return this.service.findFullByEventIds(eventIds);
  }

  @Query(() => InvitationPayload, {
    name: 'invitation',
  })
  getById(
    @Args('id', {
      type: () => ID,
    })
    id: string,
  ): Promise<InvitationPayload> {
    return this.service.findOne(id);
  }

  @Query(() => [InvitationPayload], {
    name: 'myInvitations',
  })
  @UseGuards(CookieAuthGuard)
  getMyInvitations(
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPayload[]> {
    return this.service.findByUser(user.id);
  }

  @Query(() => [InvitationPayload], {
    name: 'getPlusOnesByInvitation',
  })
  getPlusOnesByInvitation(
    @Args('invitationId', {
      type: () => ID,
    })
    invitationId: string,
  ): Promise<InvitationPayload[]> {
    return this.service.findPlusOnesByInvitation(invitationId);
  }
}
