import type { ActivityType } from "@prisma/client"

import type { AutomationEntityType, AutomationTrigger } from "@/lib/automation/types"
import { runAutomations } from "@/lib/automation/engine"
import { prisma } from "@/lib/prisma"
import { createActivity } from "@/lib/services/activities"

const SMART_REMINDER_TRIGGER_TYPES = new Set<ActivityType>([
  "CLIENT_CREATED",
  "CLIENT_UPDATED",
  "CLIENT_STATUS_CHANGED",
  "NOTE_ADDED",
  "NOTE_UPDATED",
  "DOCUMENT_ADDED",
  "DOCUMENT_UPDATED",
  "DOCUMENT_STATUS_CHANGED",
  "DOCUMENT_RECEIVED",
  "DOCUMENT_VALIDATED",
  "DOCUMENT_EXPIRED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_STATUS_CHANGED",
  "PRODUCT_REVIEWED",
  "KYC_CREATED",
  "KYC_UPDATED",
  "KYC_APPROVED",
  "KYC_REVIEW_COMPLETED",
  "CONSENT_GIVEN",
  "CONSENT_REVOKED",
  "TASK_COMPLETED",
  "RECOMMENDATION_CREATED",
])

export async function createCrmActivity({
  organizationId,
  userId,
  leadId,
  clientId,
  taskId,
  documentId,
  productId,
  noteId,
  alertId,
  automationRuleId,
  type,
  title,
  description,
  entityType,
  entityId,
  source = "USER",
  metadata,
}: {
  organizationId: string
  userId?: string | null
  leadId?: string | null
  clientId?: string | null
  taskId?: string | null
  documentId?: string | null
  productId?: string | null
  noteId?: string | null
  alertId?: string | null
  automationRuleId?: string | null
  type: ActivityType
  title: string
  description?: string | null
  entityType?: string | null
  entityId?: string | null
  source?: "USER" | "AUTOMATION" | "SYSTEM" | "AI" | "WEBHOOK" | "IMPORT"
  metadata?: Record<string, unknown> | null
}) {
  const activity = await createActivity({
    organizationId,
    userId,
    leadId,
    clientId,
    taskId,
    documentId,
    productId,
    noteId,
    alertId,
    automationRuleId,
    type,
    title,
    description,
    entityType,
    entityId,
    source,
    metadata,
  })

  try {
    await prisma.notification.create({
      data: {
        organizationId,
        userId,
        type:
          type === "TASK_COMPLETED" || type === "LEAD_CONVERTED"
            ? "SUCCESS"
            : type === "DOCUMENT_ADDED"
              ? "INFO"
              : "WARNING",
        title,
        message: description,
        href: leadId ? `/prospects/${leadId}` : clientId ? `/clients/${clientId}` : undefined,
      },
    })
  } catch (error) {
    console.warn({
      action: "secondary_notification_failed",
      name: error instanceof Error ? error.name : "UnknownError",
    })
  }

  if (clientId && SMART_REMINDER_TRIGGER_TYPES.has(type)) {
    try {
      const { evaluateSmartRemindersForClient } = await import("@/lib/smart-reminders/service")
      await evaluateSmartRemindersForClient({ organizationId, clientId, userId })
    } catch (error) {
      console.warn({
        action: "smart_reminder_event_evaluation_failed",
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }

  return activity
}

export async function runAutomationsForEvent({
  organizationId,
  userId,
  event,
  leadId,
  clientId,
  title,
  description,
  entityType,
  entityId,
  payload,
}: {
  organizationId: string
  userId?: string | null
  event: AutomationTrigger
  leadId?: string | null
  clientId?: string | null
  title: string
  description?: string | null
  entityType?: AutomationEntityType
  entityId?: string | null
  payload?: Record<string, unknown>
}) {
  try {
    return await runAutomations({
      organizationId,
      userId,
      trigger: event,
      entityType: entityType ?? (leadId ? "lead" : clientId ? "client" : "task"),
      entityId: entityId ?? leadId ?? clientId,
      leadId,
      clientId,
      payload: {
        ...(payload ?? {}),
        title,
        description,
        leadId,
        clientId,
        event,
      },
    })
  } catch (error) {
    console.warn({
      action: "secondary_automation_failed",
      name: error instanceof Error ? error.name : "UnknownError",
    })
    return {
      evaluatedRules: 0,
      matchedRules: 0,
      skippedRules: 0,
      executedRules: 0,
      failedRules: 0,
      actionsExecuted: 0,
    }
  }
}
