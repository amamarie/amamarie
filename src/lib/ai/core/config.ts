export const AI_CONFIG = {
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  temperature: 0.25,
  maxTokens: 900,
  promptVersion: "ai-core-v1",
} as const

export const AI_LIMITS = {
  perMinutePerUser: 10,
  perDayPerUser: 100,
} as const
