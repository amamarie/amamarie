import { runAI } from "@/lib/ai/core/run-ai"
import { aiCallSummaryOutputSchema } from "@/lib/ai/schemas/ai-output"

import { buildCallSummaryFallback } from "./fallbacks"

export async function summarizeCall({ organizationId, userId, note }: { organizationId: string; userId: string; note: string }) {
  return runAI({
    organizationId,
    userId,
    feature: "call-summary",
    prompt: "Transforme cette note brute d’appel en résumé structuré administratif. Ne donne aucun conseil financier. Retourne le JSON demandé.",
    schema: aiCallSummaryOutputSchema,
    context: { note },
    fallback: () => buildCallSummaryFallback(note),
  })
}
