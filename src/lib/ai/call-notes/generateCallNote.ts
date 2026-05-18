import { AI_COMPLIANCE_DISCLAIMER } from "@/lib/ai/prompts/system"
import { runAI } from "@/lib/ai/core/run-ai"

import { buildCallContext } from "./context"
import { callNotePrompt } from "./prompts"
import { callNoteSchema, type CallNoteOutput } from "./schemas"
import { validateCallNoteSafety } from "./safety"

function fallbackCallNote(rawText: string): CallNoteOutput {
  return {
    summary: rawText.trim().slice(0, 1000) || "Appel à documenter.",
    needs: ["Besoin exprimé à clarifier"],
    context: ["Contexte à valider avec le client ou prospect"],
    objections: [],
    nextSteps: ["Créer une tâche de suivi", "Valider les informations du dossier"],
    tasks: [{ title: "Faire le suivi après l’appel", priority: "HIGH", dueInDays: 2 }],
    followUpDate: null,
    priority: "HIGH",
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export async function generateCallNote({
  organizationId,
  userId,
  rawNote,
  transcript,
  client,
  lead,
  previousNotes,
  callMetadata,
}: {
  organizationId: string
  userId: string
  rawNote?: string
  transcript?: string
  client?: unknown
  lead?: unknown
  previousNotes?: unknown[]
  callMetadata?: unknown
}) {
  const sourceText = transcript || rawNote || ""
  const context = buildCallContext({ client, lead, previousNotes, callMetadata })
  const result = await runAI({
    organizationId,
    userId,
    feature: "call-note",
    system: callNotePrompt,
    prompt: `Transforme ce contenu d’appel en note structurée administrative.\n\nContenu:\n${sourceText}`,
    schema: callNoteSchema,
    context,
    fallback: () => fallbackCallNote(sourceText),
  })

  const safety = validateCallNoteSafety(result)
  if (!safety.ok) throw new Error(safety.reason ?? "Note d’appel refusée par sécurité.")
  return result
}
