import { InvitationStatus, InvitationType, RsvpChoice } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { applyMapping } from '../../utils/apply-mapping.js';
import { mapColumns } from '../../utils/column-mapper.js';
import {
  InvitationAlreadyApprovedException,
  InvitationAlreadyRejectedException,
  InvitationValidationException,
  MissingGuestNameException,
  MissingPendingContactException,
  RsvpNotAcceptedException,
  RsvpNotSubmittedException,
} from '../errors/invitation-domain.error.js';
import { ApproveInvitationDTO } from '../models/dto/approve.dto.js';
import { InvitationCreateInput } from '../models/input/create-invitation.input.js';
import { ImportInvitationsResult } from '../models/input/import-invitation.input.js';
import { InvitationUpdateInput } from '../models/input/update-invitation.input.js';
import { InvitationMapper } from '../models/mappers/invitation.mapper.js';
import { InvitationPayload } from '../models/payloads/invitation.payload.js';
import { InvitationBaseService } from './invitation-base.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { ValkeyKey, ValkeyService } from '@omnixys/cache';
import { ContextAccessor } from '@omnixys/context';
import type { EventMilestoneRecordedDTO } from '@omnixys/contracts';
import { getPrimaryPhoneNumber } from '@omnixys/contracts';
import { KafkaProducerService, KafkaTopics } from '@omnixys/kafka';
import { OmnixysLogger } from '@omnixys/logger';
import { FILE_STORAGE, type FileStorage } from '@omnixys/media';
import { TraceRunner } from '@omnixys/observability';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

