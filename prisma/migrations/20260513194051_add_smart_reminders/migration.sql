-- CreateTable
CREATE TABLE "SmartReminderRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "conditionConfig" JSONB,
    "actionConfig" JSONB,
    "defaultPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "defaultDueOffsetDays" INTEGER NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT,
    "ruleId" TEXT,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "triggerDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "recommendedAction" TEXT,
    "actionUrl" TEXT,
    "opportunityId" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredById" TEXT,
    "ignoredReason" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "commercialScore" INTEGER NOT NULL DEFAULT 0,
    "relationshipScore" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartReminderAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdEntityType" TEXT,
    "createdEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "SmartReminderAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartReminderSnooze" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "snoozedById" TEXT,
    "snoozedUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartReminderSnooze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartReminderTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'INTERNAL',
    "language" TEXT NOT NULL DEFAULT 'FR',
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartReminderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartReminderAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartReminderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartReminderRule_organizationId_idx" ON "SmartReminderRule"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminderRule_category_idx" ON "SmartReminderRule"("category");

-- CreateIndex
CREATE INDEX "SmartReminderRule_active_idx" ON "SmartReminderRule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SmartReminderRule_organizationId_code_key" ON "SmartReminderRule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SmartReminder_organizationId_idx" ON "SmartReminder"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminder_clientId_idx" ON "SmartReminder"("clientId");

-- CreateIndex
CREATE INDEX "SmartReminder_advisorId_idx" ON "SmartReminder"("advisorId");

-- CreateIndex
CREATE INDEX "SmartReminder_ruleId_idx" ON "SmartReminder"("ruleId");

-- CreateIndex
CREATE INDEX "SmartReminder_status_idx" ON "SmartReminder"("status");

-- CreateIndex
CREATE INDEX "SmartReminder_priority_idx" ON "SmartReminder"("priority");

-- CreateIndex
CREATE INDEX "SmartReminder_dueDate_idx" ON "SmartReminder"("dueDate");

-- CreateIndex
CREATE INDEX "SmartReminder_category_idx" ON "SmartReminder"("category");

-- CreateIndex
CREATE INDEX "SmartReminder_sourceEntityType_sourceEntityId_idx" ON "SmartReminder"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartReminder_organizationId_dedupeKey_key" ON "SmartReminder"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "SmartReminderAction_organizationId_idx" ON "SmartReminderAction"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminderAction_reminderId_idx" ON "SmartReminderAction"("reminderId");

-- CreateIndex
CREATE INDEX "SmartReminderAction_actionType_idx" ON "SmartReminderAction"("actionType");

-- CreateIndex
CREATE INDEX "SmartReminderAction_status_idx" ON "SmartReminderAction"("status");

-- CreateIndex
CREATE INDEX "SmartReminderSnooze_organizationId_idx" ON "SmartReminderSnooze"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminderSnooze_reminderId_idx" ON "SmartReminderSnooze"("reminderId");

-- CreateIndex
CREATE INDEX "SmartReminderSnooze_snoozedUntil_idx" ON "SmartReminderSnooze"("snoozedUntil");

-- CreateIndex
CREATE INDEX "SmartReminderTemplate_organizationId_idx" ON "SmartReminderTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminderTemplate_category_idx" ON "SmartReminderTemplate"("category");

-- CreateIndex
CREATE INDEX "SmartReminderTemplate_channel_idx" ON "SmartReminderTemplate"("channel");

-- CreateIndex
CREATE INDEX "SmartReminderTemplate_active_idx" ON "SmartReminderTemplate"("active");

-- CreateIndex
CREATE INDEX "SmartReminderAuditLog_organizationId_idx" ON "SmartReminderAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "SmartReminderAuditLog_reminderId_idx" ON "SmartReminderAuditLog"("reminderId");

-- CreateIndex
CREATE INDEX "SmartReminderAuditLog_eventType_idx" ON "SmartReminderAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "SmartReminderAuditLog_timestamp_idx" ON "SmartReminderAuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "SmartReminderRule" ADD CONSTRAINT "SmartReminderRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminder" ADD CONSTRAINT "SmartReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminder" ADD CONSTRAINT "SmartReminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminder" ADD CONSTRAINT "SmartReminder_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminder" ADD CONSTRAINT "SmartReminder_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SmartReminderRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminder" ADD CONSTRAINT "SmartReminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderAction" ADD CONSTRAINT "SmartReminderAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderAction" ADD CONSTRAINT "SmartReminderAction_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "SmartReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderSnooze" ADD CONSTRAINT "SmartReminderSnooze_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderSnooze" ADD CONSTRAINT "SmartReminderSnooze_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "SmartReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderTemplate" ADD CONSTRAINT "SmartReminderTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderAuditLog" ADD CONSTRAINT "SmartReminderAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartReminderAuditLog" ADD CONSTRAINT "SmartReminderAuditLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "SmartReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
