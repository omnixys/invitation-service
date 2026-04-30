// path: src/invitation/controller/invitation-upload.controller.ts

import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
  Inject,
  Body,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';

import { CookieAuthGuard, CurrentUser, CurrentUserData } from '@omnixys/security';

import {
  InvitationPreviewService,
  type InvitationPreviewResult,
} from '../service/invitation-preview.service.js';
import { OmnixysLogger } from '@omnixys/logger';
import { FILE_STORAGE, FileStorage } from '@omnixys/media';
import { TraceRunner } from '@omnixys/observability';
import { IsIn, IsString } from 'class-validator';

/* ---------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------- */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

interface UploadResult {
  key: string;
  type: 'csv' | 'xlsx';
}

/* ---------------------------------------------------------------------------
 * DTO
 * ------------------------------------------------------------------------- */
export class PreviewInvitationDto {
  @IsString()
  key!: string;

  @IsString()
  @IsIn(['csv', 'xlsx'])
  type!: 'csv' | 'xlsx';

  @IsString()
  eventId!: string;
}

/* ---------------------------------------------------------------------------
 * Controller
 * ------------------------------------------------------------------------- */
@Controller()
export class InvitationUploadController {
  private readonly logger;

  constructor(
    @Inject(FILE_STORAGE)
    private readonly storage: FileStorage,
    private readonly loggerService: OmnixysLogger,
    private readonly previewService: InvitationPreviewService,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  /* =========================================================================
   * UPLOAD
   * ========================================================================= */
  @UseGuards(CookieAuthGuard)
  @Post('/upload')
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: CurrentUserData,
  ): Promise<UploadResult> {
    return TraceRunner.run('[CONTROLLER] upload', async () => {
      if (!user?.id) {
        throw new BadRequestException('Not authenticated');
      }

      if (!req.isMultipart()) {
        throw new BadRequestException('Expected multipart/form-data');
      }

      const part = await req.file();

      if (!part) {
        throw new BadRequestException('No file uploaded');
      }

      if (!ALLOWED_MIME.has(part.mimetype)) {
        throw new BadRequestException('Only CSV or Excel allowed');
      }

      const buffer = await part.toBuffer();

      if (buffer.length > MAX_FILE_SIZE) {
        throw new BadRequestException('File too large');
      }

      const ext = part.filename.split('.').pop()?.toLowerCase();
      const type = ext === 'xlsx' ? 'xlsx' : 'csv';

      const key = `invitation-imports/${randomUUID()}.${type}`;

      await this.storage.upload({
        key,
        buffer,
        contentType: part.mimetype,
      });

      this.logger.debug('Upload successful', {
        actorId: user.id,
        filename: part.filename,
        mimetype: part.mimetype,
        size: buffer.length,
        key,
        type,
      });

      return {
        key,
        type,
      };
    });
  }

  /* =========================================================================
   * PREVIEW
   * ========================================================================= */
  @UseGuards(CookieAuthGuard)
  @Post('/preview')
  async preview(
    @Body() dto: PreviewInvitationDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InvitationPreviewResult> {
    return TraceRunner.run('[CONTROLLER] preview', async () => {
      if (!user?.id) {
        throw new BadRequestException('Not authenticated');
      }

      /**
       * 🔒 Input validation (defensive)
       */
      if (!dto.key || !dto.type || !dto.eventId) {
        throw new BadRequestException('Missing required fields');
      }

      this.logger.debug('Preview requested %o', {
        actorId: user.id,
        key: dto.key,
        type: dto.type,
        eventId: dto.eventId,
      });

      try {
        const result = await this.previewService.preview(dto);

        this.logger.debug('Preview result %o', {
          actorId: user.id,
          key: dto.key,
          total: result.total,
          errors: result.errors.length,
          duplicates: result.duplicates.length,
          confidence: result.confidence,
        });

        return result;
      } catch (error) {
        this.logger.error('Preview failed %o', {
          actorId: user.id,
          key: dto.key,
          error,
        });

        throw new BadRequestException('Preview failed');
      }
    });
  }
}
