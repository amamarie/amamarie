CREATE TABLE "ClientKybProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "subjectType" "ClientProfileType" NOT NULL DEFAULT 'BUSINESS',
  "legalName" TEXT,
  "tradeName" TEXT,
  "entityType" TEXT,
  "jurisdiction" TEXT,
  "registrationNumber" TEXT,
  "taxNumber" TEXT,
  "incorporationDate" TIMESTAMP(3),
  "headOfficeAddress" TEXT,
  "operatingAddress" TEXT,
  "businessActivity" TEXT,
  "industry" TEXT,
  "website" TEXT,
  "annualRevenue" DOUBLE PRECISION,
  "netProfit" DOUBLE PRECISION,
  "employeeCount" INTEGER,
  "cashIntensiveBusiness" BOOLEAN NOT NULL DEFAULT false,
  "internationalActivity" BOOLEAN NOT NULL DEFAULT false,
  "regulatedActivity" BOOLEAN NOT NULL DEFAULT false,
  "directorsDocumented" BOOLEAN NOT NULL DEFAULT false,
  "shareholdersDocumented" BOOLEAN NOT NULL DEFAULT false,
  "beneficialOwnersDocumented" BOOLEAN NOT NULL DEFAULT false,
  "authorizedSignersDocumented" BOOLEAN NOT NULL DEFAULT false,
  "corporateDocumentsCollected" BOOLEAN NOT NULL DEFAULT false,
  "ownershipStructureNotes" TEXT,
  "authorizedSignersNotes" TEXT,
  "beneficialOwnersNotes" TEXT,
  "sourceOfFunds" TEXT,
  "sourceOfWealth" TEXT,
  "amlRiskLevel" TEXT,
  "kybScore" INTEGER NOT NULL DEFAULT 0,
  "reviewNotes" TEXT,
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientKybProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientKybProfile_clientId_key" ON "ClientKybProfile"("clientId");
CREATE INDEX "ClientKybProfile_organizationId_idx" ON "ClientKybProfile"("organizationId");
CREATE INDEX "ClientKybProfile_clientId_idx" ON "ClientKybProfile"("clientId");
CREATE INDEX "ClientKybProfile_status_idx" ON "ClientKybProfile"("status");
CREATE INDEX "ClientKybProfile_subjectType_idx" ON "ClientKybProfile"("subjectType");

ALTER TABLE "ClientKybProfile" ADD CONSTRAINT "ClientKybProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientKybProfile" ADD CONSTRAINT "ClientKybProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
