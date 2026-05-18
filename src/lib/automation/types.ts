import type { AutomationActionType, AutomationTrigger, Prisma } from "@prisma/client"

export type { AutomationActionType, AutomationTrigger }

export type AutomationEntityType = "lead" | "client" | "task" | "document" | "product" | "note" | "alert" | "kyc" | "automation" | "call"

export type AutomationPayload = Record<string, Prisma.JsonValue | undefined>

export type AutomationAction = {
  type?: AutomationActionType
  params?: Record<string, Prisma.JsonValue | undefined>
  title?: string
  message?: string
  template?: string
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  dueInDays?: number
  dueInHours?: number
  assignTo?: "advisor" | "currentUser"
}

export type AutomationCondition = {
  field: string
  operator:
    | "equals"
    | "not_equals"
    | "exists"
    | "not_exists"
    | "in"
    | "not_in"
    | "greater_than"
    | "less_than"
    | "greater_or_equal"
    | "less_or_equal"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "days_since_greater_than"
    | "date_before"
    | "date_after"
  value?: Prisma.JsonValue
}

export type AutomationConditionGroup = {
  all?: AutomationCondition[]
  any?: AutomationCondition[]
}

export type RunAutomationsInput = {
  organizationId: string
  userId?: string | null
  trigger: AutomationTrigger
  entityType: AutomationEntityType
  entityId?: string | null
  leadId?: string | null
  clientId?: string | null
  automationRuleId?: string | null
  payload?: AutomationPayload
}
