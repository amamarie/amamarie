import { AutomationActionType, AutomationTrigger } from "@prisma/client"
import { z } from "zod"

export const automationTriggerSchema = z.nativeEnum(AutomationTrigger)
export const automationActionTypeSchema = z.nativeEnum(AutomationActionType)

const conditionSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "exists",
    "not_exists",
    "in",
    "not_in",
    "greater_than",
    "less_than",
    "greater_or_equal",
    "less_or_equal",
    "contains",
    "starts_with",
    "ends_with",
    "days_since_greater_than",
    "date_before",
    "date_after",
  ]),
  value: z.unknown().optional(),
})

export const automationConditionsSchema = z
  .union([
    z.array(conditionSchema),
    z.object({
      all: z.array(conditionSchema).optional(),
      any: z.array(conditionSchema).optional(),
    }),
  ])
  .optional()

export const automationActionSchema = z
  .object({
    type: automationActionTypeSchema,
    params: z.record(z.string(), z.unknown()).optional(),
    title: z.string().trim().optional(),
    message: z.string().trim().optional(),
    template: z.string().trim().optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    dueInDays: z.coerce.number().positive().optional(),
    dueInHours: z.coerce.number().positive().optional(),
  })
  .superRefine((action, context) => {
    const dueInHours = action.params?.dueInHours
    if (dueInHours !== undefined && Number(dueInHours) <= 0) {
      context.addIssue({ code: "custom", path: ["params", "dueInHours"], message: "Le délai doit être positif." })
    }

    if ((action.type === "SEND_MOCK_SMS" || action.type === "SEND_MOCK_EMAIL") && !action.template && !action.message && !action.params?.template && !action.params?.message) {
      context.addIssue({ code: "custom", path: ["template"], message: "Un modèle est requis pour un SMS ou courriel fictif." })
    }
  })

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis."),
  description: z.string().trim().optional(),
  trigger: automationTriggerSchema,
  conditions: automationConditionsSchema,
  actions: z.array(automationActionSchema).min(1, "Au moins une action est requise."),
  isActive: z.boolean().default(true),
})

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial().extend({
  actions: z.array(automationActionSchema).min(1, "Au moins une action est requise.").optional(),
})

export const testAutomationRuleSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
})

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>
