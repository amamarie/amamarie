import type { AutomationTrigger, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type AutomationTemplate = {
  id: string
  name: string
  description: string
  trigger: AutomationTrigger
  conditions?: Prisma.InputJsonValue
  actions: Prisma.InputJsonValue
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "lead-created-follow-up",
    name: "Nouveau prospect - premier suivi",
    description: "Crée une tâche de suivi lorsqu’un prospect est créé.",
    trigger: "LEAD_CREATED",
    conditions: { all: [{ field: "status", operator: "equals", value: "NEW" }] },
    actions: [
      { type: "CREATE_TASK", params: { title: "Premier suivi prospect", priority: "NORMAL", dueInHours: 24 } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "lead.created.follow_up" } },
    ],
  },
  {
    id: "lead-form-sms-confirmation-n8n",
    name: "Formulaire web - SMS confirmation n8n",
    description: "Lorsqu’un prospect vient d’un formulaire web, appelle n8n pour envoyer un SMS de confirmation et crée une tâche de suivi conseiller.",
    trigger: "LEAD_CREATED",
    conditions: { all: [{ field: "source", operator: "equals", value: "lead_form" }] },
    actions: [
      {
        type: "RUN_WORKFLOW",
        params: {
          workflowKey: "lead.form.sms_confirmation",
          smsTemplate: "Bonjour {{firstName}}, merci pour votre demande. Votre conseiller a bien reçu votre formulaire et vous contactera sous peu.",
          required: false,
        },
      },
      {
        type: "CREATE_TASK",
        params: {
          title: "Suivi formulaire web",
          description: "Prospect {{fullName}} créé depuis formulaire. Vérifier la demande, confirmer le besoin et documenter le prochain contact.",
          priority: "HIGH",
          dueInHours: 2,
        },
      },
      {
        type: "CREATE_ACTIVITY",
        params: {
          title: "Workflow n8n demandé",
          message: "Demande d’envoi SMS confirmation transmise à n8n pour {{fullName}}.",
        },
      },
    ],
  },
  {
    id: "lead-form-multichannel-n8n",
    name: "Formulaire web - multicanal n8n",
    description: "Lorsqu’un prospect vient d’un formulaire web, appelle n8n pour orchestrer Google Sheets, un courriel HTML, un SMS de confirmation et une tâche conseiller.",
    trigger: "LEAD_CREATED",
    conditions: { all: [{ field: "source", operator: "equals", value: "lead_form" }] },
    actions: [
      {
        type: "RUN_WORKFLOW",
        params: {
          workflowKey: "lead.form.multichannel_followup",
          required: false,
          smsTemplate: "Bonjour {{firstName}}, merci pour votre demande. Votre conseiller a bien reçu votre formulaire et vous contactera sous peu.",
          emailSubject: "Votre demande a bien été reçue",
          emailHtml:
            "<p>Bonjour {{firstName}},</p><p>Votre demande a bien été reçue par FinAssuro. Un conseiller vous contactera sous peu.</p><p>Merci.</p>",
          taskTitle: "Suivi formulaire web multicanal",
          taskDescription: "Prospect {{fullName}} créé depuis formulaire. Vérifier la demande, confirmer le besoin et documenter le prochain contact.",
          taskPriority: "HIGH",
          taskDueInHours: 2,
          googleSheetsMode: "n8n",
        },
      },
      {
        type: "CREATE_ACTIVITY",
        params: {
          title: "Workflow multicanal n8n demandé",
          message: "Demande transmise à n8n pour Google Sheets, courriel HTML, SMS et suivi conseiller de {{fullName}}.",
        },
      },
    ],
  },
  {
    id: "lead-form-ai-qualification-routing-n8n",
    name: "Formulaire web - qualification IA et routage n8n",
    description: "Lorsqu’un prospect vient d’un formulaire web, n8n analyse le besoin, l’urgence et le budget, puis FinAssuro assigne le bon conseiller.",
    trigger: "LEAD_CREATED",
    conditions: { all: [{ field: "source", operator: "equals", value: "lead_form" }] },
    actions: [
      {
        type: "RUN_WORKFLOW",
        params: {
          workflowKey: "lead.form.ai_qualification_routing",
          required: false,
          routingMode: "advisor_specialty",
        },
      },
      {
        type: "CREATE_ACTIVITY",
        params: {
          title: "Workflow qualification/routage n8n demandé",
          message: "Demande transmise à n8n pour qualifier {{fullName}} et assigner le conseiller approprié.",
        },
      },
    ],
  },
  {
    id: "inbound-call-urgent",
    name: "Appel entrant - rappel urgent",
    description: "Crée une tâche urgente et notifie le conseiller pour un prospect issu d’un appel entrant.",
    trigger: "LEAD_CREATED",
    conditions: { all: [{ field: "source", operator: "equals", value: "INBOUND_CALL" }] },
    actions: [
      { type: "CREATE_TASK", params: { title: "Rappeler le prospect", priority: "HIGH", dueInHours: 2 } },
      { type: "SEND_INTERNAL_NOTIFICATION", params: { title: "Nouveau prospect à rappeler", message: "{{fullName}} vient d’être ajouté depuis un appel entrant.", priority: "HIGH" } },
      { type: "SEND_MOCK_SMS", params: { template: "Bonjour {{firstName}}, merci pour votre appel. Un conseiller vous contactera sous peu." } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "lead.inbound_call.urgent" } },
    ],
  },
  {
    id: "inbound-call-reception-advisor-n8n",
    name: "Appel entrant - réception conseiller n8n",
    description: "Quand un appel arrive, n8n journalise la réception, crée une tâche urgente pour le conseiller et envoie un SMS d’accusé réception à l’appelant si Twilio est configuré.",
    trigger: "INBOUND_CALL_RECEIVED",
    actions: [
      {
        type: "RUN_WORKFLOW",
        params: {
          workflowKey: "call.inbound.reception_advisor",
          required: false,
          taskTitle: "Rappeler après appel entrant",
          taskDescription: "Appel entrant reçu. Vérifier le dossier, rappeler la personne et documenter le besoin.",
          taskPriority: "URGENT",
          taskDueInHours: 1,
          callerSmsTemplate: "Bonjour, nous avons bien reçu votre appel. Un conseiller vous contactera rapidement.",
        },
      },
      {
        type: "SEND_INTERNAL_NOTIFICATION",
        params: {
          title: "Appel entrant à traiter",
          message: "Un appel entrant de {{fromNumber}} doit être traité par le conseiller.",
          priority: "URGENT",
          type: "CALL_RECEIVED",
        },
      },
      {
        type: "CREATE_ACTIVITY",
        params: {
          title: "Workflow n8n réception appel demandé",
          message: "Demande transmise à n8n pour traiter l’appel entrant {{fromNumber}}.",
        },
      },
    ],
  },
  {
    id: "proposal-sent-follow-up",
    name: "Proposition envoyée - suivi 48h",
    description: "Crée une tâche de suivi deux jours après l’envoi d’une proposition.",
    trigger: "LEAD_STATUS_CHANGED",
    conditions: { all: [{ field: "newStatus", operator: "equals", value: "PROPOSAL_SENT" }] },
    actions: [
      { type: "CREATE_TASK", params: { title: "Suivi proposition", priority: "HIGH", dueInHours: 48 } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "lead.proposal_sent.follow_up" } },
    ],
  },
  {
    id: "client-onboarding",
    name: "Client créé - onboarding",
    description: "Crée les suivis de démarrage du dossier client.",
    trigger: "CLIENT_CREATED",
    actions: [
      { type: "CREATE_TASK", params: { title: "Compléter dossier client", priority: "HIGH", dueInHours: 24 } },
      { type: "CREATE_TASK", params: { title: "Vérifier documents requis", priority: "NORMAL", dueInHours: 48 } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "client.created.onboarding" } },
    ],
  },
  {
    id: "document-required",
    name: "Document requis - demande",
    description: "Crée une tâche de demande lorsqu’un document requis est ajouté.",
    trigger: "DOCUMENT_CREATED",
    conditions: { all: [{ field: "status", operator: "equals", value: "REQUIRED" }] },
    actions: [
      { type: "CREATE_TASK", params: { title: "Demander document", priority: "HIGH", dueInHours: 24 } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "document.required.request" } },
    ],
  },
  {
    id: "document-rejected",
    name: "Document rejeté - correction",
    description: "Crée une tâche de correction pour un document rejeté.",
    trigger: "DOCUMENT_STATUS_CHANGED",
    conditions: { all: [{ field: "newStatus", operator: "equals", value: "REJECTED" }] },
    actions: [
      { type: "CREATE_TASK", params: { title: "Corriger document rejeté", priority: "HIGH", dueInHours: 24 } },
      { type: "SEND_INTERNAL_NOTIFICATION", params: { title: "Document rejeté", message: "Un document nécessite une correction.", priority: "HIGH" } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "document.rejected.correction" } },
    ],
  },
  {
    id: "insurance-policy-delivery-needs-analysis",
    name: "Livraison police - analyse des besoins obligatoire",
    description: "Quand un produit d’assurance devient actif, FinAssuro vérifie qu’un rapport daté d’analyse des besoins a été remis/signé au client avant la livraison.",
    trigger: "PRODUCT_STATUS_CHANGED",
    conditions: {
      all: [
        { field: "category", operator: "equals", value: "INSURANCE" },
        { field: "newStatus", operator: "equals", value: "ACTIVE" },
      ],
    },
    actions: [
      {
        type: "CREATE_ACTIVITY",
        params: {
          title: "Contrôle livraison police",
          message: "Vérification conformité lancée: analyse des besoins datée, remise/signée par le client et liée au dossier.",
        },
      },
    ],
  },
  {
    id: "task-completed-activity",
    name: "Tâche terminée - activité",
    description: "Ajoute une activité lisible lorsqu’une tâche est terminée.",
    trigger: "TASK_COMPLETED",
    actions: [
      { type: "CREATE_ACTIVITY", params: { title: "Tâche complétée", message: "{{title}}" } },
      { type: "RUN_WORKFLOW", params: { workflowKey: "task.completed.activity" } },
    ],
  },
]

