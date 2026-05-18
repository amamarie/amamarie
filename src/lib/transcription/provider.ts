import type { TranscriptionAudioInput, TranscriptionResult } from "./types"

export interface TranscriptionProviderAdapter {
  transcribeAudio(input: TranscriptionAudioInput): Promise<TranscriptionResult>
}
