import { validateAIOutput } from "@/lib/ai/safety/validator"

export function validateTranscriptionSummarySafety(output: unknown) {
  return validateAIOutput(output)
}
