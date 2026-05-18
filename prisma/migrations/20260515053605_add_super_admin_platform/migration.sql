-- CreateTable
CREATE TABLE "SuperAdminTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "slaDueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "sensitivity" TEXT NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "externalInvoiceId" TEXT,
    "invoiceNumber" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "billingReason" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hostedInvoiceUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "externalPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "failedReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasAddOn" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billingType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "availablePlans" JSONB,
    "limits" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAddOn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "allowedPlans" JSONB,
    "beta" BOOLEAN NOT NULL DEFAULT false,
    "owner" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "featureFlagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistanceSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "reason" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnnouncement" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "postmortem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformIncidentImpact" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "impactLevel" TEXT NOT NULL DEFAULT 'LOW',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIncidentImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "internalRole" TEXT NOT NULL DEFAULT 'OWNER',
    "permissions" JSONB,
    "twoFactorRequired" BOOLEAN NOT NULL DEFAULT true,
    "ipAllowlist" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuperAdminTicket_organizationId_idx" ON "SuperAdminTicket"("organizationId");

-- CreateIndex
CREATE INDEX "SuperAdminTicket_assignedToId_idx" ON "SuperAdminTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SuperAdminTicket_priority_idx" ON "SuperAdminTicket"("priority");

-- CreateIndex
CREATE INDEX "SuperAdminTicket_status_idx" ON "SuperAdminTicket"("status");

-- CreateIndex
CREATE INDEX "SuperAdminTicket_createdAt_idx" ON "SuperAdminTicket"("createdAt");

-- CreateIndex
CREATE INDEX "SuperAdminNote_organizationId_idx" ON "SuperAdminNote"("organizationId");

-- CreateIndex
CREATE INDEX "SuperAdminNote_authorId_idx" ON "SuperAdminNote"("authorId");

-- CreateIndex
CREATE INDEX "SuperAdminNote_category_idx" ON "SuperAdminNote"("category");

-- CreateIndex
CREATE INDEX "SuperAdminNote_createdAt_idx" ON "SuperAdminNote"("createdAt");

-- CreateIndex
CREATE INDEX "SaasInvoice_organizationId_idx" ON "SaasInvoice"("organizationId");

-- CreateIndex
CREATE INDEX "SaasInvoice_status_idx" ON "SaasInvoice"("status");

-- CreateIndex
CREATE INDEX "SaasInvoice_currency_idx" ON "SaasInvoice"("currency");

-- CreateIndex
CREATE INDEX "SaasInvoice_createdAt_idx" ON "SaasInvoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaasInvoice_provider_externalInvoiceId_key" ON "SaasInvoice"("provider", "externalInvoiceId");

-- CreateIndex
CREATE INDEX "SaasPayment_organizationId_idx" ON "SaasPayment"("organizationId");

-- CreateIndex
CREATE INDEX "SaasPayment_invoiceId_idx" ON "SaasPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "SaasPayment_status_idx" ON "SaasPayment"("status");

-- CreateIndex
CREATE INDEX "SaasPayment_currency_idx" ON "SaasPayment"("currency");

-- CreateIndex
CREATE INDEX "SaasPayment_createdAt_idx" ON "SaasPayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaasPayment_provider_externalPaymentId_key" ON "SaasPayment"("provider", "externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SaasAddOn_key_key" ON "SaasAddOn"("key");

-- CreateIndex
CREATE INDEX "SaasAddOn_status_idx" ON "SaasAddOn"("status");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_organizationId_idx" ON "OrganizationAddOn"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_addOnId_idx" ON "OrganizationAddOn"("addOnId");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_status_idx" ON "OrganizationAddOn"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAddOn_organizationId_addOnId_key" ON "OrganizationAddOn"("organizationId", "addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_status_idx" ON "FeatureFlag"("status");

-- CreateIndex
CREATE INDEX "FeatureFlag_beta_idx" ON "FeatureFlag"("beta");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_organizationId_idx" ON "FeatureFlagOverride"("organizationId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_featureFlagId_idx" ON "FeatureFlagOverride"("featureFlagId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_enabled_idx" ON "FeatureFlagOverride"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagOverride_organizationId_featureFlagId_key" ON "FeatureFlagOverride"("organizationId", "featureFlagId");

-- CreateIndex
CREATE INDEX "AssistanceSession_organizationId_idx" ON "AssistanceSession"("organizationId");

-- CreateIndex
CREATE INDEX "AssistanceSession_adminUserId_idx" ON "AssistanceSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AssistanceSession_status_idx" ON "AssistanceSession"("status");

-- CreateIndex
CREATE INDEX "AssistanceSession_expiresAt_idx" ON "AssistanceSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ProductAnnouncement_status_idx" ON "ProductAnnouncement"("status");

-- CreateIndex
CREATE INDEX "ProductAnnouncement_scheduledAt_idx" ON "ProductAnnouncement"("scheduledAt");

-- CreateIndex
CREATE INDEX "ProductAnnouncementDelivery_organizationId_idx" ON "ProductAnnouncementDelivery"("organizationId");

-- CreateIndex
CREATE INDEX "ProductAnnouncementDelivery_status_idx" ON "ProductAnnouncementDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnnouncementDelivery_announcementId_organizationId_key" ON "ProductAnnouncementDelivery"("announcementId", "organizationId");

-- CreateIndex
CREATE INDEX "PlatformIncident_module_idx" ON "PlatformIncident"("module");

-- CreateIndex
CREATE INDEX "PlatformIncident_priority_idx" ON "PlatformIncident"("priority");

-- CreateIndex
CREATE INDEX "PlatformIncident_status_idx" ON "PlatformIncident"("status");

-- CreateIndex
CREATE INDEX "PlatformIncident_startedAt_idx" ON "PlatformIncident"("startedAt");

-- CreateIndex
CREATE INDEX "PlatformIncidentImpact_organizationId_idx" ON "PlatformIncidentImpact"("organizationId");

-- CreateIndex
CREATE INDEX "PlatformIncidentImpact_impactLevel_idx" ON "PlatformIncidentImpact"("impactLevel");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIncidentImpact_incidentId_organizationId_key" ON "PlatformIncidentImpact"("incidentId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAdminProfile_userId_key" ON "InternalAdminProfile"("userId");

-- CreateIndex
CREATE INDEX "InternalAdminProfile_internalRole_idx" ON "InternalAdminProfile"("internalRole");

-- CreateIndex
CREATE INDEX "InternalAdminProfile_status_idx" ON "InternalAdminProfile"("status");

-- AddForeignKey
ALTER TABLE "SuperAdminTicket" ADD CONSTRAINT "SuperAdminTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminTicket" ADD CONSTRAINT "SuperAdminTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminTicket" ADD CONSTRAINT "SuperAdminTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminNote" ADD CONSTRAINT "SuperAdminNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminNote" ADD CONSTRAINT "SuperAdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasInvoice" ADD CONSTRAINT "SaasInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SaasInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddOn" ADD CONSTRAINT "OrganizationAddOn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddOn" ADD CONSTRAINT "OrganizationAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "SaasAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistanceSession" ADD CONSTRAINT "AssistanceSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistanceSession" ADD CONSTRAINT "AssistanceSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnnouncement" ADD CONSTRAINT "ProductAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnnouncementDelivery" ADD CONSTRAINT "ProductAnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "ProductAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnnouncementDelivery" ADD CONSTRAINT "ProductAnnouncementDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIncidentImpact" ADD CONSTRAINT "PlatformIncidentImpact_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "PlatformIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIncidentImpact" ADD CONSTRAINT "PlatformIncidentImpact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAdminProfile" ADD CONSTRAINT "InternalAdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
