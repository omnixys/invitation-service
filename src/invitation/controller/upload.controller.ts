import { BadRequestException, Controller, Post, Req, UseGuards, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';

import { CookieAuthGuard, CurrentUser, CurrentUserData } from '@omnixys/security';

import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import { FILE_STORAGE, FileStorage } from '@omnixys/storage';

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

@Controller('invitation/upload')
export class InvitationUploadController {
  private readonly logger;

  constructor(
    @Inject(FILE_STORAGE)
    private readonly storage: FileStorage,
    private readonly loggerService: OmnixysLogger,
  ) {
    this.logger = this.loggerService.log(this.constructor.name);
  }

  @UseGuards(CookieAuthGuard)
  @Post()
  async upload(@Req() req: FastifyRequest, @CurrentUser() user: CurrentUserData) {
    return TraceRunner.run('[INVITATION] upload', async () => {
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

      this.logger.debug('Invitation import uploaded', {
        actorId: user.id,
        key,
      });

      return {
        key,
        type,
      };
    });
  }
}
