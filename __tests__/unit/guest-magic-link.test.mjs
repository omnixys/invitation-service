import { GuestMutationResolver } from '../../dist/invitation/resolver/guest-mutation.resolver.js';
import { GuestMagicLinkService } from '../../dist/invitation/service/guest-magic-link.service.js';
import { GuestMagicLinkMetricsService } from '../../dist/invitation/metrics/guest-magic-link.metrics.service.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const client = {
  locale: 'de-DE',
  device: 'mobile',
  ip: '127.0.0.1',
  location: 'Berlin',
};

function createHarness(matches = [], { rateLimitCount = 0 } = {}) {
  const logs = [];
  const sends = [];
  const logger = {
    log() {
      return {
        info(_message, context) {
          logs.push(context);
        },
        debug() {},
      };
    },
  };
  const prisma = { async $queryRaw() { return matches; } };
  const producer = { async send(event) { sends.push(event); } };
  const metrics = new GuestMagicLinkMetricsService();
  const rateLimitStore = {
    async incr() {
      rateLimitCount += 1;
      return rateLimitCount;
    },
    async expire() {},
  };
  return {
    logs,
    sends,
    metrics,
    service: new GuestMagicLinkService(logger, prisma, producer, metrics, rateLimitStore),
  };
}

test('public resolver always returns true after accepting the identifier', async () => {
  const logger = { log: () => ({ debug() {} }) };
  const resolver = new GuestMutationResolver(logger, {}, {
    async request() {
      throw new Error('internal failure');
    },
  });

  assert.equal(await resolver.requestGuestMagicLink('unknown@example.com', null, null, client), true);
  assert.equal(await resolver.requestGuestMagicLink('+4915112345678', null, null, client), true);
});

test('public response does not await distinguishable lookup or dispatch work', async () => {
  let processingFinished = false;
  let finishProcessing;
  const resolver = new GuestMutationResolver(
    { log: () => ({ debug() {} }) },
    {},
    {
      request: () =>
        new Promise((resolve) => {
          finishProcessing = () => {
            processingFinished = true;
            resolve();
          };
        }),
    },
  );

  assert.equal(await resolver.requestGuestMagicLink('guest@example.com', null, null, client), true);
  assert.equal(processingFinished, false);
  finishProcessing();
});

test('ineligible, missing and ambiguous invitations never dispatch', async () => {
  const cases = [
    [],
    [{ guestProfileId: 'guest-1', status: 'PENDING', eventEndsAt: null }],
    [{ guestProfileId: 'guest-1', status: 'DECLINED', eventEndsAt: null }],
    [{ guestProfileId: 'guest-1', status: 'REJECTED', eventEndsAt: null }],
    [{ guestProfileId: 'guest-1', status: 'CANCELED', eventEndsAt: null }],
    [{ guestProfileId: 'guest-1', status: 'APPROVED', eventEndsAt: new Date(0) }],
    [{ guestProfileId: null, status: 'ACCEPTED', eventEndsAt: null }],
    [
      { guestProfileId: 'guest-1', status: 'APPROVED', eventEndsAt: null },
      { guestProfileId: 'guest-2', status: 'APPROVED', eventEndsAt: null },
    ],
  ];

  for (const matches of cases) {
    const harness = createHarness(matches);
    await harness.service.request({ identifier: 'guest@example.com' }, client);
    assert.equal(harness.sends.length, 0);
  }
});

test('the entered identifier fixes the recipient and channel', async () => {
  const match = [
    {
      guestProfileId: 'guest-1',
      status: 'APPROVED',
      eventEndsAt: new Date(Date.now() + 60_000),
    },
  ];
  const email = createHarness(match);
  await email.service.request({ identifier: ' Guest@Example.COM ' }, client);
  assert.equal(email.sends[0].payload.recipient, 'guest@example.com');
  assert.equal(email.sends[0].payload.channel, 'EMAIL');

  const phone = createHarness(match);
  await phone.service.request({ identifier: '+49 151 12345678' }, client);
  assert.equal(phone.sends[0].payload.recipient, '+4915112345678');
  assert.equal(phone.sends[0].payload.channel, 'WHATSAPP');
});

