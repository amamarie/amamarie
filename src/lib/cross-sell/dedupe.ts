import type { CrossSellCandidate } from "@/lib/cross-sell/types"

export function crossSellDedupeKey(candidate: Pick<CrossSellCandidate, "ruleKey" | "relatedProductId" | "relatedProductType">) {
  return `${candidate.ruleKey}:${candidate.relatedProductType ?? "client"}:${candidate.relatedProductId ?? "none"}`
}

export function dedupeCrossSell(candidates: CrossSellCandidate[]) {
  const map = new Map<string, CrossSellCandidate>()

  for (const candidate of candidates) {
    const key = crossSellDedupeKey(candidate)
    const existing = map.get(key)
    if (!existing || (candidate.score ?? 0) > (existing.score ?? 0)) {
      map.set(key, candidate)
    }
  }

  return [...map.values()]
}
