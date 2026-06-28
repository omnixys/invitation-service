import { InvitationEventRoleResolver } from '../invitation/service/invitation-event-role-resolver.service.js';
import { Module } from '@nestjs/common';
import { EventRoleGuard, EventRoleResolver } from '@omnixys/security';

@Module({
  providers: [
    EventRoleGuard,
    InvitationEventRoleResolver,
    { provide: EventRoleResolver, useExisting: InvitationEventRoleResolver },
  ],
  exports: [EventRoleGuard, EventRoleResolver],
})
export class EventAuthModule {}
