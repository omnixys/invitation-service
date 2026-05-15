-- CreateEnum
CREATE TYPE "invitation_type" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "contact_type" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "phone_number_type" AS ENUM ('WHATSAPP', 'MOBILE', 'PRIVATE', 'WORK', 'HOME', 'OTHER');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "rsvp_choice" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL,
    "type" "invitation_type" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "guest_profile_id" UUID,
    "email" TEXT,
    "phone_number" TEXT,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pending_contact_id" TEXT,
    "rsvp_choice" "rsvp_choice",
    "rsvp_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "max_invitees" INTEGER NOT NULL DEFAULT 0,
    "invited_by_invitation_id" UUID,
    "invited_by_user_id" UUID,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_number" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "phone_number_type" NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "country_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

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
