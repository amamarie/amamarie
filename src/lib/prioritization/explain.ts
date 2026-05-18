import type { PriorityCandidate } from "./types"

export function explainPriorityItem(candidate: PriorityCandidate) {
  return {
    reason: candidate.reason,
    suggestedAction: candidate.suggestedAction,
    shortLabel: candidate.title,
  }
}
