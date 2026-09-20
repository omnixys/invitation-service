import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

process.env.INTERNAL_GATEWAY_TOKEN = 'unit-test-token';
process.env.EVENT_INTERNAL_URI = 'http://event.test:7406/graphql';

const { EventAccessClient } = await import(
  '../../dist/invitation/service/event-access.client.js'
);
const { EventAccessGrantException } = await import(
  '../../dist/invitation/errors/invitation-domain.error.js'
);

const INPUT = {
  eventId: '22222222-2222-4222-8222-222222222222',
  userId: '11111111-1111-4111-8111-111111111111',
  actorId: '33333333-3333-4333-8333-333333333333',
};

function withFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return fn();
  } finally {
    globalThis.fetch = original;
  }
}

test('posts the grant to the event internal endpoint with the internal token', async () => {
  const client = new EventAccessClient();
  let captured;

  await withFetch(
    async (url, options) => {
      captured = { url: String(url), options };
      return new Response(null, { status: 200 });
    },
    () => client.grantGuestAccess(INPUT),
  );

  assert.equal(
    captured.url,
    'http://event.test:7406/internal/event-access/grant',
  );
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-internal-token'], 'unit-test-token');
  assert.equal(captured.options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(captured.options.body), INPUT);
});

test('rejects when the event service responds with an error status', async () => {
  const client = new EventAccessClient();

  await withFetch(
    async () => new Response(null, { status: 500 }),
    () =>
      assert.rejects(
        client.grantGuestAccess(INPUT),
        (error) =>
          error instanceof EventAccessGrantException &&
          error.code === 'EVENT_ACCESS_GRANT_FAILED',
      ),
  );
});

test('rejects when the event service is unreachable', async () => {
  const client = new EventAccessClient();

  await withFetch(
    async () => {
      throw new Error('connection refused');
    },
    () =>
      assert.rejects(
        client.grantGuestAccess(INPUT),
        (error) =>
          error instanceof EventAccessGrantException &&
          error.code === 'EVENT_ACCESS_GRANT_FAILED',
      ),
  );
});