import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

const { AnalyticsTenantController } = await import(
  '../../dist/invitation/controller/analytics-tenant.controller.js'
);
const { EventSettingsHandler } = await import(
  '../../dist/handlers/event-settings.handler.js'
);
const { KAFKA_HEADERS } = await import('@omnixys/kafka');

const tenantId = '11111111-1111-4111-8111-111111111111';

test('public event tenant resolution requires an enabled RSVP projection', async () => {
  const controller = new AnalyticsTenantController({
    eventSettingsProjection: {
      findUnique: async () => ({ tenantId, allowPublicRsvp: true }),
    },
  });

  assert.deepEqual(
    await controller.resolveTenant('dev-internal-gateway-token', {
      type: 'event',
      id: '22222222-2222-4222-8222-222222222222',
    }),
    { tenantId },
  );
});

test('public analytics tenant resolution rejects invalid internal tokens', async () => {
  const controller = new AnalyticsTenantController({});
  await assert.rejects(
    controller.resolveTenant('invalid', {
      type: 'event',
      id: '22222222-2222-4222-8222-222222222222',
    }),
    (error) => error?.getResponse?.().code === 'INTERNAL_TOKEN_INVALID',
  );
});

test('event projection persists only valid Kafka tenant headers', async () => {
  const writes = [];
  const handler = new EventSettingsHandler(
    {
      log: () => ({ info() {}, debug() {}, warn() {}, error() {} }),
    },
    {
      eventSettingsProjection: {
        upsert: async (input) => writes.push(input),
      },
    },
  );
  const payload = {
    eventId: '22222222-2222-4222-8222-222222222222',
    name: 'Public event',
  };

  await handler.handleEventCreated(payload, {
    headers: { [KAFKA_HEADERS.TENANT_ID]: tenantId },
  });
  assert.equal(writes[0].create.tenantId, tenantId);
  assert.equal(writes[0].update.tenantId, tenantId);

  await assert.rejects(
    handler.handleEventCreated(payload, {
      headers: { [KAFKA_HEADERS.TENANT_ID]: 'browser-supplied-tenant' },
    }),
    /valid Kafka tenant header/,
  );
});
