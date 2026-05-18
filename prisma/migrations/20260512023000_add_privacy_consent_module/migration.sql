-- CreateTable
CREATE TABLE "PrivacyPurpose" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequiredForService" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveDataAllowed" BOOLEAN NOT NULL DEFAULT false,
    "consentRequired" BOOLEAN NOT NULL DEFAULT true,
    "defaultRetentionPolicyId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purposeId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "version" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'FR',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "requiresExplicitAction" BOOLEAN NOT NULL DEFAULT true,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ClientConsent" ADD COLUMN "purposeId" TEXT,
ADD COLUMN "templateId" TEXT,
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'FR',
ADD COLUMN "method" TEXT NOT NULL DEFAULT 'ADVISOR',
ADD COLUMN "purposeText" TEXT,
ADD COLUMN "dataCategories" JSONB,
ADD COLUMN "thirdParties" JSONB,
ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isRequiredForService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "withdrawalAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "proofDocumentId" TEXT,
ADD COLUMN "relatedEntityType" TEXT,
ADD COLUMN "relatedEntityId" TEXT;

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "responseDocumentId" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDisclosure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "purposeId" TEXT,
    "consentId" TEXT,
    "disclosedById" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "dataCategories" JSONB,
    "documentIds" JSONB,
    "method" TEXT NOT NULL DEFAULT 'SECURE_PORTAL',
    "outsideQuebec" BOOLEAN NOT NULL DEFAULT false,
    "piaId" TEXT,
    "contractReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "externalReference" TEXT,
    "notes" TEXT,
    "disclosedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "detectedById" TEXT,
    "incidentType" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "affectedClientsCount" INTEGER NOT NULL DEFAULT 0,
    "affectedClientIds" JSONB,
    "affectedDataCategories" JSONB,
    "riskLevel" TEXT NOT NULL DEFAULT 'TO_ASSESS',
    "seriousHarmRisk" BOOLEAN NOT NULL DEFAULT false,
    "mitigationSteps" TEXT,
    "notifiedCaiAt" TIMESTAMP(3),
    "notifiedClientsAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "dataCategory" TEXT NOT NULL,
    "documentType" TEXT,
    "retentionPeriodMonths" INTEGER NOT NULL,
    "triggerEvent" TEXT NOT NULL DEFAULT 'CREATION',
    "actionAtEnd" TEXT NOT NULL DEFAULT 'REVIEW',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyImpactAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvedById" TEXT,
    "projectName" TEXT NOT NULL,
    "systemOrVendor" TEXT,
    "dataCategories" JSONB,
    "outsideQuebec" BOOLEAN NOT NULL DEFAULT false,
    "riskSummary" TEXT,
    "mitigationMeasures" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyPurpose_organizationId_code_key" ON "PrivacyPurpose"("organizationId", "code");
CREATE INDEX "PrivacyPurpose_organizationId_idx" ON "PrivacyPurpose"("organizationId");
CREATE INDEX "PrivacyPurpose_active_idx" ON "PrivacyPurpose"("active");
CREATE INDEX "ConsentTemplate_organizationId_idx" ON "ConsentTemplate"("organizationId");
CREATE INDEX "ConsentTemplate_purposeId_idx" ON "ConsentTemplate"("purposeId");
CREATE INDEX "ConsentTemplate_active_idx" ON "ConsentTemplate"("active");
CREATE INDEX "ConsentTemplate_language_idx" ON "ConsentTemplate"("language");
CREATE INDEX "ClientConsent_purposeId_idx" ON "ClientConsent"("purposeId");
CREATE INDEX "ClientConsent_templateId_idx" ON "ClientConsent"("templateId");
CREATE INDEX "ConsentEvent_organizationId_idx" ON "ConsentEvent"("organizationId");
CREATE INDEX "ConsentEvent_consentId_idx" ON "ConsentEvent"("consentId");
CREATE INDEX "ConsentEvent_eventType_idx" ON "ConsentEvent"("eventType");
CREATE INDEX "ConsentEvent_createdAt_idx" ON "ConsentEvent"("createdAt");
CREATE INDEX "PrivacyRequest_organizationId_idx" ON "PrivacyRequest"("organizationId");
CREATE INDEX "PrivacyRequest_clientId_idx" ON "PrivacyRequest"("clientId");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX "PrivacyRequest_requestType_idx" ON "PrivacyRequest"("requestType");
CREATE INDEX "PrivacyRequest_dueAt_idx" ON "PrivacyRequest"("dueAt");
CREATE INDEX "DataDisclosure_organizationId_idx" ON "DataDisclosure"("organizationId");
CREATE INDEX "DataDisclosure_clientId_idx" ON "DataDisclosure"("clientId");
CREATE INDEX "DataDisclosure_consentId_idx" ON "DataDisclosure"("consentId");
CREATE INDEX "DataDisclosure_purposeId_idx" ON "DataDisclosure"("purposeId");
CREATE INDEX "DataDisclosure_outsideQuebec_idx" ON "DataDisclosure"("outsideQuebec");
CREATE INDEX "DataDisclosure_disclosedAt_idx" ON "DataDisclosure"("disclosedAt");
CREATE INDEX "PrivacyIncident_organizationId_idx" ON "PrivacyIncident"("organizationId");
CREATE INDEX "PrivacyIncident_status_idx" ON "PrivacyIncident"("status");
CREATE INDEX "PrivacyIncident_riskLevel_idx" ON "PrivacyIncident"("riskLevel");
CREATE INDEX "PrivacyIncident_detectedAt_idx" ON "PrivacyIncident"("detectedAt");
CREATE INDEX "RetentionPolicy_organizationId_idx" ON "RetentionPolicy"("organizationId");
CREATE INDEX "RetentionPolicy_dataCategory_idx" ON "RetentionPolicy"("dataCategory");
CREATE INDEX "RetentionPolicy_documentType_idx" ON "RetentionPolicy"("documentType");
CREATE INDEX "RetentionPolicy_active_idx" ON "RetentionPolicy"("active");
CREATE INDEX "PrivacyImpactAssessment_organizationId_idx" ON "PrivacyImpactAssessment"("organizationId");
CREATE INDEX "PrivacyImpactAssessment_status_idx" ON "PrivacyImpactAssessment"("status");
CREATE INDEX "PrivacyImpactAssessment_outsideQuebec_idx" ON "PrivacyImpactAssessment"("outsideQuebec");
CREATE INDEX "PrivacyImpactAssessment_reviewDueAt_idx" ON "PrivacyImpactAssessment"("reviewDueAt");

-- AddForeignKey
ALTER TABLE "PrivacyPurpose" ADD CONSTRAINT "PrivacyPurpose_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "PrivacyPurpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientConsent" ADD CONSTRAINT "ClientConsent_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "PrivacyPurpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientConsent" ADD CONSTRAINT "ClientConsent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "ClientConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDisclosure" ADD CONSTRAINT "DataDisclosure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataDisclosure" ADD CONSTRAINT "DataDisclosure_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataDisclosure" ADD CONSTRAINT "DataDisclosure_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "PrivacyPurpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDisclosure" ADD CONSTRAINT "DataDisclosure_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "ClientConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDisclosure" ADD CONSTRAINT "DataDisclosure_disclosedById_fkey" FOREIGN KEY ("disclosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyIncident" ADD CONSTRAINT "PrivacyIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyIncident" ADD CONSTRAINT "PrivacyIncident_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyImpactAssessment" ADD CONSTRAINT "PrivacyImpactAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyImpactAssessment" ADD CONSTRAINT "PrivacyImpactAssessment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
