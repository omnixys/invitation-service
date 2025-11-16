-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SECURITY', 'GUEST');

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "allow_re_entry" BOOLEAN NOT NULL DEFAULT true,
    "rotate_seconds" INTEGER NOT NULL DEFAULT 300,
    "max_seats" INTEGER NOT NULL DEFAULT 300,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "section" TEXT,
    "table" TEXT,
    "number" TEXT,
    "note" TEXT,
    "guest_id" TEXT,

    CONSTRAINT "seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_event_role" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "user_event_role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seat_event_id_idx" ON "seat"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "seat_event_id_section_table_number_key" ON "seat"("event_id", "section", "table", "number");

-- CreateIndex
CREATE INDEX "user_event_role_event_id_idx" ON "user_event_role"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_role_user_id_event_id_key" ON "user_event_role"("user_id", "event_id");

-- AddForeignKey
ALTER TABLE "seat" ADD CONSTRAINT "seat_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event_role" ADD CONSTRAINT "user_event_role_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "invitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
