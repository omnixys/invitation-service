import { InvitationEventRoleResolver } from '../invitation/service/invitation-event-role-resolver.service.js';
import { Module } from '@nestjs/common';
import {
  EventPermissionGuard,
  EventPermissionResolver,
  EventRoleGuard,
  EventRoleResolver,
} from '@omnixys/security';

@Module({
  providers: [
    EventRoleGuard,
    EventPermissionGuard,
    InvitationEventRoleResolver,
    { provide: EventRoleResolver, useExisting: InvitationEventRoleResolver },
    {
      provide: EventPermissionResolver,
      useExisting: InvitationEventRoleResolver,
    },
  ],
  exports: [EventRoleGuard, EventPermissionGuard, EventRoleResolver, EventPermissionResolver],
})
export class EventAuthModule {}
