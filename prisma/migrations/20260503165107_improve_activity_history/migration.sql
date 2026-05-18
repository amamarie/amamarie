-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'LEAD_LOST';
ALTER TYPE "ActivityType" ADD VALUE 'LEAD_ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'CLIENT_STATUS_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'CLIENT_ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'CALL_MADE';
ALTER TYPE "ActivityType" ADD VALUE 'CALL_MISSED';
ALTER TYPE "ActivityType" ADD VALUE 'SMS_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'EMAIL_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATION_FAILED';
ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATION_RULE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'AUTOMATION_RULE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'ALERT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'ALERT_RESOLVED';
ALTER TYPE "ActivityType" ADD VALUE 'ALERT_DISMISSED';
ALTER TYPE "ActivityType" ADD VALUE 'ALERT_CONVERTED_TO_TASK';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "alertId" TEXT,
ADD COLUMN     "automationRuleId" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "noteId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_clientId_idx" ON "Activity"("clientId");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_taskId_idx" ON "Activity"("taskId");

-- CreateIndex
CREATE INDEX "Activity_documentId_idx" ON "Activity"("documentId");

-- CreateIndex
CREATE INDEX "Activity_productId_idx" ON "Activity"("productId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "ComplianceAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
