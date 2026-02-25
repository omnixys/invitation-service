
  /**
 * Prisma Seed – Invitation Service
 * Creates demo invitations with different RSVP states and plus-ones
 */

    import { InvitationStatus, PrismaClient, RsvpChoice } from '../src/prisma/generated/client.js';
    import { PrismaPg } from '@prisma/adapter-pg';
    import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const EVENT_ID = 'cmlz996ya000nrbij16p2jnxk';
  const GUEST_ID = 'ae489d9b-96ce-4942-bcb1-c2e2a0c92e83';

  /* ------------------------------------------------------------------
   * 1) Accepted Invitation
   * ------------------------------------------------------------------ */
  const accepted = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: 'Guest',
      lastName: 'Omnixys',
      phoneNumber: '15111951223',
      guestProfileId: GUEST_ID,
      status: InvitationStatus.APPROVED,
      rsvpChoice: RsvpChoice.YES,
      rsvpAt: new Date(),
      approved: true,
      approvedAt: new Date(),
      maxInvitees: 0,
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
      phoneNumber: '1522222222',
      status: InvitationStatus.DECLINED,
      rsvpChoice: RsvpChoice.NO,
      rsvpAt: new Date(),
      maxInvitees: 0,
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
      phoneNumber: '1533333333',
      status: InvitationStatus.PENDING,
      maxInvitees: 0,
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
      phoneNumber: '1544444444',
      status: InvitationStatus.ACCEPTED,
      rsvpChoice: RsvpChoice.YES,
      rsvpAt: new Date(),
      approved: false,
      approvedAt: new Date(),
      maxInvitees: 3,
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
   * Console Output (IDs)
   * ------------------------------------------------------------------ */
  console.log('\n📌 Seeded Invitation IDs');
  console.log('─────────────────────────────────────────────');
  console.log('Accepted (guest)         :', accepted.id);
  console.log('Declined  (mark)         :', declined.id);
  console.log('Pending    (Julia)       :', pending.id);
  console.log('Main + PlusOnes (daniel) :', mainWithPlusOnes.id);
  // console.log('Plus-Ones Count :', plusOnes.count);
  console.log('Event ID                 :', EVENT_ID);
  console.log('GuestProfile ID          :', GUEST_ID);
    console.log('─────────────────────────────────────────────');

  console.log('✅ Invitation seed completed successfully');
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
