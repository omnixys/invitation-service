import { ApproveInvitationInput } from '../models/input/approve.input.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import {
  ImportInvitationsInput,
  ImportInvitationsResult,
} from '../models/input/import-invitation.input.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { SuccessPayload } from '../models/payloads/success.payload.js';
import { AdminWriteService } from '../service/invitation-admin.write.service.js';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  CookieAuthGuard,
  CurrentUser,
  CurrentUserData,
} from '@omnixys/security';

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
      this.logger.debug('user= %o', user);
      throw new UnauthorizedException('Not authenticated');
    }

    return this.adminService.create(input, user?.id);
  }

  @Mutation(() => ImportInvitationsResult)
  async importInvitations(
    @Args('input', { type: () => ImportInvitationsInput })
    input: ImportInvitationsInput,
  ): Promise<ImportInvitationsResult> {
    return this.adminService.importInvitations(
      input.eventId,
      input.uploadId,
      input.uploadType,
    );
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
        throw new UnauthorizedException('Not authenticated');
      }

      const result = await this.adminService.approve({
        id: input.invitationId,
        approve: input.approved,
        actorId: user.id,
        eventName: input.eventName,
        seat: input.seat,
        seatId: input.seatId,
      });

      if (!result) {
        throw new Error('Gast hat sich noch nicht entschieden!', {cause: 456});
      }
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
}
