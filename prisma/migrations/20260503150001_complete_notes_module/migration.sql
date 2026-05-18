-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'MEETING', 'CALL', 'SMS', 'EMAIL', 'COMPLIANCE', 'INTERNAL', 'FOLLOW_UP', 'PRODUCT', 'KYC', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'TEAM', 'COMPLIANCE_ONLY');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('ACTIVE', 'PINNED', 'ARCHIVED', 'DELETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'NOTE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_PINNED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_UNPINNED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_RESTORED';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_DELETED';

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "isSensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meetingDate" TIMESTAMP(3),
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "status" "NoteStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "type" "NoteType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "visibility" "NoteVisibility" NOT NULL DEFAULT 'TEAM';

-- CreateIndex
CREATE INDEX "Note_clientId_idx" ON "Note"("clientId");

-- CreateIndex
CREATE INDEX "Note_leadId_idx" ON "Note"("leadId");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Note_taskId_idx" ON "Note"("taskId");

-- CreateIndex
CREATE INDEX "Note_productId_idx" ON "Note"("productId");

-- CreateIndex
CREATE INDEX "Note_type_idx" ON "Note"("type");

-- CreateIndex
CREATE INDEX "Note_status_idx" ON "Note"("status");

-- CreateIndex
CREATE INDEX "Note_isPinned_idx" ON "Note"("isPinned");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
