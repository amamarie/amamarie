CREATE TABLE IF NOT EXISTS "LeadForm" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "subdomainSlug" TEXT,
  "publicTitle" TEXT NOT NULL,
  "publicDescription" TEXT,
  "successMessage" TEXT,
  "fields" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "googleSheetId" TEXT,
  "googleSheetName" TEXT DEFAULT 'Leads',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadFormSubmission" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadFormId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "leadId" TEXT,
  "payload" JSONB NOT NULL,
  "sourceUrl" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "syncedToGoogleSheets" BOOLEAN NOT NULL DEFAULT false,
  "googleSheetRowId" TEXT,
  "syncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadForm_slug_key" ON "LeadForm"("slug");
CREATE INDEX IF NOT EXISTS "LeadForm_organizationId_idx" ON "LeadForm"("organizationId");
CREATE INDEX IF NOT EXISTS "LeadForm_advisorId_idx" ON "LeadForm"("advisorId");
CREATE INDEX IF NOT EXISTS "LeadForm_slug_idx" ON "LeadForm"("slug");
CREATE INDEX IF NOT EXISTS "LeadForm_subdomainSlug_idx" ON "LeadForm"("subdomainSlug");
CREATE INDEX IF NOT EXISTS "LeadForm_isActive_idx" ON "LeadForm"("isActive");

CREATE INDEX IF NOT EXISTS "LeadFormSubmission_organizationId_idx" ON "LeadFormSubmission"("organizationId");
CREATE INDEX IF NOT EXISTS "LeadFormSubmission_leadFormId_idx" ON "LeadFormSubmission"("leadFormId");
CREATE INDEX IF NOT EXISTS "LeadFormSubmission_advisorId_idx" ON "LeadFormSubmission"("advisorId");
CREATE INDEX IF NOT EXISTS "LeadFormSubmission_leadId_idx" ON "LeadFormSubmission"("leadId");
CREATE INDEX IF NOT EXISTS "LeadFormSubmission_syncedToGoogleSheets_idx" ON "LeadFormSubmission"("syncedToGoogleSheets");
CREATE INDEX IF NOT EXISTS "LeadFormSubmission_createdAt_idx" ON "LeadFormSubmission"("createdAt");

DO $$
BEGIN
  ALTER TABLE "LeadForm" ADD CONSTRAINT "LeadForm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadForm" ADD CONSTRAINT "LeadForm_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_leadFormId_fkey" FOREIGN KEY ("leadFormId") REFERENCES "LeadForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "LeadFormSubmission" ADD CONSTRAINT "LeadFormSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
