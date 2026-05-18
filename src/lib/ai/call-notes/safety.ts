import { validateAIOutput } from "@/lib/ai/safety/validator"

import type { CallNoteOutput } from "./schemas"

export function validateCallNoteSafety(note: CallNoteOutput) {
  return validateAIOutput(note)
}
