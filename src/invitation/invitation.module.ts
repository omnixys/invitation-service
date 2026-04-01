import { UploadController } from './controller/upload.controller.js';
import { GuestMutationResolver } from './resolver/guest-mutation.resolver.js';
import { AdminMutationResolver } from './resolver/invitation-admin-mutation.resolver.js';
import { InvitationQueryResolver } from './resolver/invitation-query.resolver.js';
import { GuestWriteService } from './service/guest-write.service.js';
import { AdminWriteService } from './service/invitation-admin.write.service.js';
import { InvitationReadService } from './service/invitation-read.service.js';
import { InvitationWriteService } from './service/invitation-write.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [UploadController],
  providers: [
    InvitationQueryResolver,
    AdminMutationResolver,
    InvitationReadService,
    AdminWriteService,
    GuestWriteService,
    InvitationWriteService,
    GuestMutationResolver,
  ],
  exports: [InvitationReadService, AdminWriteService, InvitationWriteService, GuestWriteService],
})
export class InvitationModule {}
