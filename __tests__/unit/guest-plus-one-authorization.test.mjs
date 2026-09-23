import { InvitationAccessDeniedException } from '../../dist/invitation/errors/invitation-domain.error.js';
import { GuestWriteService } from '../../dist/invitation/service/guest-write.service.js';
import {
  InvitationStatus,
  InvitationType,
  RsvpChoice,
} from '../../dist/prisma/generated/client.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const PARENT_ID = 'parent-1';
const CHILD_ID = 'child-1';
const EVENT_ID = 'event-1';
const GUEST_OWNER = 'guest-owner';
const ORIGIN_CREATOR = 'origin-creator';
const STAFF_USER = 'staff-user';

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

function childInvitation(overrides = {}) {
  return {
    id: CHILD_ID,
    type: InvitationType.PRIVATE,
    firstName: 'Plus',
    lastName: 'One',
    eventId: EVENT_ID,
    eventName: 'Platform Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    autoApproveOnAccept: false,
    guestProfileId: null,
    email: null,
    phoneNumber: null,
    status: InvitationStatus.ACCEPTED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    pendingContactId: null,
    rsvpChoice: RsvpChoice.YES,
    rsvpAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: null,
    approvedByUserId: null,
    maxInvitees: 0,
    invitedByInvitationId: PARENT_ID,
    invitedByUserId: ORIGIN_CREATOR,
    selectedInvitedBy: [],
    guestNote: null,
    plusOneAgeCategory: 'ADULT',
    phoneNumbers: [],
    ...overrides,
  };
}

function parentInvitation(overrides = {}) {
  return {
    id: PARENT_ID,
    eventId: EVENT_ID,
    guestProfileId: GUEST_OWNER,
    invitedByUserId: ORIGIN_CREATOR,
    ...overrides,
  };
}

function makeService({ parent, child, permissions }) {
  const calls = [];
  const transactionClient = {
    invitation: {
      async findUnique({ where }) {
        if (where?.id === PARENT_ID) {
          return parent;
        }
        return child;
      },
      async delete({ where }) {
        calls.push(`delete:${where.id}`);
        return child;
      },
      async update({ where, data }) {
        calls.push(`update:${where.id}`);
        return { ...child, maxInvitees: 1, ...(data ?? {}) };
      },
    },
  };
  const service = new GuestWriteService(
    {
      $transaction: async (work) => work(transactionClient),
      invitation: { findUnique: async () => child },
    },
    logger,
    { set: async () => 'pending-1' },
    { send: async () => {} },
    { async approve() { return child; } },
    { enqueue: async () => undefined },
    {
      getPermissionsForUser: async (userId, eventId) => {
        calls.push(`permissions:${userId}:${eventId}`);
        return permissions;
      },
    },
  );
  return { service, calls };
}

test('staff with plus_ones.manage may delete a plus-one of a parent they neither own nor created', async () => {
  const { service, calls } = makeService({
    parent: parentInvitation(),
    child: childInvitation(),
    permissions: ['plus_ones.manage'],
  });

  const result = await service.deletePlusOne(CHILD_ID, STAFF_USER);

  assert.equal(result.id, CHILD_ID);
  assert.deepEqual(calls, [
    'permissions:staff-user:event-1',
    'delete:child-1',
    'update:parent-1',
  ]);
});

test('staff without plus_ones.manage and without ownership is denied', async () => {
  const { service } = makeService({
    parent: parentInvitation(),
    child: childInvitation(),
    permissions: [],
  });

  await assert.rejects(
    service.deletePlusOne(CHILD_ID, STAFF_USER),
    (error) => {
      assert.ok(error instanceof InvitationAccessDeniedException);
      assert.equal(error.code, 'INVITATION_ACCESS_DENIED');
      return true;
    },
  );
});

test('the parent guest owner may manage plus-ones without an event permission', async () => {
  const { service, calls } = makeService({
    parent: parentInvitation(),
    child: childInvitation(),
    permissions: [],
  });

  const result = await service.deletePlusOne(CHILD_ID, GUEST_OWNER);

  assert.equal(result.id, CHILD_ID);
  assert.deepEqual(calls, ['delete:child-1', 'update:parent-1']);
});

test('the invitation creator may manage plus-ones without an event permission', async () => {
  const { service, calls } = makeService({
    parent: parentInvitation(),
    child: childInvitation(),
    permissions: [],
  });

  const result = await service.deletePlusOne(CHILD_ID, ORIGIN_CREATOR);

  assert.equal(result.id, CHILD_ID);
  assert.deepEqual(calls, ['delete:child-1', 'update:parent-1']);
});