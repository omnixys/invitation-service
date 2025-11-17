import { Invitation } from '../models/entity/invitation.entity.js';
import { InvitationReadService } from '../service/invitation-read.service.js';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

@Resolver(() => Invitation)
export class InvitationQueryResolver {
  constructor(private readonly service: InvitationReadService) {}

  @Query(() => [Invitation], {
    name: 'invitations',
  })
  get(): Promise<Invitation[]> {
    return this.service.findAll();
  }

  @Query(() => [Invitation], {
    name: 'eventInvitation',
  })
  getByEventId(
    @Args('eventId', {
      type: () => ID,
    })
    eventId: string,
  ): Promise<Invitation[]> {
    return this.service.findByEventId(eventId);
  }

  @Query(() => Invitation, {
    name: 'invitation',
  })
  getById(
    @Args('id', {
      type: () => ID,
    })
    id: string,
  ): Promise<Invitation> {
    return this.service.findOne(id);
  }

  @Query(() => [Invitation], {
    name: 'plusOnesByInvitationId',
  })
  getMyInvitationsByInvitationId(
    @Args('id', {
      type: () => ID,
    })
    invitationId: string,
  ): Promise<Invitation[]> {
    return this.service.findAllByInvitedByInvitationId(invitationId);
  }
}
