import type { RecommendationCandidate } from "@/lib/recommendations/types"

export function recommendationDedupeKey(candidate: Pick<RecommendationCandidate, "ruleKey" | "relatedProductId">) {
  return `${candidate.ruleKey}:${candidate.relatedProductId ?? "client"}`
}

export function dedupeRecommendations(candidates: RecommendationCandidate[]) {
  const map = new Map<string, RecommendationCandidate>()

  candidates.forEach((candidate) => {
    map.set(recommendationDedupeKey(candidate), candidate)
  })

  return Array.from(map.values())
}
