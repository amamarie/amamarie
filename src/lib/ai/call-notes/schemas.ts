import { z } from "zod"

export const callNoteTaskSchema = z.object({
  title: z.string().min(2).max(180),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueInDays: z.coerce.number().int().min(0).max(30).default(2),
})

export const callNoteSchema = z.object({
  summary: z.string().min(10).max(1600),
  needs: z.array(z.string().min(2).max(220)).default([]),
  context: z.array(z.string().min(2).max(220)).default([]),
  objections: z.array(z.string().min(2).max(220)).default([]),
  nextSteps: z.array(z.string().min(2).max(220)).default([]),
  tasks: z.array(callNoteTaskSchema).max(6).default([]),
  followUpDate: z.string().nullable().default(null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  disclaimer: z.string().min(20),
})

export type CallNoteOutput = z.infer<typeof callNoteSchema>
