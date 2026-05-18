type LooseRecord = Record<string, unknown>

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {}
}

function asArray(value: unknown): LooseRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function buildCallContext({
  client,
  lead,
  previousNotes,
  callMetadata,
}: {
  client?: unknown
  lead?: unknown
  previousNotes?: unknown[]
  callMetadata?: unknown
}) {
  const person = asRecord(client ?? lead)
  return {
    entityType: client ? "client" : "lead",
    person: {
      id: person.id,
      name: `${text(person.firstName)} ${text(person.lastName)}`.trim(),
      status: person.status,
      priority: person.priority,
      source: person.source,
      interestType: person.interestType,
      riskProfile: person.riskProfile,
      primaryGoal: person.primaryGoal,
      kycCompleted: person.kycCompleted,
      lastContactAt: person.lastContactAt,
    },
    previousNotes: asArray(previousNotes).slice(0, 5).map((note) => ({
      title: note.title,
      content: text(note.content).slice(0, 500),
      type: note.type,
    })),
    callMetadata: asRecord(callMetadata),
  }
}
