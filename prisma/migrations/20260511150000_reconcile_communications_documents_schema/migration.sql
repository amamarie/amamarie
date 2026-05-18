CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationStatus" AS ENUM ('RECEIVED', 'SENT', 'FAILED', 'MISSED', 'QUEUED', 'DELIVERED', 'UNDELIVERED');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'FAILED', 'BUSY', 'NO_ANSWER');

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SMS_FAILED';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'INBOUND_CALL_RECEIVED';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'INBOUND_SMS_RECEIVED';
ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'SMS_FAILED';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'SMS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CALL_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SMS_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_LEAD_FROM_CALL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_LEAD_FROM_SMS';

CREATE TABLE "DocumentFolder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentId" TEXT,
  "clientId" TEXT,
  "leadId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT,
  "path" TEXT NOT NULL,
  "depth" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;

ALTER TABLE "CallLog" ADD COLUMN "advisorId" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "CallLog" ADD COLUMN "fromNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CallLog" ADD COLUMN "matchedEntityId" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "matchedEntityType" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "recordingUrl" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "toNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CallLog" ADD COLUMN "twilioCallSid" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CallLog" ALTER COLUMN "phoneNumber" DROP NOT NULL;

ALTER TABLE "SMSMessage" ADD COLUMN "advisorId" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "fromNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SMSMessage" ADD COLUMN "matchedEntityId" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "matchedEntityType" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "toNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SMSMessage" ADD COLUMN "twilioMessageSid" TEXT;
ALTER TABLE "SMSMessage" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SMSMessage" ALTER COLUMN "phoneNumber" DROP NOT NULL;

ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN "autoTranscribeCalls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN "autoGenerateCallSummary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN "callRecordingRetentionDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN "transcriptionLanguage" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN "allowTranscriptionForAssistants" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CallTranscription" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "GmailIntegrationConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "DocumentFolder_organizationId_idx" ON "DocumentFolder"("organizationId");
CREATE INDEX "DocumentFolder_parentId_idx" ON "DocumentFolder"("parentId");
CREATE INDEX "DocumentFolder_clientId_idx" ON "DocumentFolder"("clientId");
CREATE INDEX "DocumentFolder_leadId_idx" ON "DocumentFolder"("leadId");
CREATE INDEX "DocumentFolder_status_idx" ON "DocumentFolder"("status");
CREATE INDEX "DocumentFolder_path_idx" ON "DocumentFolder"("path");
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

CREATE INDEX "CallLog_advisorId_idx" ON "CallLog"("advisorId");
CREATE INDEX "CallLog_leadId_idx" ON "CallLog"("leadId");
CREATE INDEX "CallLog_clientId_idx" ON "CallLog"("clientId");
CREATE INDEX "CallLog_fromNumber_idx" ON "CallLog"("fromNumber");
CREATE INDEX "CallLog_toNumber_idx" ON "CallLog"("toNumber");
CREATE UNIQUE INDEX "CallLog_twilioCallSid_key" ON "CallLog"("twilioCallSid");
CREATE INDEX "CallLog_twilioCallSid_idx" ON "CallLog"("twilioCallSid");

CREATE INDEX "SMSMessage_advisorId_idx" ON "SMSMessage"("advisorId");
CREATE INDEX "SMSMessage_leadId_idx" ON "SMSMessage"("leadId");
CREATE INDEX "SMSMessage_clientId_idx" ON "SMSMessage"("clientId");
CREATE INDEX "SMSMessage_fromNumber_idx" ON "SMSMessage"("fromNumber");
CREATE INDEX "SMSMessage_toNumber_idx" ON "SMSMessage"("toNumber");
CREATE UNIQUE INDEX "SMSMessage_twilioMessageSid_key" ON "SMSMessage"("twilioMessageSid");
CREATE INDEX "SMSMessage_twilioMessageSid_idx" ON "SMSMessage"("twilioMessageSid");

ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SMSMessage" ADD CONSTRAINT "SMSMessage_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
