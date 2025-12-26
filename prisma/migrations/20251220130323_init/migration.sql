/*
  Warnings:

  - You are about to drop the column `plus_ones` on the `invitation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invitation" DROP COLUMN "plus_ones";

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_invitation_id_fkey" FOREIGN KEY ("invited_by_invitation_id") REFERENCES "invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
