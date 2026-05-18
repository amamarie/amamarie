-- CreateTable
CREATE TABLE "DocumentVaultSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultRetentionYears" INTEGER NOT NULL DEFAULT 7,
    "kycRetentionYears" INTEGER NOT NULL DEFAULT 7,
    "recommendationRetentionYears" INTEGER NOT NULL DEFAULT 7,
    "identityRetentionYears" INTEGER NOT NULL DEFAULT 3,
    "rejectedDocumentRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "unclassifiedReviewDays" INTEGER NOT NULL DEFAULT 14,
    "expiryReminderDays" INTEGER NOT NULL DEFAULT 45,
    "requireConsentForSensitiveDocuments" BOOLEAN NOT NULL DEFAULT true,
    "requireHumanValidationForExtractions" BOOLEAN NOT NULL DEFAULT true,
    "blockRecommendationWithUnvalidatedData" BOOLEAN NOT NULL DEFAULT true,
    "createTaskForMissingDocuments" BOOLEAN NOT NULL DEFAULT true,
    "createTaskForExpiredDocuments" BOOLEAN NOT NULL DEFAULT true,
    "restrictIdentityDocuments" BOOLEAN NOT NULL DEFAULT true,
    "restrictMedicalDocuments" BOOLEAN NOT NULL DEFAULT true,
    "restrictCriticalDocuments" BOOLEAN NOT NULL DEFAULT true,
    "allowExternalSharing" BOOLEAN NOT NULL DEFAULT true,
    "requireComplianceApprovalForExternalSharing" BOOLEAN NOT NULL DEFAULT true,
    "accessLogEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientUploadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "semanticSearchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultStorageResidency" TEXT NOT NULL DEFAULT 'CANADA_PREFERRED',
    "deletionPolicy" TEXT NOT NULL DEFAULT 'ARCHIVE_OR_DESTROY_BY_POLICY',
    "externalSharingPolicy" TEXT NOT NULL DEFAULT 'TEMPORARY_LINK_WITH_AUDIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVaultSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVaultSettings_organizationId_key" ON "DocumentVaultSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "DocumentVaultSettings" ADD CONSTRAINT "DocumentVaultSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
