ALTER TABLE "invitation"
ADD COLUMN "event_name" TEXT,
ADD COLUMN "event_ends_at" TIMESTAMP(3),
ADD COLUMN "auto_approve_on_accept" BOOLEAN NOT NULL DEFAULT false;
