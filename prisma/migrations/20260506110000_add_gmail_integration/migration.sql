CREATE TABLE IF NOT EXISTS "GmailIntegrationConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT NOT NULL,
  "scope" TEXT,
  "tokenType" TEXT,
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmailIntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GmailIntegrationConnection_organizationId_userId_key" ON "GmailIntegrationConnection"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "GmailIntegrationConnection_organizationId_idx" ON "GmailIntegrationConnection"("organizationId");
CREATE INDEX IF NOT EXISTS "GmailIntegrationConnection_userId_idx" ON "GmailIntegrationConnection"("userId");
CREATE INDEX IF NOT EXISTS "GmailIntegrationConnection_email_idx" ON "GmailIntegrationConnection"("email");
CREATE INDEX IF NOT EXISTS "GmailIntegrationConnection_status_idx" ON "GmailIntegrationConnection"("status");

DO $$ BEGIN
  ALTER TABLE "GmailIntegrationConnection" ADD CONSTRAINT "GmailIntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GmailIntegrationConnection" ADD CONSTRAINT "GmailIntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
