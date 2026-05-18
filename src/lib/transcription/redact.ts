type TranscriptionLike = {
  audioUrl?: string | null
  audioStoragePath?: string | null
}

export function redactTranscription<T extends TranscriptionLike | null | undefined>(transcription: T) {
  if (!transcription) return transcription
  const safeTranscription = { ...transcription }
  delete safeTranscription.audioUrl
  delete safeTranscription.audioStoragePath
  return safeTranscription
}
