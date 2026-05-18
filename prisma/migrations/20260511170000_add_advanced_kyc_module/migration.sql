-- Advanced KYC module: investor profile, goals, questionnaire answers, versions,
-- dedicated KYC alerts, cabinet policy settings and Loi 25 access log.

CREATE TABLE "InvestmentProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kycProfileId" TEXT,
  "profileType" TEXT,
  "primaryObjective" TEXT,
  "secondaryObjectives" JSONB,
  "investmentKnowledge" TEXT,
  "investmentExperience" JSONB,
  "riskToleranceScore" INTEGER,
  "riskCapacityScore" INTEGER,
  "finalRiskScore" INTEGER,
  "finalRiskProfile" TEXT,
  "riskProfileRationale" TEXT,
  "timeHorizon" TEXT,
  "liquidityNeeds" TEXT,
  "usesLeverage" BOOLEAN NOT NULL DEFAULT false,
  "leverageDetails" TEXT,
  "clientConfirmedAt" TIMESTAMP(3),
  "advisorValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialGoal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kycProfileId" TEXT,
  "goalName" TEXT NOT NULL,
  "goalType" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "targetAmount" DOUBLE PRECISION,
  "currentAmount" DOUBLE PRECISION,
  "timeHorizonYears" DOUBLE PRECISION,
  "liquidityNeed" TEXT,
  "riskLevelForGoal" TEXT,
  "accountId" TEXT,
  "contributionPlan" TEXT,
  "notes" TEXT,
  "source" TEXT NOT NULL DEFAULT 'CRM',
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskQuestionnaireAnswer" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kycProfileId" TEXT,
  "questionId" TEXT NOT NULL,
  "questionLabel" TEXT NOT NULL,
  "questionCategory" TEXT NOT NULL,
  "answerValue" JSONB NOT NULL,
  "score" INTEGER,
  "answeredById" TEXT,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskQuestionnaireAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kycProfileId" TEXT,
  "sourceSnapshotId" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "scoresSnapshot" JSONB,
  "alertsSnapshot" JSONB,
  "clientConfirmedAt" TIMESTAMP(3),
  "advisorValidatedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "lockedById" TEXT,
  "integrityHash" TEXT,
  "usedForRecommendationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycAlert" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kycProfileId" TEXT,
  "alertType" TEXT NOT NULL,
  "severity" "ComplianceAlertSeverity" NOT NULL,
  "status" "ComplianceAlertStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "triggerRuleId" TEXT,
  "assignedToId" TEXT,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KycAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycPolicySettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reviewCadenceMonths" INTEGER NOT NULL DEFAULT 36,
  "managedAccountReviewMonths" INTEGER NOT NULL DEFAULT 12,
  "completionThreshold" INTEGER NOT NULL DEFAULT 85,
  "freshnessThreshold" INTEGER NOT NULL DEFAULT 60,
  "coherenceThreshold" INTEGER NOT NULL DEFAULT 70,
  "blockRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "blockExpiredKyc" BOOLEAN NOT NULL DEFAULT true,
  "requireClientConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "requireAdvisorAttestation" BOOLEAN NOT NULL DEFAULT true,
  "allowAdvisorOverride" BOOLEAN NOT NULL DEFAULT true,
  "requireOverrideJustification" BOOLEAN NOT NULL DEFAULT true,
  "retentionYears" INTEGER NOT NULL DEFAULT 7,
  "maskingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "accessLogEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientExportEnabled" BOOLEAN NOT NULL DEFAULT true,
  "deletionPolicy" TEXT NOT NULL DEFAULT 'ARCHIVE_ONLY',
  "residencyPolicy" TEXT NOT NULL DEFAULT 'CANADA_PREFERRED',
  "exceptionPolicy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KycPolicySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycAccessLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "userId" TEXT,
  "accessType" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "sensitiveFields" JSONB,
  "masked" BOOLEAN NOT NULL DEFAULT true,
  "exportFormat" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycAccessLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductRecommendation" ADD COLUMN "sourceKycVersionId" TEXT;

CREATE UNIQUE INDEX "InvestmentProfile_clientId_key" ON "InvestmentProfile"("clientId");
CREATE UNIQUE INDEX "InvestmentProfile_kycProfileId_key" ON "InvestmentProfile"("kycProfileId");
CREATE INDEX "InvestmentProfile_organizationId_idx" ON "InvestmentProfile"("organizationId");
CREATE INDEX "InvestmentProfile_clientId_idx" ON "InvestmentProfile"("clientId");
CREATE INDEX "InvestmentProfile_kycProfileId_idx" ON "InvestmentProfile"("kycProfileId");
CREATE INDEX "InvestmentProfile_finalRiskProfile_idx" ON "InvestmentProfile"("finalRiskProfile");

