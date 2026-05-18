import { z } from "zod"

import { FINADVISOR_AI_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import { validateAIOutput } from "@/lib/ai/safety/validator"

import { getAICache, setAICache, createAIHash } from "./cache"
import { getAiClient } from "./client"
import { AI_CONFIG } from "./config"
import { logAIUsage } from "./logger"
import { enforceAIRateLimit } from "./rate-limit"

export async function runAI<T>({
  organizationId,
  userId,
  feature,
  prompt,
  system = FINADVISOR_AI_SYSTEM_PROMPT,
  schema,
  context,
  fallback,
}: {
  organizationId: string
  userId: string
  feature: string
  prompt: string
  system?: string
  schema: z.ZodType<T>
  context: unknown
  fallback: () => T
}) {
  const inputHash = createAIHash({ feature, prompt, system, context, schema: schema.description })
  const cacheKey = `${feature}:${organizationId}:${userId}:${inputHash}`
  const cached = getAICache<T>(cacheKey)
  if (cached) {
    await logAIUsage({ organizationId, userId, feature, model: AI_CONFIG.model, status: "CACHED", inputHash })
    return cached
  }

  enforceAIRateLimit(userId)

  const client = getAiClient()
  let parsed: T

  if (!client) {
    parsed = schema.parse(fallback())
  } else {
    try {
      const response = await client.chat.completions.create({
        model: AI_CONFIG.model,
        temperature: AI_CONFIG.temperature,
        max_tokens: AI_CONFIG.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${prompt}\n\nContexte JSON:\n${JSON.stringify(context)}` },
        ],
      })

      const content = response.choices[0]?.message?.content ?? "{}"
      parsed = schema.parse(JSON.parse(content))
    } catch (error) {
      await logAIUsage({
        organizationId,
        userId,
        feature,
        model: AI_CONFIG.model,
        status: "FAILED",
        inputHash,
        error: error instanceof Error ? error.message : "Erreur IA inconnue",
      })
      parsed = schema.parse(fallback())
    }
  }

  const safety = validateAIOutput(parsed)
  if (!safety.ok) throw new Error(safety.reason ?? "Sortie IA refusée.")

  setAICache(cacheKey, parsed)
  await logAIUsage({ organizationId, userId, feature, model: client ? AI_CONFIG.model : "local-safe-fallback", status: "SUCCESS", inputHash })
  return parsed
}
