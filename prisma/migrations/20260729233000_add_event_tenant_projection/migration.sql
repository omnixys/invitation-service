ALTER TABLE "event_settings_projection"
ADD COLUMN "tenant_id" UUID;

CREATE INDEX "event_settings_projection_tenant_id_idx"
ON "event_settings_projection" ("tenant_id");
