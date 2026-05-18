import { Prisma } from "@prisma/client"

import { runAutomationAction } from "@/lib/automation/actions"
import { conditionsMatch, parseConditions } from "@/lib/automation/conditions"
import { completeAutomationRun, failAutomationRun, startAutomationRun } from "@/lib/automation/logs"
import type { AutomationAction, RunAutomationsInput } from "@/lib/automation/types"
import { prisma } from "@/lib/prisma"
import { createActivity } from "@/lib/services/activities"

function parseActions(value: Prisma.JsonValue): AutomationAction[] {
  if (Array.isArray(value)) {
    return value.filter((action): action is AutomationAction => {
      return typeof action === "object" && action !== null && !Array.isArray(action)
    })
  }

  if (typeof value === "object" && value !== null && "items" in value) {
    const items = (value as { items?: unknown }).items
    return Array.isArray(items)
      ? items.filter((action): action is AutomationAction => {
          return typeof action === "object" && action !== null && !Array.isArray(action)
        })
      : []
  }

  return []
}

function actionStepLabel(action: AutomationAction) {
  const workflowKey = action.params && typeof action.params === "object" ? String(action.params.workflowKey ?? "") : ""
  if (workflowKey === "lead.form.ai_qualification_routing") return "IA n8n analysée et routage demandé"
  if (workflowKey === "lead.form.sms_confirmation") return "SMS demandé à n8n"
  if (workflowKey === "lead.form.multichannel_followup") return "Google Sheets, courriel et SMS demandés"
  if (workflowKey === "call.inbound.reception_advisor") return "Réception d’appel demandée à n8n"
  if (action.type === "CREATE_TASK") return "Tâche conseiller créée"
  if (action.type === "CREATE_ACTIVITY") return "Preuve CRM enregistrée"
  if (action.type === "SEND_INTERNAL_NOTIFICATION" || action.type === "NOTIFY_USER") return "Notification interne envoyée"
  return action.type ?? "Action automatisée"
}

export async function runAutomations(input: RunAutomationsInput) {
  const rules = await prisma.automationRule.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      trigger: input.trigger,
    },
  })

  let matchedRules = 0
  let executedRules = 0
  let failedRules = 0
  let actionsExecutedCount = 0

  for (const rule of rules) {
    const conditions = parseConditions(rule.conditions ?? [])

    if (!conditionsMatch(conditions, input.payload ?? {})) {
      continue
    }

    matchedRules += 1

    const actions = parseActions(rule.actions)
    const ruleInput = {
      ...input,
      automationRuleId: rule.id,
    }
    const run = await startAutomationRun({
      organizationId: input.organizationId,
      automationRuleId: rule.id,
      trigger: input.trigger,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    })
    const actionsExecuted: Array<{ step: string; status: "SUCCESS" | "FAILED"; at: string; detail?: string }> = [
      { step: "Formulaire reçu / événement reçu", status: "SUCCESS", at: new Date().toISOString(), detail: input.entityId ?? input.leadId ?? undefined },
    ]

    try {
      for (const action of actions) {
        const startedAt = new Date().toISOString()
        await runAutomationAction(action, ruleInput)
        if (action.type) {
          actionsExecuted.push({
            step: actionStepLabel(action),
            status: "SUCCESS",
            at: startedAt,
            detail: action.params && typeof action.params === "object" && "workflowKey" in action.params ? String(action.params.workflowKey) : undefined,
          })
        }
      }

      await prisma.automationRule.updateMany({
        where: { id: rule.id, organizationId: input.organizationId },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
        },
      })

      await completeAutomationRun({ id: run.id, actionsExecuted: actionsExecuted as Prisma.InputJsonValue })
      executedRules += 1
      actionsExecutedCount += actionsExecuted.length

      await createActivity({
        organizationId: input.organizationId,
        userId: input.userId,
        leadId: input.leadId,
        clientId: input.clientId,
        automationRuleId: rule.id,
        type: "AUTOMATION_EXECUTED",
        title: "Automatisation exécutée",
        description: rule.name,
        entityType: "AutomationRule",
        entityId: rule.id,
        source: "AUTOMATION",
        metadata: {
          ruleName: rule.name,
          trigger: rule.trigger,
          actionsExecuted,
        },
      })
    } catch (error) {
      failedRules += 1
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      actionsExecuted.push({ step: "Erreur", status: "FAILED", at: new Date().toISOString(), detail: message })
      await failAutomationRun({ id: run.id, error: message, actionsExecuted: actionsExecuted as Prisma.InputJsonValue })
      await createActivity({
        organizationId: input.organizationId,
        userId: input.userId,
        leadId: input.leadId,
        clientId: input.clientId,
        automationRuleId: rule.id,
        type: "AUTOMATION_FAILED",
        title: "Automatisation échouée",
        description: rule.name,
        entityType: "AutomationRule",
        entityId: rule.id,
        source: "AUTOMATION",
        metadata: { error: message },
      })
      console.warn({
        action: "automation_failed",
        ruleId: rule.id,
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }

  return {
    evaluatedRules: rules.length,
    matchedRules,
    skippedRules: rules.length - matchedRules,
    executedRules,
    failedRules,
    actionsExecuted: actionsExecutedCount,
  }
}
