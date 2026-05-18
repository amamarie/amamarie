-- CreateEnum
CREATE TYPE "ProductRecommendationType" AS ENUM ('PROTECTION', 'INVESTMENT_REVIEW', 'COMPLIANCE', 'FOLLOW_UP', 'CROSS_SELL_OPPORTUNITY', 'DATA_QUALITY');

-- CreateEnum
CREATE TYPE "ProductRecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProductRecommendationStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'CONVERTED_TO_TASK', 'COMPLETED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION_REVIEWED';
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION_DISMISSED';
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION_CONVERTED_TO_TASK';
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATIONS_GENERATED';

-- CreateTable
CREATE TABLE "ProductRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT,
    "type" "ProductRecommendationType" NOT NULL,
    "priority" "ProductRecommendationPriority" NOT NULL,
    "status" "ProductRecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "relatedProductId" TEXT,
    "relatedTaskId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRecommendation_organizationId_idx" ON "ProductRecommendation"("organizationId");

-- CreateIndex
CREATE INDEX "ProductRecommendation_clientId_idx" ON "ProductRecommendation"("clientId");

-- CreateIndex
CREATE INDEX "ProductRecommendation_advisorId_idx" ON "ProductRecommendation"("advisorId");

-- CreateIndex
CREATE INDEX "ProductRecommendation_status_idx" ON "ProductRecommendation"("status");

-- CreateIndex
CREATE INDEX "ProductRecommendation_priority_idx" ON "ProductRecommendation"("priority");

-- CreateIndex
CREATE INDEX "ProductRecommendation_ruleKey_idx" ON "ProductRecommendation"("ruleKey");

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
