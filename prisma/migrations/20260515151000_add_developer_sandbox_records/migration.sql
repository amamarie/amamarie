CREATE TABLE "DeveloperSandboxRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperSandboxRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperSandboxRecord_organizationId_externalId_key" ON "DeveloperSandboxRecord"("organizationId", "externalId");
CREATE INDEX "DeveloperSandboxRecord_organizationId_idx" ON "DeveloperSandboxRecord"("organizationId");
CREATE INDEX "DeveloperSandboxRecord_type_idx" ON "DeveloperSandboxRecord"("type");
CREATE INDEX "DeveloperSandboxRecord_createdAt_idx" ON "DeveloperSandboxRecord"("createdAt");

ALTER TABLE "DeveloperSandboxRecord" ADD CONSTRAINT "DeveloperSandboxRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
