import { z } from "zod"

export const complianceAlertSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
export const complianceAlertStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED", "ARCHIVED"])

export const dismissComplianceAlertSchema = z.object({
  dismissReason: z.string().trim().min(1, "La raison est requise."),
})

export const createComplianceAlertSchema = z.object({
  type: z.string().min(1),
  severity: complianceAlertSeveritySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  actionLabel: z.string().optional(),
  actionUrl: z.string().optional(),
})
