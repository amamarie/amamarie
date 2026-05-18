-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'SMS', 'EMAIL', 'MEETING', 'DOCUMENT', 'KYC', 'FOLLOW_UP', 'PRODUCT_REVIEW', 'RENEWAL', 'COMPLIANCE', 'INTERNAL', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TASK_CANCELLED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_SNOOZED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_REOPENED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_PRIORITY_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_OVERDUE';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_REMINDER_SENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'WAITING';
ALTER TYPE "TaskStatus" ADD VALUE 'SNOOZED';
ALTER TYPE "TaskStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "alertId" TEXT,
ADD COLUMN     "automationRuleId" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "crossSellOpportunityId" TEXT,
ADD COLUMN     "isAutomated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "recommendationId" TEXT,
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "snoozeReason" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "type" "TaskType" NOT NULL DEFAULT 'FOLLOW_UP';

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_type_idx" ON "Task"("type");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "ComplianceAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_crossSellOpportunityId_fkey" FOREIGN KEY ("crossSellOpportunityId") REFERENCES "CrossSellOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
