/**
 * Prisma Seed – Invitation Service
 * Creates demo invitations with different RSVP states and plus-ones
 */

import {
  InvitationStatus,
  PrismaClient,
  RsvpChoice,
  PhoneNumberType,
} from '../src/prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const EVENT_ID = 'cmm52hirb00007r06xfzglibb';
  const GUEST_ID = 'ae489d9b-96ce-4942-bcb1-c2e2a0c92e83';

  /* ------------------------------------------------------------------
   * 1) Accepted Invitation
   * ------------------------------------------------------------------ */
  const accepted = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: 'Guest',
      lastName: 'Omnixys',
      guestProfileId: GUEST_ID,
      email: 'guest@omnixys.com',

      status: InvitationStatus.APPROVED,
      rsvpChoice: RsvpChoice.YES,
      rsvpAt: new Date(),

      approvedAt: new Date(),
      approvedByUserId: 'admin-user-id',

      maxInvitees: 0,

      phoneNumbers: {
        create: [
          {
            number: '15111951223',
            countryCode: '+49',
            type: PhoneNumberType.MOBILE,
            isPrimary: true,
          },
        ],
      },
    },
  });

  /* ------------------------------------------------------------------
   * 2) Declined Invitation
   * ------------------------------------------------------------------ */
  const declined = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: 'Mark',
      lastName: 'Schneider',
      email: 'mark@test.de',

      status: InvitationStatus.DECLINED,
      rsvpChoice: RsvpChoice.NO,
      rsvpAt: new Date(),

      maxInvitees: 0,

      phoneNumbers: {
        create: [
          {
            number: '1522222222',
            countryCode: '+49',
            type: PhoneNumberType.MOBILE,
            isPrimary: true,
          },
        ],
      },
    },
  });

  /* ------------------------------------------------------------------
   * 3) Pending Invitation (no RSVP yet)
   * ------------------------------------------------------------------ */
  const pending = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: 'Julia',
      lastName: 'Becker',

      status: InvitationStatus.PENDING,
      maxInvitees: 0,

      phoneNumbers: {
        create: [
          {
            number: '1533333333',
            countryCode: '+49',
            type: PhoneNumberType.WHATSAPP,
            isPrimary: true,
          },
        ],
      },
    },
  });

  /* ------------------------------------------------------------------
   * 4) Accepted Invitation with 3 Plus-Ones
   * ------------------------------------------------------------------ */
  const mainWithPlusOnes = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: 'Daniel',
      lastName: 'Klein',

      status: InvitationStatus.ACCEPTED,
      rsvpChoice: RsvpChoice.YES,
      rsvpAt: new Date(),

      approvedAt: new Date(),
      approvedByUserId: 'admin-user-id',

      maxInvitees: 3,

      phoneNumbers: {
        create: [
          {
            number: '1544444444',
            countryCode: '+49',
            type: PhoneNumberType.MOBILE,
            isPrimary: true,
          },
        ],
      },
    },
  });

  /* ------------------------------------------------------------------
   * Plus-Ones (linked via invitedByInvitationId)
   * ------------------------------------------------------------------ */
  await prisma.invitation.createMany({
    data: [
      {
        eventId: EVENT_ID,
        firstName: 'Laura',
        lastName: 'Klein',
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
      {
        eventId: EVENT_ID,
        firstName: 'Tom',
        lastName: 'Klein',
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
      {
        eventId: EVENT_ID,
        firstName: 'Sophie',
        lastName: 'Klein',
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
    ],
  });

  /* ------------------------------------------------------------------
   * Console Output
   * ------------------------------------------------------------------ */
  console.log('\n📌 Seeded Invitation IDs');
  console.log('─────────────────────────────────────────────');
  console.log('Accepted (guest)         :', accepted.id);
  console.log('Declined  (mark)         :', declined.id);
  console.log('Pending    (Julia)       :', pending.id);
  console.log('Main + PlusOnes (daniel) :', mainWithPlusOnes.id);
  console.log('Event ID                 :', EVENT_ID);
  console.log('GuestProfile ID          :', GUEST_ID);
  console.log('─────────────────────────────────────────────');

  console.log('✅ Invitation seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
