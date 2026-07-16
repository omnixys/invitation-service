import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationReadService } from '../service/invitation-read.service.js';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { EventPermissionKey, RealmRoleType } from '@omnixys/contracts';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
  EventAccessDeniedException,
  EventPermissionGuard,
  EventPermissionResolver,
  EventPermissions,
  RoleGuard,
  Roles,
} from '@omnixys/security';

@Resolver(() => InvitationPayload)
export class InvitationQueryResolver {
  constructor(
    private readonly service: InvitationReadService,
    private readonly eventPermissionResolver: EventPermissionResolver,
  ) {}

  @Query(() => [InvitationPayload], {
    name: 'invitations',
  })
  @UseGuards(CookieAuthGuard, RoleGuard)
  @Roles(RealmRoleType.ADMIN)
  get(): Promise<InvitationPayload[]> {
    return this.service.findAll();
  }

  @Query(() => [InvitationPayload], {
    name: 'eventInvitation',
  })
  @UseGuards(CookieAuthGuard, RoleGuard, EventPermissionGuard)
  @Roles(RealmRoleType.USER)
  @EventPermissions(EventPermissionKey.ViewInvitations)
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
  @UseGuards(CookieAuthGuard, RoleGuard)
  @Roles(RealmRoleType.USER)
  async getFullByEventIds(
    @CurrentUser() user: CurrentUserData,
    @Args('eventIds', {
      type: () => [ID],
    })
    eventIds: string[],
  ): Promise<InvitationPayload[]> {
    await this.assertCanViewInvitations(user, eventIds);
    return this.service.findFullByEventIds(eventIds);
  }

  @Query(() => InvitationPayload, {
    name: 'invitation',
  })
  @UseGuards(CookieAuthGuard, RoleGuard)
  @Roles(RealmRoleType.USER)
  async getById(
    @CurrentUser() user: CurrentUserData,
    @Args('id', {
      type: () => ID,
    })
    id: string,
  ): Promise<InvitationPayload> {
    const invitation = await this.service.findOne(id);
    await this.assertCanViewInvitations(user, [invitation.eventId]);
    return invitation;
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
  @UseGuards(CookieAuthGuard, RoleGuard)
  @Roles(RealmRoleType.USER)
  async getPlusOnesByInvitation(
    @CurrentUser() user: CurrentUserData,
    @Args('invitationId', {
      type: () => ID,
    })
    invitationId: string,
  ): Promise<InvitationPayload[]> {
    const invitation = await this.service.findOne(invitationId);
    await this.assertCanViewInvitations(user, [invitation.eventId]);
    return this.service.findPlusOnesByInvitation(invitationId);
  }

  private async assertCanViewInvitations(
    user: CurrentUserData,
    eventIds: readonly string[],
  ): Promise<void> {
    await Promise.all(
      [...new Set(eventIds)].map(async (eventId) => {
        const permissions =
          await this.eventPermissionResolver.getPermissionsForUser(
            user.id,
            eventId,
          );

        if (!permissions.includes(EventPermissionKey.ViewInvitations)) {
          throw new EventAccessDeniedException({
            eventId,
            userId: user.id,
            reason: 'event-permission-mismatch',
            actualPermissions: permissions,
            requiredPermissions: [EventPermissionKey.ViewInvitations],
          });
        }
      }),
    );
  }
}
