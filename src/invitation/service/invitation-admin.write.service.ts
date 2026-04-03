/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { InvitationStatus, RsvpChoice } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ApproveInvitationDTO } from '../models/dto/approve.dto.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { ImportInvitationsResult } from '../models/input/import-invitation.input.js';
import { InvitationUpdateInput } from '../models/input/update-invitation.input.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ValkeyService, ValkeyKey } from '@omnixys/cache';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  RsvpNotSubmittedException,
  RsvpNotAcceptedException,
  InvitationAlreadyAcceptedException,
  InvitationNotFoundException,
  MissingGuestNameException,
  InvitationAlreadyApprovedException,
  InvitationAlreadyRejectedException,
  MissingPendingContactException,
} from '@omnixys/shared';
import ExcelJS from 'exceljs';
import * as fssync from 'fs';
import * as fs from 'fs/promises';
import Papa from 'papaparse';
import { join } from 'path';

@Injectable()
export class AdminWriteService extends InvitationBaseService {
  constructor(
    prisma: PrismaService,
    loggerService: OmnixysLogger,
    private readonly producer: KafkaProducerService,
    private readonly cache: ValkeyService,
  ) {
    super(loggerService, prisma);
  }

  /**
   * Creates a new invitation. Guest profile is created later during RSVP/ticket flow.
   */
  async create(input: InvitationCreateInput, eventAdminId?: string): Promise<InvitationPayload> {
    this.logger.debug('create: admin=%s input=%o', eventAdminId, input);

    if (!input.eventId) {
      throw new BadRequestException('eventId is required');
    }
    if (input.maxInvitees !== undefined && input.maxInvitees < 0) {
      throw new BadRequestException('maxInvitees must be >= 0');
    }

    const created = await this.prismaService.invitation.create({
      data: {
        eventId: input.eventId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        invitedByInvitationId: input.invitedByInvitationId ?? null,
        invitedByUserId: eventAdminId ?? null,
        maxInvitees: input.maxInvitees ?? 0,
        status: InvitationStatus.PENDING,
      },
    });

    return InvitationMapper.toPayload(created);
  }

