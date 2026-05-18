-- Documented recommendations module: structured options, risks, delivered
-- documents, versions and audit trail.

ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'LIFE_INSURANCE';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'DISABILITY_INSURANCE';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'CRITICAL_ILLNESS';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'BUSINESS_INSURANCE';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'REPLACEMENT';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'INVESTMENT';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'MAINTAIN';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'NO_ACTION';
ALTER TYPE "ProductRecommendationType" ADD VALUE IF NOT EXISTS 'CLIENT_DECLINED';

ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'NOT_STARTED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'MISSING_DATA';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'OPTIONS_REQUIRED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'ADVISOR_REVIEW';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'COMPLIANCE_REVIEW_REQUIRED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'ADVISOR_APPROVED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'COMPLIANCE_APPROVED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'PRESENTED_TO_CLIENT';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'CLIENT_ACCEPTED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'CLIENT_DECLINED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'SIGNED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'USED_FOR_PROPOSAL';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "ProductRecommendationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_UPDATE';

CREATE TYPE "RecommendationClientDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'PARTIAL', 'DEFERRED', 'NO_RESPONSE');
CREATE TYPE "RecommendationOptionType" AS ENUM ('PRODUCT', 'STRATEGY', 'MAINTAIN', 'NO_ACTION', 'REPLACEMENT', 'CLIENT_DECLINE');
CREATE TYPE "RecommendationDocumentType" AS ENUM ('NEEDS_ANALYSIS_REPORT', 'RECOMMENDATION_REPORT', 'SUITABILITY_REPORT', 'ILLUSTRATION', 'PRODUCT_SUMMARY', 'REPLACEMENT_NOTICE', 'REPLACEMENT_COMPARISON', 'INVESTOR_PROFILE', 'FEE_SUMMARY', 'MEETING_NOTES', 'CONSENT', 'SIGNATURE', 'OTHER');
CREATE TYPE "RecommendationDeliveryMethod" AS ENUM ('PORTAL', 'SECURE_EMAIL', 'IN_PERSON', 'PHONE', 'OTHER');
CREATE TYPE "RecommendationRiskType" AS ENUM ('FEES', 'LIQUIDITY', 'EXCLUSIONS', 'VOLATILITY', 'UNDERWRITING', 'TERM_LIMIT', 'REPLACEMENT', 'BUDGET', 'BENEFICIARY', 'TAX', 'CONCENTRATION', 'COMPLEXITY', 'OTHER');

ALTER TABLE "ProductRecommendation"
  ADD COLUMN "sourceNeedsAnalysisId" TEXT,
  ADD COLUMN "opportunityId" TEXT,
  ADD COLUMN "reportDocumentId" TEXT,
  ADD COLUMN "recommendationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "clientDecision" "RecommendationClientDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "currentSituation" JSONB,
  ADD COLUMN "objectives" JSONB,
  ADD COLUMN "gaps" JSONB,
  ADD COLUMN "optionsSummary" JSONB,
  ADD COLUMN "recommendedSolution" JSONB,
  ADD COLUMN "recommendationReasoning" TEXT,
  ADD COLUMN "risksAndLimits" JSONB,
  ADD COLUMN "deliveredDocuments" JSONB,
  ADD COLUMN "generatedDraft" TEXT,
  ADD COLUMN "finalText" TEXT,
  ADD COLUMN "complianceFlags" JSONB,
  ADD COLUMN "advisorApprovedAt" TIMESTAMP(3),
  ADD COLUMN "complianceApprovedAt" TIMESTAMP(3),
  ADD COLUMN "presentedToClientAt" TIMESTAMP(3),
  ADD COLUMN "clientDecisionAt" TIMESTAMP(3),
  ADD COLUMN "clientSignedAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "usedForProposalAt" TIMESTAMP(3);

CREATE TABLE "RecommendationOption" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "clientId" TEXT,
  "createdById" TEXT,
  "optionName" TEXT NOT NULL,
  "optionType" "RecommendationOptionType" NOT NULL DEFAULT 'STRATEGY',
  "advantages" JSONB,
  "limitations" JSONB,
  "estimatedCost" DECIMAL(12,2),
  "isSelected" BOOLEAN NOT NULL DEFAULT false,
  "reasonNotSelected" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "clientId" TEXT,
  "documentId" TEXT,
  "documentType" "RecommendationDocumentType" NOT NULL DEFAULT 'OTHER',
  "deliveredToClient" BOOLEAN NOT NULL DEFAULT false,
  "deliveredAt" TIMESTAMP(3),
  "deliveryMethod" "RecommendationDeliveryMethod",
  "clientAcknowledgedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationRisk" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "clientId" TEXT,
  "createdById" TEXT,
  "riskType" "RecommendationRiskType" NOT NULL DEFAULT 'OTHER',
  "description" TEXT NOT NULL,
  "explainedToClient" BOOLEAN NOT NULL DEFAULT false,
  "clientAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "clientId" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "generatedText" TEXT,
  "editedText" TEXT,
  "changedById" TEXT,
  "changeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "clientId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductRecommendation_sourceNeedsAnalysisId_idx" ON "ProductRecommendation"("sourceNeedsAnalysisId");
