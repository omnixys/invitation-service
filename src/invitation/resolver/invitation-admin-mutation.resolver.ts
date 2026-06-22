import {
  InvitationAuthenticationRequiredException,
  InvitationValidationException,
} from '../errors/invitation-domain.error.js';
import { ApproveInvitationInput } from '../models/input/approve.input.js';
import { BulkApproveInvitationInput } from '../models/input/bulk-approve.input.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import {
  ImportInvitationsInput,
  ImportInvitationsResult,
} from '../models/input/import-invitation.input.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { SuccessPayload } from '../models/payloads/success.payload.js';
import { AdminWriteService } from '../service/invitation-admin.write.service.js';
import { UseGuards } from '@nestjs/common';
import {
  Args,
  GraphQLISODateTime,
  ID,
  Mutation,
  Resolver,
} from '@nestjs/graphql';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

export enum UploadType {
  CSV = 'csv',
  XLSX = 'xlsx',
}

@Resolver(() => InvitationPayload)
export class AdminMutationResolver {
  private readonly logger;
  constructor(
    private readonly loggerService: OmnixysLogger,
    private readonly adminService: AdminWriteService,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => InvitationPayload)
  async createInvitation(
    @Args('input')
    input: InvitationCreateInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPayload> {
    if (!user?.id) {
      // Kein authentifizierter Nutzer im Kontext
      this.logger.warn('Unauthorized create invitation attempt');
      throw new InvitationAuthenticationRequiredException();
    }

    return this.adminService.create(input, user?.id);
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => ImportInvitationsResult, {
    description: 'Imports invitations from CSV/XLSX stored in object storage',
  })
  async importInvitations(
    @Args('input', { type: () => ImportInvitationsInput })
    input: ImportInvitationsInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportInvitationsResult> {
    return TraceRunner.run('[RESOLVER] importInvitations', async () => {
      /**
       * SECURITY
       */
      if (!user?.id) {
        this.logger.warn('Unauthorized import attempt');
        throw new InvitationAuthenticationRequiredException();
      }

      /**
       * VALIDATION
       */
      if (!input.eventId) {
        throw new InvitationValidationException('Event ID is required');
      }

      if (!input.key || !input.uploadType) {
        throw new InvitationValidationException(
          'Storage key and upload type are required',
        );
      }

      this.logger.debug('Import invitations requested', {
        actorId: user.id,
        eventId: input.eventId,
        key: input.key,
        uploadType: input.uploadType,
      });

      /**
       * SERVICE
       */
      const result = await this.adminService.importInvitations(
        input.eventId,
        input.key,
        input.uploadType,
        user.id,
      );

      this.logger.debug('Import completed', {
        actorId: user.id,
        duplicates: result.duplicates.length,
        imported: result.imported,
        skipped: result.skipped,
        total: result.total,
      });

      return result;
    });
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => InvitationPayload)
  async approveInvitation(
    @Args('input', {
      type: () => ApproveInvitationInput,
    })
    input: ApproveInvitationInput,
    @CurrentUser()
    user: CurrentUserData,
  ): Promise<InvitationPayload> {
    return TraceRunner.run('[RESOLVER] approveInvitation', async () => {
      if (!user?.id) {
        throw new InvitationAuthenticationRequiredException();
      }

      const result = await this.adminService.approve({
        id: input.invitationId,
        approve: input.approved,
        actorId: user.id,
        eventName: input.eventName,
        eventEndsAt: input.eventEndsAt,
        seat: input.seat,
        seatId: input.seatId,
      });

      return result;
    });
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => SuccessPayload)
  async removeInvitation(
    @Args('id', {
      type: () => ID,
    })
    id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<SuccessPayload> {
    const ok = await this.adminService.delete(id, user.id);
    return {
      ok,
      message: `Einladung '${id}' Gelöscht`,
    };
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => [InvitationPayload])
  async bulkApproveInvitations(
    @Args('input', { type: () => BulkApproveInvitationInput })
    input: BulkApproveInvitationInput,

    @Args('eventEndsAt', { type: () => GraphQLISODateTime })
    eventEndsAt: Date,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPayload[]> {
    return TraceRunner.run('[RESOLVER] bulkApproveInvitations', async () => {
      if (!user?.id) {
        throw new InvitationAuthenticationRequiredException();
      }

      if (!input.invitationIds?.length) {
        throw new InvitationValidationException(
          'Invitation IDs must not be empty',
        );
      }

      this.logger.debug('Bulk approve requested', {
        actorId: user.id,
        count: input.invitationIds.length,
      });

      return this.adminService.bulkApprove({
        invitationIds: input.invitationIds,
        approved: input.approved,
        actorId: user.id,
        eventEndsAt,
      });
    });
  }
}
