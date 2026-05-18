/*
  Warnings:

  - Changed the type of `trigger` on the `AutomationRule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('INBOUND_UNKNOWN_CALL', 'LEAD_CREATED', 'LEAD_STATUS_CHANGED', 'LEAD_CONVERTED', 'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_NO_CONTACT_90_DAYS', 'CLIENT_NO_FOLLOW_UP_90_DAYS', 'TASK_CREATED', 'TASK_COMPLETED', 'TASK_OVERDUE', 'DOCUMENT_CREATED', 'DOCUMENT_ADDED', 'DOCUMENT_STATUS_CHANGED', 'DOCUMENT_EXPIRED', 'NOTE_ADDED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_STATUS_CHANGED', 'PRODUCT_RENEWAL_SOON', 'PRODUCT_REVIEW_DUE', 'PRODUCT_REVIEWED', 'PRODUCT_ARCHIVED', 'KYC_INCOMPLETE', 'KYC_UPDATED', 'KYC_EXPIRED', 'KYC_APPROVED', 'CONSENT_REVOKED', 'COMPLIANCE_ALERT_CREATED', 'SMART_ALERT_CREATED', 'ALERT_RESOLVED', 'RECOMMENDATION_CREATED', 'CROSS_SELL_CREATED');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('CREATE_TASK', 'CREATE_ACTIVITY', 'SEND_INTERNAL_NOTIFICATION', 'NOTIFY_USER', 'SEND_MOCK_SMS', 'SEND_MOCK_EMAIL', 'CHANGE_LEAD_STATUS', 'ASSIGN_ADVISOR', 'CREATE_REMINDER', 'CREATE_SMART_ALERT', 'UPDATE_FIELD', 'GENERATE_RECOMMENDATIONS', 'GENERATE_PRIORITIES', 'CREATE_DOCUMENT_REQUEST', 'CREATE_KYC_REVIEW_TASK', 'CREATE_PRODUCT_REVIEW_TASK');

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

ALTER TABLE "AutomationRule"
ALTER COLUMN "trigger" TYPE "AutomationTrigger"
USING "trigger"::"AutomationTrigger";

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationRuleId" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "actionsExecuted" JSONB,
    "payload" JSONB,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRun_organizationId_idx" ON "AutomationRun"("organizationId");

-- CreateIndex
CREATE INDEX "AutomationRun_automationRuleId_idx" ON "AutomationRun"("automationRuleId");

-- CreateIndex
CREATE INDEX "AutomationRun_trigger_idx" ON "AutomationRun"("trigger");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");

-- CreateIndex
CREATE INDEX "AutomationRule_trigger_idx" ON "AutomationRule"("trigger");

-- CreateIndex
CREATE INDEX "AutomationRule_isActive_idx" ON "AutomationRule"("isActive");

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
