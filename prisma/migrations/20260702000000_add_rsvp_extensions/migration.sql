CREATE TYPE "plus_one_age_category" AS ENUM ('OVER_SIX', 'UNDER_SIX');

ALTER TABLE "invitation"
ADD COLUMN "selected_invited_by" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "guest_note" TEXT,
ADD COLUMN "plus_one_age_category" "plus_one_age_category";
