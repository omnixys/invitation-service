import { TicketHandler } from '../../dist/handlers/ticket.handler.js';
import { InvitationAccessDeniedException, InvitationValidationException } from '../../dist/invitation/errors/invitation-domain.error.js';
import { InvitationHttpValidationException } from '../../dist/invitation/errors/invitation-http.error.js';
import { RsvpDomain } from '../../dist/invitation/models/domain/rsvp.domain.js';
import { GuestWriteService } from '../../dist/invitation/service/guest-write.service.js';
import { InvitationEventRoleResolver } from '../../dist/invitation/service/invitation-event-role-resolver.service.js';
import { AdminWriteService } from '../../dist/invitation/service/invitation-admin.write.service.js';
import {
  InvitationStatus,
  InvitationType,
  RsvpChoice,
} from '../../dist/prisma/generated/client.js';
import { ContextAccessor } from '@omnixys/context';
import { EventPermissionKey, EventRoleType } from '@omnixys/contracts';
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
    selectedInvitedBy: [],
    guestNote: null,
    plusOneAgeCategory: null,
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
      eventSettingsProjection: {
        async findUnique() {
          return {
            name: 'Platform Launch',
            endsAt: eventEndsAt,
            approvalMode: 'AUTO',
          };
        },
      },
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
      eventSettingsProjection: {
        async findUnique() {
          return { approvalMode: 'AUTO' };
        },
      },
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
        phoneNumbers: [
          {
            type: 'MOBILE',
            number: '+4915112345678',
            countryCode: '+49',
            isPrimary: true,
            label: null,
          },
        ],
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
  assert.equal(approvalCalls[0].activeEventId, existing.eventId);
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

test('invitation permission resolver prefers access projection over legacy roles', async () => {
  const resolver = new InvitationEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return {
          permissions: [EventPermissionKey.ViewInvitations, 'unknown.permission'],
        };
      },
    },
    eventRoleProjection: {
      async findUnique() {
        throw new Error('legacy fallback must not be used when access projection exists');
      },
    },
  });

  assert.deepEqual(await resolver.getPermissionsForUser('user-1', 'event-1'), [
    EventPermissionKey.ViewInvitations,
  ]);
});

test('invitation permission resolver treats empty access projection as immediate access removal', async () => {
  const resolver = new InvitationEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return { permissions: [] };
      },
    },
    eventRoleProjection: {
      async findUnique() {
        return { role: EventRoleType.ADMIN };
      },
    },
  });

  assert.deepEqual(await resolver.getPermissionsForUser('user-1', 'event-1'), []);
});

test('invitation permission resolver keeps legacy SUPPORT fallback compatible', async () => {
  const resolver = new InvitationEventRoleResolver({
    eventAccessProjection: {
      async findUnique() {
        return null;
      },
    },
    eventRoleProjection: {
      async findUnique() {
        return { role: EventRoleType.SUPPORT };
      },
    },
  });

  const permissions = await resolver.getPermissionsForUser('user-1', 'event-1');
  assert.ok(permissions.includes(EventPermissionKey.ViewSupport));
  assert.equal(permissions.includes(EventPermissionKey.ViewInvitations), false);
});

