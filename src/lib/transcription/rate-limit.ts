const hits = new Map<string, number[]>()

function prune(values: number[], windowMs: number) {
  const cutoff = Date.now() - windowMs
  return values.filter((value) => value >= cutoff)
}

export function assertTranscriptionRateLimit({ organizationId, userId }: { organizationId: string; userId: string }) {
  const userKey = `user:${organizationId}:${userId}`
  const orgKey = `org:${organizationId}`
  const userHits = prune(hits.get(userKey) ?? [], 60 * 60 * 1000)
  const orgHits = prune(hits.get(orgKey) ?? [], 24 * 60 * 60 * 1000)

  if (userHits.length >= 5) throw new Error("TRANSCRIPTION_USER_RATE_LIMIT")
  if (orgHits.length >= 50) throw new Error("TRANSCRIPTION_ORG_RATE_LIMIT")

  userHits.push(Date.now())
  orgHits.push(Date.now())
  hits.set(userKey, userHits)
  hits.set(orgKey, orgHits)
}
