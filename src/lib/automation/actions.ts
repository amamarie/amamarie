import { prisma } from "@/lib/prisma"
import type { AutomationAction, RunAutomationsInput } from "@/lib/automation/types"
import { invokeWorkflow } from "@/lib/automation/workflows"
import { createActivity } from "@/lib/services/activities"
import { createNotification } from "@/lib/services/notifications"

function actionParams(action: AutomationAction) {
  return action.params ?? {}
}

function contextValue(input: RunAutomationsInput, key: string) {
  const payload = input.payload ?? {}
  const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(" ")
  const values: Record<string, unknown> = {
    ...payload,
    fullName,
    leadName: fullName,
    clientName: fullName,
    dueDate: payload.dueDate,
  }
  return values[key]
}

function renderTemplate(template: string | undefined, input: RunAutomationsInput) {
  if (!template) return undefined
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(contextValue(input, key) ?? ""))
}

function relatedHref(input: RunAutomationsInput) {
  if (input.leadId) return `/prospects/${input.leadId}`
  if (input.clientId) return `/clients/${input.clientId}`
  return undefined
}

export async function runAutomationAction(
  action: AutomationAction,
  input: RunAutomationsInput
) {
  const params = actionParams(action)

  if (action.type === "RUN_WORKFLOW") {
    const workflowKey = String(params.workflowKey ?? "")
    if (!workflowKey) throw new Error("WORKFLOW_KEY_REQUIRED")

    await invokeWorkflow({
      workflowKey,
      required: params.required === true,
      input,
      params,
    })
  }

  if (action.type === "CREATE_TASK") {
    const dueInHours = Number(params.dueInHours ?? action.dueInHours)
    const dueInDays = Number(params.dueInDays ?? action.dueInDays)
    const task = await prisma.task.create({
      data: {
        organizationId: input.organizationId,
        assignedToId: input.userId,
        createdById: input.userId,
        leadId: input.leadId,
        clientId: input.clientId,
        automationRuleId: input.automationRuleId,
        title: renderTemplate(String(params.title ?? action.title ?? "Suivi automatique"), input) ?? "Suivi automatique",
        description: renderTemplate(String(params.description ?? action.message ?? ""), input),
        priority: (params.priority ?? action.priority ?? "NORMAL") as "LOW" | "NORMAL" | "HIGH" | "URGENT",
        type: (params.taskType ?? "FOLLOW_UP") as "FOLLOW_UP",
        status: "TODO",
        isAutomated: true,
        dueDate: Number.isFinite(dueInHours)
          ? new Date(Date.now() + dueInHours * 60 * 60 * 1000)
          : Number.isFinite(dueInDays)
            ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)
            : undefined,
      },
    })
    await createActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      leadId: input.leadId,
      clientId: input.clientId,
      taskId: task.id,
      automationRuleId: input.automationRuleId,
      type: "TASK_CREATED",
      title: "Tâche créée par automatisation",
      description: task.title,
      entityType: "Task",
      entityId: task.id,
      source: "AUTOMATION",
    })
  }

  if (action.type === "CREATE_ACTIVITY") {
    await createActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      leadId: input.leadId,
      clientId: input.clientId,
      type: "AUTOMATION_EXECUTED",
      title: renderTemplate(String(params.title ?? action.title ?? "Automatisation exécutée"), input) ?? "Automatisation exécutée",
      description: renderTemplate(String(params.message ?? action.message ?? ""), input),
      source: "AUTOMATION",
    })
  }

  if (
    action.type === "SEND_INTERNAL_NOTIFICATION" ||
    action.type === "NOTIFY_USER"
  ) {
    try {
      await createNotification({
        organizationId: input.organizationId,
        userId: params.userTarget === "organization" ? null : input.userId,
        type: String(params.type ?? "AUTOMATION_EXECUTED") as never,
        priority: String(params.priority ?? action.priority ?? "NORMAL") as never,
        title: renderTemplate(String(params.title ?? action.title ?? "Notification interne"), input) ?? "Notification interne",
        message: renderTemplate(String(params.message ?? action.message ?? "Une automatisation a généré une notification."), input) ?? "Une automatisation a généré une notification.",
        actionLabel: params.actionLabel ? String(params.actionLabel) : "Voir le dossier",
        actionUrl: renderTemplate(String(params.actionUrl ?? relatedHref(input) ?? ""), input),
        entityType: input.entityType,
        entityId: input.entityId,
        clientId: input.clientId,
        leadId: input.leadId,
      })
    } catch (error) {
      console.warn({
        action: "automation_notification_failed",
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }

  if (action.type === "SEND_MOCK_SMS" || action.type === "SEND_MOCK_EMAIL") {
    await createActivity({
      organizationId: input.organizationId,
      userId: input.userId,
      leadId: input.leadId,
      clientId: input.clientId,
      type: action.type === "SEND_MOCK_SMS" ? "SMS_SENT" : "EMAIL_SENT",
      title: action.type === "SEND_MOCK_SMS" ? "SMS fictif envoyé" : "Courriel fictif envoyé",
      description: renderTemplate(String(params.template ?? params.message ?? action.template ?? action.message ?? "Action simulée, aucune intégration externe appelée."), input),
      source: "AUTOMATION",
    })
  }

  if (action.type === "CHANGE_LEAD_STATUS" && input.leadId && params.status) {
    await prisma.lead.updateMany({
      where: { id: input.leadId, organizationId: input.organizationId },
      data: { status: params.status as never },
    })
  }

  if (action.type === "ASSIGN_ADVISOR" && input.leadId && params.advisorId) {
    await prisma.lead.updateMany({
      where: { id: input.leadId, organizationId: input.organizationId },
      data: { advisorId: String(params.advisorId) },
    })
  }

  if (action.type === "CREATE_REMINDER") {
    await createNotification({
      organizationId: input.organizationId,
      userId: input.userId,
      type: "SYSTEM",
      priority: "NORMAL",
      title: renderTemplate(String(params.title ?? "Rappel automatique"), input) ?? "Rappel automatique",
      message: renderTemplate(String(params.message ?? "Rappel généré automatiquement."), input) ?? "Rappel généré automatiquement.",
      actionUrl: relatedHref(input),
      actionLabel: "Voir le dossier",
      entityType: input.entityType,
      entityId: input.entityId,
      clientId: input.clientId,
      leadId: input.leadId,
    })
  }
}
