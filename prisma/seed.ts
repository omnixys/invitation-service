
  /**
 * Prisma Seed – Invitation Service
 * Creates demo invitations with different RSVP states and plus-ones
 */

import { InvitationStatus, RsvpChoice } from "@prisma/client";
  import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  const EVENT_ID = 'cmjkm0jnu000mewij0eq9tse0';
  const GUEST_ID = '3a709c62-9148-4029-8180-943fcb1ded39';

  /* ------------------------------------------------------------------
   * 1) Accepted Invitation
   * ------------------------------------------------------------------ */
  const accepted = await prisma.invitation.create({
    data: {
      eventId: EVENT_ID,
      firstName: "Guest",
      lastName: "Omnixys",
      phoneNumber: "15111951223",
      guestProfileId: GUEST_ID,
      status: InvitationStatus.ACCEPTED,
      rsvpChoice: RsvpChoice.YES,
      rsvpAt: new Date(),
      approved: false,
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
      firstName: "Mark",
      lastName: "Schneider",
      phoneNumber: "1522222222",
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
      firstName: "Julia",
      lastName: "Becker",
      phoneNumber: "1533333333",
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
      firstName: "Daniel",
      lastName: "Klein",
      phoneNumber: "1544444444",
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
        firstName: "Laura",
        lastName: "Klein",
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
      {
        eventId: EVENT_ID,
        firstName: "Tom",
        lastName: "Klein",
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
      {
        eventId: EVENT_ID,
        firstName: "Sophie",
        lastName: "Klein",
        status: InvitationStatus.ACCEPTED,
        invitedByInvitationId: mainWithPlusOnes.id,
      },
    ],
  });

  console.log("✅ Invitation seed completed successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
