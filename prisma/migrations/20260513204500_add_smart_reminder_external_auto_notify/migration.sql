ALTER TABLE "OrganizationCommunicationSettings"
ADD COLUMN "smartRemindersExternalAutoNotify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "smartRemindersExternalNotifyMinPriority" TEXT NOT NULL DEFAULT 'CRITICAL';