  async importInvitations(
    eventId: string,
    uploadId: string,
    uploadType: string,
  ): Promise<ImportInvitationsResult> {
    // Ensure local tmp folder exists → absolute path
    const tmpDir = join(process.cwd(), 'tmp');
    if (!fssync.existsSync(tmpDir)) {
      await fs.mkdir(tmpDir, { recursive: true });
    }

    const filePath = join(tmpDir, `${uploadId}.${uploadType}`);

    /** ============================
     *  CHECK FILE EXISTENCE
     *  ============================ */
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Upload file not found: ${filePath}`);
    }

    /** ============================
     *  PARSE FILE
     *  ============================ */
    const isCsv = filePath.endsWith('.csv');
    const isExcel = filePath.endsWith('.xlsx');

    let rows: any[] = [];

    /** ---- CSV ---- */
    if (isCsv) {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
      });

      rows = parsed.data as any[];
    }

    /** ---- XLSX ---- */
    if (isExcel) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return {
          total: 0,
          imported: 0,
          skipped: 0,
          duplicates: [],
          errors: ['No first sheet found in Excel file.'],
        };
      }

      const headerRow = sheet.getRow(1);
      const rawHeaders = Array.isArray(headerRow.values)
        ? (headerRow.values as Array<string | null>)
        : [];

      const headers = rawHeaders.map((h) => (h === undefined ? null : h));

      rows = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        const values = Array.isArray(row.values) ? row.values : [];
        const obj: Record<string, any> = {};

        values.forEach((cellVal, colIndex) => {
          const key = headers[colIndex];
          if (typeof key === 'string') {
            obj[key] = cellVal ?? null;
          }
        });

        rows.push(obj);
      });
    }

    /** ============================
     *  VALIDATION (ONLY MISSING FIELDS)
     *  ============================ */
    const required = ['firstName', 'lastName'];
    const errors: string[] = [];

    rows.forEach((row, i) => {
      required.forEach((key) => {
        if (!row[key]) {
          errors.push(`Row ${i + 2}: Missing required field "${key}"`);
        }
      });
    });

    // If validation errors → stop import
    if (errors.length > 0) {
      return {
        total: rows.length,
        imported: 0,
        skipped: rows.length,
        duplicates: [],
        errors,
      };
    }

    /** ============================
     *  INSERT (SKIP DUPLICATES)
     *  ============================ */
    let imported = 0;
    const duplicates: string[] = [];

    for (const r of rows) {
      const firstName = String(r.firstName).trim();
      const lastName = String(r.lastName).trim();

      // Check duplicate in DB
      const exists = await this.prismaService.invitation.findFirst({
        where: {
          eventId,
          firstName,
          lastName,
        },
      });

      if (exists) {
        duplicates.push(`${firstName} ${lastName}`);
        continue; // skip
      }

      // Insert new invitation
      await this.prismaService.invitation.create({
        data: {
          eventId,
          firstName,
          lastName,
          maxInvitees: Number(r.maxPlusOnes ?? 0),
        },
      });

      imported++;
    }

    const skipped = rows.length - imported;

    /** ============================
     *  FINAL RESULT
     *  ============================ */
    return {
      total: rows.length,
      imported,
      skipped,
      duplicates,
      errors: [], // no errors besides validation
    };
  }

  /**
   * Approves or unapproves an invitation. Only allowed for admins.
   * Approval creates the guest profile if missing and sends a Kafka event.
   */
  async approve({
    id,
    approve,
    actorId,
    eventName,
    seat,
    seatId,
  }: ApproveInvitationDTO): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] approve', async () => {
      this.logger.debug('approve: input=%o', { id, approve });

      const invitation = await this.ensureExists(id);

      if (!invitation.rsvpChoice) {
        this.logger.error('Guest has not submitted an RSVP yet.');
        throw new RsvpNotSubmittedException();
      }

      if (invitation.rsvpChoice !== RsvpChoice.YES) {
        this.logger.error('Guest has not accepted the RSVP.');
        throw new RsvpNotAcceptedException();
      }

      if (approve && invitation.status === InvitationStatus.APPROVED) {
        this.logger.error('Invitation already approved.');
        throw new InvitationAlreadyApprovedException();
      }

      if (!approve && invitation.status === InvitationStatus.REJECTED) {
        this.logger.error('Invitation already rejected.');
        throw new InvitationAlreadyRejectedException();
      }

      // Fire Kafka event only if newly approved
      if (approve) {
        this.logger.debug('approve Invitation | actorId=%s', actorId);

        const updated = await this.prismaService.invitation.update({
          where: { id },
          data: {
            approvedByUserId: actorId ?? null,
            approvedAt: new Date(),
            status: InvitationStatus.APPROVED,
          },
        });

        if (!updated.guestProfileId) {
          const missing: string[] = [];

          if (!updated.firstName) missing.push('firstName');
          if (!updated.lastName) missing.push('lastName');

          if (missing.length) {
            throw new MissingGuestNameException(missing);
          }

          if (!updated.pendingContactId) {
            throw new MissingPendingContactException();
          }

          await this.producer.send({
            topic: KafkaTopics.notification.confirmGuest,
            payload: {
              token: updated.pendingContactId!,
              eventName,
              seat,
              seatId,
            },
            meta: {
              service: 'invitation-service',
              operation: 'Send confirm guest notification',
              version: '1',
              type: 'EVENT',
              actorId: actorId,
              tenantId: 'omnixys',
            },
          });
        } else {
          this.logger.debug('Guest profile already exists – skip Kafka event.');
        }

        return InvitationMapper.toPayload(updated);
      } else {
        this.logger.debug('Invitation Rejected by actor=%s', actorId);

        if (invitation.pendingContactId) {
          await this.cache.delete(ValkeyKey.pendingContact, invitation.pendingContactId);
        }

        const updated = await this.prismaService.invitation.update({
          where: { id },
          data: {
            pendingContactId: null,
            status: InvitationStatus.REJECTED,
            approvedByUserId: actorId,
            approvedAt: new Date(),
          },
        });

        return InvitationMapper.toPayload(updated);
      }
    });
  }

  /**
   * Updates RSVP, maxInvitees or approval.
   * This is a catch-all mutation for both guests and admins.
   */
  async update(id: string, input: InvitationUpdateInput): Promise<InvitationPayload> {
    const invitation = await this.ensureExists(id);

    const data: Record<string, unknown> = {};

    // Guest RSVP update ---------------------------------------
    if (typeof input.rsvpChoice !== 'undefined') {
      data.rsvpChoice = input.rsvpChoice;

      if (input.rsvpChoice === RsvpChoice.YES) {
        data.status = InvitationStatus.ACCEPTED;
      } else if (input.rsvpChoice === RsvpChoice.NO) {
        data.status = InvitationStatus.DECLINED;
      } else if (input.rsvpChoice === RsvpChoice.MAYBE) {
        data.status = InvitationStatus.PENDING;
      }
    }

    // Admin maxInvitees update --------------------------------
    if (typeof input.maxInvitees === 'number') {
      if (input.maxInvitees < 0) {
        throw new BadRequestException('maxInvitees must be >= 0');
      }
      data.maxInvitees = input.maxInvitees;
    }

    // Admin approval update -----------------------------------
    if (typeof input.approved === 'boolean') {
      data.approved = input.approved;
      data.approvedByUserId = invitation.approvedByUserId;
      data.approvedAt = new Date();
    }

    const updated = await this.prismaService.invitation.update({
      where: { id },
      data,
    });

    return InvitationMapper.toPayload(updated);
  }

  /**
   * Deletes an invitation after rejecting it (cleanup PII + revoke approval).
   */
  async delete(id: string, actorId: string): Promise<boolean> {
    return TraceRunner.run('[SERVICE] delete', async () => {
      this.logger.debug('delete: invitationID=%s | actorId=%s', id, actorId);
      await this.ensureExists(id);
      await this.prismaService.invitation.delete({ where: { id } });
      return true;
    });
  }
}
