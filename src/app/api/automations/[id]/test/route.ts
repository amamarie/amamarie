import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { parseConditions } from "@/lib/automation/conditions"
import { runAutomations } from "@/lib/automation/engine"
import type { AutomationCondition, AutomationConditionGroup, AutomationEntityType } from "@/lib/automation/types"
import { prisma } from "@/lib/db"
import { getTenantContext } from "@/lib/tenant"
import { testAutomationRuleSchema } from "@/lib/validations/automation"

type RouteContext = { params: Promise<{ id: string }> }

function samplePayloadForTrigger(trigger: string): Record<string, Prisma.JsonValue> {
  const common = {
    title: "Test automatisation",
    firstName: "Client",
    lastName: "Test",
    fullName: "Client Test",
  }

  if (trigger === "LEAD_STATUS_CHANGED") {
    return { ...common, oldStatus: "NEW", newStatus: "PROPOSAL_SENT", status: "PROPOSAL_SENT", source: "MANUAL" }
  }

  if (trigger === "CLIENT_CREATED") {
    return { ...common, status: "ACTIVE", source: "CRM" }
  }

  if (trigger === "DOCUMENT_CREATED") {
    return { ...common, status: "REQUIRED", type: "IDENTITY", documentName: "Preuve d'identite" }
  }

  if (trigger === "DOCUMENT_STATUS_CHANGED") {
    return { ...common, oldStatus: "RECEIVED", newStatus: "REJECTED", status: "REJECTED", type: "IDENTITY", documentName: "Preuve d'identite" }
  }

  if (trigger === "TASK_COMPLETED") {
    return { ...common, status: "DONE", taskTitle: "Suivi client termine" }
  }

  if (trigger.includes("CALL")) {
    return {
      ...common,
      status: "RINGING",
      source: "INBOUND_CALL",
      phone: "+15145550000",
      fromNumber: "+15145550000",
      toNumber: "+15145550123",
      callSid: `test-call-${Date.now()}`,
    }
  }

  return { ...common, status: "NEW", source: "MANUAL" }
}

function entityTypeForTrigger(trigger: string): AutomationEntityType {
  if (trigger.startsWith("DOCUMENT_")) return "document"
  if (trigger.startsWith("CLIENT_")) return "client"
  if (trigger.startsWith("TASK_")) return "task"
  if (trigger.includes("CALL")) return "call"
  return "lead"
}

function setPayloadValue(payload: Record<string, Prisma.JsonValue>, field: string, value: Prisma.JsonValue) {
  const parts = field.split(".")
  let current = payload

  for (const part of parts.slice(0, -1)) {
    const existing = current[part]
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {}
    }
    current = current[part] as Record<string, Prisma.JsonValue>
  }

  current[parts[parts.length - 1] ?? field] = value
}

function applyConditionDefault(payload: Record<string, Prisma.JsonValue>, condition: AutomationCondition) {
  if (condition.operator === "equals" && condition.value !== undefined) {
    setPayloadValue(payload, condition.field, condition.value)
  }

  if (condition.operator === "in" && Array.isArray(condition.value) && condition.value.length > 0) {
    setPayloadValue(payload, condition.field, condition.value[0] ?? null)
  }

  if (condition.operator === "exists") {
    setPayloadValue(payload, condition.field, true)
  }
}

function applyConditionDefaults(payload: Record<string, Prisma.JsonValue>, conditions: AutomationCondition[] | AutomationConditionGroup) {
  if (Array.isArray(conditions)) {
    conditions.forEach((condition) => applyConditionDefault(payload, condition))
    return
  }

  conditions.all?.forEach((condition) => applyConditionDefault(payload, condition))
  if (conditions.any?.[0]) applyConditionDefault(payload, conditions.any[0])
}

async function resolveTestLead({
  organizationId,
  userId,
  payload,
}: {
  organizationId: string
  userId: string | null
  payload: Record<string, Prisma.JsonValue>
}) {
  const lead = await prisma.lead.findFirst({
    where: {
      organizationId,
      firstName: "Test",
      lastName: "Automatisation",
    },
    orderBy: { createdAt: "desc" },
  }) ?? await prisma.lead.create({
    data: {
      organizationId,
      advisorId: userId,
      firstName: "Test",
      lastName: "Automatisation",
      phone: "+15145550000",
      email: "test-automatisation@finadvisor.local",
      status: "NEW",
      source: "MANUAL",
      notes: "Prospect technique utilisé pour tester les automatisations.",
    },
  })

  payload.firstName = lead.firstName
  payload.lastName = lead.lastName
  payload.fullName = `${lead.firstName} ${lead.lastName}`
  payload.phone = lead.phone
  payload.email = lead.email
  payload.status = payload.status ?? lead.status
  payload.source = payload.source ?? lead.source
  payload.advisorId = lead.advisorId

  return lead
}

async function resolveTestClient({
  organizationId,
  userId,
  payload,
}: {
  organizationId: string
  userId: string | null
  payload: Record<string, Prisma.JsonValue>
}) {
  const client = await prisma.client.findFirst({
    where: {
      organizationId,
      firstName: "Test",
      lastName: "Automatisation",
    },
    orderBy: { createdAt: "desc" },
  }) ?? await prisma.client.create({
    data: {
      organizationId,
      advisorId: userId,
      firstName: "Test",
      lastName: "Automatisation",
      phone: "+15145550001",
      email: "client-test-automatisation@finadvisor.local",
      status: "ACTIVE",
      notes: "Client technique utilisé pour tester les automatisations.",
    },
  })

  payload.firstName = client.firstName
  payload.lastName = client.lastName
  payload.fullName = `${client.firstName} ${client.lastName}`
  payload.phone = client.phone
  payload.email = client.email
  payload.status = payload.status ?? client.status
  payload.advisorId = client.advisorId

  return client
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const payload = testAutomationRuleSchema.parse(await request.json())
    const rule = await prisma.automationRule.findFirst({ where: { id, organizationId } })
    if (!rule) return fail("NOT_FOUND", "Automatisation introuvable.", 404)

    const testPayload = {
      ...samplePayloadForTrigger(rule.trigger),
      ...((payload.payload ?? {}) as Record<string, Prisma.JsonValue>),
    }
    applyConditionDefaults(testPayload, parseConditions(rule.conditions ?? []))

    let leadId = payload.leadId
    let clientId = payload.clientId
    let entityId = payload.entityId ?? id
    const entityType = (payload.entityType ?? entityTypeForTrigger(rule.trigger)) as AutomationEntityType

    if (!leadId && (entityType === "lead" || rule.trigger.startsWith("LEAD_"))) {
      const lead = await resolveTestLead({ organizationId, userId, payload: testPayload })
      leadId = lead.id
      entityId = lead.id
    }

    if (!clientId && (entityType === "client" || rule.trigger.startsWith("CLIENT_"))) {
      const client = await resolveTestClient({ organizationId, userId, payload: testPayload })
      clientId = client.id
      entityId = client.id
    }

    const result = await runAutomations({
      organizationId,
      userId,
      trigger: rule.trigger,
      entityType,
      entityId,
      leadId,
      clientId,
      payload: testPayload,
    })

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
