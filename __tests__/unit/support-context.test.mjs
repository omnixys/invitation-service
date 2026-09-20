import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

// The controller reads the internal token from env at module load. Avoid
// depending on the ambient .env value (which varies per environment) so the
// test is deterministic. dotenv does not override an already-set variable.
process.env.INTERNAL_GATEWAY_TOKEN = process.env.TEST_INTERNAL_GATEWAY_TOKEN ?? 'dev-internal-gateway-token';

const { SupportContextController } = await import(
  '../../dist/invitation/controller/support-context.controller.js'
);

const eventId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

function mockPrisma(invitation) {
  return {
    invitation: {
      findUnique: async () => invitation,
    },
  };
}

function mockInvitationStore(invitations) {
  return {
    invitation: {
      findUnique: async ({ where }) => invitations.find((i) => i.id === where.id) ?? null,
      findFirst: async ({ where }) => {
        return (
          invitations.find((i) => {
            if (where.eventId && i.eventId !== where.eventId) return false;
            if (where.guestProfileId && i.guestProfileId !== where.guestProfileId) return false;
            if (where.status?.notIn && where.status.notIn.includes(i.status)) return false;
            const endedOk = i.eventEndsAt === null || new Date(i.eventEndsAt) > new Date();
            if (!endedOk) return false;
            return true;
          }) ?? null
        );
      },
    },
  };
}

test('support context returns event and guest data for a valid invitation', async () => {
  const controller = new SupportContextController(
    mockPrisma({
      id: 'inv-1',
      eventId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phoneNumber: '+491711234567',
      status: 'APPROVED',
      eventEndsAt: new Date(Date.now() + 60_000),
    }),
  );

  const result = await controller.supportContext('dev-internal-gateway-token', 'inv-1');
  assert.deepEqual(result, {
    invitationId: 'inv-1',
    eventId,
    guestName: 'Ada Lovelace',
    guestContact: '+491711234567',
  });
});

test('support context falls back to email when no phone is present', async () => {
  const controller = new SupportContextController(
    mockPrisma({
      id: 'inv-2',
      eventId,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      phoneNumber: null,
      status: 'ACCEPTED',
    }),
  );

  const result = await controller.supportContext('dev-internal-gateway-token', 'inv-2');
  assert.equal(result.guestContact, 'grace@example.com');
  assert.equal(result.guestName, 'Grace Hopper');
});

test('support context rejects invalid internal tokens', async () => {
  const controller = new SupportContextController(
    mockPrisma({ id: 'inv-1', eventId, status: 'APPROVED' }),
  );
  await assert.rejects(
    controller.supportContext('invalid-token', 'inv-1'),
    (error) => error?.getResponse?.().code === 'INTERNAL_TOKEN_INVALID',
  );
  await assert.rejects(
    controller.supportContext(undefined, 'inv-1'),
    (error) => error?.getResponse?.().code === 'INTERNAL_TOKEN_INVALID',
  );
});

test('support context rejects missing invitationId', async () => {
  const controller = new SupportContextController(mockPrisma(undefined));
  await assert.rejects(
    controller.supportContext('dev-internal-gateway-token', undefined),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVALID',
  );
});

test('support context returns no PII for unknown invitations', async () => {
  const controller = new SupportContextController(mockPrisma(undefined));
  await assert.rejects(
    controller.supportContext('dev-internal-gateway-token', 'missing-inv'),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_NOT_FOUND',
  );
});

