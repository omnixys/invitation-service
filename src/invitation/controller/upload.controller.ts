/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Controller, Post, BadRequestException, Req } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';
import * as fssync from 'fs';
import * as fs from 'fs/promises';
import { join } from 'path';

@Controller('upload')
export class UploadController {
  @Post('invitation')
  async uploadCSV(@Req() req: FastifyRequest) {
    if (!req.isMultipart()) {
      throw new BadRequestException('Expected multipart/form-data');
    }

    // ⬅️ Hier benutzt man Fastify korrekt
    const part = await req.file();

    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate MIME
    const allowed = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowed.includes(part.mimetype)) {
      throw new BadRequestException('Only CSV or Excel (.xlsx) files allowed');
    }

    const uploadId = randomUUID();

    const ext = part.filename.endsWith('.xlsx') ? 'xlsx' : 'csv';
    // ensure local tmp folder exists → absolute path
    const tmpDir = join(process.cwd(), 'tmp');
    if (!fssync.existsSync(tmpDir)) {
      await fs.mkdir(tmpDir, { recursive: true });
    }

    const tmpPath = join(tmpDir, `${uploadId}.${ext}`);

    // Buffer lesen
    const data = await part.toBuffer();
    await fs.writeFile(tmpPath, data);

    return {
      uploadId,
      tmpPath,
      type: ext,
      filename: part.filename,
      size: data.length,
    };
  }
}
