/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { InvitationStatus, InvitationType, PhoneNumberType, RsvpChoice } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ApproveInvitationDTO } from '../models/dto/approve.dto.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { ImportInvitationsResult } from '../models/input/import-invitation.input.js';
import { InvitationUpdateInput } from '../models/input/update-invitation.input.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ValkeyService, ValkeyKey } from '@omnixys/cache';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { TraceRunner } from '@omnixys/observability';
import {
  RsvpNotSubmittedException,
  RsvpNotAcceptedException,
  MissingGuestNameException,
  InvitationAlreadyApprovedException,
  InvitationAlreadyRejectedException,
  MissingPendingContactException,
  getPrimaryPhoneNumber,
} from '@omnixys/shared';
import { FILE_STORAGE, FileStorage } from '@omnixys/storage';
import ExcelJS from 'exceljs';
import { Buffer as NodeBuffer } from 'node:buffer';
import Papa from 'papaparse';

@Injectable()
export class AdminWriteService extends InvitationBaseService {
  constructor(
    prisma: PrismaService,
    loggerService: OmnixysLogger,
    private readonly producer: KafkaProducerService,
    private readonly cache: ValkeyService,

    @Inject(FILE_STORAGE)
    private readonly storage: FileStorage,
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
        type: InvitationType.PRIVATE,
        eventId: input.eventId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        invitedByInvitationId: input.invitedByInvitationId ?? null,
        invitedByUserId: eventAdminId ?? null,
        maxInvitees: input.maxInvitees ?? 0,
        status: InvitationStatus.PENDING,

        phoneNumber: getPrimaryPhoneNumber(input.phoneNumbers),
        email: input.email,
        phoneNumbers: input.phoneNumbers?.length
          ? {
              createMany: {
                data: input.phoneNumbers.map((ph) => ({
                  number: ph.number,
                  type: ph.type as PhoneNumberType,
                  label: ph.label ?? null,
                  isPrimary: ph.isPrimary ?? false,
                  countryCode: ph.countryCode,
                })),
              },
            }
          : undefined,
      },
    });

    return InvitationMapper.toPayload(created);
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

      if (!invitation.rsvpChoice && approve) {
        this.logger.error('Guest has not submitted an RSVP yet.');
        throw new RsvpNotSubmittedException();
      }

      if (invitation.rsvpChoice !== RsvpChoice.YES && approve) {
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

  /**
   * Bulk approval for invitations with per-invitation metadata.
   *
   * WHY:
   * - Each invitation can belong to a different event
   * - Each invitation may require a different seat
   * - Avoids incorrect global assumptions
   */
  async bulkApprove(params: {
    invitationIds: {
      invitationId: string;
      eventName: string;
      seat: string;
      seatId?: string;
    }[];
    approved: boolean;
    actorId: string;
  }): Promise<InvitationPayload[]> {
    return TraceRunner.run('[SERVICE] bulkApprove', async () => {
      const { invitationIds, approved, actorId } = params;

      this.logger.debug('Bulk approve start', {
        actorId,
        count: invitationIds.length,
      });

      const results: InvitationPayload[] = [];

      /**
       * Sequential processing
       *
       * WHY:
       * - Kafka side effects must stay deterministic
       * - Seat assignment must not race
       * - Easier error tracking per invitation
       */
      for (const item of invitationIds) {
        const { invitationId, eventName, seat, seatId } = item;

        try {
          const result = await this.approve({
            id: invitationId,
            approve: approved,
            actorId,
            eventName,
            seat: seat ?? 'debug',
            seatId,
          });

          results.push(result);
        } catch (err) {
          /**
           * DO NOT break the loop
           *
           * WHY:
           * - Partial success is better than full failure
           * - Admin can retry failed ones
           */
          this.logger.error('Bulk approve failed for invitation', {
            invitationId,
            error: err,
          });
        }
      }

      this.logger.debug('Bulk approve finished', {
        success: results.length,
        total: invitationIds.length,
      });

      return results;
    });
  }

  async importInvitations(
    eventId: string,
    key: string,
    uploadType: string,
    actorId: string,
  ): Promise<ImportInvitationsResult> {
    return TraceRunner.run('[SERVICE] importInvitations', async () => {
      this.logger.debug('Import start', {
        actorId,
        eventId,
        key,
        uploadType,
      });

      /**
       * 🔥 LOAD FILE FROM STORAGE
       */
      const buffer = await this.storage.get({ key });

      let rows: Record<string, unknown>[] = [];

      /**
       * ---------------- CSV ----------------
       */
      if (uploadType === 'csv') {
        const content = buffer.toString('utf8');

        const parsed = Papa.parse<Record<string, unknown>>(content, {
          header: true,
          skipEmptyLines: true,
        });

        rows = parsed.data;
      }

      /**
       * ---------------- XLSX ----------------
       */
      if (uploadType === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(NodeBuffer.from(buffer) as unknown as import('exceljs').Buffer);

        const sheet = workbook.worksheets[0];

        if (!sheet) {
          throw new Error('Excel file has no sheets');
        }

        const headers = sheet.getRow(1).values as string[];

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;

          const obj: Record<string, unknown> = {};

          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber];
            if (key) obj[key] = cell.value;
          });

          rows.push(obj);
        });
      }

      /**
       * ---------------- VALIDATION ----------------
       */
      const errors: string[] = [];
      const required = ['firstName', 'lastName'];

      rows.forEach((row, i) => {
        required.forEach((field) => {
          if (!row[field]) {
            errors.push(`Row ${i + 2}: Missing "${field}"`);
          }
        });
      });

      if (errors.length) {
        return {
          total: rows.length,
          imported: 0,
          skipped: rows.length,
          duplicates: [],
          errors,
        };
      }

      /**
       * ---------------- INSERT ----------------
       */
      let imported = 0;
      const duplicates: string[] = [];

      for (const row of rows) {
        const firstName = String(row.firstName).trim();
        const lastName = String(row.lastName).trim();

        const exists = await this.prismaService.invitation.findFirst({
          where: { eventId, firstName, lastName },
        });

        if (exists) {
          duplicates.push(`${firstName} ${lastName}`);
          continue;
        }

        await this.prismaService.invitation.create({
          data: {
            type: InvitationType.PRIVATE,
            eventId,
            firstName,
            lastName,
            maxInvitees: Number(row.maxPlusOnes ?? 0),
            invitedByUserId: actorId,
          },
        });

        imported++;
      }

      return {
        total: rows.length,
        imported,
        skipped: rows.length - imported,
        duplicates,
        errors: [],
      };
    });
  }
}
