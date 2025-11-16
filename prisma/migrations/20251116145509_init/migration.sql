-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RsvpChoice" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "event_id" TEXT NOT NULL,
    "guest_profile_id" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pending_contact_id" TEXT,
    "rsvp_choice" "RsvpChoice",
    "rsvp_at" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "max_invitees" INTEGER NOT NULL DEFAULT 0,
    "invited_by_invitation_id" TEXT,
    "invited_by_user_id" TEXT,
    "plus_ones" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_pending_contact_id_key" ON "invitation"("pending_contact_id");

-- CreateIndex
CREATE INDEX "invitation_event_id_status_idx" ON "invitation"("event_id", "status");

-- CreateIndex
CREATE INDEX "invitation_event_id_rsvp_choice_idx" ON "invitation"("event_id", "rsvp_choice");

-- CreateIndex
CREATE INDEX "invitation_invited_by_invitation_id_idx" ON "invitation"("invited_by_invitation_id");

-- CreateIndex
CREATE INDEX "invitation_approved_approved_at_idx" ON "invitation"("approved", "approved_at");