CREATE INDEX "ProductRecommendation_opportunityId_idx" ON "ProductRecommendation"("opportunityId");
CREATE INDEX "ProductRecommendation_reportDocumentId_idx" ON "ProductRecommendation"("reportDocumentId");

CREATE INDEX "RecommendationOption_organizationId_idx" ON "RecommendationOption"("organizationId");
CREATE INDEX "RecommendationOption_recommendationId_idx" ON "RecommendationOption"("recommendationId");
CREATE INDEX "RecommendationOption_clientId_idx" ON "RecommendationOption"("clientId");
CREATE INDEX "RecommendationOption_isSelected_idx" ON "RecommendationOption"("isSelected");

CREATE INDEX "RecommendationDocument_organizationId_idx" ON "RecommendationDocument"("organizationId");
CREATE INDEX "RecommendationDocument_recommendationId_idx" ON "RecommendationDocument"("recommendationId");
CREATE INDEX "RecommendationDocument_clientId_idx" ON "RecommendationDocument"("clientId");
CREATE INDEX "RecommendationDocument_documentId_idx" ON "RecommendationDocument"("documentId");
CREATE INDEX "RecommendationDocument_deliveredToClient_idx" ON "RecommendationDocument"("deliveredToClient");

CREATE INDEX "RecommendationRisk_organizationId_idx" ON "RecommendationRisk"("organizationId");
CREATE INDEX "RecommendationRisk_recommendationId_idx" ON "RecommendationRisk"("recommendationId");
CREATE INDEX "RecommendationRisk_clientId_idx" ON "RecommendationRisk"("clientId");
CREATE INDEX "RecommendationRisk_riskType_idx" ON "RecommendationRisk"("riskType");

CREATE UNIQUE INDEX "RecommendationVersion_recommendationId_versionNumber_key" ON "RecommendationVersion"("recommendationId", "versionNumber");
CREATE INDEX "RecommendationVersion_organizationId_idx" ON "RecommendationVersion"("organizationId");
CREATE INDEX "RecommendationVersion_clientId_idx" ON "RecommendationVersion"("clientId");
CREATE INDEX "RecommendationVersion_changedById_idx" ON "RecommendationVersion"("changedById");

CREATE INDEX "RecommendationAuditLog_organizationId_idx" ON "RecommendationAuditLog"("organizationId");
CREATE INDEX "RecommendationAuditLog_recommendationId_idx" ON "RecommendationAuditLog"("recommendationId");
CREATE INDEX "RecommendationAuditLog_clientId_idx" ON "RecommendationAuditLog"("clientId");
CREATE INDEX "RecommendationAuditLog_userId_idx" ON "RecommendationAuditLog"("userId");
CREATE INDEX "RecommendationAuditLog_eventType_idx" ON "RecommendationAuditLog"("eventType");

ALTER TABLE "RecommendationOption" ADD CONSTRAINT "RecommendationOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOption" ADD CONSTRAINT "RecommendationOption_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOption" ADD CONSTRAINT "RecommendationOption_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationOption" ADD CONSTRAINT "RecommendationOption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationDocument" ADD CONSTRAINT "RecommendationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationDocument" ADD CONSTRAINT "RecommendationDocument_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationDocument" ADD CONSTRAINT "RecommendationDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationDocument" ADD CONSTRAINT "RecommendationDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationRisk" ADD CONSTRAINT "RecommendationRisk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationRisk" ADD CONSTRAINT "RecommendationRisk_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationRisk" ADD CONSTRAINT "RecommendationRisk_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationRisk" ADD CONSTRAINT "RecommendationRisk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationVersion" ADD CONSTRAINT "RecommendationVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationVersion" ADD CONSTRAINT "RecommendationVersion_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationVersion" ADD CONSTRAINT "RecommendationVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationVersion" ADD CONSTRAINT "RecommendationVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationAuditLog" ADD CONSTRAINT "RecommendationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationAuditLog" ADD CONSTRAINT "RecommendationAuditLog_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationAuditLog" ADD CONSTRAINT "RecommendationAuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationAuditLog" ADD CONSTRAINT "RecommendationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
