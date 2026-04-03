-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'SPANISH', 'FRENCH', 'GERMAN', 'CHINESE', 'JAPANESE', 'OTHER');

-- CreateEnum
CREATE TYPE "PhoneNumberType" AS ENUM ('WHATSAPP', 'MOBILE', 'PRIVATE', 'WORK', 'HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RsvpChoice" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "guest_profile_id" TEXT,
    "email" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pending_contact_id" TEXT,
    "rsvp_choice" "RsvpChoice",
    "rsvp_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "max_invitees" INTEGER NOT NULL DEFAULT 0,
    "invited_by_invitation_id" TEXT,
    "invited_by_user_id" TEXT,
    "preferred_language" "Language" DEFAULT 'ENGLISH',
    "preferred_contact_type" "ContactType" DEFAULT 'EMAIL',

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_number" (
    "id" TEXT NOT NULL,
    "invitation_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PhoneNumberType" NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "country_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_number_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "invitation_event_id_idx" ON "invitation"("event_id");

-- CreateIndex
CREATE INDEX "phone_number_country_code_number_idx" ON "phone_number"("country_code", "number");

-- CreateIndex
CREATE INDEX "phone_number_invitation_id_idx" ON "phone_number"("invitation_id");

-- CreateIndex
CREATE INDEX "phone_number_invitation_id_is_primary_idx" ON "phone_number"("invitation_id", "is_primary");

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_invitation_id_fkey" FOREIGN KEY ("invited_by_invitation_id") REFERENCES "invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_number" ADD CONSTRAINT "phone_number_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
