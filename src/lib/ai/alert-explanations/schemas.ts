import { z } from "zod"

export const aiAlertActionSchema = z.object({
  label: z.string().min(3),
  type: z.enum([
    "CREATE_TASK",
    "CREATE_NOTE",
    "REQUEST_DOCUMENT",
    "SCHEDULE_REVIEW",
    "UPDATE_CLIENT_FIELD",
    "UPDATE_PRODUCT_FIELD",
    "MARK_ALERT_REVIEWED",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
})

export const aiAlertExplanationOutputSchema = z.object({
  summary: z.string().min(8),
  whyItTriggered: z.string().min(12),
  clientContext: z.string().optional(),
  missingData: z.array(z.string()).default([]),
  suggestedActions: z.array(aiAlertActionSchema).default([]),
  advisorNoteDraft: z.string().optional(),
  clientMessageDraft: z.string().optional(),
  riskLevelExplanation: z.string().optional(),
  complianceDisclaimer: z
    .string()
    .min(10)
    .refine((value) => value.toLowerCase().includes("ne remplace pas"), {
      message: "Le rappel de prudence est obligatoire.",
    }),
})

export type AiAlertExplanationOutput = z.infer<typeof aiAlertExplanationOutputSchema>
