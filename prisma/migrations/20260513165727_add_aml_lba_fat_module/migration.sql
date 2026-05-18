-- CreateTable
CREATE TABLE "AmlProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TO_REVIEW',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "riskRationale" TEXT,
    "identityStatus" TEXT NOT NULL DEFAULT 'TO_VERIFY',
    "sourceOfFundsStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "sourceOfWealthStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "thirdPartyStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "beneficialOwnershipStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "pepStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sanctionsStatus" TEXT NOT NULL DEFAULT 'NOT_SCREENED',
    "enhancedMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "seniorReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextReviewAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "assignedComplianceUserId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlIdentityVerification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "verificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "personType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "method" TEXT,
    "provider" TEXT,
    "documentType" TEXT,
    "documentId" TEXT,
    "issuingJurisdiction" TEXT,
    "documentExpiresAt" TIMESTAMP(3),
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlIdentityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlSourceOfFundsRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "transactionId" TEXT,
    "operationType" TEXT,
    "sourceType" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "originCountry" TEXT,
    "financialInstitution" TEXT,
    "thirdPartyFunds" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "coherentWithKyc" TEXT NOT NULL DEFAULT 'TO_REVIEW',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlSourceOfFundsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlSourceOfWealthRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "wealthSourceType" TEXT NOT NULL,
    "description" TEXT,
    "estimatedWealth" DECIMAL(14,2),
    "accumulationYears" INTEGER,
    "documentId" TEXT,
    "coherentWithKyc" TEXT NOT NULL DEFAULT 'TO_REVIEW',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlSourceOfWealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlThirdPartyDetermination" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "transactionId" TEXT,
    "thirdPartyInvolved" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartySuspected" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyName" TEXT,
    "thirdPartyType" TEXT,
    "relationshipToClient" TEXT,
    "role" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "sourceOfFunds" TEXT,
    "documentId" TEXT,
    "determinationMethod" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "complianceReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlThirdPartyDetermination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlBeneficialOwnershipRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityType" TEXT,
    "directOwnerName" TEXT,
    "ultimateBeneficialOwnerName" TEXT NOT NULL,
    "directOwnershipPercentage" DECIMAL(5,2),
    "indirectOwnershipPercentage" DECIMAL(5,2),
    "controlWithoutOwnership" BOOLEAN NOT NULL DEFAULT false,
    "controlType" TEXT,
    "isBeneficialOwner" BOOLEAN NOT NULL DEFAULT true,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "documentId" TEXT,
    "sourceOfConfirmation" TEXT,
    "officialRegistryMismatch" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlBeneficialOwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlPepScreening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "screenedPersonName" TEXT NOT NULL,
    "screeningType" TEXT NOT NULL DEFAULT 'CLIENT',
    "result" TEXT NOT NULL DEFAULT 'NO_MATCH',
    "pepType" TEXT,
    "positionTitle" TEXT,
    "organizationName" TEXT,
    "country" TEXT,
    "relationshipToClient" TEXT,
    "sourceOfFundsRequired" BOOLEAN NOT NULL DEFAULT false,
    "sourceOfWealthRequired" BOOLEAN NOT NULL DEFAULT false,
    "seniorManagementReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlPepScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlSanctionsScreening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "screenedEntityType" TEXT NOT NULL DEFAULT 'CLIENT',
    "screenedEntityId" TEXT,
    "nameScreened" TEXT NOT NULL,
    "aliasesScreened" JSONB,
    "listsUsed" JSONB NOT NULL,
    "provider" TEXT,
    "result" TEXT NOT NULL DEFAULT 'NO_MATCH',
    "matchScore" DECIMAL(5,2),
    "matchedName" TEXT,
    "matchedList" TEXT,
    "matchType" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlSanctionsScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'IMPORTANT',
    "message" TEXT NOT NULL,
    "triggerRuleKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "reason" TEXT,
    "riskLevelBefore" TEXT,
    "riskLevelAfter" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlInternalReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "transactionId" TEXT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "facts" TEXT,
    "context" TEXT,
    "indicators" JSONB,
    "reasonableSuspicionAssessment" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "preparedById" TEXT,
    "approvedById" TEXT,
    "submittedToFintrac" BOOLEAN NOT NULL DEFAULT false,
    "fintracReference" TEXT,
    "submittedAt" TIMESTAMP(3),
    "copyDocumentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlInternalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlRiskScoreComponent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amlProfileId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rationale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmlRiskScoreComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmlProfile_clientId_key" ON "AmlProfile"("clientId");

-- CreateIndex
CREATE INDEX "AmlProfile_organizationId_idx" ON "AmlProfile"("organizationId");

-- CreateIndex
CREATE INDEX "AmlProfile_clientId_idx" ON "AmlProfile"("clientId");

-- CreateIndex
CREATE INDEX "AmlProfile_status_idx" ON "AmlProfile"("status");

-- CreateIndex
CREATE INDEX "AmlProfile_riskLevel_idx" ON "AmlProfile"("riskLevel");

-- CreateIndex
CREATE INDEX "AmlProfile_nextReviewAt_idx" ON "AmlProfile"("nextReviewAt");

