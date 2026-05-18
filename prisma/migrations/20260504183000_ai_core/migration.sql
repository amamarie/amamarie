CREATE TABLE IF NOT EXISTS "AiUsageLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "feature" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "inputHash" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiUsageLog_organizationId_idx" ON "AiUsageLog"("organizationId");
CREATE INDEX IF NOT EXISTS "AiUsageLog_userId_idx" ON "AiUsageLog"("userId");
CREATE INDEX IF NOT EXISTS "AiUsageLog_feature_idx" ON "AiUsageLog"("feature");
CREATE INDEX IF NOT EXISTS "AiUsageLog_status_idx" ON "AiUsageLog"("status");
CREATE INDEX IF NOT EXISTS "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");
