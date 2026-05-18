import { z } from "zod"

export const transcriptionStatusSchema = z.enum(["NOT_STARTED", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "APPROVED", "ARCHIVED"])
export const transcriptionProviderSchema = z.enum(["OPENAI", "DEEPGRAM", "ASSEMBLYAI", "AWS", "MANUAL"])

export const structuredTranscriptionSchema = z.object({
  rawTranscript: z.string(),
  language: z.string().default("fr"),
  confidence: z.number().optional(),
  structuredNote: z.object({
    summary: z.string(),
    needs: z.array(z.string()).default([]),
    clientContext: z.array(z.string()).default([]),
    objections: z.array(z.string()).default([]),
    questions: z.array(z.string()).default([]),
    nextSteps: z.array(z.string()).default([]),
    suggestedTasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
      dueInDays: z.number().optional(),
    })).default([]),
    followUpSuggestion: z.string().optional(),
    missingData: z.array(z.string()).default([]),
    complianceFlags: z.array(z.string()).default([]),
  }),
})
