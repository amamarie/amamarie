CREATE TABLE "MarketingSequenceEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStepPosition" INTEGER NOT NULL DEFAULT 1,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingLeadScore" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COLD',
    "signals" JSONB,
    "lastSignalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLeadScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSequenceEnrollment_sequenceId_email_key" ON "MarketingSequenceEnrollment"("sequenceId", "email");
CREATE INDEX "MarketingSequenceEnrollment_organizationId_idx" ON "MarketingSequenceEnrollment"("organizationId");
CREATE INDEX "MarketingSequenceEnrollment_sequenceId_idx" ON "MarketingSequenceEnrollment"("sequenceId");
CREATE INDEX "MarketingSequenceEnrollment_clientId_idx" ON "MarketingSequenceEnrollment"("clientId");
CREATE INDEX "MarketingSequenceEnrollment_leadId_idx" ON "MarketingSequenceEnrollment"("leadId");
CREATE INDEX "MarketingSequenceEnrollment_email_idx" ON "MarketingSequenceEnrollment"("email");
CREATE INDEX "MarketingSequenceEnrollment_status_idx" ON "MarketingSequenceEnrollment"("status");
CREATE INDEX "MarketingSequenceEnrollment_nextRunAt_idx" ON "MarketingSequenceEnrollment"("nextRunAt");

CREATE UNIQUE INDEX "MarketingLeadScore_organizationId_email_key" ON "MarketingLeadScore"("organizationId", "email");
CREATE INDEX "MarketingLeadScore_organizationId_idx" ON "MarketingLeadScore"("organizationId");
CREATE INDEX "MarketingLeadScore_clientId_idx" ON "MarketingLeadScore"("clientId");
CREATE INDEX "MarketingLeadScore_leadId_idx" ON "MarketingLeadScore"("leadId");
CREATE INDEX "MarketingLeadScore_score_idx" ON "MarketingLeadScore"("score");
CREATE INDEX "MarketingLeadScore_status_idx" ON "MarketingLeadScore"("status");

ALTER TABLE "MarketingSequenceEnrollment" ADD CONSTRAINT "MarketingSequenceEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSequenceEnrollment" ADD CONSTRAINT "MarketingSequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "MarketingSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadScore" ADD CONSTRAINT "MarketingLeadScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
