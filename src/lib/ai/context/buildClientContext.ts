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

export function buildClientContext(input: unknown) {
  const client = asRecord(input)
  return {
    id: client.id,
    name: `${text(client.firstName)} ${text(client.lastName)}`.trim(),
    ageKnown: Boolean(client.dateOfBirth),
    familyStatus: client.familyStatus,
    dependents: client.dependentsCount ?? client.dependents,
    occupation: client.occupation,
    incomeRange: client.incomeRange,
    status: client.status,
    riskProfile: client.riskProfile,
    primaryGoal: client.primaryGoal,
    investmentHorizon: client.investmentHorizon,
    kycCompleted: client.kycCompleted,
    complianceStatus: client.complianceStatus ?? asRecord(client.kycProfile).status,
    complianceScore: asRecord(client.kycProfile).complianceScore,
    lastContactAt: client.lastContactAt,
    nextReviewDate: client.nextReviewDate,
    products: asArray(client.products).slice(0, 12).map((product) => ({
      category: product.category,
      type: product.type,
      status: product.status,
      documentStatus: product.documentStatus,
      renewalAt: product.renewalAt,
      nextReviewAt: product.nextReviewAt,
      missingDocuments: product.missingDocuments,
    })),
    openTasks: asArray(client.tasks).filter((task) => task.status !== "DONE").slice(0, 10).map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      type: task.type,
    })),
    documents: asArray(client.documents).slice(0, 10).map((document) => ({
      name: document.name,
      type: document.type,
      status: document.status,
      expiresAt: document.expiresAt,
    })),
    alerts: asArray(client.complianceAlerts).slice(0, 8).map((alert) => ({
      title: alert.title,
      severity: alert.severity,
      status: alert.status,
    })),
    notes: asArray(client.noteItems).slice(0, 5).map((note) => ({
      title: note.title,
      content: text(note.content).slice(0, 500),
      type: note.type,
    })),
  }
}
