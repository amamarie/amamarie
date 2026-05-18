import { z } from "zod"

export const transcribeCallSchema = z.object({
  language: z.enum(["fr", "en"]).default("fr"),
})

export const updateTranscriptionSchema = z.object({
  editedTranscript: z.string().max(100000).optional(),
})

export const selectedTranscriptionTaskSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().max(600).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueInDays: z.coerce.number().int().min(0).max(30).default(2),
})

export const approveTranscriptionSchema = z.object({
  editedTranscript: z.string().max(100000).optional(),
  noteContent: z.string().trim().min(3).max(20000),
  createTasks: z.boolean().default(true),
  selectedTasks: z.array(selectedTranscriptionTaskSchema).default([]),
})

export const retryTranscriptionSchema = transcribeCallSchema

export const twilioRecordingStatusSchema = z.object({
  CallSid: z.string().min(1),
  RecordingSid: z.string().optional(),
  RecordingUrl: z.string().optional(),
  RecordingDuration: z.string().optional(),
  RecordingStatus: z.string().optional(),
})
