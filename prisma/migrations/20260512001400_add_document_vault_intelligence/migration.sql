-- CreateEnum
CREATE TYPE "DocumentSensitivityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('PORTAL', 'ADVISOR', 'ASSISTANT', 'EMAIL', 'API', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentLinkEntityType" AS ENUM ('CLIENT', 'LEAD', 'HOUSEHOLD', 'BUSINESS', 'KYC_PROFILE', 'KYC_VERSION', 'INSURANCE_ANALYSIS', 'RECOMMENDATION', 'OPPORTUNITY', 'FINANCIAL_PRODUCT', 'TASK', 'CONSENT', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentLinkRelationshipType" AS ENUM ('PROOF', 'SOURCE', 'DELIVERED_TO_CLIENT', 'SIGNED_PROOF', 'ANNEX', 'SUPPORTING_DOCUMENT', 'REPLACES', 'EXTRACTED_FROM', 'USED_FOR_RECOMMENDATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentExtractionType" AS ENUM ('POLICY', 'INSURANCE_STATEMENT', 'INVESTMENT_STATEMENT', 'TAX_NOTICE', 'MORTGAGE_STATEMENT', 'IDENTITY', 'CORPORATE_REGISTRY', 'SHAREHOLDER_AGREEMENT', 'FINANCIAL_STATEMENT', 'CONSENT', 'RECOMMENDATION_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'TO_VALIDATE', 'VALIDATED', 'REJECTED', 'SYNCHRONIZED');

-- CreateEnum
CREATE TYPE "DocumentExtractedFieldStatus" AS ENUM ('PROPOSED', 'TO_VALIDATE', 'VALIDATED', 'CORRECTED', 'REJECTED', 'NOT_APPLICABLE', 'SYNCHRONIZED');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED_BY_CLIENT', 'PARTIALLY_COMPLETED', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentRequestItemStatus" AS ENUM ('PENDING', 'RECEIVED', 'REJECTED', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentAccessEventType" AS ENUM ('VIEW', 'PREVIEW', 'DOWNLOAD', 'UPLOAD', 'SHARE', 'LINK', 'UNLINK', 'UPDATE', 'VALIDATE', 'REJECT', 'ARCHIVE', 'RESTORE', 'DELETE', 'LOCK', 'EXPORT');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "consentId" TEXT,
ADD COLUMN     "containsFinancialData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsIdentityData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsMedicalData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containsPersonalData" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "encryptedAt" TIMESTAMP(3),
ADD COLUMN     "externalSharingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extractionSummary" JSONB,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "lastAccessedById" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "publicLinkActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionPolicyId" TEXT,
ADD COLUMN     "retentionReviewAt" TIMESTAMP(3),
ADD COLUMN     "securityMetadata" JSONB,
ADD COLUMN     "sensitivityLevel" "DocumentSensitivityLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "source" "DocumentSource" NOT NULL DEFAULT 'ADVISOR',
ADD COLUMN     "tags" JSONB;

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "changedById" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "fileName" TEXT,
    "storageBucket" TEXT,
    "storagePath" TEXT,
    "storageProvider" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "changeReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT,
    "linkedEntityType" "DocumentLinkEntityType" NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "relationshipType" "DocumentLinkRelationshipType" NOT NULL DEFAULT 'SUPPORTING_DOCUMENT',
    "label" TEXT,
    "sourceFieldKey" TEXT,
    "proofStatus" TEXT,
    "usedForRecommendationAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "validatedById" TEXT,
    "extractionType" "DocumentExtractionType" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractedData" JSONB,
    "confidenceScore" DECIMAL(5,2),
    "modelVersion" TEXT,
    "method" TEXT,
    "humanReviewNote" TEXT,
    "synchronizedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtractedField" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "validatedById" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "extractedValue" JSONB,
    "validatedValue" JSONB,
    "confidenceScore" DECIMAL(5,2),
    "pageNumber" INTEGER,
    "boundingReference" JSONB,
    "status" "DocumentExtractedFieldStatus" NOT NULL DEFAULT 'PROPOSED',
    "validationNote" TEXT,
    "synchronizedEntityType" TEXT,
    "synchronizedEntityId" TEXT,
    "synchronizedFieldKey" TEXT,
    "synchronizedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedById" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT,
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedByClientAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequestItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "documentId" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentRequestItemStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "eventType" "DocumentAccessEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "purpose" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersion_organizationId_idx" ON "DocumentVersion"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentVersion_clientId_idx" ON "DocumentVersion"("clientId");

-- CreateIndex
CREATE INDEX "DocumentVersion_changedById_idx" ON "DocumentVersion"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentLink_organizationId_idx" ON "DocumentLink"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentLink_clientId_idx" ON "DocumentLink"("clientId");

-- CreateIndex
CREATE INDEX "DocumentLink_linkedEntityType_linkedEntityId_idx" ON "DocumentLink"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "DocumentLink_relationshipType_idx" ON "DocumentLink"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_linkedEntityType_linkedEntityId_rel_key" ON "DocumentLink"("documentId", "linkedEntityType", "linkedEntityId", "relationshipType");

-- CreateIndex
CREATE INDEX "DocumentExtraction_organizationId_idx" ON "DocumentExtraction"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_idx" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_clientId_idx" ON "DocumentExtraction"("clientId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_status_idx" ON "DocumentExtraction"("status");

-- CreateIndex
CREATE INDEX "DocumentExtraction_extractionType_idx" ON "DocumentExtraction"("extractionType");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_organizationId_idx" ON "DocumentExtractedField"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_extractionId_idx" ON "DocumentExtractedField"("extractionId");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_documentId_idx" ON "DocumentExtractedField"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_clientId_idx" ON "DocumentExtractedField"("clientId");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_fieldKey_idx" ON "DocumentExtractedField"("fieldKey");

-- CreateIndex
CREATE INDEX "DocumentExtractedField_status_idx" ON "DocumentExtractedField"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_organizationId_idx" ON "DocumentRequest"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentRequest_clientId_idx" ON "DocumentRequest"("clientId");

-- CreateIndex
CREATE INDEX "DocumentRequest_requestedById_idx" ON "DocumentRequest"("requestedById");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_dueDate_idx" ON "DocumentRequest"("dueDate");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_organizationId_idx" ON "DocumentRequestItem"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_requestId_idx" ON "DocumentRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_clientId_idx" ON "DocumentRequestItem"("clientId");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_documentId_idx" ON "DocumentRequestItem"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_status_idx" ON "DocumentRequestItem"("status");

-- CreateIndex
CREATE INDEX "DocumentRequestItem_documentType_idx" ON "DocumentRequestItem"("documentType");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_organizationId_idx" ON "DocumentAccessLog"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_idx" ON "DocumentAccessLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_clientId_idx" ON "DocumentAccessLog"("clientId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_userId_idx" ON "DocumentAccessLog"("userId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_eventType_idx" ON "DocumentAccessLog"("eventType");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_createdAt_idx" ON "DocumentAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "Document_visibility_idx" ON "Document"("visibility");

-- CreateIndex
CREATE INDEX "Document_sensitivityLevel_idx" ON "Document"("sensitivityLevel");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE INDEX "Document_isLocked_idx" ON "Document"("isLocked");

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedField" ADD CONSTRAINT "DocumentExtractedField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedField" ADD CONSTRAINT "DocumentExtractedField_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "DocumentExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedField" ADD CONSTRAINT "DocumentExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedField" ADD CONSTRAINT "DocumentExtractedField_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedField" ADD CONSTRAINT "DocumentExtractedField_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestItem" ADD CONSTRAINT "DocumentRequestItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
