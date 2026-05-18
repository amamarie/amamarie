CREATE TABLE "DeveloperApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "permissionLevel" TEXT NOT NULL DEFAULT 'read_create',
    "permissions" JSONB NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "allowedIps" TEXT,
    "allowedDomains" TEXT,
    "quotaMonthly" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "events" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "secretPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperWebhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperApiLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "webhookId" TEXT,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER,
    "ipAddress" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperApiLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperApiQuotaUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "webhookDeliveries" INTEGER NOT NULL DEFAULT 0,
    "emailApiCalls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperApiQuotaUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperApiKey_keyHash_key" ON "DeveloperApiKey"("keyHash");
CREATE INDEX "DeveloperApiKey_organizationId_idx" ON "DeveloperApiKey"("organizationId");
CREATE INDEX "DeveloperApiKey_status_idx" ON "DeveloperApiKey"("status");
CREATE INDEX "DeveloperApiKey_environment_idx" ON "DeveloperApiKey"("environment");
CREATE INDEX "DeveloperApiKey_createdAt_idx" ON "DeveloperApiKey"("createdAt");

CREATE INDEX "DeveloperWebhook_organizationId_idx" ON "DeveloperWebhook"("organizationId");
CREATE INDEX "DeveloperWebhook_status_idx" ON "DeveloperWebhook"("status");
CREATE INDEX "DeveloperWebhook_environment_idx" ON "DeveloperWebhook"("environment");
CREATE INDEX "DeveloperWebhook_createdAt_idx" ON "DeveloperWebhook"("createdAt");

CREATE INDEX "DeveloperApiLog_organizationId_idx" ON "DeveloperApiLog"("organizationId");
CREATE INDEX "DeveloperApiLog_apiKeyId_idx" ON "DeveloperApiLog"("apiKeyId");
CREATE INDEX "DeveloperApiLog_webhookId_idx" ON "DeveloperApiLog"("webhookId");
CREATE INDEX "DeveloperApiLog_type_idx" ON "DeveloperApiLog"("type");
CREATE INDEX "DeveloperApiLog_status_idx" ON "DeveloperApiLog"("status");
CREATE INDEX "DeveloperApiLog_statusCode_idx" ON "DeveloperApiLog"("statusCode");
CREATE INDEX "DeveloperApiLog_environment_idx" ON "DeveloperApiLog"("environment");
CREATE INDEX "DeveloperApiLog_createdAt_idx" ON "DeveloperApiLog"("createdAt");

CREATE UNIQUE INDEX "DeveloperApiQuotaUsage_organizationId_period_key" ON "DeveloperApiQuotaUsage"("organizationId", "period");
CREATE INDEX "DeveloperApiQuotaUsage_organizationId_idx" ON "DeveloperApiQuotaUsage"("organizationId");
CREATE INDEX "DeveloperApiQuotaUsage_period_idx" ON "DeveloperApiQuotaUsage"("period");

ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeveloperWebhook" ADD CONSTRAINT "DeveloperWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhook" ADD CONSTRAINT "DeveloperWebhook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeveloperApiLog" ADD CONSTRAINT "DeveloperApiLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiLog" ADD CONSTRAINT "DeveloperApiLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "DeveloperApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiLog" ADD CONSTRAINT "DeveloperApiLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "DeveloperWebhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeveloperApiQuotaUsage" ADD CONSTRAINT "DeveloperApiQuotaUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
