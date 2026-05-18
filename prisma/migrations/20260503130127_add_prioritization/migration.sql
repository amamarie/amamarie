-- CreateEnum
CREATE TYPE "PriorityEntityType" AS ENUM ('LEAD', 'CLIENT', 'TASK', 'SMART_ALERT', 'COMPLIANCE_ALERT', 'RECOMMENDATION', 'CROSS_SELL', 'FINANCIAL_PRODUCT', 'DOCUMENT', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BACKLOG');

-- CreateEnum
CREATE TYPE "PriorityStatus" AS ENUM ('ACTIVE', 'SNOOZED', 'DISMISSED', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "PriorityItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "advisorId" TEXT,
    "clientId" TEXT,
    "leadId" TEXT,
    "entityType" "PriorityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "level" "PriorityLevel" NOT NULL,
    "status" "PriorityStatus" NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "complianceScore" INTEGER NOT NULL DEFAULT 0,
    "relationshipScore" INTEGER NOT NULL DEFAULT 0,
    "commercialScore" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "effortScore" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "suggestedAction" TEXT,
    "actionUrl" TEXT,
    "dueAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "metadata" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "scope" TEXT NOT NULL,
    "entityCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "archivedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "PriorityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriorityItem_organizationId_idx" ON "PriorityItem"("organizationId");

-- CreateIndex
CREATE INDEX "PriorityItem_advisorId_idx" ON "PriorityItem"("advisorId");

-- CreateIndex
CREATE INDEX "PriorityItem_clientId_idx" ON "PriorityItem"("clientId");

-- CreateIndex
CREATE INDEX "PriorityItem_leadId_idx" ON "PriorityItem"("leadId");

-- CreateIndex
CREATE INDEX "PriorityItem_level_idx" ON "PriorityItem"("level");

-- CreateIndex
CREATE INDEX "PriorityItem_status_idx" ON "PriorityItem"("status");

-- CreateIndex
CREATE INDEX "PriorityItem_score_idx" ON "PriorityItem"("score");

-- CreateIndex
CREATE INDEX "PriorityItem_dueAt_idx" ON "PriorityItem"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriorityItem_organizationId_entityType_entityId_key" ON "PriorityItem"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "PriorityRun_organizationId_idx" ON "PriorityRun"("organizationId");

-- CreateIndex
CREATE INDEX "PriorityRun_startedAt_idx" ON "PriorityRun"("startedAt");

-- AddForeignKey
ALTER TABLE "PriorityItem" ADD CONSTRAINT "PriorityItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityItem" ADD CONSTRAINT "PriorityItem_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityItem" ADD CONSTRAINT "PriorityItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityItem" ADD CONSTRAINT "PriorityItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityRun" ADD CONSTRAINT "PriorityRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityRun" ADD CONSTRAINT "PriorityRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