test('plus-one creation rejects cross-user access', async () => {
  const parentInvitation = {
    id: 'parent-1',
    eventId: 'event-1',
    guestProfileId: 'guest-owner',
    invitedByUserId: 'creator-user',
    maxInvitees: 5,
    type: InvitationType.PRIVATE,
    status: InvitationStatus.APPROVED,
    invitedByInvitationId: null,
    firstName: 'Guest',
    lastName: 'Owner',
    email: null,
    phoneNumber: null,
    eventName: 'Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    autoApproveOnAccept: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    pendingContactId: null,
    rsvpChoice: RsvpChoice.YES,
    rsvpAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: null,
    approvedByUserId: null,
    selectedInvitedBy: [],
    guestNote: null,
    plusOneAgeCategory: null,
    phoneNumbers: [],
  };

  const transactionClient = {
    invitation: {
      async findUnique() {
        return parentInvitation;
      },
      async updateMany() {
        return { count: 1 };
      },
      async create(data) {
        return { id: 'plusone-1', ...data.data };
      },
      async update() {
        return { id: 'plusone-1', pendingContactId: 'pending-1' };
      },
    },
    eventSettingsProjection: {
      async findUnique() {
        return { requireApprovalForPlusOnes: true };
      },
    },
  };

  const service = new GuestWriteService(
    {
      $transaction: async (work) => work(transactionClient),
      invitation: { findUnique: async () => parentInvitation },
    },
    logger,
    { set: async () => 'pending-1' },
    { send: async () => {} },
    { async approve() { return parentInvitation; } },
  );

  await assert.rejects(
    service.createPlusOne({
      input: {
        eventId: 'event-1',
        invitedByInvitationId: 'parent-1',
        firstName: 'Intruder',
        lastName: 'User',
        plusOneAgeCategory: 'ADULT',
      },
      actorId: 'attacker-user',
      clientInfo: { locale: 'en-US' },
    }),
    (error) => {
      assert.ok(error instanceof InvitationAccessDeniedException);
      return true;
    },
  );
});

test('plus-one deletion rejects cross-user access', async () => {
  const childInvitation = {
    id: 'child-1',
    invitedByInvitationId: 'parent-1',
    guestProfileId: null,
    pendingContactId: null,
    eventId: 'event-1',
    type: InvitationType.PRIVATE,
    status: InvitationStatus.ACCEPTED,
    invitedByUserId: 'creator-user',
    firstName: 'Plus',
    lastName: 'One',
    email: null,
    phoneNumber: null,
    eventName: 'Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    autoApproveOnAccept: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    rsvpChoice: RsvpChoice.YES,
    rsvpAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: null,
    approvedByUserId: null,
    maxInvitees: 0,
    selectedInvitedBy: [],
    guestNote: null,
    plusOneAgeCategory: 'ADULT',
    phoneNumbers: [],
  };

  const transactionClient = {
    invitation: {
      async findUnique(args) {
        if (args?.where?.id === 'parent-1') {
          return {
            id: 'parent-1',
            guestProfileId: 'guest-owner',
            invitedByUserId: 'creator-user',
          };
        }
        return childInvitation;
      },
      async delete() {
        return childInvitation;
      },
      async update() {
        return { ...childInvitation, maxInvitees: 1 };
      },
    },
  };

  const service = new GuestWriteService(
    {
      $transaction: async (work) => work(transactionClient),
      invitation: {
        findUnique: async () => childInvitation,
      },
    },
    logger,
    { set: async () => {} },
    {
      send: async () => {},
    },
    { async approve() { return childInvitation; } },
  );

  await assert.rejects(
    service.deletePlusOne('child-1', 'attacker-user'),
    (error) => {
      assert.ok(error instanceof InvitationAccessDeniedException);
      return true;
    },
  );
});

test('plus-one bulk deletion rejects cross-user access', async () => {
  const transactionClient = {
    invitation: {
      async findUnique() {
        return { id: 'parent-1', eventId: 'event-1', plusOnes: [] };
      },
      async findMany() {
        return [];
      },
      async delete() {
        return {};
      },
      async update() {
        return {};
      },
    },
  };

  const service = new GuestWriteService(
    {
      $transaction: async (work) => work(transactionClient),
      invitation: { findUnique: async () => ({ id: 'parent-1', eventId: 'event-1' }) },
    },
    logger,
    { set: async () => {} },
    { send: async () => {} },
    { async approve() { return { id: 'parent-1' }; } },
  );

  await assert.rejects(
    service.deleteAllPlusOnes('parent-1', 'attacker-user'),
    (error) => {
      assert.ok(error instanceof InvitationAccessDeniedException);
      return true;
    },
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
