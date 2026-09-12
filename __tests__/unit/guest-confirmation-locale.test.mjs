import { GuestConfirmationService } from '../../dist/invitation/service/guest-confirmation.service.js';
import { AdminWriteService } from '../../dist/invitation/service/invitation-admin.write.service.js';
import {
  InvitationStatus,
  RsvpChoice,
} from '../../dist/prisma/generated/client.js';
import { ContextAccessor } from '@omnixys/context-ts';
import { KafkaTopics } from '@omnixys/kafka-ts';
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
    firstName: 'Ada',
    lastName: 'Lovelace',
    eventId: 'event-1',
    eventName: 'Platform Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    guestProfileId: null,
    status: InvitationStatus.PENDING,
    pendingContactId: 'pc-1',
    pendingContactPayload: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      invitationId: 'invitation-1',
      eventId: 'event-1',
      eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
      locale: 'de-DE',
      actorId: 'actor-1',
    },
    phoneNumbers: [],
    ...overrides,
  };
}

function guestConfirmationService({ prisma, cache, sent, scheduled }) {
  return new GuestConfirmationService(
    prisma,
    cache,
    { send: async (event) => sent.push(event) },
    { schedule: async (job) => scheduled.push(job) },
    { enqueue: async () => undefined },
    logger,
  );
}

test('sendFirstConfirmation overrides the stored pending payload locale', async () => {
  const sent = [];
  const scheduled = [];
  const stored = invitation({
    status: InvitationStatus.APPROVED,
  });
  const cached = [];

  const service = guestConfirmationService({
    prisma: {
      invitation: {
        async findUnique({ select }) {
          return select ? { eventId: stored.eventId } : stored;
        },
        async update({ data }) {
          Object.assign(stored, data);
          return stored;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return null;
        },
      },
    },
    cache: {
      async set(_key, value, _ttl) {
        cached.push(value);
        return 'token-1';
      },
    },
    sent,
    scheduled,
  });

  const ok = await ContextAccessor.run(
    {
      requestId: 'request-locale',
      correlationId: 'correlation-locale',
      tenantId: 'tenant-1',
      actorId: 'admin-1',
    },
    () =>
      service.sendFirstConfirmation({
        invitationId: 'invitation-1',
        seatId: 'seat-1',
        actorId: 'admin-1',
        locale: 'en-US',
      }),
  );

  assert.equal(ok, true);
  assert.equal(JSON.parse(cached[0]).locale, 'en-US');
  assert.equal(stored.pendingContactPayload.locale, 'en-US');
  assert.equal(stored.pendingContactId, 'token-1');
  assert.equal(sent[0].topic, KafkaTopics.notification.confirmGuest);
  assert.equal(sent[0].payload.token, 'token-1');
});

test('sendFirstConfirmation ignores a locale when it is not in the supported set', async () => {
  const sent = [];
  const scheduled = [];
  const stored = invitation({
    status: InvitationStatus.APPROVED,
  });
  const cached = [];

  const service = guestConfirmationService({
    prisma: {
      invitation: {
        async findUnique({ select }) {
          return select ? { eventId: stored.eventId } : stored;
        },
        async update({ data }) {
          Object.assign(stored, data);
          return stored;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return null;
        },
      },
    },
    cache: {
      async set(_key, value, _ttl) {
        cached.push(value);
        return 'token-1';
      },
    },
    sent,
    scheduled,
  });

  const ok = await service.sendFirstConfirmation({
    invitationId: 'invitation-1',
    actorId: 'admin-1',
    locale: 'fr-FR',
  });

  assert.equal(ok, true);
  assert.equal(JSON.parse(cached[0]).locale, 'de-DE');
});

test('resendConfirmation overrides the stored pending payload locale', async () => {
  const sent = [];
  const scheduled = [];
  const stored = invitation({
    status: InvitationStatus.APPROVED,
    pendingContactPayload: {
      invitationId: 'invitation-1',
      eventId: 'event-1',
      eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
      locale: 'de-DE',
      actorId: 'actor-1',
      seatId: 'seat-1',
    },
  });
  const cached = [];

  const service = guestConfirmationService({
    prisma: {
      invitation: {
        async findUnique({ select }) {
          return select ? { eventId: stored.eventId } : stored;
        },
        async update({ data }) {
          Object.assign(stored, data);
          return stored;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return null;
        },
      },
      async $transaction(work) {
        return work(null);
      },
    },
    cache: {
      async rawGet() {
        return null;
      },
      async rawSet() {
        return undefined;
      },
      async set(_key, value, _ttl) {
        cached.push(value);
        return 'token-2';
      },
    },
    sent,
    scheduled,
  });

  const result = await ContextAccessor.run(
    {
      requestId: 'request-resend-locale',
      correlationId: 'correlation-resend-locale',
      tenantId: 'tenant-1',
      actorId: 'admin-1',
    },
    () =>
      service.resendConfirmation({
        invitationId: 'invitation-1',
        actorId: 'admin-1',
        locale: 'en-US',
      }),
  );

  assert.deepEqual(result, { resent: true });
  assert.equal(JSON.parse(cached[0]).locale, 'en-US');
  assert.equal(stored.pendingContactPayload.locale, 'en-US');
  assert.equal(stored.pendingContactId, 'token-2');
  assert.deepEqual(stored.confirmationResendCount, { increment: 1 });
  assert.equal(sent[0].topic, KafkaTopics.notification.confirmGuest);
  assert.equal(sent[0].payload.seatId, 'seat-1');
  assert.equal(sent[0].payload.token, 'token-2');
});

