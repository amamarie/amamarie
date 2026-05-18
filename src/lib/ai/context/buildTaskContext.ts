export function buildTaskContext(input: unknown) {
  const task = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    type: task.type,
    dueDate: task.dueDate,
    clientId: task.clientId,
    leadId: task.leadId,
  }
}
