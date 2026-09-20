import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

const { AdminWriteService } = await import(
  '../../dist/invitation/service/invitation-admin.write.service.js'
);

const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

function makeInvitation({ withProfile = true } = {}) {
  const base = {
    id: 'inv-approve-grant',
    type: 'PRIVATE',
    status: 'PENDING',
    eventId: EVENT_ID,
    eventName: 'Test Event',
    eventEndsAt: new Date('2099-01-01T00:00:00Z'),
    autoApproveOnAccept: false,
    firstName: 'Caleb',
    lastName: 'Gyamfi',
    guestProfileId: PROFILE_ID,
    createdAt: new Date('2026-09-20T06:48:00.000Z'),
    updatedAt: new Date('2026-09-20T06:50:59.000Z'),
    pendingContactId: 'pending-contact-1',
    rsvpChoice: 'YES',
    rsvpAt: new Date('2026-09-20T06:48:00.000Z'),
    approvedAt: null,
    approvedByUserId: null,
    maxInvitees: 0,
    invitedByInvitationId: null,
    invitedByUserId: null,
    confirmationSentAt: null,
    confirmationResendCount: 0,
    email: 'guest@example.com',
    phoneNumber: '+491711234567',
    selectedInvitedBy: [],
    guestNote: null,
    plusOneAgeCategory: null,
  };
  if (!withProfile) {
    base.guestProfileId = null;
  }
  return base;
}

function makeLogger() {
  const scoped = {
    debug: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
  };
  return { log: () => scoped };
}

function makeService({ invitation, grantError, onGrant }) {
  const seq = [];
  const prisma = {
    invitation: {
      findUnique: async () => invitation,
      update: async () => {
        seq.push('update');
        return { ...invitation, status: 'APPROVED', approvedAt: new Date() };
      },
    },
    eventSettingsProjection: {
      findUnique: async () => ({ scheduleTicketRelease: false, ticketReleaseAt: null }),
    },
  };
const eventAccessClient = {
    grantGuestAccess: async (input) => {
      seq.push('grant');
      onGrant?.(input);
      if (grantError) {
        throw grantError;
      }
    },
  };
  const guestConfirmation = {
    sendFirstConfirmationOrReserve: async () => ({ sent: true }),
  };
  const service = new AdminWriteService(
    prisma,
    makeLogger(),
    { send: async () => {} },
    { delete: async () => {} },
    {},
    {},
    guestConfirmation,
    eventAccessClient,
    null,
  );
  return { service, seq };
}

const approveArgs = {
  id: 'inv-approve-grant',
  approve: true,
  actorId: ACTOR_ID,
  activeEventId: EVENT_ID,
};

test('approving an invitation with a guest profile grants event access before persisting', async () => {
  const invitation = makeInvitation({ withProfile: true });
  const granted = [];
  const { service, seq } = makeService({
    invitation,
    onGrant: (input) => granted.push(input),
  });

  await service.approve(approveArgs);

  assert.equal(granted.length, 1);
  assert.deepEqual(granted[0], {
    eventId: EVENT_ID,
    userId: PROFILE_ID,
    actorId: ACTOR_ID,
  });
  assert.deepEqual(seq, ['grant', 'update']);
});

test('approving an invitation without a guest profile does not grant access', async () => {
  const invitation = makeInvitation({ withProfile: false });
  const granted = [];
  const { service, seq } = makeService({ invitation, onGrant: (i) => granted.push(i) });

  await service.approve(approveArgs);

  assert.equal(granted.length, 0);
  assert.deepEqual(seq, ['update']);
});

test('a failing grant aborts the approval before the invitation is marked APPROVED', async () => {
  const invitation = makeInvitation({ withProfile: true });
  const boom = new Error('grant failed');
  const { service, seq } = makeService({ invitation, grantError: boom });

  await assert.rejects(service.approve(approveArgs), (error) => error === boom);
  assert.deepEqual(seq, ['grant']);
});