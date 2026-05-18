-- CreateEnum
CREATE TYPE "AiExplanationStatus" AS ENUM ('GENERATED', 'REVIEWED', 'FAILED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'AI_ALERT_EXPLANATION_GENERATED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_ALERT_EXPLANATION_REVIEWED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_ALERT_TASK_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_ALERT_NOTE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_ALERT_EXPLANATION_FAILED';

-- CreateTable
CREATE TABLE "AlertAiExplanation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "clientId" TEXT,
    "generatedById" TEXT,
    "status" "AiExplanationStatus" NOT NULL DEFAULT 'GENERATED',
    "summary" TEXT NOT NULL,
    "whyItTriggered" TEXT NOT NULL,
    "clientContext" TEXT,
    "missingData" JSONB,
    "suggestedActions" JSONB,
    "advisorNoteDraft" TEXT,
    "clientMessageDraft" TEXT,
    "riskLevelExplanation" TEXT,
    "complianceDisclaimer" TEXT NOT NULL,
    "modelName" TEXT,
    "promptVersion" TEXT,
    "inputHash" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertAiExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertAiExplanation_organizationId_idx" ON "AlertAiExplanation"("organizationId");

-- CreateIndex
CREATE INDEX "AlertAiExplanation_alertId_idx" ON "AlertAiExplanation"("alertId");

-- CreateIndex
CREATE INDEX "AlertAiExplanation_clientId_idx" ON "AlertAiExplanation"("clientId");

-- CreateIndex
CREATE INDEX "AlertAiExplanation_status_idx" ON "AlertAiExplanation"("status");

-- CreateIndex
CREATE INDEX "AlertAiExplanation_inputHash_idx" ON "AlertAiExplanation"("inputHash");

-- AddForeignKey
ALTER TABLE "AlertAiExplanation" ADD CONSTRAINT "AlertAiExplanation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAiExplanation" ADD CONSTRAINT "AlertAiExplanation_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "ComplianceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAiExplanation" ADD CONSTRAINT "AlertAiExplanation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAiExplanation" ADD CONSTRAINT "AlertAiExplanation_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
