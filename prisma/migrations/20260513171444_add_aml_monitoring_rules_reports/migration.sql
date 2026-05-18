-- CreateTable
CREATE TABLE "AmlMonitoringEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "description" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "country" TEXT,
    "triggerRuleKey" TEXT,
    "riskImpact" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlMonitoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlRiskRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'IMPORTANT',
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "scoreImpact" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB,
    "action" JSONB,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlRiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_organizationId_idx" ON "AmlMonitoringEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_clientId_idx" ON "AmlMonitoringEvent"("clientId");

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_amlProfileId_idx" ON "AmlMonitoringEvent"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_eventType_idx" ON "AmlMonitoringEvent"("eventType");

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_status_idx" ON "AmlMonitoringEvent"("status");

-- CreateIndex
CREATE INDEX "AmlMonitoringEvent_createdAt_idx" ON "AmlMonitoringEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AmlRiskRule_organizationId_idx" ON "AmlRiskRule"("organizationId");

-- CreateIndex
CREATE INDEX "AmlRiskRule_category_idx" ON "AmlRiskRule"("category");

-- CreateIndex
CREATE INDEX "AmlRiskRule_enabled_idx" ON "AmlRiskRule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AmlRiskRule_organizationId_ruleKey_key" ON "AmlRiskRule"("organizationId", "ruleKey");

-- AddForeignKey
ALTER TABLE "AmlMonitoringEvent" ADD CONSTRAINT "AmlMonitoringEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlMonitoringEvent" ADD CONSTRAINT "AmlMonitoringEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlMonitoringEvent" ADD CONSTRAINT "AmlMonitoringEvent_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlRiskRule" ADD CONSTRAINT "AmlRiskRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
