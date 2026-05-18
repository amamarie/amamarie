-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_DOCUMENTS', 'PENDING_REVIEW', 'APPROVED', 'NEEDS_UPDATE', 'EXPIRED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComplianceAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplianceAlertStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'GIVEN', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REQUIRED', 'REQUESTED', 'RECEIVED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'WAIVED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'KYC_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_REVIEW_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_SNAPSHOT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'CONSENT_GIVEN';
ALTER TYPE "ActivityType" ADD VALUE 'CONSENT_REVOKED';
ALTER TYPE "ActivityType" ADD VALUE 'COMPLIANCE_ALERT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'COMPLIANCE_ALERT_RESOLVED';
ALTER TYPE "ActivityType" ADD VALUE 'COMPLIANCE_ALERT_DISMISSED';
ALTER TYPE "ActivityType" ADD VALUE 'AUDIT_LOG_CREATED';

-- CreateTable
CREATE TABLE "ClientKycProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "legalFirstName" TEXT,
    "legalLastName" TEXT,
    "preferredName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "countryOfResidence" TEXT,
    "provinceOfResidence" TEXT,
    "citizenship" TEXT,
    "taxResidency" TEXT,
    "sinLast4" TEXT,
    "maritalStatus" TEXT,
    "dependentsCount" INTEGER,
    "politicallyExposedPerson" BOOLEAN NOT NULL DEFAULT false,
    "pepDetails" TEXT,
    "insiderStatus" BOOLEAN NOT NULL DEFAULT false,
    "insiderCompany" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "employmentStatus" TEXT,
    "annualIncome" DOUBLE PRECISION,
    "incomeRange" TEXT,
    "netWorth" DOUBLE PRECISION,
    "liquidNetWorth" DOUBLE PRECISION,
    "totalAssets" DOUBLE PRECISION,
    "totalLiabilities" DOUBLE PRECISION,
    "monthlyExpenses" DOUBLE PRECISION,
    "emergencyFund" DOUBLE PRECISION,
    "investmentKnowledge" TEXT,
    "investmentExperience" TEXT,
    "borrowingNeeds" TEXT,
    "liquidityNeeds" TEXT,
    "taxBracket" TEXT,
    "sourceOfWealth" TEXT,
    "sourceOfFunds" TEXT,
    "primaryObjective" TEXT,
    "secondaryObjectives" JSONB,
    "investmentHorizon" TEXT,
    "riskTolerance" TEXT,
    "riskCapacity" TEXT,
    "riskProfileResult" TEXT,
    "timeHorizonYears" INTEGER,
    "retirementAgeTarget" INTEGER,
    "protectionNeeds" TEXT,
    "estatePlanningNeeds" BOOLEAN NOT NULL DEFAULT false,
    "educationFundingNeeds" BOOLEAN NOT NULL DEFAULT false,
    "homePurchaseGoal" BOOLEAN NOT NULL DEFAULT false,
    "taxOptimizationGoal" BOOLEAN NOT NULL DEFAULT false,
    "riskQuestionnaireCompleted" BOOLEAN NOT NULL DEFAULT false,
    "riskQuestionnaireScore" INTEGER,
    "riskQuestionnaireDate" TIMESTAMP(3),
    "riskProfileNotes" TEXT,
    "advisorOverride" BOOLEAN NOT NULL DEFAULT false,
    "advisorOverrideReason" TEXT,
    "financialGoals" TEXT,
    "notes" TEXT,
    "lastKycReviewAt" TIMESTAMP(3),
    "nextKycReviewAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewStatus" TEXT,
    "reviewNotes" TEXT,
    "changesDetected" BOOLEAN NOT NULL DEFAULT false,
    "clientConfirmedNoChange" BOOLEAN NOT NULL DEFAULT false,
    "advisorAttestation" BOOLEAN NOT NULL DEFAULT false,
    "advisorAttestationAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "complianceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientKycProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "capturedById" TEXT,
    "type" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "consentText" TEXT,
    "version" TEXT,
    "givenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "ComplianceAlertSeverity" NOT NULL,
    "status" "ComplianceAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientKycProfile_clientId_key" ON "ClientKycProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientKycProfile_organizationId_idx" ON "ClientKycProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ClientKycProfile_clientId_idx" ON "ClientKycProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientKycProfile_status_idx" ON "ClientKycProfile"("status");

-- CreateIndex
CREATE INDEX "ClientKycProfile_nextKycReviewAt_idx" ON "ClientKycProfile"("nextKycReviewAt");

-- CreateIndex
CREATE INDEX "ClientConsent_organizationId_idx" ON "ClientConsent"("organizationId");

-- CreateIndex
CREATE INDEX "ClientConsent_clientId_idx" ON "ClientConsent"("clientId");

-- CreateIndex
CREATE INDEX "ClientConsent_status_idx" ON "ClientConsent"("status");

-- CreateIndex
CREATE INDEX "ClientConsent_type_idx" ON "ClientConsent"("type");

-- CreateIndex
CREATE INDEX "ComplianceAlert_organizationId_idx" ON "ComplianceAlert"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceAlert_clientId_idx" ON "ComplianceAlert"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceAlert_status_idx" ON "ComplianceAlert"("status");

-- CreateIndex
CREATE INDEX "ComplianceAlert_severity_idx" ON "ComplianceAlert"("severity");

-- CreateIndex
CREATE INDEX "ComplianceAlert_type_idx" ON "ComplianceAlert"("type");

-- CreateIndex
CREATE INDEX "KycSnapshot_organizationId_idx" ON "KycSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "KycSnapshot_clientId_idx" ON "KycSnapshot"("clientId");

-- CreateIndex
CREATE INDEX "KycSnapshot_version_idx" ON "KycSnapshot"("version");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_clientId_idx" ON "AuditLog"("clientId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ClientKycProfile" ADD CONSTRAINT "ClientKycProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientKycProfile" ADD CONSTRAINT "ClientKycProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientKycProfile" ADD CONSTRAINT "ClientKycProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientKycProfile" ADD CONSTRAINT "ClientKycProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientKycProfile" ADD CONSTRAINT "ClientKycProfile_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsent" ADD CONSTRAINT "ClientConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsent" ADD CONSTRAINT "ClientConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsent" ADD CONSTRAINT "ClientConsent_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSnapshot" ADD CONSTRAINT "KycSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSnapshot" ADD CONSTRAINT "KycSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSnapshot" ADD CONSTRAINT "KycSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
