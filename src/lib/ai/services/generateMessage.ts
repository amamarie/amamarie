import { runAI } from "@/lib/ai/core/run-ai"
import { aiMessageOutputSchema } from "@/lib/ai/schemas/ai-output"

import { buildMessageFallback } from "./fallbacks"

export async function generateMessage({
  organizationId,
  userId,
  context,
  clientName,
  tone,
}: {
  organizationId: string
  userId: string
  context: string
  clientName?: string
  tone?: string
}) {
  const safeContext = { context, clientName, tone: tone ?? "professional" }
  return runAI({
    organizationId,
    userId,
    feature: "message-generator",
    prompt: "Prépare un brouillon de message administratif. Validation humaine obligatoire. Aucun conseil financier, aucune promesse, aucune pression commerciale. Retourne le JSON demandé.",
    schema: aiMessageOutputSchema,
    context: safeContext,
    fallback: () => buildMessageFallback(safeContext),
  })
}
