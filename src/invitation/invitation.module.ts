import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ValkeyModule } from '../valkey/valkey.module.js';
import { GuestMutationResolver } from './resolver/guest-mutation.resolver.js';
import { AdminMutationResolver } from './resolver/invitation-admin-mutation.resolver.js';
import { InvitationQueryResolver } from './resolver/invitation-query.resolver.js';
import { GuestWriteService } from './service/guest-write.service.js';
import { AdminWriteService } from './service/invitation-admin.write.service.js';
import { InvitationReadService } from './service/invitation-read.service.js';
import { InvitationWriteService } from './service/invitation-write.service.js';
import { PendingContactService } from './service/pending-contact.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule, AuthModule, ValkeyModule],
  providers: [
    InvitationQueryResolver,
    AdminMutationResolver,
    InvitationReadService,
    AdminWriteService,
    GuestWriteService,
    PendingContactService,
    InvitationWriteService,
    GuestMutationResolver,
  ],
  exports: [
    InvitationReadService,
    AdminWriteService,
    PendingContactService,
    InvitationWriteService,
    GuestWriteService,
  ],
})
export class InvitationModule {}
