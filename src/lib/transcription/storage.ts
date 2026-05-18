export function getTranscriptionMaxBytes() {
  const mb = Number.parseInt(process.env.TRANSCRIPTION_MAX_FILE_MB ?? "25", 10)
  return Math.max(1, mb) * 1024 * 1024
}

export function assertAudioSize(size: number) {
  if (size > getTranscriptionMaxBytes()) throw new Error("AUDIO_FILE_TOO_LARGE")
}
