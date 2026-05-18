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

export function buildLeadContext(input: unknown) {
  const lead = asRecord(input)
  return {
    id: lead.id,
    name: `${text(lead.firstName)} ${text(lead.lastName)}`.trim(),
    source: lead.source,
    status: lead.status,
    priority: lead.priority,
    interestType: lead.interestType,
    nextAction: lead.nextAction,
    createdAt: lead.createdAt,
    lastContactAt: lead.lastContactAt,
    notes: text(lead.notes).slice(0, 600),
    openTasks: asArray(lead.tasks).filter((task) => task.status !== "DONE").slice(0, 10).map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    })),
    documents: asArray(lead.documents).slice(0, 8).map((document) => ({
      name: document.name,
      type: document.type,
      status: document.status,
    })),
    notesList: asArray(lead.noteItems).slice(0, 5).map((note) => ({
      title: note.title,
      content: text(note.content).slice(0, 500),
      type: note.type,
    })),
  }
}
