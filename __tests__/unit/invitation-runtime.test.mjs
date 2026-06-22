import { TicketHandler } from '../../dist/handlers/ticket.handler.js';
import { InvitationValidationException } from '../../dist/invitation/errors/invitation-domain.error.js';
import { InvitationHttpValidationException } from '../../dist/invitation/errors/invitation-http.error.js';
import { RsvpDomain } from '../../dist/invitation/models/domain/rsvp.domain.js';
import { GuestWriteService } from '../../dist/invitation/service/guest-write.service.js';
import { AdminWriteService } from '../../dist/invitation/service/invitation-admin.write.service.js';
import {
  InvitationStatus,
  InvitationType,
  RsvpChoice,
} from '../../dist/prisma/generated/client.js';
import { ContextAccessor } from '@omnixys/context';
import { KafkaTopics } from '@omnixys/kafka';
import assert from 'node:assert/strict';
import test from 'node:test';

const logger = {
  log() {
    return {
      info() {},
      debug() {},
      warn() {},
      error() {},
    };
  },
};

function invitation(overrides = {}) {
  return {
    id: 'invitation-1',
    type: InvitationType.PRIVATE,
    firstName: 'Ada',
    lastName: 'Lovelace',
    eventId: 'event-1',
    eventName: 'Platform Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    autoApproveOnAccept: true,
    guestProfileId: null,
    email: 'ada@example.test',
    phoneNumber: null,
    status: InvitationStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    pendingContactId: null,
    rsvpChoice: null,
    rsvpAt: null,
    approvedAt: null,
    approvedByUserId: null,
    maxInvitees: 0,
    invitedByInvitationId: null,
    invitedByUserId: '00000000-0000-4000-8000-000000000001',
    phoneNumbers: [],
    ...overrides,
  };
}

test('RSVP domain rejects duplicate state with structured diagnostics', () => {
  ContextAccessor.run(
    { requestId: 'request-rsvp', correlationId: 'correlation-rsvp' },
    () => {
      assert.throws(
        () => RsvpDomain.decide(RsvpChoice.NO, RsvpChoice.NO, false),
        (error) => {
          assert.ok(error instanceof InvitationValidationException);
          assert.equal(error.requestId, 'request-rsvp');
          assert.equal(error.code, 'INVITATION_INVALID_INPUT');
          return true;
        },
      );
    },
  );
});

test('admin invitation creation persists auto-approval policy and emits milestone', async () => {
  const sent = [];
  let createData;
  const service = new AdminWriteService(
    {
      invitation: {
        async create({ data }) {
          createData = data;
          return invitation({ ...data });
        },
      },
    },
    logger,
    { send: async (event) => sent.push(event) },
    {},
    {},
  );
  const eventEndsAt = new Date('2030-01-01T00:00:00.000Z');

  const result = await ContextAccessor.run(
    {
      requestId: 'request-create',
      actorId: '00000000-0000-4000-8000-000000000001',
      tenantId: 'tenant-1',
    },
    () =>
      service.create(
        {
          eventId: 'event-1',
          eventName: 'Platform Launch',
          eventEndsAt,
          autoApproveOnAccept: true,
          firstName: 'Ada',
          lastName: 'Lovelace',
          maxInvitees: 0,
        },
        '00000000-0000-4000-8000-000000000001',
      ),
  );

  assert.equal(createData.autoApproveOnAccept, true);
  assert.equal(createData.eventName, 'Platform Launch');
  assert.equal(result.autoApproveOnAccept, true);
  assert.equal(sent[0].topic, KafkaTopics.event.milestoneRecorded);
  assert.equal(sent[0].payload.type, 'INVITATION_CREATED');
  assert.equal(sent[0].meta.tenantId, 'tenant-1');
  assert.equal(sent[0].meta.actorId, '00000000-0000-4000-8000-000000000001');
});

test('accepted RSVP applies configured automatic approval', async () => {
  const existing = invitation();
  const approvalCalls = [];
  const transactionClient = {
    invitation: {
      async update({ data }) {
        return invitation({
          ...existing,
          ...data,
          rsvpChoice: data.rsvpChoice ?? existing.rsvpChoice,
          status: data.status ?? existing.status,
          pendingContactId: data.pendingContactId ?? 'pending-1',
        });
      },
      async create() {
        throw new Error('plus-one creation was not expected');
      },
    },
  };
  const service = new GuestWriteService(
    {
      invitation: { findUnique: async () => existing },
      $transaction: async (work) => work(transactionClient),
    },
    logger,
    { set: async () => 'pending-1' },
    { send: async () => undefined },
    {
      async approve(input) {
        approvalCalls.push(input);
        return invitation({
          status: InvitationStatus.APPROVED,
          approvedAt: new Date(),
        });
      },
    },
  );

  const result = await service.reply(
    {
      invitationId: existing.id,
      choice: RsvpChoice.YES,
      replyInput: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        eventEndsAt: existing.eventEndsAt,
      },
    },
    {
      locale: 'en-US',
      ip: undefined,
      userAgent: undefined,
      device: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      location: 'unknown',
    },
  );

  assert.equal(approvalCalls.length, 1);
  assert.equal(approvalCalls[0].id, existing.id);
  assert.equal(approvalCalls[0].actorId, existing.invitedByUserId);
  assert.equal(result.status, InvitationStatus.APPROVED);
});

test('ticket link handler propagates failures to Kafka retry and DLQ handling', async () => {
  const failure = new Error('database unavailable');
  const handler = new TicketHandler(logger, {
    async addGuestId() {
      throw failure;
    },
  });

  await assert.rejects(
    handler.handleAddGuestId(
      {
        invitationId: 'invitation-1',
        userId: 'user-1',
        actorId: 'actor-1',
      },
      { headers: {} },
    ),
    failure,
  );
});

test('HTTP validation errors expose canonical request diagnostics', () => {
  ContextAccessor.run(
    {
      requestId: 'request-upload',
      correlationId: 'correlation-upload',
    },
    () => {
      const error = new InvitationHttpValidationException('Invalid upload');
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: 'INVITATION_UPLOAD_INVALID',
        message: 'Invalid upload',
        requestId: 'request-upload',
        correlationId: 'correlation-upload',
        traceId: undefined,
        metadata: {},
      });
    },
  );
});
