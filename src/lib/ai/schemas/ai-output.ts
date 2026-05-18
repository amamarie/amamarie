import { z } from "zod"

export const aiActionSchema = z.object({
  label: z.string().min(2).max(160),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  type: z.enum(["CREATE_TASK", "ADD_NOTE", "REQUEST_DOCUMENT", "SCHEDULE_CALL", "SCHEDULE_MEETING", "REVIEW_FILE"]).default("CREATE_TASK"),
  rationale: z.string().max(300).optional(),
})

export const aiSummaryOutputSchema = z.object({
  summary: z.string().min(10).max(1800),
  keyPoints: z.array(z.string().min(2).max(220)).default([]),
  risks: z.array(z.string().min(2).max(220)).default([]),
  missingData: z.array(z.string().min(2).max(220)).default([]),
  suggestedNextSteps: z.array(z.string().min(2).max(220)).default([]),
  disclaimer: z.string().min(20),
})

export const aiCallSummaryOutputSchema = z.object({
  summary: z.string().min(10).max(1200),
  needs: z.array(z.string().min(2).max(220)).default([]),
  questions: z.array(z.string().min(2).max(220)).default([]),
  nextSteps: z.array(z.string().min(2).max(220)).default([]),
  followUpSuggestion: z.string().max(400).default(""),
  disclaimer: z.string().min(20),
})

export const aiActionsOutputSchema = z.object({
  actions: z.array(aiActionSchema).min(1).max(8),
  missingData: z.array(z.string().min(2).max(220)).default([]),
  rationale: z.string().max(900).default(""),
  disclaimer: z.string().min(20),
})

export const aiMessageOutputSchema = z.object({
  draft: z.string().min(10).max(1400),
  validationRequired: z.literal(true),
  warnings: z.array(z.string().max(220)).default([]),
  disclaimer: z.string().min(20),
})

export const aiMeetingPrepOutputSchema = z.object({
  summary: z.string().min(10).max(1200),
  topics: z.array(z.string().min(2).max(220)).default([]),
  questions: z.array(z.string().min(2).max(220)).default([]),
  documentsToCheck: z.array(z.string().min(2).max(220)).default([]),
  suggestedActions: z.array(aiActionSchema).default([]),
  disclaimer: z.string().min(20),
})

export type AiSummaryOutput = z.infer<typeof aiSummaryOutputSchema>
export type AiCallSummaryOutput = z.infer<typeof aiCallSummaryOutputSchema>
export type AiActionsOutput = z.infer<typeof aiActionsOutputSchema>
export type AiMessageOutput = z.infer<typeof aiMessageOutputSchema>
export type AiMeetingPrepOutput = z.infer<typeof aiMeetingPrepOutputSchema>
