CREATE TABLE "MarketingSegment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CRM',
    "criteria" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "estimatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "variables" JSONB,
    "performance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "segmentId" TEXT,
    "templateId" TEXT,
    "sequenceId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "ctaUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "validationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "complianceChecks" JSONB,
    "pressureRules" JSONB,
    "attribution" JSONB,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "exitRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "templateId" TEXT,
    "position" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "actionType" TEXT NOT NULL DEFAULT 'SEND_EMAIL',
    "condition" JSONB,
    "exitOn" JSONB,
    "subject" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSend" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "consentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "unsubscribeToken" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "opportunityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingUnsubscribe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LINK',
    "token" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingUnsubscribe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "sendId" TEXT,
    "clientId" TEXT,
    "leadId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MARKETING',
    "url" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSend_unsubscribeToken_key" ON "MarketingSend"("unsubscribeToken");
CREATE UNIQUE INDEX "MarketingUnsubscribe_organizationId_email_channel_key" ON "MarketingUnsubscribe"("organizationId", "email", "channel");

CREATE INDEX "MarketingSegment_organizationId_idx" ON "MarketingSegment"("organizationId");
CREATE INDEX "MarketingSegment_status_idx" ON "MarketingSegment"("status");
CREATE INDEX "MarketingSegment_createdAt_idx" ON "MarketingSegment"("createdAt");
CREATE INDEX "MarketingTemplate_organizationId_idx" ON "MarketingTemplate"("organizationId");
CREATE INDEX "MarketingTemplate_channel_idx" ON "MarketingTemplate"("channel");
CREATE INDEX "MarketingTemplate_category_idx" ON "MarketingTemplate"("category");
CREATE INDEX "MarketingTemplate_status_idx" ON "MarketingTemplate"("status");
CREATE INDEX "MarketingTemplate_validationStatus_idx" ON "MarketingTemplate"("validationStatus");
CREATE INDEX "MarketingCampaign_organizationId_idx" ON "MarketingCampaign"("organizationId");
CREATE INDEX "MarketingCampaign_segmentId_idx" ON "MarketingCampaign"("segmentId");
CREATE INDEX "MarketingCampaign_templateId_idx" ON "MarketingCampaign"("templateId");
CREATE INDEX "MarketingCampaign_sequenceId_idx" ON "MarketingCampaign"("sequenceId");
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");
CREATE INDEX "MarketingCampaign_scheduledAt_idx" ON "MarketingCampaign"("scheduledAt");
CREATE INDEX "MarketingCampaign_createdAt_idx" ON "MarketingCampaign"("createdAt");
CREATE INDEX "MarketingSequence_organizationId_idx" ON "MarketingSequence"("organizationId");
CREATE INDEX "MarketingSequence_trigger_idx" ON "MarketingSequence"("trigger");
CREATE INDEX "MarketingSequence_status_idx" ON "MarketingSequence"("status");
CREATE INDEX "MarketingSequenceStep_sequenceId_idx" ON "MarketingSequenceStep"("sequenceId");
CREATE INDEX "MarketingSequenceStep_templateId_idx" ON "MarketingSequenceStep"("templateId");
CREATE INDEX "MarketingSequenceStep_position_idx" ON "MarketingSequenceStep"("position");
CREATE INDEX "MarketingSend_organizationId_idx" ON "MarketingSend"("organizationId");
CREATE INDEX "MarketingSend_campaignId_idx" ON "MarketingSend"("campaignId");
CREATE INDEX "MarketingSend_clientId_idx" ON "MarketingSend"("clientId");
CREATE INDEX "MarketingSend_leadId_idx" ON "MarketingSend"("leadId");
CREATE INDEX "MarketingSend_email_idx" ON "MarketingSend"("email");
CREATE INDEX "MarketingSend_status_idx" ON "MarketingSend"("status");
CREATE INDEX "MarketingSend_sentAt_idx" ON "MarketingSend"("sentAt");
CREATE INDEX "MarketingUnsubscribe_organizationId_idx" ON "MarketingUnsubscribe"("organizationId");
CREATE INDEX "MarketingUnsubscribe_email_idx" ON "MarketingUnsubscribe"("email");
CREATE INDEX "MarketingEvent_organizationId_idx" ON "MarketingEvent"("organizationId");
CREATE INDEX "MarketingEvent_campaignId_idx" ON "MarketingEvent"("campaignId");
CREATE INDEX "MarketingEvent_sendId_idx" ON "MarketingEvent"("sendId");
CREATE INDEX "MarketingEvent_clientId_idx" ON "MarketingEvent"("clientId");
CREATE INDEX "MarketingEvent_leadId_idx" ON "MarketingEvent"("leadId");
CREATE INDEX "MarketingEvent_type_idx" ON "MarketingEvent"("type");
CREATE INDEX "MarketingEvent_createdAt_idx" ON "MarketingEvent"("createdAt");

ALTER TABLE "MarketingSegment" ADD CONSTRAINT "MarketingSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTemplate" ADD CONSTRAINT "MarketingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "MarketingSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingSequence" ADD CONSTRAINT "MarketingSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSequenceStep" ADD CONSTRAINT "MarketingSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "MarketingSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSequenceStep" ADD CONSTRAINT "MarketingSequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingSend" ADD CONSTRAINT "MarketingSend_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSend" ADD CONSTRAINT "MarketingSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingUnsubscribe" ADD CONSTRAINT "MarketingUnsubscribe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "MarketingSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
