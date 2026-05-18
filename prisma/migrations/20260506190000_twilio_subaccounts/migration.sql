ALTER TABLE "OrganizationCommunicationSettings"
ADD COLUMN "twilioAccountSid" TEXT,
ADD COLUMN "twilioAuthToken" TEXT,
ADD COLUMN "twilioSubaccountName" TEXT,
ADD COLUMN "twilioMode" TEXT NOT NULL DEFAULT 'PLATFORM';
