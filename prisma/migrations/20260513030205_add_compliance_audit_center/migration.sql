-- CreateTable
CREATE TABLE "ComplianceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "resolvedById" TEXT,
    "eventCategory" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChecklist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "productType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientChecklistResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "itemId" TEXT,
    "completedById" TEXT,
    "opportunityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceDocumentId" TEXT,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientChecklistResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "advisorId" TEXT,
    "reviewerId" TEXT,
    "reviewType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "findings" TEXT,
    "requiredCorrections" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "advisorId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "exceptionType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "supportingDocumentId" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT,
    "assignedToId" TEXT,
    "complaintNumber" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT,
    "productType" TEXT,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "resolutionSummary" TEXT,
    "closedAt" TIMESTAMP(3),
    "reportableToAmf" BOOLEAN NOT NULL DEFAULT false,
    "documents" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "detectedById" TEXT,
    "assignedToId" TEXT,
    "incidentNumber" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "affectedClientIds" JSONB,
    "dataCategories" JSONB,
    "description" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'TO_ASSESS',
    "seriousHarmRisk" BOOLEAN NOT NULL DEFAULT false,
    "mitigationSteps" TEXT,
    "notifiedAuthorityAt" TIMESTAMP(3),
    "notifiedClientsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "correctiveActions" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "summary" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "fileName" TEXT,
    "storagePath" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceEvent_organizationId_idx" ON "ComplianceEvent"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceEvent_clientId_idx" ON "ComplianceEvent"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceEvent_assignedToId_idx" ON "ComplianceEvent"("assignedToId");

-- CreateIndex
CREATE INDEX "ComplianceEvent_eventCategory_idx" ON "ComplianceEvent"("eventCategory");

-- CreateIndex
CREATE INDEX "ComplianceEvent_severity_idx" ON "ComplianceEvent"("severity");

-- CreateIndex
CREATE INDEX "ComplianceEvent_status_idx" ON "ComplianceEvent"("status");

-- CreateIndex
CREATE INDEX "ComplianceEvent_linkedEntityType_linkedEntityId_idx" ON "ComplianceEvent"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "ComplianceEvent_createdAt_idx" ON "ComplianceEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProductChecklist_organizationId_idx" ON "ProductChecklist"("organizationId");

-- CreateIndex
CREATE INDEX "ProductChecklist_productType_idx" ON "ProductChecklist"("productType");

-- CreateIndex
CREATE INDEX "ProductChecklist_active_idx" ON "ProductChecklist"("active");

-- CreateIndex
CREATE INDEX "ChecklistItem_organizationId_idx" ON "ChecklistItem"("organizationId");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "ChecklistItem_required_idx" ON "ChecklistItem"("required");

-- CreateIndex
CREATE INDEX "ChecklistItem_blocking_idx" ON "ChecklistItem"("blocking");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_organizationId_idx" ON "ClientChecklistResult"("organizationId");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_clientId_idx" ON "ClientChecklistResult"("clientId");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_checklistId_idx" ON "ClientChecklistResult"("checklistId");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_itemId_idx" ON "ClientChecklistResult"("itemId");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_opportunityId_idx" ON "ClientChecklistResult"("opportunityId");

-- CreateIndex
CREATE INDEX "ClientChecklistResult_status_idx" ON "ClientChecklistResult"("status");

-- CreateIndex
CREATE INDEX "SupervisionReview_organizationId_idx" ON "SupervisionReview"("organizationId");

-- CreateIndex
CREATE INDEX "SupervisionReview_clientId_idx" ON "SupervisionReview"("clientId");

-- CreateIndex
CREATE INDEX "SupervisionReview_advisorId_idx" ON "SupervisionReview"("advisorId");

-- CreateIndex
CREATE INDEX "SupervisionReview_reviewerId_idx" ON "SupervisionReview"("reviewerId");

-- CreateIndex
CREATE INDEX "SupervisionReview_reviewType_idx" ON "SupervisionReview"("reviewType");

-- CreateIndex
CREATE INDEX "SupervisionReview_status_idx" ON "SupervisionReview"("status");

-- CreateIndex
CREATE INDEX "SupervisionReview_riskLevel_idx" ON "SupervisionReview"("riskLevel");