-- CreateIndex
CREATE INDEX "AmlIdentityVerification_organizationId_idx" ON "AmlIdentityVerification"("organizationId");

-- CreateIndex
CREATE INDEX "AmlIdentityVerification_clientId_idx" ON "AmlIdentityVerification"("clientId");

-- CreateIndex
CREATE INDEX "AmlIdentityVerification_amlProfileId_idx" ON "AmlIdentityVerification"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlIdentityVerification_result_idx" ON "AmlIdentityVerification"("result");

-- CreateIndex
CREATE INDEX "AmlIdentityVerification_expiresAt_idx" ON "AmlIdentityVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "AmlSourceOfFundsRecord_organizationId_idx" ON "AmlSourceOfFundsRecord"("organizationId");

-- CreateIndex
CREATE INDEX "AmlSourceOfFundsRecord_clientId_idx" ON "AmlSourceOfFundsRecord"("clientId");

-- CreateIndex
CREATE INDEX "AmlSourceOfFundsRecord_amlProfileId_idx" ON "AmlSourceOfFundsRecord"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlSourceOfFundsRecord_riskLevel_idx" ON "AmlSourceOfFundsRecord"("riskLevel");

-- CreateIndex
CREATE INDEX "AmlSourceOfFundsRecord_validatedAt_idx" ON "AmlSourceOfFundsRecord"("validatedAt");

-- CreateIndex
CREATE INDEX "AmlSourceOfWealthRecord_organizationId_idx" ON "AmlSourceOfWealthRecord"("organizationId");

-- CreateIndex
CREATE INDEX "AmlSourceOfWealthRecord_clientId_idx" ON "AmlSourceOfWealthRecord"("clientId");

-- CreateIndex
CREATE INDEX "AmlSourceOfWealthRecord_amlProfileId_idx" ON "AmlSourceOfWealthRecord"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlSourceOfWealthRecord_validatedAt_idx" ON "AmlSourceOfWealthRecord"("validatedAt");

-- CreateIndex
CREATE INDEX "AmlThirdPartyDetermination_organizationId_idx" ON "AmlThirdPartyDetermination"("organizationId");

-- CreateIndex
CREATE INDEX "AmlThirdPartyDetermination_clientId_idx" ON "AmlThirdPartyDetermination"("clientId");

-- CreateIndex
CREATE INDEX "AmlThirdPartyDetermination_amlProfileId_idx" ON "AmlThirdPartyDetermination"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlThirdPartyDetermination_thirdPartyInvolved_idx" ON "AmlThirdPartyDetermination"("thirdPartyInvolved");

-- CreateIndex
CREATE INDEX "AmlThirdPartyDetermination_riskLevel_idx" ON "AmlThirdPartyDetermination"("riskLevel");

-- CreateIndex
CREATE INDEX "AmlBeneficialOwnershipRecord_organizationId_idx" ON "AmlBeneficialOwnershipRecord"("organizationId");

-- CreateIndex
CREATE INDEX "AmlBeneficialOwnershipRecord_clientId_idx" ON "AmlBeneficialOwnershipRecord"("clientId");

-- CreateIndex
CREATE INDEX "AmlBeneficialOwnershipRecord_amlProfileId_idx" ON "AmlBeneficialOwnershipRecord"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlBeneficialOwnershipRecord_isBeneficialOwner_idx" ON "AmlBeneficialOwnershipRecord"("isBeneficialOwner");

-- CreateIndex
CREATE INDEX "AmlBeneficialOwnershipRecord_confirmedAt_idx" ON "AmlBeneficialOwnershipRecord"("confirmedAt");

-- CreateIndex
CREATE INDEX "AmlPepScreening_organizationId_idx" ON "AmlPepScreening"("organizationId");

-- CreateIndex
CREATE INDEX "AmlPepScreening_clientId_idx" ON "AmlPepScreening"("clientId");

-- CreateIndex
CREATE INDEX "AmlPepScreening_amlProfileId_idx" ON "AmlPepScreening"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlPepScreening_result_idx" ON "AmlPepScreening"("result");

-- CreateIndex
CREATE INDEX "AmlPepScreening_pepType_idx" ON "AmlPepScreening"("pepType");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_organizationId_idx" ON "AmlSanctionsScreening"("organizationId");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_clientId_idx" ON "AmlSanctionsScreening"("clientId");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_amlProfileId_idx" ON "AmlSanctionsScreening"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_result_idx" ON "AmlSanctionsScreening"("result");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_decision_idx" ON "AmlSanctionsScreening"("decision");

-- CreateIndex
CREATE INDEX "AmlSanctionsScreening_nextReviewAt_idx" ON "AmlSanctionsScreening"("nextReviewAt");

-- CreateIndex
CREATE INDEX "AmlAlert_organizationId_idx" ON "AmlAlert"("organizationId");

-- CreateIndex
CREATE INDEX "AmlAlert_clientId_idx" ON "AmlAlert"("clientId");

-- CreateIndex
CREATE INDEX "AmlAlert_amlProfileId_idx" ON "AmlAlert"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlAlert_alertType_idx" ON "AmlAlert"("alertType");

