/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

/**
 * @file reconcile-guest-links.ts
 *
 * Repair helper for guest invitations that never received a seat-linked
 * confirmation (e.g. signed up before strict reservation existed, or when the
 * seat auto-assign failed and the confirmation was silently dropped).
 *
 * Behaviour:
 *   npx tsx src/scripts/reconcile-guest-links.ts             # read-only report
 *   npx tsx src/scripts/reconcile-guest-links.ts --apply     # publish seat.reserve
 *
 * For every APPROVED/ACCEPTED invitation without a linked guest profile but
 * with a pending contact, `--apply` re-runs the seat reservation request. The
 * normal chain takes over from there: Seat reserves → Invitation sends a fresh
 * confirmation → the guest signs up through the strict (wait + compensate)
 * path. Invitations whose guest already exists in Keycloak but was never linked
 * are NOT linked automatically; the report marks them so a host can clean up
 * the stale guest account.
 */

import { PrismaClient, InvitationStatus } from '../prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'node:crypto';

const SEAT_RESERVE_TOPIC = 'seat.reserve';
const SERVICE = 'invitation';
const APPLICATION_FLAG = '--apply';

const kafkaHeaders = (actorId: string) => ({
  'x-meta-service': stringToBuffer(SERVICE),
  'x-meta-version': stringToBuffer('1'),
  'x-meta-operation': stringToBuffer('reconcile guest links'),
  'x-meta-type': stringToBuffer('EVENT'),
  'x-meta-actorId': stringToBuffer(actorId),
  'x-request-id': stringToBuffer(randomUUID()),
  'x-correlation-id': stringToBuffer(randomUUID()),
});

function stringToBuffer(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

function buildEnvelope(payload: unknown): Buffer {
  return Buffer.from(
    JSON.stringify({
      eventId: randomUUID(),
      eventName: SEAT_RESERVE_TOPIC,
      eventType: 'EVENT',
      eventVersion: '1',
      service: SERVICE,
      timestamp: new Date().toISOString(),
      payload,
    }),
    'utf8',
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes(APPLICATION_FLAG);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const invitations = await prisma.invitation.findMany({
    where: {
      status: { in: [InvitationStatus.APPROVED, InvitationStatus.ACCEPTED] },
      guestProfileId: null,
      pendingContactId: { not: null },
    },
    select: {
      id: true,
      eventId: true,
      firstName: true,
      lastName: true,
      pendingContactId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!invitations.length) {
    console.log(
      `RECONCILE_GUEST_LINKS_JSON:${JSON.stringify({
        apply,
        pending: 0,
        sent: 0,
        report: [],
      })}`,
    );
    return;
  }

  const report = invitations.map((invitation) => ({
    invitationId: invitation.id,
    eventId: invitation.eventId,
    contactName: `${invitation.firstName} ${invitation.lastName}`.trim(),
    pendingContactId: invitation.pendingContactId,
  }));

  if (!apply) {
    console.log(
      `RECONCILE_GUEST_LINKS_JSON:${JSON.stringify({
        apply,
        pending: report.length,
        sent: 0,
        report,
      })}`,
    );
    await prisma.$disconnect();
    return;
  }

  const kafka = new Kafka({
    clientId: SERVICE,
    brokers: (process.env.KAFKA_BROKER ?? 'localhost:9092').split(','),
  });
  const producer = kafka.producer();
  await producer.connect();

  let sent = 0;
  for (const invitation of invitations) {
    await producer.send({
      topic: SEAT_RESERVE_TOPIC,
      messages: [
        {
          value: buildEnvelope({
            eventId: invitation.eventId,
            invitationId: invitation.id,
            actorId: 'system-reconcile',
          }),
          headers: kafkaHeaders('system-reconcile'),
        },
      ],
    });
    sent += 1;
    console.log(
      `REQUEUED seat.reserve invitationId=${invitation.id} eventId=${invitation.eventId}`,
    );
  }

  await producer.disconnect();
  await prisma.$disconnect();

  console.log(
    `RECONCILE_GUEST_LINKS_JSON:${JSON.stringify({
      apply,
      pending: report.length,
      sent,
      report,
    })}`,
  );
}

main().catch((error) => {
  console.error('RECONCILE_GUEST_LINKS_FAILED:', error);
  process.exitCode = 1;
});
