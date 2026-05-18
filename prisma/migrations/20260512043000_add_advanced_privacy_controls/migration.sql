-- Advanced privacy controls: vendors, privacy-by-default settings, access risk, masking and incident notification logs.

CREATE TABLE "PrivacyVendor" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "reviewedById" TEXT,
  "name" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "dataCategories" JSONB,
  "dataLocation" TEXT,
  "outsideQuebec" BOOLEAN NOT NULL DEFAULT false,
  "subprocessors" JSONB,
  "contractSigned" BOOLEAN NOT NULL DEFAULT false,
  "contractReference" TEXT,
  "piaId" TEXT,
  "piaCompleted" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "safeguards" TEXT,
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyVendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacySettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "defaultPrivacyMode" BOOLEAN NOT NULL DEFAULT true,
  "screenShareMaskingDefault" BOOLEAN NOT NULL DEFAULT true,
  "shareWithSpouseDefault" BOOLEAN NOT NULL DEFAULT false,
  "externalDocumentSharingDefault" BOOLEAN NOT NULL DEFAULT false,
  "marketingDefault" BOOLEAN NOT NULL DEFAULT false,
  "aiAssistanceDefault" BOOLEAN NOT NULL DEFAULT false,
  "assistantSensitiveDocsDefault" BOOLEAN NOT NULL DEFAULT false,
  "massExportDefault" BOOLEAN NOT NULL DEFAULT false,
  "publicLinksAllowed" BOOLEAN NOT NULL DEFAULT false,
  "indefiniteRetentionAllowed" BOOLEAN NOT NULL DEFAULT false,
  "productAnalyticsDefault" BOOLEAN NOT NULL DEFAULT false,
  "requireMfaForPortal" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalExternalSharing" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalMassExport" BOOLEAN NOT NULL DEFAULT true,
  "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "anomalyRiskThreshold" INTEGER NOT NULL DEFAULT 70,
  "maskPhone" BOOLEAN NOT NULL DEFAULT true,
  "maskEmail" BOOLEAN NOT NULL DEFAULT true,
  "maskAddress" BOOLEAN NOT NULL DEFAULT true,
  "maskFinancialValues" BOOLEAN NOT NULL DEFAULT true,
  "maskDateOfBirth" BOOLEAN NOT NULL DEFAULT true,
  "maskTaxIdentifiers" BOOLEAN NOT NULL DEFAULT true,
  "maskHealthData" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyAccessRiskEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "reviewedById" TEXT,
  "clientId" TEXT,
  "documentId" TEXT,
  "eventType" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyAccessRiskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensitiveMaskingRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT,
  "dataCategory" TEXT NOT NULL,
  "fieldPattern" TEXT NOT NULL,
  "maskingMode" TEXT NOT NULL DEFAULT 'PARTIAL',
  "rolesAllowed" JSONB,
  "appliesToPortal" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SensitiveMaskingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyNotificationLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "incidentId" TEXT,
  "clientId" TEXT,
  "recipientType" TEXT NOT NULL,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "notificationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "sentAt" TIMESTAMP(3),
  "payload" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacySettings_organizationId_key" ON "PrivacySettings"("organizationId");
CREATE INDEX "PrivacyVendor_organizationId_idx" ON "PrivacyVendor"("organizationId");
CREATE INDEX "PrivacyVendor_status_idx" ON "PrivacyVendor"("status");
CREATE INDEX "PrivacyVendor_outsideQuebec_idx" ON "PrivacyVendor"("outsideQuebec");
CREATE INDEX "PrivacyVendor_riskLevel_idx" ON "PrivacyVendor"("riskLevel");
CREATE INDEX "PrivacyVendor_nextReviewAt_idx" ON "PrivacyVendor"("nextReviewAt");
CREATE INDEX "PrivacyAccessRiskEvent_organizationId_idx" ON "PrivacyAccessRiskEvent"("organizationId");
CREATE INDEX "PrivacyAccessRiskEvent_userId_idx" ON "PrivacyAccessRiskEvent"("userId");
CREATE INDEX "PrivacyAccessRiskEvent_clientId_idx" ON "PrivacyAccessRiskEvent"("clientId");
CREATE INDEX "PrivacyAccessRiskEvent_documentId_idx" ON "PrivacyAccessRiskEvent"("documentId");
CREATE INDEX "PrivacyAccessRiskEvent_riskLevel_idx" ON "PrivacyAccessRiskEvent"("riskLevel");
CREATE INDEX "PrivacyAccessRiskEvent_status_idx" ON "PrivacyAccessRiskEvent"("status");
CREATE INDEX "PrivacyAccessRiskEvent_createdAt_idx" ON "PrivacyAccessRiskEvent"("createdAt");
CREATE INDEX "SensitiveMaskingRule_organizationId_idx" ON "SensitiveMaskingRule"("organizationId");
CREATE INDEX "SensitiveMaskingRule_dataCategory_idx" ON "SensitiveMaskingRule"("dataCategory");
CREATE INDEX "SensitiveMaskingRule_active_idx" ON "SensitiveMaskingRule"("active");
CREATE INDEX "PrivacyNotificationLog_organizationId_idx" ON "PrivacyNotificationLog"("organizationId");
CREATE INDEX "PrivacyNotificationLog_incidentId_idx" ON "PrivacyNotificationLog"("incidentId");
CREATE INDEX "PrivacyNotificationLog_clientId_idx" ON "PrivacyNotificationLog"("clientId");
CREATE INDEX "PrivacyNotificationLog_notificationType_idx" ON "PrivacyNotificationLog"("notificationType");
CREATE INDEX "PrivacyNotificationLog_status_idx" ON "PrivacyNotificationLog"("status");

ALTER TABLE "PrivacyVendor" ADD CONSTRAINT "PrivacyVendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyVendor" ADD CONSTRAINT "PrivacyVendor_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyVendor" ADD CONSTRAINT "PrivacyVendor_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacySettings" ADD CONSTRAINT "PrivacySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyAccessRiskEvent" ADD CONSTRAINT "PrivacyAccessRiskEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyAccessRiskEvent" ADD CONSTRAINT "PrivacyAccessRiskEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyAccessRiskEvent" ADD CONSTRAINT "PrivacyAccessRiskEvent_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SensitiveMaskingRule" ADD CONSTRAINT "SensitiveMaskingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensitiveMaskingRule" ADD CONSTRAINT "SensitiveMaskingRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyNotificationLog" ADD CONSTRAINT "PrivacyNotificationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
