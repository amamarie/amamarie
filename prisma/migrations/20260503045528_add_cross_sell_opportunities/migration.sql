-- CreateEnum
CREATE TYPE "CrossSellCategory" AS ENUM ('PROTECTION', 'INVESTMENT', 'FAMILY_NEEDS', 'RETIREMENT', 'TAX_EFFICIENCY', 'BUSINESS_OWNER', 'REVIEW_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "CrossSellPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CrossSellStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'CONVERTED_TO_TASK', 'DISCUSSED', 'WON', 'LOST', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_REVIEWED';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_DISMISSED';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_DISCUSSSED';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_DISCUSSED';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_WON';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_LOST';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_CONVERTED_TO_TASK';
ALTER TYPE "ActivityType" ADD VALUE 'CROSS_SELL_GENERATED';

-- CreateTable
CREATE TABLE "CrossSellOpportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT,
    "category" "CrossSellCategory" NOT NULL,
    "priority" "CrossSellPriority" NOT NULL,
    "status" "CrossSellStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "suggestedDiscussionTopic" TEXT,
    "relatedProductType" TEXT,
    "relatedProductId" TEXT,
    "relatedTaskId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "discussedAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossSellOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_organizationId_idx" ON "CrossSellOpportunity"("organizationId");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_clientId_idx" ON "CrossSellOpportunity"("clientId");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_advisorId_idx" ON "CrossSellOpportunity"("advisorId");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_category_idx" ON "CrossSellOpportunity"("category");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_priority_idx" ON "CrossSellOpportunity"("priority");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_status_idx" ON "CrossSellOpportunity"("status");

-- CreateIndex
CREATE INDEX "CrossSellOpportunity_ruleKey_idx" ON "CrossSellOpportunity"("ruleKey");

-- AddForeignKey
ALTER TABLE "CrossSellOpportunity" ADD CONSTRAINT "CrossSellOpportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellOpportunity" ADD CONSTRAINT "CrossSellOpportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellOpportunity" ADD CONSTRAINT "CrossSellOpportunity_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellOpportunity" ADD CONSTRAINT "CrossSellOpportunity_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
