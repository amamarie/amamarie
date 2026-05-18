-- CreateTable
CREATE TABLE "LeadInsuranceProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "insuranceCategory" TEXT,
    "currentCoverage" TEXT,
    "renewalDate" TIMESTAMP(3),
    "familyContext" TEXT,
    "businessContext" TEXT,
    "urgencyLevel" TEXT,
    "mainGoal" TEXT,
    "advisorNotes" TEXT,
    "qualificationScore" INTEGER,
    "appointmentRequested" BOOLEAN NOT NULL DEFAULT false,
    "preferredAvailabilities" JSONB,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "sourceCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadInsuranceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFinancialPlanningProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "planningTopic" TEXT,
    "lifeStage" TEXT,
    "hasExistingAdvisor" TEXT,
    "investmentKnowledge" TEXT,
    "riskDiscussionNeeded" BOOLEAN,
    "documentsNeeded" JSONB,
    "meetingObjective" TEXT,
    "advisorNotes" TEXT,
    "qualificationScore" INTEGER,
    "appointmentRequested" BOOLEAN NOT NULL DEFAULT false,
    "preferredAvailabilities" JSONB,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "sourceCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadFinancialPlanningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadInsuranceProfile_leadId_key" ON "LeadInsuranceProfile"("leadId");

-- CreateIndex
CREATE INDEX "LeadInsuranceProfile_organizationId_idx" ON "LeadInsuranceProfile"("organizationId");

-- CreateIndex
CREATE INDEX "LeadInsuranceProfile_urgencyLevel_idx" ON "LeadInsuranceProfile"("urgencyLevel");

-- CreateIndex
CREATE INDEX "LeadInsuranceProfile_insuranceCategory_idx" ON "LeadInsuranceProfile"("insuranceCategory");

-- CreateIndex
CREATE UNIQUE INDEX "LeadFinancialPlanningProfile_leadId_key" ON "LeadFinancialPlanningProfile"("leadId");

-- CreateIndex
CREATE INDEX "LeadFinancialPlanningProfile_organizationId_idx" ON "LeadFinancialPlanningProfile"("organizationId");

-- CreateIndex
CREATE INDEX "LeadFinancialPlanningProfile_planningTopic_idx" ON "LeadFinancialPlanningProfile"("planningTopic");

-- AddForeignKey
ALTER TABLE "LeadInsuranceProfile" ADD CONSTRAINT "LeadInsuranceProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInsuranceProfile" ADD CONSTRAINT "LeadInsuranceProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFinancialPlanningProfile" ADD CONSTRAINT "LeadFinancialPlanningProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFinancialPlanningProfile" ADD CONSTRAINT "LeadFinancialPlanningProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
