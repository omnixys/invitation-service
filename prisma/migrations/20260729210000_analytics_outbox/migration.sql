CREATE TABLE "analytics_outbox" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "correlation_id" TEXT,
  "actor_id" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ,
  "locked_by" TEXT,
  "published_at" TIMESTAMPTZ,
  "dead_lettered_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_outbox_ready_idx"
  ON "analytics_outbox" ("next_attempt_at", "created_at")
  WHERE "published_at" IS NULL AND "dead_lettered_at" IS NULL;
