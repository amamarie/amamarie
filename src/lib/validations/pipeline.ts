import { z } from "zod"

import { leadSourceSchema, leadStatusSchema, prioritySchema } from "@/lib/validations/lead"

const booleanParam = z.preprocess((value) => {
  if (value === "true") return true
  if (value === "false") return false
  return value
}, z.boolean().optional())

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
)

export const pipelineQuerySchema = z.object({
  advisorId: optionalText,
  source: leadSourceSchema.optional(),
  priority: prioritySchema.optional(),
  search: z.string().trim().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  includeLost: booleanParam.default(false),
  includeArchived: booleanParam.default(false),
})

export const updateLeadStatusSchema = z
  .object({
    status: leadStatusSchema,
    lostReason: z.string().trim().optional(),
    lostNote: z.string().trim().optional(),
    archiveReason: z.string().trim().optional(),
    nextAction: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "LOST" && !value.lostReason) {
      context.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: "La raison de perte est requise.",
      })
    }
  })

export const lostLeadSchema = z.object({
  status: z.literal("LOST"),
  lostReason: z.string().trim().min(2, "La raison de perte est requise."),
  lostNote: z.string().trim().optional(),
  nextAction: z.string().trim().optional(),
})

export type PipelineQueryInput = z.infer<typeof pipelineQuerySchema>
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>
