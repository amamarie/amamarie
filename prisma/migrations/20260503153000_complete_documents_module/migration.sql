-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM (
  'GOVERNMENT_ID',
  'PROOF_OF_ADDRESS',
  'VOID_CHEQUE',
  'KYC_FORM',
  'RISK_PROFILE',
  'CONSENT_FORM',
  'POLICY_DOCUMENT',
  'PROPOSAL',
  'ILLUSTRATION',
  'INVESTMENT_STATEMENT',
  'INSURANCE_STATEMENT',
  'BENEFICIARY_FORM',
  'SIGNATURE_PAGE',
  'TAX_DOCUMENT',
  'CLIENT_NOTE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('INTERNAL', 'TEAM', 'CLIENT_VISIBLE', 'COMPLIANCE_ONLY');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_VALIDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_WAIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXPIRED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_RESTORED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_UPLOADED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_DOWNLOADED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_PREVIEWED';

-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "taskId" TEXT,
  ADD COLUMN "kycProfileId" TEXT,
  ADD COLUMN "uploadedById" TEXT,
  ADD COLUMN "visibility" "DocumentVisibility" NOT NULL DEFAULT 'TEAM',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "fileUrl" TEXT,
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiredBy" TIMESTAMP(3),
  ADD COLUMN "requestedAt" TIMESTAMP(3),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedReason" TEXT,
  ADD COLUMN "waiverReason" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parentDocumentId" TEXT;

-- Convert legacy string columns to enums.
ALTER TABLE "Document"
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "DocumentType"
  USING (
    CASE
      WHEN "type" IN (
        'GOVERNMENT_ID',
        'PROOF_OF_ADDRESS',
        'VOID_CHEQUE',
        'KYC_FORM',
        'RISK_PROFILE',
        'CONSENT_FORM',
        'POLICY_DOCUMENT',
        'PROPOSAL',
        'ILLUSTRATION',
        'INVESTMENT_STATEMENT',
        'INSURANCE_STATEMENT',
        'BENEFICIARY_FORM',
        'SIGNATURE_PAGE',
        'TAX_DOCUMENT',
        'CLIENT_NOTE',
        'OTHER'
      ) THEN "type"::"DocumentType"
      ELSE 'OTHER'::"DocumentType"
    END
  ),
  ALTER COLUMN "type" SET DEFAULT 'OTHER';

ALTER TABLE "Document"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "DocumentStatus"
  USING (
    CASE
      WHEN "status" IN ('REQUIRED', 'REQUESTED', 'RECEIVED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'WAIVED', 'ARCHIVED') THEN "status"::"DocumentStatus"
      WHEN "status" = 'PENDING' THEN 'RECEIVED'::"DocumentStatus"
      ELSE 'REQUIRED'::"DocumentStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'REQUIRED';

UPDATE "Document" SET
  "isRequired" = CASE WHEN "status" = 'REQUIRED' THEN true ELSE "isRequired" END,
  "receivedAt" = CASE WHEN "status" IN ('RECEIVED', 'VALIDATED') AND "receivedAt" IS NULL THEN "createdAt" ELSE "receivedAt" END,
  "validatedAt" = CASE WHEN "status" = 'VALIDATED' AND "validatedAt" IS NULL THEN "updatedAt" ELSE "validatedAt" END,
  "archivedAt" = CASE WHEN "status" = 'ARCHIVED' AND "archivedAt" IS NULL THEN "updatedAt" ELSE "archivedAt" END;

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");
CREATE INDEX "Document_leadId_idx" ON "Document"("leadId");
CREATE INDEX "Document_productId_idx" ON "Document"("productId");
CREATE INDEX "Document_taskId_idx" ON "Document"("taskId");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "ClientKycProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