-- CreateIndex
CREATE INDEX "AmlAlert_severity_idx" ON "AmlAlert"("severity");

-- CreateIndex
CREATE INDEX "AmlAlert_status_idx" ON "AmlAlert"("status");

-- CreateIndex
CREATE INDEX "AmlAlert_blocking_idx" ON "AmlAlert"("blocking");

-- CreateIndex
CREATE INDEX "AmlReview_organizationId_idx" ON "AmlReview"("organizationId");

-- CreateIndex
CREATE INDEX "AmlReview_clientId_idx" ON "AmlReview"("clientId");

-- CreateIndex
CREATE INDEX "AmlReview_amlProfileId_idx" ON "AmlReview"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlReview_reviewType_idx" ON "AmlReview"("reviewType");

-- CreateIndex
CREATE INDEX "AmlReview_decision_idx" ON "AmlReview"("decision");

-- CreateIndex
CREATE INDEX "AmlInternalReport_organizationId_idx" ON "AmlInternalReport"("organizationId");

-- CreateIndex
CREATE INDEX "AmlInternalReport_clientId_idx" ON "AmlInternalReport"("clientId");

-- CreateIndex
CREATE INDEX "AmlInternalReport_amlProfileId_idx" ON "AmlInternalReport"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlInternalReport_reportType_idx" ON "AmlInternalReport"("reportType");

-- CreateIndex
CREATE INDEX "AmlInternalReport_status_idx" ON "AmlInternalReport"("status");

-- CreateIndex
CREATE INDEX "AmlInternalReport_decision_idx" ON "AmlInternalReport"("decision");

-- CreateIndex
CREATE INDEX "AmlRiskScoreComponent_organizationId_idx" ON "AmlRiskScoreComponent"("organizationId");

-- CreateIndex
CREATE INDEX "AmlRiskScoreComponent_clientId_idx" ON "AmlRiskScoreComponent"("clientId");

-- CreateIndex
CREATE INDEX "AmlRiskScoreComponent_amlProfileId_idx" ON "AmlRiskScoreComponent"("amlProfileId");

-- CreateIndex
CREATE INDEX "AmlRiskScoreComponent_componentType_idx" ON "AmlRiskScoreComponent"("componentType");

-- AddForeignKey
ALTER TABLE "AmlProfile" ADD CONSTRAINT "AmlProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlProfile" ADD CONSTRAINT "AmlProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlIdentityVerification" ADD CONSTRAINT "AmlIdentityVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlIdentityVerification" ADD CONSTRAINT "AmlIdentityVerification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlIdentityVerification" ADD CONSTRAINT "AmlIdentityVerification_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfFundsRecord" ADD CONSTRAINT "AmlSourceOfFundsRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfFundsRecord" ADD CONSTRAINT "AmlSourceOfFundsRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfFundsRecord" ADD CONSTRAINT "AmlSourceOfFundsRecord_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfWealthRecord" ADD CONSTRAINT "AmlSourceOfWealthRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfWealthRecord" ADD CONSTRAINT "AmlSourceOfWealthRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSourceOfWealthRecord" ADD CONSTRAINT "AmlSourceOfWealthRecord_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlThirdPartyDetermination" ADD CONSTRAINT "AmlThirdPartyDetermination_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlThirdPartyDetermination" ADD CONSTRAINT "AmlThirdPartyDetermination_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlThirdPartyDetermination" ADD CONSTRAINT "AmlThirdPartyDetermination_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlBeneficialOwnershipRecord" ADD CONSTRAINT "AmlBeneficialOwnershipRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlBeneficialOwnershipRecord" ADD CONSTRAINT "AmlBeneficialOwnershipRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlBeneficialOwnershipRecord" ADD CONSTRAINT "AmlBeneficialOwnershipRecord_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlPepScreening" ADD CONSTRAINT "AmlPepScreening_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlPepScreening" ADD CONSTRAINT "AmlPepScreening_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlPepScreening" ADD CONSTRAINT "AmlPepScreening_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSanctionsScreening" ADD CONSTRAINT "AmlSanctionsScreening_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSanctionsScreening" ADD CONSTRAINT "AmlSanctionsScreening_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlSanctionsScreening" ADD CONSTRAINT "AmlSanctionsScreening_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlAlert" ADD CONSTRAINT "AmlAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlAlert" ADD CONSTRAINT "AmlAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlAlert" ADD CONSTRAINT "AmlAlert_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlReview" ADD CONSTRAINT "AmlReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlReview" ADD CONSTRAINT "AmlReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlReview" ADD CONSTRAINT "AmlReview_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlInternalReport" ADD CONSTRAINT "AmlInternalReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlInternalReport" ADD CONSTRAINT "AmlInternalReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlInternalReport" ADD CONSTRAINT "AmlInternalReport_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlRiskScoreComponent" ADD CONSTRAINT "AmlRiskScoreComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlRiskScoreComponent" ADD CONSTRAINT "AmlRiskScoreComponent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlRiskScoreComponent" ADD CONSTRAINT "AmlRiskScoreComponent_amlProfileId_fkey" FOREIGN KEY ("amlProfileId") REFERENCES "AmlProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