test('structured logs contain correlation data but no identifier or token', async () => {
  const harness = createHarness([]);
  await harness.service.request({ identifier: 'private@example.com' }, client);
  const serialized = JSON.stringify(harness.logs);

  assert.match(serialized, /identifierFingerprint/);
  assert.match(serialized, /correlationId/);
  assert.doesNotMatch(serialized, /private@example\.com/);
  assert.doesNotMatch(serialized, /token/i);
});

test('rate-limited requests never dispatch and are classified RATE_LIMITED', async () => {
  const match = [
    {
      guestProfileId: 'guest-1',
      status: 'APPROVED',
      eventEndsAt: new Date(Date.now() + 60_000),
    },
  ];
  const harness = createHarness(match, { rateLimitCount: 11 });
  await harness.service.request({ identifier: 'guest@example.com' }, client);

  assert.equal(harness.sends.length, 0);
  const rateLimited = harness.logs.find((entry) => entry.result === 'RATE_LIMITED');
  assert.ok(rateLimited);
  assert.equal(rateLimited.correlationId.length > 0, true);
  assert.equal('recipient' in rateLimited, false);
  assert.equal('ip' in rateLimited, false);
});

test('metrics snapshot counts results, channels and dispatches without identifiers', async () => {
  const match = [
    {
      guestProfileId: 'guest-1',
      status: 'APPROVED',
      eventEndsAt: new Date(Date.now() + 60_000),
    },
  ];
  const dispatchedHarness = createHarness(match);
  await dispatchedHarness.service.request({ identifier: 'guest@example.com' }, client);
  await dispatchedHarness.service.request({ identifier: '+49 151 12345678' }, client);

  const noMatchHarness = createHarness([]);
  await noMatchHarness.service.request({ identifier: 'unknown@example.com' }, client);

  const snapshot = dispatchedHarness.metrics.snapshot();
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.dispatched, 2);
  assert.equal(snapshot.byResult.DISPATCH_QUEUED, 2);
  assert.equal(snapshot.byChannel.EMAIL, 1);
  assert.equal(snapshot.byChannel.WHATSAPP, 1);

  const noMatchSnapshot = noMatchHarness.metrics.snapshot();
  assert.equal(noMatchSnapshot.total, 1);
  assert.equal(noMatchSnapshot.dispatched, 0);
  assert.equal(noMatchSnapshot.byResult.NO_MATCH, 1);
});

function approvedMatch(overrides = {}) {
  return {
    guestProfileId: 'guest-1',
    status: 'APPROVED',
    eventEndsAt: new Date(Date.now() + 60_000),
    firstName: 'Sdf',
    lastName: 'Sdfsdf',
    invitedByInvitationId: null,
    updatedAt: new Date('2026-09-13T11:34:02.000Z'),
    ...overrides,
  };
}

test('duplicate phone with parent + child resolves to the matching name', async () => {
  const parent = approvedMatch({
    guestProfileId: 'guest-parent',
    firstName: 'Sdf',
    lastName: 'Sdfsdf',
    invitedByInvitationId: null,
    updatedAt: new Date('2026-09-13T10:00:00.000Z'),
  });
  const child = approvedMatch({
    guestProfileId: 'guest-child',
    firstName: 'Wer',
    lastName: 'Rwe',
    invitedByInvitationId: 'guest-parent',
    updatedAt: new Date('2026-09-13T11:00:00.000Z'),
  });

  const forChild = createHarness([parent, child]);
  await forChild.service.request(
    { identifier: '+4915111951223', firstName: 'Wer', lastName: 'Rwe' },
    client,
  );
  assert.equal(forChild.sends[0].payload.userId, 'guest-child');

  const forParent = createHarness([parent, child]);
  await forParent.service.request(
    { identifier: '+4915111951223', firstName: 'Sdf', lastName: 'Sdfsdf' },
    client,
  );
  assert.equal(forParent.sends[0].payload.userId, 'guest-parent');
});