test('resendConfirmation ignores a locale that is not in the supported set', async () => {
  const sent = [];
  const scheduled = [];
  const stored = invitation({
    status: InvitationStatus.APPROVED,
    pendingContactPayload: {
      invitationId: 'invitation-1',
      eventId: 'event-1',
      eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
      locale: 'de-DE',
      actorId: 'actor-1',
      seatId: 'seat-1',
    },
  });
  const cached = [];

  const service = guestConfirmationService({
    prisma: {
      invitation: {
        async findUnique({ select }) {
          return select ? { eventId: stored.eventId } : stored;
        },
        async update({ data }) {
          Object.assign(stored, data);
          return stored;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return null;
        },
      },
      async $transaction(work) {
        return work(null);
      },
    },
    cache: {
      async rawGet() {
        return null;
      },
      async rawSet() {
        return undefined;
      },
      async set(_key, value, _ttl) {
        cached.push(value);
        return 'token-2';
      },
    },
    sent,
    scheduled,
  });

  const result = await service.resendConfirmation({
    invitationId: 'invitation-1',
    actorId: 'admin-1',
    locale: 'fr-FR',
  });

  assert.equal(result.resent, true);
  assert.equal(JSON.parse(cached[0]).locale, 'de-DE');
});

test('approve passes the admin locale to the immediate confirmation', async () => {
  const stored = invitation({
    rsvpChoice: RsvpChoice.YES,
    status: InvitationStatus.ACCEPTED,
  });
  let confirmationInput;
  let delayedJobCalls = 0;

  const service = new AdminWriteService(
    {
      invitation: {
        async findUnique() {
          return stored;
        },
        async update({ data }) {
          const updated = invitation({ ...stored, ...data });
          Object.assign(stored, updated);
          return updated;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return { scheduleTicketRelease: false, ticketReleaseAt: null };
        },
      },
      async $transaction(work) {
        return work(service);
      },
    },
    logger,
    { send: async () => undefined },
    {},
    {
      async schedule() {
        delayedJobCalls++;
      },
    },
    { enqueue: async () => undefined },
    {
      async sendFirstConfirmation(input) {
        confirmationInput = input;
        return true;
      },
      async sendFirstConfirmationOrReserve(input) {
        confirmationInput = input;
        return true;
      },
    },
    {},
  );

  const result = await service.approve({
    id: 'invitation-1',
    approve: true,
    actorId: 'admin-1',
    seatId: 'seat-1',
    locale: 'en-US',
    activeEventId: 'event-1',
  });

  assert.equal(result.status, InvitationStatus.APPROVED);
  assert.equal(delayedJobCalls, 0);
  assert.deepEqual(confirmationInput, {
    invitationId: 'invitation-1',
    seatId: 'seat-1',
    actorId: 'admin-1',
    locale: 'en-US',
  });
});

test('approve carries the admin locale into the scheduled ticket generation job', async () => {
  const stored = invitation({
    rsvpChoice: RsvpChoice.YES,
    status: InvitationStatus.ACCEPTED,
  });
  const jobs = [];
  let confirmationCalls = 0;

  const service = new AdminWriteService(
    {
      invitation: {
        async findUnique() {
          return stored;
        },
        async update({ data }) {
          const updated = invitation({ ...stored, ...data });
          Object.assign(stored, updated);
          return updated;
        },
      },
      eventSettingsProjection: {
        async findUnique() {
          return {
            scheduleTicketRelease: true,
            ticketReleaseAt: new Date(Date.now() + 60 * 1000),
          };
        },
      },
    },
    logger,
    { send: async () => undefined },
    {},
    {
      async schedule(input) {
        jobs.push(input);
      },
    },
    { enqueue: async () => undefined },
    {
      async sendFirstConfirmation() {
        confirmationCalls++;
      },
    },
    {},
  );

  await service.approve({
    id: 'invitation-1',
    approve: true,
    actorId: 'admin-1',
    seatId: 'seat-1',
    locale: 'de-DE',
    activeEventId: 'event-1',
  });

  assert.equal(confirmationCalls, 0);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].type, 'ticket.generate');
  assert.equal(jobs[0].payload.locale, 'de-DE');
  assert.equal(jobs[0].payload.seatId, 'seat-1');
  assert.equal(jobs[0].payload.actorId, 'admin-1');
});