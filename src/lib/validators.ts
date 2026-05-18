import { z } from "zod"

export {
  createLeadSchema as leadCreateSchema,
  leadSourceSchema,
  leadStatusSchema,
  prioritySchema,
  updateLeadSchema as leadUpdateSchema,
} from "@/lib/validations/lead"
export {
  clientStatusSchema,
  createClientSchema as clientCreateSchema,
  updateClientSchema as clientUpdateSchema,
} from "@/lib/validations/client"
export {
  createTaskSchema as taskCreateSchema,
  taskStatusSchema,
  updateTaskSchema as taskUpdateSchema,
} from "@/lib/validations/task"
export {
  createNoteSchema as noteCreateSchema,
  noteQuerySchema,
  noteStatusSchema,
  noteTypeSchema,
  noteVisibilitySchema,
  updateNoteSchema as noteUpdateSchema,
} from "@/lib/validations/note"
export {
  createDocumentSchema as documentCreateSchema,
  documentQuerySchema,
  documentStatusSchema,
  documentTypeSchema,
  documentVisibilitySchema,
  rejectDocumentSchema,
  updateDocumentSchema as documentUpdateSchema,
  updateDocumentStatusSchema,
  waiveDocumentSchema,
} from "@/lib/validations/document"
export {
  commissionTypeSchema,
  createFinancialProductSchema as financialProductCreateSchema,
  financialProductCategorySchema,
  financialProductFiltersSchema,
  financialProductStatusSchema,
  financialProductTypeSchema as productTypeSchema,
  paymentFrequencySchema,
  updateFinancialProductSchema as financialProductUpdateSchema,
} from "@/lib/validations/financial-product"

export const activityTypeSchema = z.enum([
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "LEAD_CONVERTED",
  "CLIENT_CREATED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "CALL_RECEIVED",
  "SMS_SENT",
  "EMAIL_SENT",
  "DOCUMENT_ADDED",
  "NOTE_ADDED",
  "AUTOMATION_EXECUTED",
])

export const activityCreateSchema = z.object({
  userId: z.string().optional(),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  type: activityTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
})

export const notificationTypeSchema = z.enum(["INFO", "SUCCESS", "WARNING", "ALERT"])

export const notificationCreateSchema = z.object({
  userId: z.string().optional(),
  type: notificationTypeSchema.default("INFO"),
  title: z.string().min(1),
  message: z.string().optional(),
  href: z.string().optional(),
})

export const automationRuleCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().min(1),
  conditions: z.unknown().optional(),
  actions: z.unknown(),
  isActive: z.boolean().default(true),
})