-- CreateIndex
CREATE INDEX "ComplianceException_organizationId_idx" ON "ComplianceException"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceException_clientId_idx" ON "ComplianceException"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceException_advisorId_idx" ON "ComplianceException"("advisorId");

-- CreateIndex
CREATE INDEX "ComplianceException_exceptionType_idx" ON "ComplianceException"("exceptionType");

-- CreateIndex
CREATE INDEX "ComplianceException_riskLevel_idx" ON "ComplianceException"("riskLevel");

-- CreateIndex
CREATE INDEX "ComplianceException_status_idx" ON "ComplianceException"("status");

-- CreateIndex
CREATE INDEX "Complaint_organizationId_idx" ON "Complaint"("organizationId");

-- CreateIndex
CREATE INDEX "Complaint_clientId_idx" ON "Complaint"("clientId");

-- CreateIndex
CREATE INDEX "Complaint_advisorId_idx" ON "Complaint"("advisorId");

-- CreateIndex
CREATE INDEX "Complaint_assignedToId_idx" ON "Complaint"("assignedToId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_severity_idx" ON "Complaint"("severity");

-- CreateIndex
CREATE INDEX "Complaint_receivedAt_idx" ON "Complaint"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_organizationId_complaintNumber_key" ON "Complaint"("organizationId", "complaintNumber");

-- CreateIndex
CREATE INDEX "ComplianceIncident_organizationId_idx" ON "ComplianceIncident"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceIncident_clientId_idx" ON "ComplianceIncident"("clientId");

-- CreateIndex
CREATE INDEX "ComplianceIncident_detectedById_idx" ON "ComplianceIncident"("detectedById");

-- CreateIndex
CREATE INDEX "ComplianceIncident_assignedToId_idx" ON "ComplianceIncident"("assignedToId");

-- CreateIndex
CREATE INDEX "ComplianceIncident_incidentType_idx" ON "ComplianceIncident"("incidentType");

-- CreateIndex
CREATE INDEX "ComplianceIncident_riskLevel_idx" ON "ComplianceIncident"("riskLevel");

-- CreateIndex
CREATE INDEX "ComplianceIncident_status_idx" ON "ComplianceIncident"("status");

-- CreateIndex
CREATE INDEX "ComplianceIncident_detectedAt_idx" ON "ComplianceIncident"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceIncident_organizationId_incidentNumber_key" ON "ComplianceIncident"("organizationId", "incidentNumber");

-- CreateIndex
CREATE INDEX "AuditReport_organizationId_idx" ON "AuditReport"("organizationId");

-- CreateIndex
CREATE INDEX "AuditReport_clientId_idx" ON "AuditReport"("clientId");

-- CreateIndex
CREATE INDEX "AuditReport_createdById_idx" ON "AuditReport"("createdById");

-- CreateIndex
CREATE INDEX "AuditReport_reportType_idx" ON "AuditReport"("reportType");

-- CreateIndex
CREATE INDEX "AuditReport_status_idx" ON "AuditReport"("status");

-- CreateIndex
CREATE INDEX "AuditReport_generatedAt_idx" ON "AuditReport"("generatedAt");

-- AddForeignKey
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvent" ADD CONSTRAINT "ComplianceEvent_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChecklist" ADD CONSTRAINT "ProductChecklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChecklist" ADD CONSTRAINT "ProductChecklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChecklist" ADD CONSTRAINT "ProductChecklist_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ProductChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChecklistResult" ADD CONSTRAINT "ClientChecklistResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChecklistResult" ADD CONSTRAINT "ClientChecklistResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChecklistResult" ADD CONSTRAINT "ClientChecklistResult_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ProductChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChecklistResult" ADD CONSTRAINT "ClientChecklistResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChecklistResult" ADD CONSTRAINT "ClientChecklistResult_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionReview" ADD CONSTRAINT "SupervisionReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionReview" ADD CONSTRAINT "SupervisionReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionReview" ADD CONSTRAINT "SupervisionReview_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionReview" ADD CONSTRAINT "SupervisionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceException" ADD CONSTRAINT "ComplianceException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceException" ADD CONSTRAINT "ComplianceException_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceException" ADD CONSTRAINT "ComplianceException_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceException" ADD CONSTRAINT "ComplianceException_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceException" ADD CONSTRAINT "ComplianceException_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
