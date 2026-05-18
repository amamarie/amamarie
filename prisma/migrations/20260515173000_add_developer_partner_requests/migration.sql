CREATE TABLE "DeveloperPartnerRequest" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "website" TEXT,
  "useCase" TEXT NOT NULL,
  "requestedScopes" JSONB,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "internalNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeveloperPartnerRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeveloperPartnerRequest_email_idx" ON "DeveloperPartnerRequest"("email");
CREATE INDEX "DeveloperPartnerRequest_status_idx" ON "DeveloperPartnerRequest"("status");
CREATE INDEX "DeveloperPartnerRequest_createdAt_idx" ON "DeveloperPartnerRequest"("createdAt");