function currentTenantId(): string {
  const context = ContextAccessor.get();
  return context?.tenant?.tenantId ?? context?.principal?.tenantId ?? 'omnixys';
}

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
    this.logger.debug('create: eventId=%s | actorId=%s', input.eventId, eventAdminId);

    if (!input.eventId) {
      throw new InvitationValidationException('Event ID is required');
    }
    if (input.maxInvitees !== undefined && input.maxInvitees < 0) {
      throw new InvitationValidationException('maxInvitees must be non-negative');
    }
    if (input.autoApproveOnAccept && (!input.eventName || !input.eventEndsAt || !eventAdminId)) {
      throw new InvitationValidationException(
        'Automatic approval requires eventName, eventEndsAt, and an event admin',
      );
    }

    this.logger.debug('Creating invitation: eventId=%s | actorId=%s', input.eventId, eventAdminId);

    const created = await this.prismaService.invitation.create({
      data: {
        type: InvitationType.PRIVATE,
        eventId: input.eventId,
        eventName: input.eventName,
        eventEndsAt: input.eventEndsAt,
        autoApproveOnAccept: input.autoApproveOnAccept ?? false,
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
                  type: ph.type,
                  label: ph.label ?? null,
                  isPrimary: ph.isPrimary ?? false,
                  countryCode: ph.countryCode,
                })),
              },
            }
          : undefined,
      },
    });

    this.logger.debug(
      'Invitation created: invitationId=%s | eventId=%s',
      created.id,
      created.eventId,
    );

    await this.publishMilestone(
      {
        eventId: created.eventId,
        milestoneId: `${created.id}:created`,
        type: 'INVITATION_CREATED',
        label: 'Invitation created',
        occurredAt: created.createdAt.toISOString(),
        referenceId: created.id,
      },
      eventAdminId,
    );

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
    eventEndsAt,
    seat,
    seatId,
  }: ApproveInvitationDTO): Promise<InvitationPayload> {
    return TraceRunner.run('[SERVICE] approve', async () => {
      this.logger.debug('approve: input=%o', { id, approve });

      const invitation = await this.ensureExists(id);

      if (!invitation.rsvpChoice && approve) {
        this.logger.error('Guest has not submitted an RSVP yet: invitationId=%s', id);
        throw new RsvpNotSubmittedException(id);
      }

      if (invitation.rsvpChoice !== RsvpChoice.YES && approve) {
        this.logger.error('Guest has not accepted the RSVP: invitationId=%s', id);
        throw new RsvpNotAcceptedException(id);
      }

      if (approve && invitation.status === InvitationStatus.APPROVED) {
        this.logger.error('Invitation already approved: invitationId=%s', id);
        throw new InvitationAlreadyApprovedException(id);
      }

      if (!approve && invitation.status === InvitationStatus.REJECTED) {
        this.logger.error('Invitation already rejected: invitationId=%s', id);
        throw new InvitationAlreadyRejectedException(id);
      }

      // Fire Kafka event only if newly approved
      if (approve) {
        this.logger.debug('approve Invitation | actorId=%s', actorId);
        this.logger.debug('Updating invitation approval: invitationId=%s', id);

        const updated = await this.prismaService.invitation.update({
          where: { id },
          data: {
            approvedByUserId: actorId ?? null,
            approvedAt: new Date(),
            status: InvitationStatus.APPROVED,
          },
        });

        this.logger.debug('Invitation approved: invitationId=%s | actorId=%s', id, actorId);

        await this.publishMilestone(
          {
            eventId: updated.eventId,
            milestoneId: `${updated.id}:approved`,
            type: 'INVITATION_APPROVED',
            label: 'Invitation approved',
            occurredAt: updated.approvedAt?.toISOString() ?? new Date().toISOString(),
            referenceId: updated.id,
          },
          actorId,
        );

        if (!updated.guestProfileId) {
          const missing: string[] = [];

          if (!updated.firstName) {
            missing.push('firstName');
          }
          if (!updated.lastName) {
            missing.push('lastName');
          }

          if (missing.length) {
            this.logger.error('Guest name is incomplete: invitationId=%s', id);
            throw new MissingGuestNameException(missing, id);
          }

          if (!updated.pendingContactId) {
            this.logger.error('Pending contact not found: invitationId=%s', id);
            throw new MissingPendingContactException(id);
          }

          this.logger.debug(
            'Sending Kafka event: topic=%s | invitationId=%s | actorId=%s',
            KafkaTopics.notification.confirmGuest,
            id,
            actorId,
          );

          await this.producer.send({
            topic: KafkaTopics.notification.confirmGuest,
            payload: {
              token: updated.pendingContactId,
              eventName,
              seat,
              seatId,
              eventEndsAt,
            },
            meta: {
              service: 'invitation-service',
              operation: 'Send confirm guest notification',
              version: '1',
              type: 'EVENT',
              actorId,
              tenantId: currentTenantId(),
            },
          });

          this.logger.debug(
            'Kafka event sent: topic=%s | invitationId=%s | actorId=%s',
            KafkaTopics.notification.confirmGuest,
            id,
            actorId,
          );
        } else {
          this.logger.debug('Guest profile already exists – skip Kafka event: invitationId=%s', id);
        }

        return InvitationMapper.toPayload(updated);
      } else {
        this.logger.debug('Invitation Rejected by actor=%s', actorId);

        if (invitation.pendingContactId) {
          await this.cache.delete(ValkeyKey.pendingContact, invitation.pendingContactId);
        }

        this.logger.debug('Updating invitation rejection: invitationId=%s', id);

        const updated = await this.prismaService.invitation.update({
          where: { id },
          data: {
            pendingContactId: null,
            status: InvitationStatus.REJECTED,
            approvedByUserId: actorId,
            approvedAt: new Date(),
          },
        });

        this.logger.debug('Invitation rejected: invitationId=%s | actorId=%s', id, actorId);

        return InvitationMapper.toPayload(updated);
      }
    });
  }

  private async publishMilestone(
    payload: EventMilestoneRecordedDTO,
    actorId?: string,
  ): Promise<void> {
    const context = ContextAccessor.get();
    await this.producer.send({
      topic: KafkaTopics.event.milestoneRecorded,
      payload,
      meta: {
        service: 'invitation-service',
        operation: 'Record Event Milestone',
        version: '1',
        type: 'EVENT',
        actorId: actorId ?? context?.principal?.actorId ?? '',
        tenantId: currentTenantId(),
      },
    });
  }

  /**
   * Updates RSVP, maxInvitees or approval.
   * This is a catch-all mutation for both guests and admins.
   */
  async update(id: string, input: InvitationUpdateInput): Promise<InvitationPayload> {
    this.logger.debug('update: invitationId=%s', id);

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
        throw new InvitationValidationException('maxInvitees must be non-negative');
      }
      data.maxInvitees = input.maxInvitees;
    }

    // Admin approval update -----------------------------------
    if (typeof input.approved === 'boolean') {
      data.approved = input.approved;
      data.approvedByUserId = invitation.approvedByUserId;
      data.approvedAt = new Date();
    }

    this.logger.debug('Updating invitation: invitationId=%s', id);

    const updated = await this.prismaService.invitation.update({
      where: { id },
      data,
    });

    this.logger.debug('Invitation updated: invitationId=%s', id);

    return InvitationMapper.toPayload(updated);
  }

  /**
   * Deletes an invitation after rejecting it (cleanup PII + revoke approval).
   */
  async delete(id: string, actorId: string): Promise<boolean> {
    return TraceRunner.run('[SERVICE] delete', async () => {
      this.logger.debug('delete: invitationID=%s | actorId=%s', id, actorId);
      await this.ensureExists(id);
      this.logger.debug('Deleting invitation: invitationID=%s', id);
      await this.prismaService.invitation.delete({ where: { id } });
      this.logger.debug('Invitation deleted: invitationID=%s | actorId=%s', id, actorId);
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
    invitationIds: Array<{
      invitationId: string;
      eventName: string;
      seat: string;
      seatId?: string;
    }>;
    approved: boolean;
    actorId: string;
    eventEndsAt: Date;
  }): Promise<InvitationPayload[]> {
    return TraceRunner.run('[SERVICE] bulkApprove', async () => {
      const { invitationIds, approved, actorId, eventEndsAt } = params;

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
            eventEndsAt,
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
    uploadType: 'csv' | 'xlsx',
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
       * LOAD FILE FROM STORAGE
       */
      const buffer = await this.storage.get({ key });

      this.logger.debug('Import file loaded', {
        actorId,
        eventId,
        uploadType,
      });

      let rawRows: Array<Record<string, unknown>> = [];
      let headers: string[] = [];

      /* ---------------- CSV ---------------- */
      if (uploadType === 'csv') {
        const content = buffer.toString('utf8');

        const parsed = Papa.parse<Record<string, unknown>>(content, {
          header: true,
          skipEmptyLines: true,
        });

        rawRows = parsed.data;
        headers = Object.keys(rawRows[0] ?? {});
      }

      /* ---------------- XLSX ---------------- */
      if (uploadType === 'xlsx') {
        const workbook = new ExcelJS.Workbook();

        const xlsxBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as Parameters<typeof workbook.xlsx.load>[0];

        await workbook.xlsx.load(xlsxBuffer);

        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new InvitationValidationException('Excel file has no sheets');
        }

        sheet.getRow(1).eachCell((cell) => {
          headers.push(cell.text);
        });

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            return;
          }

          const obj: Record<string, unknown> = {};

          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber - 1];
            if (key) {
              obj[key] = cell.value;
            }
          });

          rawRows.push(obj);
        });
      }

      /**
       * 🔥 COLUMN MAPPING (CRITICAL)
       */
      const { mapping } = mapColumns(headers);
      const rows = applyMapping(rawRows, mapping);

      /**
       * VALIDATION
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
        this.logger.warn('Import validation failed', {
          actorId,
          eventId,
          errors: errors.length,
          total: rows.length,
        });

        return {
          total: rows.length,
          imported: 0,
          skipped: rows.length,
          duplicates: [],
          errors,
        };
      }

      /**
       * 🔥 OPTIMIZED DUPLICATE CHECK
       */
      const existing = await this.prismaService.invitation.findMany({
        where: { eventId },
        select: { firstName: true, lastName: true },
      });

      this.logger.debug('Import duplicate check completed', {
        actorId,
        eventId,
        existing: existing.length,
        total: rows.length,
      });

      const existingSet = new Set(existing.map((e) => `${e.firstName}-${e.lastName}`));

      /**
       * INSERT
       */
      let imported = 0;
      const duplicates: string[] = [];

      for (const row of rows) {
        const firstName = String(row.firstName).trim();
        const lastName = String(row.lastName).trim();

        const key = `${firstName}-${lastName}`;

        if (existingSet.has(key)) {
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

        existingSet.add(key);
        imported++;
      }

      this.logger.debug('Import finished', {
        actorId,
        eventId,
        imported,
        skipped: rows.length - imported,
        total: rows.length,
      });

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
