CREATE TYPE "InsuranceAnalysisType" AS ENUM ('LIFE', 'DISABILITY', 'CRITICAL_ILLNESS', 'BUSINESS', 'REPLACEMENT');
CREATE TYPE "InsuranceAnalysisStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'MISSING_DATA', 'IN_ANALYSIS', 'ADVISOR_REVIEW', 'RECOMMENDATION_PREPARED', 'WAITING_CLIENT', 'COMPLETED', 'DELIVERED', 'USED_FOR_SUBMISSION', 'ARCHIVED', 'NEEDS_UPDATE');
CREATE TYPE "InsuranceInputSource" AS ENUM ('CRM', 'KYC', 'ADVISOR', 'CLIENT', 'DOCUMENT', 'SYSTEM');
CREATE TYPE "InsuranceClientDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'DEFERRED');

CREATE TABLE "InsuranceNeedsAnalysis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "advisorId" TEXT,
  "sourceKycSnapshotId" TEXT,
  "reportDocumentId" TEXT,
  "analysisType" "InsuranceAnalysisType" NOT NULL,
  "status" "InsuranceAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "objective" TEXT,
  "summary" TEXT,
  "aiSummary" TEXT,
  "advisorNotes" TEXT,
  "clientConfirmedAt" TIMESTAMP(3),
  "advisorValidatedAt" TIMESTAMP(3),
  "usedForRecommendation" BOOLEAN NOT NULL DEFAULT false,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceNeedsAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceAnalysisInput" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "inputKey" TEXT NOT NULL,
  "label" TEXT,
  "inputValue" JSONB NOT NULL,
  "source" "InsuranceInputSource" NOT NULL DEFAULT 'CRM',
  "sourceDocumentId" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceAnalysisInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceAnalysisAssumption" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "assumptionType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT,
  "numericValue" DOUBLE PRECISION,
  "unit" TEXT,
  "reason" TEXT,
  "editableByAdvisor" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceAnalysisAssumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceAnalysisResult" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "needCategory" TEXT NOT NULL,
  "grossNeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "existingCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableAssetsOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netNeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gapAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "calculationDetails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceAnalysisResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceAnalysisRecommendation" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "recommendedProductType" TEXT NOT NULL,
  "recommendedAmount" DOUBLE PRECISION,
  "recommendedTerm" TEXT,
  "premiumEstimate" DOUBLE PRECISION,
  "reasoning" TEXT,
  "alternativesConsidered" JSONB,
  "clientDecision" "InsuranceClientDecision" NOT NULL DEFAULT 'PENDING',
  "clientDeclineReason" TEXT,
  "advisorNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceAnalysisRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceReplacementComparison" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "existingPolicyId" TEXT,
  "proposedPolicyId" TEXT,
  "replacementRequired" BOOLEAN NOT NULL DEFAULT false,
  "advantages" JSONB,
  "disadvantages" JSONB,
  "lostBenefits" JSONB,
  "newExclusions" JSONB,
  "justification" TEXT,
  "noticeDocumentId" TEXT,
  "clientAcknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InsuranceReplacementComparison_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InsuranceNeedsAnalysis_organizationId_idx" ON "InsuranceNeedsAnalysis"("organizationId");
CREATE INDEX "InsuranceNeedsAnalysis_clientId_idx" ON "InsuranceNeedsAnalysis"("clientId");
CREATE INDEX "InsuranceNeedsAnalysis_advisorId_idx" ON "InsuranceNeedsAnalysis"("advisorId");
CREATE INDEX "InsuranceNeedsAnalysis_analysisType_idx" ON "InsuranceNeedsAnalysis"("analysisType");
CREATE INDEX "InsuranceNeedsAnalysis_status_idx" ON "InsuranceNeedsAnalysis"("status");
CREATE INDEX "InsuranceNeedsAnalysis_analysisDate_idx" ON "InsuranceNeedsAnalysis"("analysisDate");

CREATE INDEX "InsuranceAnalysisInput_analysisId_idx" ON "InsuranceAnalysisInput"("analysisId");
CREATE INDEX "InsuranceAnalysisInput_inputKey_idx" ON "InsuranceAnalysisInput"("inputKey");
CREATE INDEX "InsuranceAnalysisInput_source_idx" ON "InsuranceAnalysisInput"("source");

CREATE INDEX "InsuranceAnalysisAssumption_analysisId_idx" ON "InsuranceAnalysisAssumption"("analysisId");
CREATE INDEX "InsuranceAnalysisAssumption_assumptionType_idx" ON "InsuranceAnalysisAssumption"("assumptionType");

CREATE INDEX "InsuranceAnalysisResult_analysisId_idx" ON "InsuranceAnalysisResult"("analysisId");
CREATE INDEX "InsuranceAnalysisResult_needCategory_idx" ON "InsuranceAnalysisResult"("needCategory");

CREATE INDEX "InsuranceAnalysisRecommendation_analysisId_idx" ON "InsuranceAnalysisRecommendation"("analysisId");
CREATE INDEX "InsuranceAnalysisRecommendation_clientDecision_idx" ON "InsuranceAnalysisRecommendation"("clientDecision");

CREATE INDEX "InsuranceReplacementComparison_analysisId_idx" ON "InsuranceReplacementComparison"("analysisId");
CREATE INDEX "InsuranceReplacementComparison_replacementRequired_idx" ON "InsuranceReplacementComparison"("replacementRequired");

ALTER TABLE "InsuranceNeedsAnalysis" ADD CONSTRAINT "InsuranceNeedsAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceNeedsAnalysis" ADD CONSTRAINT "InsuranceNeedsAnalysis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceNeedsAnalysis" ADD CONSTRAINT "InsuranceNeedsAnalysis_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsuranceNeedsAnalysis" ADD CONSTRAINT "InsuranceNeedsAnalysis_sourceKycSnapshotId_fkey" FOREIGN KEY ("sourceKycSnapshotId") REFERENCES "KycSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsuranceNeedsAnalysis" ADD CONSTRAINT "InsuranceNeedsAnalysis_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InsuranceAnalysisInput" ADD CONSTRAINT "InsuranceAnalysisInput_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "InsuranceNeedsAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceAnalysisInput" ADD CONSTRAINT "InsuranceAnalysisInput_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InsuranceAnalysisAssumption" ADD CONSTRAINT "InsuranceAnalysisAssumption_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "InsuranceNeedsAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceAnalysisResult" ADD CONSTRAINT "InsuranceAnalysisResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "InsuranceNeedsAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceAnalysisRecommendation" ADD CONSTRAINT "InsuranceAnalysisRecommendation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "InsuranceNeedsAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceReplacementComparison" ADD CONSTRAINT "InsuranceReplacementComparison_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "InsuranceNeedsAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