type JsonAction = Record<string, Prisma.JsonValue>

function actionList(value: unknown): JsonAction[] {
  return Array.isArray(value) ? value.filter((item): item is JsonAction => typeof item === "object" && item !== null && !Array.isArray(item)) : []
}

function workflowKeyFromAction(action: JsonAction) {
  if (action.type !== "RUN_WORKFLOW") return undefined
  const params = action.params
  if (!params || typeof params !== "object" || Array.isArray(params)) return undefined
  const workflowKey = (params as Record<string, Prisma.JsonValue>).workflowKey
  return typeof workflowKey === "string" ? workflowKey : undefined
}

function mergeWorkflowActions(existingActions: Prisma.JsonValue, templateActions: Prisma.InputJsonValue) {
  const existing = actionList(existingActions)
  const template = actionList(templateActions)
  const existingKeys = new Set(existing.map(workflowKeyFromAction).filter(Boolean))
  const missingWorkflows = template.filter((action) => {
    const workflowKey = workflowKeyFromAction(action)
    return workflowKey && !existingKeys.has(workflowKey)
  })

  return missingWorkflows.length > 0 ? ([...existing, ...missingWorkflows] as Prisma.InputJsonValue) : null
}

export async function ensureDefaultAutomationRules({
  organizationId,
  userId,
}: {
  organizationId: string
  userId?: string | null
}) {
  const existing = await prisma.automationRule.findMany({
    where: { organizationId },
    select: { id: true, name: true, actions: true },
  })
  const names = new Set(existing.map((rule) => rule.name))
  const missing = automationTemplates.filter((template) => !names.has(template.name))
  const existingByName = new Map(existing.map((rule) => [rule.name, rule]))
  const updates = automationTemplates.flatMap((template) => {
    const rule = existingByName.get(template.name)
    if (!rule) return []
    const actions = mergeWorkflowActions(rule.actions, template.actions)
    return actions ? [{ id: rule.id, actions }] : []
  })

  for (const update of updates) {
    await prisma.automationRule.updateMany({
      where: { id: update.id, organizationId },
      data: {
        actions: update.actions,
        updatedById: userId ?? null,
      },
    })
  }

  if (missing.length === 0) return { created: 0, updated: updates.length }

  await prisma.automationRule.createMany({
    data: missing.map((template) => ({
      organizationId,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      conditions: template.conditions,
      actions: template.actions,
      isActive: true,
      createdById: userId ?? null,
      updatedById: userId ?? null,
    })),
  })

  return { created: missing.length, updated: updates.length }
}
