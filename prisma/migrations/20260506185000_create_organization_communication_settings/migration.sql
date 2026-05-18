CREATE TABLE "OrganizationCommunicationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "twilioPhoneNumber" TEXT,
  "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultAdvisorId" TEXT,
  "inboundCallAutoCreateLead" BOOLEAN NOT NULL DEFAULT true,
  "inboundSmsAutoCreateLead" BOOLEAN NOT NULL DEFAULT true,
  "defaultSmsReply" TEXT NOT NULL DEFAULT 'Bonjour, merci pour votre message. Un conseiller vous contactera sous peu.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationCommunicationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationCommunicationSettings_organizationId_key" ON "OrganizationCommunicationSettings"("organizationId");
CREATE INDEX "OrganizationCommunicationSettings_organizationId_idx" ON "OrganizationCommunicationSettings"("organizationId");

ALTER TABLE "OrganizationCommunicationSettings"
  ADD CONSTRAINT "OrganizationCommunicationSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
