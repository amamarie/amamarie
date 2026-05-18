CREATE TABLE "DeveloperWebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperAppointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "source" TEXT NOT NULL DEFAULT 'api',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperMarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "topic" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperMarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperCampaignSubscriber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBSCRIBED',
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperCampaignSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperOAuthClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT NOT NULL,
    "clientSecretPrefix" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperOAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperOAuthAccessToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperOAuthAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperIntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "config" JSONB,
    "secretHash" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperIntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeveloperWebhookDelivery_organizationId_idx" ON "DeveloperWebhookDelivery"("organizationId");
CREATE INDEX "DeveloperWebhookDelivery_webhookId_idx" ON "DeveloperWebhookDelivery"("webhookId");
CREATE INDEX "DeveloperWebhookDelivery_status_idx" ON "DeveloperWebhookDelivery"("status");
CREATE INDEX "DeveloperWebhookDelivery_nextAttemptAt_idx" ON "DeveloperWebhookDelivery"("nextAttemptAt");
CREATE INDEX "DeveloperWebhookDelivery_createdAt_idx" ON "DeveloperWebhookDelivery"("createdAt");

CREATE INDEX "DeveloperAppointment_organizationId_idx" ON "DeveloperAppointment"("organizationId");
CREATE INDEX "DeveloperAppointment_leadId_idx" ON "DeveloperAppointment"("leadId");
CREATE INDEX "DeveloperAppointment_clientId_idx" ON "DeveloperAppointment"("clientId");
CREATE INDEX "DeveloperAppointment_assignedTo_idx" ON "DeveloperAppointment"("assignedTo");
CREATE INDEX "DeveloperAppointment_startsAt_idx" ON "DeveloperAppointment"("startsAt");
CREATE INDEX "DeveloperAppointment_status_idx" ON "DeveloperAppointment"("status");

CREATE INDEX "DeveloperMarketingCampaign_organizationId_idx" ON "DeveloperMarketingCampaign"("organizationId");
CREATE INDEX "DeveloperMarketingCampaign_status_idx" ON "DeveloperMarketingCampaign"("status");
CREATE INDEX "DeveloperMarketingCampaign_createdAt_idx" ON "DeveloperMarketingCampaign"("createdAt");

CREATE UNIQUE INDEX "DeveloperCampaignSubscriber_campaignId_contactId_key" ON "DeveloperCampaignSubscriber"("campaignId", "contactId");
CREATE INDEX "DeveloperCampaignSubscriber_organizationId_idx" ON "DeveloperCampaignSubscriber"("organizationId");
CREATE INDEX "DeveloperCampaignSubscriber_campaignId_idx" ON "DeveloperCampaignSubscriber"("campaignId");
CREATE INDEX "DeveloperCampaignSubscriber_contactId_idx" ON "DeveloperCampaignSubscriber"("contactId");
CREATE INDEX "DeveloperCampaignSubscriber_status_idx" ON "DeveloperCampaignSubscriber"("status");

CREATE UNIQUE INDEX "DeveloperOAuthClient_clientId_key" ON "DeveloperOAuthClient"("clientId");
CREATE INDEX "DeveloperOAuthClient_organizationId_idx" ON "DeveloperOAuthClient"("organizationId");
CREATE INDEX "DeveloperOAuthClient_status_idx" ON "DeveloperOAuthClient"("status");
CREATE INDEX "DeveloperOAuthClient_createdAt_idx" ON "DeveloperOAuthClient"("createdAt");

CREATE UNIQUE INDEX "DeveloperOAuthAccessToken_tokenHash_key" ON "DeveloperOAuthAccessToken"("tokenHash");
CREATE INDEX "DeveloperOAuthAccessToken_organizationId_idx" ON "DeveloperOAuthAccessToken"("organizationId");
CREATE INDEX "DeveloperOAuthAccessToken_clientId_idx" ON "DeveloperOAuthAccessToken"("clientId");
CREATE INDEX "DeveloperOAuthAccessToken_status_idx" ON "DeveloperOAuthAccessToken"("status");
CREATE INDEX "DeveloperOAuthAccessToken_expiresAt_idx" ON "DeveloperOAuthAccessToken"("expiresAt");

CREATE UNIQUE INDEX "DeveloperIntegrationConnection_organizationId_provider_key" ON "DeveloperIntegrationConnection"("organizationId", "provider");
CREATE INDEX "DeveloperIntegrationConnection_organizationId_idx" ON "DeveloperIntegrationConnection"("organizationId");
CREATE INDEX "DeveloperIntegrationConnection_provider_idx" ON "DeveloperIntegrationConnection"("provider");
CREATE INDEX "DeveloperIntegrationConnection_status_idx" ON "DeveloperIntegrationConnection"("status");

ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "DeveloperWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeveloperAppointment" ADD CONSTRAINT "DeveloperAppointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperMarketingCampaign" ADD CONSTRAINT "DeveloperMarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperCampaignSubscriber" ADD CONSTRAINT "DeveloperCampaignSubscriber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperCampaignSubscriber" ADD CONSTRAINT "DeveloperCampaignSubscriber_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DeveloperMarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperOAuthClient" ADD CONSTRAINT "DeveloperOAuthClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperOAuthAccessToken" ADD CONSTRAINT "DeveloperOAuthAccessToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperOAuthAccessToken" ADD CONSTRAINT "DeveloperOAuthAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "DeveloperOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperIntegrationConnection" ADD CONSTRAINT "DeveloperIntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