test('duplicate phone with parent + child and no name resolves to the parent', async () => {
  const parent = approvedMatch({
    guestProfileId: 'guest-parent',
    firstName: 'Sdf',
    lastName: 'Sdfsdf',
    invitedByInvitationId: null,
  });
  const child = approvedMatch({
    guestProfileId: 'guest-child',
    firstName: 'Wer',
    lastName: 'Rwe',
    invitedByInvitationId: 'guest-parent',
  });

  const harness = createHarness([parent, child]);
  await harness.service.request({ identifier: '+4915111951223' }, client);
  assert.equal(harness.sends[0].payload.userId, 'guest-parent');
});

test('two roots with same phone and same name dispatch the newest updatedAt', async () => {
  const older = approvedMatch({
    guestProfileId: 'guest-a',
    firstName: 'Max',
    lastName: 'Mustermann',
    updatedAt: new Date('2026-09-01T08:00:00.000Z'),
  });
  const newer = approvedMatch({
    guestProfileId: 'guest-b',
    firstName: 'Max',
    lastName: 'Mustermann',
    updatedAt: new Date('2026-09-05T08:00:00.000Z'),
  });

  const harness = createHarness([older, newer]);
  await harness.service.request(
    { identifier: '+4915111951223', firstName: 'Max', lastName: 'Mustermann' },
    client,
  );
  assert.equal(harness.sends[0].payload.userId, 'guest-b');
});

test('two roots with same phone but no name remain AMBIGUOUS', async () => {
  const rootA = approvedMatch({ guestProfileId: 'guest-a', firstName: 'Max', lastName: 'Müller' });
  const rootB = approvedMatch({ guestProfileId: 'guest-b', firstName: 'Anna', lastName: 'Schmidt' });

  const harness = createHarness([rootA, rootB]);
  await harness.service.request({ identifier: '+4915111951223' }, client);
  assert.equal(harness.sends.length, 0);
  assert.ok(harness.logs.find((entry) => entry.result === 'AMBIGUOUS'));
});

test('two roots with same phone and equal updatedAt stay AMBIGUOUS', async () => {
  const rootA = approvedMatch({
    guestProfileId: 'guest-a',
    firstName: 'Max',
    lastName: 'Mustermann',
    updatedAt: new Date('2026-09-05T08:00:00.000Z'),
  });
  const rootB = approvedMatch({
    guestProfileId: 'guest-b',
    firstName: 'Max',
    lastName: 'Mustermann',
    updatedAt: new Date('2026-09-05T08:00:00.000Z'),
  });

  const harness = createHarness([rootA, rootB]);
  await harness.service.request(
    { identifier: '+4915111951223', firstName: 'Max', lastName: 'Mustermann' },
    client,
  );
  assert.equal(harness.sends.length, 0);
  assert.ok(harness.logs.find((entry) => entry.result === 'AMBIGUOUS'));
});

test('provided name that matches no invitation is AMBIGUOUS, never dispatched', async () => {
  const parent = approvedMatch({
    guestProfileId: 'guest-parent',
    firstName: 'Sdf',
    lastName: 'Sdfsdf',
    invitedByInvitationId: null,
  });
  const child = approvedMatch({
    guestProfileId: 'guest-child',
    firstName: 'Wer',
    lastName: 'Rwe',
    invitedByInvitationId: 'guest-parent',
  });

  const harness = createHarness([parent, child]);
  await harness.service.request(
    { identifier: '+4915111951223', firstName: 'Tippo', lastName: 'Fehler' },
    client,
  );
  assert.equal(harness.sends.length, 0);
  assert.ok(harness.logs.find((entry) => entry.result === 'AMBIGUOUS'));
});

test('explicit name comparison is case- and whitespace-insensitive', async () => {
  const parent = approvedMatch({
    guestProfileId: 'guest-parent',
    firstName: 'Sdf',
    lastName: 'Sdfsdf',
    invitedByInvitationId: null,
  });
  const child = approvedMatch({
    guestProfileId: 'guest-child',
    firstName: 'Wer',
    lastName: 'Rwe',
    invitedByInvitationId: 'guest-parent',
  });

  const harness = createHarness([parent, child]);
  await harness.service.request(
    { identifier: '+4915111951223', firstName: ' sdf ', lastName: ' SDFSDF ' },
    client,
  );
  assert.equal(harness.sends[0].payload.userId, 'guest-parent');
});
