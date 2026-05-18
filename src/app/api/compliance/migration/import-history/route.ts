import type { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const [clients, documents, notes, tasks] = await Promise.all([
      prisma.client.findMany({ where: { organizationId }, select: { id: true, firstName: true, lastName: true, createdAt: true }, take: 1000 }),
      prisma.document.findMany({ where: { organizationId }, select: { id: true, clientId: true, name: true, status: true, createdAt: true }, take: 1000 }),
      prisma.note.findMany({ where: { organizationId }, select: { id: true, clientId: true, title: true, type: true, createdAt: true }, take: 1000 }),
      prisma.task.findMany({ where: { organizationId }, select: { id: true, clientId: true, title: true, status: true, createdAt: true }, take: 1000 }),
    ])
    let created = 0
    async function ensureHistoricalLog(input: { entityType: string; entityId: string; clientId?: string | null; action: string; newValue: Prisma.InputJsonObject }) {
      const exists = await prisma.auditLog.findFirst({
        where: { organizationId, entityType: input.entityType, entityId: input.entityId, action: input.action },
        select: { id: true },
      })
      if (exists) return
      await createAuditLog({
        organizationId,
        userId,
        clientId: input.clientId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        newValue: input.newValue,
        source: "historical_import",
        sensitivityLevel: "MEDIUM",
        reason: "Migration structurée des dossiers historiques.",
        metadata: { importedAt: new Date().toISOString(), historical: true },
        request,
      })
      created += 1
    }
    for (const client of clients) {
      await ensureHistoricalLog({ entityType: "Client", entityId: client.id, clientId: client.id, action: "HISTORICAL_CLIENT_IMPORTED", newValue: { name: `${client.firstName} ${client.lastName}`, originalCreatedAt: client.createdAt.toISOString() } })
    }
    for (const document of documents) {
      await ensureHistoricalLog({ entityType: "Document", entityId: document.id, clientId: document.clientId, action: "HISTORICAL_DOCUMENT_IMPORTED", newValue: { name: document.name, status: document.status, originalCreatedAt: document.createdAt.toISOString() } })
    }
    for (const note of notes) {
      await ensureHistoricalLog({ entityType: "Note", entityId: note.id, clientId: note.clientId, action: "HISTORICAL_NOTE_IMPORTED", newValue: { title: note.title, type: note.type, originalCreatedAt: note.createdAt.toISOString() } })
    }
    for (const task of tasks) {
      await ensureHistoricalLog({ entityType: "Task", entityId: task.id, clientId: task.clientId, action: "HISTORICAL_TASK_IMPORTED", newValue: { title: task.title, status: task.status, originalCreatedAt: task.createdAt.toISOString() } })
    }
    return ok({ created, scanned: { clients: clients.length, documents: documents.length, notes: notes.length, tasks: tasks.length } })
  } catch (error) {
    return handleApiError(error)
  }
}
