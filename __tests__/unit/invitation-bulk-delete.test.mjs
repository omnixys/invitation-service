import { AdminWriteService } from '../../dist/invitation/service/invitation-admin.write.service.js';
import {
  InvitationNotFoundException,
  InvitationValidationException,
} from '../../dist/invitation/errors/invitation-domain.error.js';
import { InvitationStatus } from '../../dist/prisma/generated/client.js';
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

function invitation(id, eventId = 'event-1') {
  return {
    id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    eventId,
    eventName: 'Platform Launch',
    eventEndsAt: new Date('2030-01-01T00:00:00.000Z'),
    guestProfileId: null,
    status: InvitationStatus.PENDING,
    pendingContactId: null,
    pendingContactPayload: null,
    phoneNumbers: [],
  };
}

function adminWriteService(txPrisma) {
  return new AdminWriteService(
    {
      async $transaction(work) {
        return work(txPrisma);
      },
    },
    logger,
    { send: async () => undefined },
    {},
    { async schedule() {} },
    { enqueue: async () => undefined },
    {
      async sendFirstConfirmation() {},
      async sendFirstConfirmationOrReserve() {},
      async resendConfirmation() {},
    },
    {},
  );
}

test('deleteMany deletes every id inside a single transaction', async () => {
  const deleted = [];
  const txPrisma = {
    invitation: {
      async findUnique({ where }) {
        return invitation(where.id);
      },
      async delete({ where }) {
        deleted.push(where.id);
        return invitation(where.id);
      },
    },
  };
  const service = adminWriteService(txPrisma);

  const ok = await service.deleteMany(
    ['invitation-1', 'invitation-2', 'invitation-3'],
    'admin-1',
    'event-1',
  );

  assert.equal(ok, true);
  assert.deepEqual(deleted, ['invitation-1', 'invitation-2', 'invitation-3']);
});

test('deleteMany rejects an empty id list without touching the store', async () => {
  const txPrisma = {
    invitation: {
      async findUnique() {
        throw new Error('must not be called');
      },
      async delete() {
        throw new Error('must not be called');
      },
    },
  };
  const service = adminWriteService(txPrisma);

  await assert.rejects(
    () => service.deleteMany([], 'admin-1', 'event-1'),
    (err) => err instanceof InvitationValidationException,
  );
});

test('deleteMany fails the transaction when an id does not exist', async () => {
  const deleted = [];
  const txPrisma = {
    invitation: {
      async findUnique({ where }) {
        return where.id === 'invitation-2' ? null : invitation(where.id);
      },
      async delete({ where }) {
        deleted.push(where.id);
        return invitation(where.id);
      },
    },
  };
  const service = adminWriteService(txPrisma);

  await assert.rejects(
    () => service.deleteMany(['invitation-1', 'invitation-2'], 'admin-1', 'event-1'),
    (err) => err instanceof InvitationNotFoundException,
  );

  assert.deepEqual(deleted, ['invitation-1']);
});

test('deleteMany rejects an invitation that belongs to another event', async () => {
  const deleted = [];
  const txPrisma = {
    invitation: {
      async findUnique({ where }) {
        return where.id === 'invitation-2'
          ? invitation('invitation-2', 'event-2')
          : invitation(where.id);
      },
      async delete({ where }) {
        deleted.push(where.id);
        return invitation(where.id);
      },
    },
  };
  const service = adminWriteService(txPrisma);

  await assert.rejects(
    () => service.deleteMany(['invitation-1', 'invitation-2'], 'admin-1', 'event-1'),
    (err) => err instanceof InvitationValidationException,
  );

  assert.deepEqual(deleted, ['invitation-1']);
});