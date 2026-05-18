import { Prisma } from "@prisma/client"

import type { AutomationCondition, AutomationConditionGroup, AutomationPayload } from "@/lib/automation/types"

function getPayloadValue(payload: AutomationPayload, field: string) {
  return field.split(".").reduce<Prisma.JsonValue | undefined>((value, key) => {
    if (value && typeof value === "object" && !Array.isArray(value) && key in value) {
      return (value as Record<string, Prisma.JsonValue>)[key]
    }

    return undefined
  }, payload)
}

export function parseConditions(value: Prisma.JsonValue): AutomationCondition[] | AutomationConditionGroup {
  if (value === null || value === undefined) return []

  if (typeof value === "object" && !Array.isArray(value)) {
    const group = value as { all?: unknown; any?: unknown }
    return {
      all: Array.isArray(group.all) ? parseConditions(group.all) as AutomationCondition[] : undefined,
      any: Array.isArray(group.any) ? parseConditions(group.any) as AutomationCondition[] : undefined,
    }
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((condition): condition is AutomationCondition => {
    return (
      typeof condition === "object" &&
      condition !== null &&
      !Array.isArray(condition) &&
      typeof condition.field === "string" &&
      typeof condition.operator === "string"
    )
  })
}

export function conditionsMatch(
  conditions: AutomationCondition[] | AutomationConditionGroup,
  payload: AutomationPayload
) {
  if (!Array.isArray(conditions)) {
    const all = conditions.all?.length ? conditions.all.every((condition) => evaluateCondition(condition, payload)) : true
    const any = conditions.any?.length ? conditions.any.some((condition) => evaluateCondition(condition, payload)) : true
    return all && any
  }

  return conditions.every((condition) => evaluateCondition(condition, payload))
}

function toComparable(value: Prisma.JsonValue | undefined) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const number = Number(value)
    if (!Number.isNaN(number) && value.trim() !== "") return number
    const date = Date.parse(value)
    if (!Number.isNaN(date)) return date
  }
  return undefined
}

function evaluateCondition(condition: AutomationCondition, payload: AutomationPayload) {
    const currentValue = getPayloadValue(payload, condition.field)

    if (condition.operator === "exists") {
      return currentValue !== undefined && currentValue !== null && currentValue !== ""
    }

    if (condition.operator === "not_exists") {
      return currentValue === undefined || currentValue === null || currentValue === ""
    }

    if (condition.operator === "equals") {
      return currentValue === condition.value
    }

    if (condition.operator === "not_equals") {
      return currentValue !== condition.value
    }

    if (condition.operator === "in") {
      return Array.isArray(condition.value) && condition.value.includes(currentValue ?? null)
    }

    if (condition.operator === "not_in") {
      return Array.isArray(condition.value) && !condition.value.includes(currentValue ?? null)
    }

    if (["greater_than", "less_than", "greater_or_equal", "less_or_equal"].includes(condition.operator)) {
      const left = toComparable(currentValue)
      const right = toComparable(condition.value)
      if (left === undefined || right === undefined) return false
      if (condition.operator === "greater_than") return left > right
      if (condition.operator === "less_than") return left < right
      if (condition.operator === "greater_or_equal") return left >= right
      return left <= right
    }

    if (["contains", "starts_with", "ends_with"].includes(condition.operator)) {
      const left = String(currentValue ?? "").toLowerCase()
      const right = String(condition.value ?? "").toLowerCase()
      if (condition.operator === "contains") return left.includes(right)
      if (condition.operator === "starts_with") return left.startsWith(right)
      return left.endsWith(right)
    }

    if (condition.operator === "days_since_greater_than") {
      const date = Date.parse(String(currentValue ?? ""))
      const days = Number(condition.value)
      if (Number.isNaN(date) || Number.isNaN(days)) return false
      return (Date.now() - date) / 86_400_000 > days
    }

    if (condition.operator === "date_before" || condition.operator === "date_after") {
      const left = Date.parse(String(currentValue ?? ""))
      const right = Date.parse(String(condition.value ?? ""))
      if (Number.isNaN(left) || Number.isNaN(right)) return false
      return condition.operator === "date_before" ? left < right : left > right
    }

    return false
}
