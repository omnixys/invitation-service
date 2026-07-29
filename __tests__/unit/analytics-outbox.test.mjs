import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';

const { ContextAccessor } = await import('@omnixys/context');
const { AnalyticsOutboxService } = await import(
  '../../dist/analytics/analytics-outbox.service.js'
);

const context = {
  requestId: 'request-invitation-1',
  correlationId: 'correlation-invitation-1',
  startedAtEpochMs: Date.now(),
  principal: { subject: 'actor-1', actorId: 'actor-1', roles: [] },
  tenant: {
    tenantId: '11111111-1111-4111-8111-111111111111',
    source: 'verified-principal',
    verified: true,
  },
  client: {},
  transport: { type: 'graphql', operation: 'replyInvitation' },
  trace: {},
};

test('invitation outbox accepts canonical RSVP facts without contact data', async () => {
  const writes = [];
  const transaction = {
    analyticsOutbox: {
      create: async (input) => {
        writes.push(input);
        return input.data;
      },
    },
  };

  await ContextAccessor.run(context, () =>
    new AnalyticsOutboxService().enqueue(transaction, 'invitation.rsvp.submitted.v1', {
      eventName: 'RsvpSubmitted',
      aggregateId: '22222222-2222-4222-8222-222222222222',
      aggregateType: 'invitation',
      properties: { choice: 'YES', eventId: '33333333-3333-4333-8333-333333333333' },
    }),
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.payload.producer, 'invitation');
  assert.equal(writes[0].data.payload.properties.choice, 'YES');
  assert.equal(writes[0].data.payload.properties.email, undefined);
});

test('invitation outbox rejects contact properties', () => {
  const transaction = {
    analyticsOutbox: { create: async () => assert.fail('must not persist') },
  };
  assert.throws(
    () =>
      ContextAccessor.run(context, () =>
        new AnalyticsOutboxService().enqueue(transaction, 'invitation.accepted.v1', {
          eventName: 'InvitationAccepted',
          aggregateId: '22222222-2222-4222-8222-222222222222',
          aggregateType: 'invitation',
          properties: { email: 'private@example.com' },
        }),
      ),
    /Sensitive analytics property/,
  );
});