CREATE INDEX "FinancialGoal_organizationId_idx" ON "FinancialGoal"("organizationId");
CREATE INDEX "FinancialGoal_clientId_idx" ON "FinancialGoal"("clientId");
CREATE INDEX "FinancialGoal_kycProfileId_idx" ON "FinancialGoal"("kycProfileId");
CREATE INDEX "FinancialGoal_goalType_idx" ON "FinancialGoal"("goalType");
CREATE INDEX "FinancialGoal_priority_idx" ON "FinancialGoal"("priority");

CREATE INDEX "RiskQuestionnaireAnswer_organizationId_idx" ON "RiskQuestionnaireAnswer"("organizationId");
CREATE INDEX "RiskQuestionnaireAnswer_clientId_idx" ON "RiskQuestionnaireAnswer"("clientId");
CREATE INDEX "RiskQuestionnaireAnswer_kycProfileId_idx" ON "RiskQuestionnaireAnswer"("kycProfileId");
CREATE INDEX "RiskQuestionnaireAnswer_questionCategory_idx" ON "RiskQuestionnaireAnswer"("questionCategory");

CREATE UNIQUE INDEX "KycVersion_clientId_versionNumber_key" ON "KycVersion"("clientId", "versionNumber");
CREATE INDEX "KycVersion_organizationId_idx" ON "KycVersion"("organizationId");
CREATE INDEX "KycVersion_clientId_idx" ON "KycVersion"("clientId");
CREATE INDEX "KycVersion_kycProfileId_idx" ON "KycVersion"("kycProfileId");
CREATE INDEX "KycVersion_sourceSnapshotId_idx" ON "KycVersion"("sourceSnapshotId");
CREATE INDEX "KycVersion_lockedAt_idx" ON "KycVersion"("lockedAt");

CREATE UNIQUE INDEX "KycAlert_clientId_alertType_status_key" ON "KycAlert"("clientId", "alertType", "status");
CREATE INDEX "KycAlert_organizationId_idx" ON "KycAlert"("organizationId");
CREATE INDEX "KycAlert_clientId_idx" ON "KycAlert"("clientId");
CREATE INDEX "KycAlert_kycProfileId_idx" ON "KycAlert"("kycProfileId");
CREATE INDEX "KycAlert_severity_idx" ON "KycAlert"("severity");
CREATE INDEX "KycAlert_status_idx" ON "KycAlert"("status");

CREATE UNIQUE INDEX "KycPolicySettings_organizationId_key" ON "KycPolicySettings"("organizationId");

CREATE INDEX "KycAccessLog_organizationId_idx" ON "KycAccessLog"("organizationId");
CREATE INDEX "KycAccessLog_clientId_idx" ON "KycAccessLog"("clientId");
CREATE INDEX "KycAccessLog_userId_idx" ON "KycAccessLog"("userId");
CREATE INDEX "KycAccessLog_accessType_idx" ON "KycAccessLog"("accessType");
CREATE INDEX "KycAccessLog_createdAt_idx" ON "KycAccessLog"("createdAt");

CREATE INDEX "ProductRecommendation_sourceKycVersionId_idx" ON "ProductRecommendation"("sourceKycVersionId");

ALTER TABLE "InvestmentProfile" ADD CONSTRAINT "InvestmentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentProfile" ADD CONSTRAINT "InvestmentProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentProfile" ADD CONSTRAINT "InvestmentProfile_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RiskQuestionnaireAnswer" ADD CONSTRAINT "RiskQuestionnaireAnswer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskQuestionnaireAnswer" ADD CONSTRAINT "RiskQuestionnaireAnswer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskQuestionnaireAnswer" ADD CONSTRAINT "RiskQuestionnaireAnswer_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KycVersion" ADD CONSTRAINT "KycVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycVersion" ADD CONSTRAINT "KycVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycVersion" ADD CONSTRAINT "KycVersion_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KycVersion" ADD CONSTRAINT "KycVersion_sourceSnapshotId_fkey" FOREIGN KEY ("sourceSnapshotId") REFERENCES "KycSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KycVersion" ADD CONSTRAINT "KycVersion_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KycAlert" ADD CONSTRAINT "KycAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycAlert" ADD CONSTRAINT "KycAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycAlert" ADD CONSTRAINT "KycAlert_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KycAlert" ADD CONSTRAINT "KycAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KycPolicySettings" ADD CONSTRAINT "KycPolicySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KycAccessLog" ADD CONSTRAINT "KycAccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycAccessLog" ADD CONSTRAINT "KycAccessLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KycAccessLog" ADD CONSTRAINT "KycAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_sourceKycVersionId_fkey" FOREIGN KEY ("sourceKycVersionId") REFERENCES "KycVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
