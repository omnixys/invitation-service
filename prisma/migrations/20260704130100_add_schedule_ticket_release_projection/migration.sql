ALTER TABLE "event_settings_projection"
ADD COLUMN "schedule_ticket_release" BOOLEAN NOT NULL DEFAULT false;

UPDATE "event_settings_projection"
SET "schedule_ticket_release" = true
WHERE "ticket_release_at" IS NOT NULL;
