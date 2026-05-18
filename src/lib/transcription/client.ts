import { getAiClient } from "@/lib/ai/core/client"

import type { TranscriptionAudioInput, TranscriptionResult } from "./types"

const DEFAULT_PROMPT =
  "Conversation en français canadien entre un conseiller financier et un client. Termes possibles: assurance vie, invalidité, REER, CELI, bénéficiaire, prime, police, profil client, connaissance client, renouvellement."

export async function transcribeWithOpenAI({ file, language = "fr", prompt = DEFAULT_PROMPT }: TranscriptionAudioInput): Promise<TranscriptionResult> {
  const client = getAiClient()
  if (!client) throw new Error("OPENAI_NOT_CONFIGURED")

  const transcription = await client.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
    language,
    prompt,
  })

  return {
    text: transcription.text,
    provider: "OPENAI",
    language,
  }
}
