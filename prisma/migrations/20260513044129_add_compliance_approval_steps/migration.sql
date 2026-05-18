-- CreateTable
CREATE TABLE "ComplianceApprovalStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "linkedEntityId" TEXT NOT NULL,
    "clientId" TEXT,
    "advisorId" TEXT,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requiredRole" TEXT,
    "requestedById" TEXT,
    "approverId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_organizationId_idx" ON "ComplianceApprovalStep"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_clientId_idx" ON "ComplianceApprovalStep"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_advisorId_idx" ON "ComplianceApprovalStep"("advisorId");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_linkedEntityType_linkedEntityId_idx" ON "ComplianceApprovalStep"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_status_idx" ON "ComplianceApprovalStep"("status");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_level_idx" ON "ComplianceApprovalStep"("level");

-- CreateIndex
CREATE INDEX "ComplianceApprovalStep_approverId_idx" ON "ComplianceApprovalStep"("approverId");
