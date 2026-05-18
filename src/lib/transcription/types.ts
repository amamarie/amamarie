export type TranscriptionResult = {
  text: string
  durationSeconds?: number
  provider: "OPENAI"
  language?: string
}

export type TranscriptionAudioInput = {
  file: File
  language?: "fr" | "en"
  prompt?: string
}
