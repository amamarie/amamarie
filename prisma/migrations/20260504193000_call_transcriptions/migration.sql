ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_RECORDING_AVAILABLE';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_TRANSCRIPTION_STARTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_TRANSCRIBED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_TRANSCRIPTION_FAILED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_TRANSCRIPTION_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'AI_CALL_NOTE_GENERATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'AI_CALL_TASKS_CREATED';

DO $$ BEGIN
  CREATE TYPE "TranscriptionStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'APPROVED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TranscriptionProvider" AS ENUM ('OPENAI', 'DEEPGRAM', 'ASSEMBLYAI', 'AWS', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "recordingSid" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "recordingDurationSeconds" INTEGER;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "transcriptionStatus" "TranscriptionStatus";

DO $$ BEGIN
  IF to_regclass('"OrganizationCommunicationSettings"') IS NOT NULL THEN
    ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN IF NOT EXISTS "autoTranscribeCalls" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN IF NOT EXISTS "autoGenerateCallSummary" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN IF NOT EXISTS "callRecordingRetentionDays" INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN IF NOT EXISTS "transcriptionLanguage" TEXT NOT NULL DEFAULT 'fr';
    ALTER TABLE "OrganizationCommunicationSettings" ADD COLUMN IF NOT EXISTS "allowTranscriptionForAssistants" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CallTranscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "callLogId" TEXT NOT NULL,
  "clientId" TEXT,
  "leadId" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "provider" "TranscriptionProvider" NOT NULL DEFAULT 'OPENAI',
  "status" "TranscriptionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "language" TEXT DEFAULT 'fr',
  "durationSeconds" INTEGER,
  "audioUrl" TEXT,
  "audioStoragePath" TEXT,
  "audioMimeType" TEXT,
  "audioFileSize" INTEGER,
  "rawTranscript" TEXT,
  "editedTranscript" TEXT,
  "summary" JSONB,
  "aiStructuredNote" JSONB,
  "error" TEXT,
  "requestedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallTranscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallTranscription_callLogId_key" ON "CallTranscription"("callLogId");
CREATE INDEX IF NOT EXISTS "CallTranscription_organizationId_idx" ON "CallTranscription"("organizationId");
CREATE INDEX IF NOT EXISTS "CallTranscription_clientId_idx" ON "CallTranscription"("clientId");
CREATE INDEX IF NOT EXISTS "CallTranscription_leadId_idx" ON "CallTranscription"("leadId");
CREATE INDEX IF NOT EXISTS "CallTranscription_status_idx" ON "CallTranscription"("status");
CREATE INDEX IF NOT EXISTS "CallTranscription_provider_idx" ON "CallTranscription"("provider");

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CallTranscription" ADD CONSTRAINT "CallTranscription_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
