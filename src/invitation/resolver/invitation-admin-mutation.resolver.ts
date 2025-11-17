// TODO Disaprove
import {
  CurrentUser,
  CurrentUserData,
} from '../../auth/decorators/current-user.decorator.js';
import { CookieAuthGuard } from '../../auth/guards/cookie-auth.guard.js';
import { LoggerPlusService } from '../../logger/logger-plus.service.js';
import { Invitation } from '../models/entity/invitation.entity.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { SuccessPayload } from '../models/payloads/success.payload.js';
import { AdminWriteService } from '../service/invitation-admin.write.service.js';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

@Resolver(() => Invitation)
export class AdminMutationResolver {
  private readonly logger;
  constructor(
    private readonly loggerService: LoggerPlusService,
    private readonly adminService: AdminWriteService,
  ) {
    this.logger = this.loggerService.getLogger(AdminMutationResolver.name);
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => Invitation)
  async createInvitation(
    @Args('input')
    input: InvitationCreateInput,
    @CurrentUser() user: CurrentUserData,
  ): Promise<Invitation> {
    if (!user?.id) {
      // Kein authentifizierter Nutzer im Kontext
      this.logger.debug('user= %o', user);
      throw new UnauthorizedException('Not authenticated');
    }

    return this.adminService.create(input, user?.id);
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => Invitation)
  async approveInvitation(
    @Args('id', {
      type: () => ID,
    })
    id: string,
    @Args('approve', {
      type: () => Boolean,
    })
    approve: boolean,
    @CurrentUser()
    user: CurrentUserData,
  ): Promise<Invitation> {
    if (!user?.id) {
      // Kein authentifizierter Nutzer im Kontext
      throw new UnauthorizedException('Not authenticated');
    }
    const result = await this.adminService.approve(id, approve, user?.id);

    if (!result) {
      throw new Error('Gast hat sich noch nicht entschieden!');
    }
    return result;
  }

  @UseGuards(CookieAuthGuard)
  @Mutation(() => Invitation)
  async rejectInvitation(
    @Args('id', {
      type: () => ID,
    })
    id: string,
    @CurrentUser()
    user: CurrentUserData,
  ): Promise<Invitation> {
    if (!user?.id) {
      // Kein authentifizierter Nutzer im Kontext
      throw new UnauthorizedException('Not authenticated');
    }
    const result = await this.adminService.reject(id, user?.id);

    if (!result) {
      throw new Error('Gast hat sich noch nicht entschieden!');
    }
    return result;
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
