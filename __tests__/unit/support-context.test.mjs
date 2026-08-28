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

function mockPrisma(invitation) {
  return {
    invitation: {
      findUnique: async () => invitation,
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
