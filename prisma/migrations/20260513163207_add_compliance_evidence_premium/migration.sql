-- CreateTable
CREATE TABLE "ComplianceEvidenceSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "wormStorageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wormProvider" TEXT,
    "wormBucket" TEXT,
    "wormRetentionYears" INTEGER NOT NULL DEFAULT 7,
    "certificateSigningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "certificateProvider" TEXT,
    "certificateKeyReference" TEXT,
    "trustedTimestampEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timestampProvider" TEXT,
    "regulatoryPortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "regulatoryPortalProvider" TEXT,
    "regulatoryPortalReference" TEXT,
    "requireExternalDepositForInspectionExport" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceEvidenceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceEvidenceDeposit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditReportId" TEXT,
    "createdById" TEXT,
    "depositType" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT,
    "contentHashAlgo" TEXT NOT NULL DEFAULT 'sha256',
    "externalReference" TEXT,
    "certificateSerial" TEXT,
    "timestampToken" TEXT,
    "portalSubmissionId" TEXT,
    "evidenceManifest" JSONB,
    "errorMessage" TEXT,
    "depositedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceEvidenceDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceEvidenceSettings_organizationId_key" ON "ComplianceEvidenceSettings"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceSettings_organizationId_idx" ON "ComplianceEvidenceSettings"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_organizationId_idx" ON "ComplianceEvidenceDeposit"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_auditReportId_idx" ON "ComplianceEvidenceDeposit"("auditReportId");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_createdById_idx" ON "ComplianceEvidenceDeposit"("createdById");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_depositType_idx" ON "ComplianceEvidenceDeposit"("depositType");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_status_idx" ON "ComplianceEvidenceDeposit"("status");

-- CreateIndex
CREATE INDEX "ComplianceEvidenceDeposit_createdAt_idx" ON "ComplianceEvidenceDeposit"("createdAt");

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceSettings" ADD CONSTRAINT "ComplianceEvidenceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceDeposit" ADD CONSTRAINT "ComplianceEvidenceDeposit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceDeposit" ADD CONSTRAINT "ComplianceEvidenceDeposit_auditReportId_fkey" FOREIGN KEY ("auditReportId") REFERENCES "AuditReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidenceDeposit" ADD CONSTRAINT "ComplianceEvidenceDeposit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