test('support context rejects declined, cancelled and rejected invitations (fail-closed)', async () => {
  for (const status of ['DECLINED', 'CANCELED', 'REJECTED']) {
    const controller = new SupportContextController(
      mockPrisma({
        id: 'inv-x',
        eventId,
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.com',
        phoneNumber: null,
        status,
      }),
    );
    await assert.rejects(
      controller.supportContext('dev-internal-gateway-token', 'inv-x'),
      (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_INVALID',
      `expected status ${status} to be rejected`,
    );
  }
});

test('support context rejects invitations after the event has ended', async () => {
  const controller = new SupportContextController(
    mockPrisma({
      id: 'inv-expired',
      eventId,
      firstName: 'Expired',
      lastName: 'Guest',
      email: 'expired@example.com',
      phoneNumber: null,
      status: 'APPROVED',
      eventEndsAt: new Date(Date.now() - 60_000),
    }),
  );

  await assert.rejects(
    controller.supportContext('dev-internal-gateway-token', 'inv-expired'),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_INVALID',
  );
});

// =========================================================================
//  GET /internal/rsvp-support/access (synchronous guest lookup by user)
// =========================================================================

test('access returns the event context for a valid invitation of the user', async () => {
  const controller = new SupportContextController(
    mockInvitationStore([
      {
        id: 'inv-u1',
        eventId,
        guestProfileId: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phoneNumber: null,
        status: 'APPROVED',
        eventEndsAt: new Date(Date.now() + 60_000),
      },
    ]),
  );

  const result = await controller.userAccess(
    'dev-internal-gateway-token',
    eventId,
    userId,
  );
  assert.deepEqual(result, {
    invitationId: 'inv-u1',
    eventId,
    guestName: 'Ada Lovelace',
    guestContact: 'ada@example.com',
  });
});

test('access requires a valid internal token', async () => {
  const controller = new SupportContextController(mockInvitationStore([]));
  await assert.rejects(
    controller.userAccess('invalid-token', eventId, userId),
    (error) => error?.getResponse?.().code === 'INTERNAL_TOKEN_INVALID',
  );
  await assert.rejects(
    controller.userAccess(undefined, eventId, userId),
    (error) => error?.getResponse?.().code === 'INTERNAL_TOKEN_INVALID',
  );
});

test('access rejects missing or malformed eventId/userId', async () => {
  const controller = new SupportContextController(mockInvitationStore([]));
  for (const args of [
    [undefined, userId],
    [eventId, undefined],
    ['not-a-uuid', userId],
    [eventId, 'not-a-uuid'],
  ]) {
    await assert.rejects(
      controller.userAccess('dev-internal-gateway-token', args[0], args[1]),
      (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVALID',
    );
  }
});

test('access fails closed for a user without a valid invitation', async () => {
  const controller = new SupportContextController(mockInvitationStore([]));
  await assert.rejects(
    controller.userAccess('dev-internal-gateway-token', eventId, userId),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_NOT_FOUND',
  );
});

test('access excludes declined invitations and expired events (findFirst filter)', async () => {
  const controller = new SupportContextController(
    mockInvitationStore([
      {
        id: 'inv-declined',
        eventId,
        guestProfileId: userId,
        firstName: 'Declined',
        lastName: 'Guest',
        email: 'declined@example.com',
        phoneNumber: null,
        status: 'DECLINED',
        eventEndsAt: new Date(Date.now() + 60_000),
      },
      {
        id: 'inv-expired-user',
        eventId,
        guestProfileId: userId,
        firstName: 'Expired',
        lastName: 'Guest',
        email: 'expired@example.com',
        phoneNumber: null,
        status: 'APPROVED',
        eventEndsAt: new Date(Date.now() - 60_000),
      },
    ]),
  );

  await assert.rejects(
    controller.userAccess('dev-internal-gateway-token', eventId, userId),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_NOT_FOUND',
  );
});

test('access ignores invitations of other events and other users', async () => {
  const controller = new SupportContextController(
    mockInvitationStore([
      {
        id: 'inv-other-event',
        eventId: '44444444-4444-4444-8444-444444444444',
        guestProfileId: userId,
        firstName: 'Other',
        lastName: 'Event',
        email: 'other@example.com',
        phoneNumber: null,
        status: 'APPROVED',
        eventEndsAt: null,
      },
      {
        id: 'inv-other-user',
        eventId,
        guestProfileId: '55555555-5555-4555-8555-555555555555',
        firstName: 'Other',
        lastName: 'User',
        email: 'ou@example.com',
        phoneNumber: null,
        status: 'APPROVED',
        eventEndsAt: null,
      },
    ]),
  );

  await assert.rejects(
    controller.userAccess('dev-internal-gateway-token', eventId, userId),
    (error) => error?.getResponse?.().code === 'SUPPORT_CONTEXT_INVITATION_NOT_FOUND',
  );
});
