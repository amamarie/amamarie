import type { NoteStatus, NoteVisibility, Prisma, UserRole } from "@prisma/client"
import type { z } from "zod"

import { createAuditLog } from "@/lib/compliance/audit"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import type { createNoteSchema, noteQuerySchema, updateNoteSchema } from "@/lib/validations/note"

type CreateNoteInput = z.infer<typeof createNoteSchema>
type UpdateNoteInput = z.infer<typeof updateNoteSchema>
type NoteQueryInput = z.infer<typeof noteQuerySchema>
type NoteActivityType =
  | "NOTE_ADDED"
  | "NOTE_UPDATED"
  | "NOTE_PINNED"
  | "NOTE_UNPINNED"
  | "NOTE_ARCHIVED"
  | "NOTE_RESTORED"
  | "NOTE_DELETED"

type CurrentUser = {
  id: string
  organizationId: string
  role: UserRole
}

const noteInclude = {
  user: { select: { id: true, name: true, role: true } },
  lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
  client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
  task: { select: { id: true, title: true } },
  product: { select: { id: true, productName: true, type: true, company: true, clientId: true } },
} satisfies Prisma.NoteInclude

function canViewComplianceNotes(user: CurrentUser) {
  return user.role === "OWNER" || user.role === "COMPLIANCE"
}

function canEditComplianceNotes(user: CurrentUser) {
  return user.role === "OWNER" || user.role === "COMPLIANCE"
}

function assertCanAccessVisibility(user: CurrentUser, visibility?: NoteVisibility | null) {
  if (visibility === "COMPLIANCE_ONLY" && !canViewComplianceNotes(user)) {
    throw new Error("NOTE_FORBIDDEN")
  }
}

async function assertRelatedOwnership(organizationId: string, data: Partial<CreateNoteInput>) {
  const checks: Promise<unknown>[] = []

  if (data.leadId) checks.push(prisma.lead.findFirstOrThrow({ where: { id: data.leadId, organizationId }, select: { id: true } }))
  if (data.clientId) checks.push(prisma.client.findFirstOrThrow({ where: { id: data.clientId, organizationId }, select: { id: true } }))
  if (data.taskId) checks.push(prisma.task.findFirstOrThrow({ where: { id: data.taskId, organizationId }, select: { id: true } }))
  if (data.productId) checks.push(prisma.financialProduct.findFirstOrThrow({ where: { id: data.productId, organizationId }, select: { id: true } }))

  await Promise.all(checks)
}

function visibleWhere(user: CurrentUser): Prisma.NoteWhereInput {
  if (canViewComplianceNotes(user)) return {}
  return { visibility: { not: "COMPLIANCE_ONLY" } }
}

function noteActivityTitle(type: NoteActivityType) {
  const labels: Record<NoteActivityType, string> = {
    NOTE_ADDED: "Note ajoutée",
    NOTE_UPDATED: "Note modifiée",
    NOTE_PINNED: "Note épinglée",
    NOTE_UNPINNED: "Note désépinglée",
    NOTE_ARCHIVED: "Note archivée",
    NOTE_RESTORED: "Note restaurée",
    NOTE_DELETED: "Note supprimée",
  }

  return labels[type] ?? "Note mise à jour"
}

async function logNoteActivity({
  organizationId,
  userId,
  leadId,
  clientId,
  type,
  description,
}: {
  organizationId: string
  userId: string
  leadId?: string | null
  clientId?: string | null
  type: NoteActivityType
  description?: string | null
}) {
  await createCrmActivity({
    organizationId,
    userId,
    leadId,
    clientId,
    type,
    title: noteActivityTitle(type),
    description,
  })
}

async function auditSensitiveNote({
  user,
  noteId,
  clientId,
  action,
  oldValue,
  newValue,
}: {
  user: CurrentUser
  noteId: string
  clientId?: string | null
  action: string
  oldValue?: Prisma.InputJsonValue
  newValue?: Prisma.InputJsonValue
}) {
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    entityType: "NOTE",
    entityId: noteId,
    action,
    oldValue,
    newValue,
  })
}

function shouldAudit(note: { isSensitive: boolean; type: string; visibility: string }) {
  return note.isSensitive || note.type === "COMPLIANCE" || note.type === "KYC" || note.visibility === "COMPLIANCE_ONLY"
}

export async function getNotes({ user, query }: { user: CurrentUser; query: NoteQueryInput }) {
  const where: Prisma.NoteWhereInput = {
    organizationId: user.organizationId,
    ...visibleWhere(user),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.taskId ? { taskId: query.taskId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.status ? { status: query.status } : { status: { not: "DELETED" } }),
    ...(query.isPinned !== undefined ? { isPinned: query.isPinned } : {}),
    ...(query.createdBy ? { userId: query.createdBy } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { content: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const skip = (query.page - 1) * query.limit
  const [items, total] = await Promise.all([
    prisma.note.findMany({
      where,
      include: noteInclude,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.note.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) }
}

export async function getNoteById({ user, id }: { user: CurrentUser; id: string }) {
  const note = await prisma.note.findFirst({
    where: { id, organizationId: user.organizationId, ...visibleWhere(user) },
    include: noteInclude,
  })
  if (!note) throw new Error("NOTE_NOT_FOUND")
  assertCanAccessVisibility(user, note.visibility)
  return note
}

export async function createNote({ user, data }: { user: CurrentUser; data: CreateNoteInput }) {
  assertCanAccessVisibility(user, data.visibility)
  await assertRelatedOwnership(user.organizationId, data)

  const note = await prisma.note.create({
    data: {
      ...data,
      organizationId: user.organizationId,
      userId: user.id,
      status: data.isPinned || data.status === "PINNED" ? "PINNED" : data.status,
      isPinned: data.isPinned || data.status === "PINNED",
    },
    include: noteInclude,
  })

  await logNoteActivity({
    organizationId: user.organizationId,
    userId: user.id,
    leadId: note.leadId,
    clientId: note.clientId,
    type: "NOTE_ADDED",
    description: note.title ?? note.content.slice(0, 160),
  })

  if (shouldAudit(note)) {
    await auditSensitiveNote({
      user,
      noteId: note.id,
      clientId: note.clientId,
      action: "NOTE_CREATED",
      newValue: { type: note.type, visibility: note.visibility, isSensitive: note.isSensitive },
    })
  }

  await runAutomationsForEvent({
    organizationId: user.organizationId,
    userId: user.id,
    leadId: note.leadId,
    clientId: note.clientId,
    event: "NOTE_ADDED",
    title: "Note ajoutée",
    description: note.title ?? note.content.slice(0, 160),
  })

  return note
}

export async function updateNote({ user, id, data }: { user: CurrentUser; id: string; data: UpdateNoteInput }) {
  const existing = await getNoteById({ user, id })
  if (existing.visibility === "COMPLIANCE_ONLY" && !canEditComplianceNotes(user)) throw new Error("NOTE_FORBIDDEN")
  assertCanAccessVisibility(user, data.visibility ?? existing.visibility)
  await assertRelatedOwnership(user.organizationId, data)

  await prisma.note.updateMany({
    where: { id, organizationId: user.organizationId },
    data: {
      ...data,
      status: data.isPinned || data.status === "PINNED" ? "PINNED" : data.isPinned === false && existing.status === "PINNED" ? "ACTIVE" : data.status,
      isPinned: data.isPinned ?? (data.status === "PINNED" ? true : undefined),
    },
  })
  const note = await prisma.note.findFirstOrThrow({ where: { id, organizationId: user.organizationId }, include: noteInclude })

  await logNoteActivity({
    organizationId: user.organizationId,
    userId: user.id,
    leadId: note.leadId,
    clientId: note.clientId,
    type: "NOTE_UPDATED",
    description: note.title ?? note.content.slice(0, 160),
  })

  if (shouldAudit(existing) || shouldAudit(note)) {
    await auditSensitiveNote({
      user,
      noteId: note.id,
      clientId: note.clientId,
      action: "NOTE_UPDATED",
      oldValue: { type: existing.type, visibility: existing.visibility, isSensitive: existing.isSensitive },
      newValue: { type: note.type, visibility: note.visibility, isSensitive: note.isSensitive },
    })
  }

  return note
}

async function updateNoteState({
  user,
  id,
  status,
  isPinned,
  activityType,
  extraData = {},
}: {
  user: CurrentUser
  id: string
  status?: NoteStatus
  isPinned?: boolean
  activityType: NoteActivityType
  extraData?: Prisma.NoteUpdateInput
}) {
  const existing = await getNoteById({ user, id })
  if (existing.visibility === "COMPLIANCE_ONLY" && !canEditComplianceNotes(user)) throw new Error("NOTE_FORBIDDEN")

  await prisma.note.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { status, isPinned, ...extraData } as Prisma.NoteUpdateManyMutationInput,
  })
  const note = await prisma.note.findFirstOrThrow({ where: { id, organizationId: user.organizationId }, include: noteInclude })

  await logNoteActivity({
    organizationId: user.organizationId,
    userId: user.id,
    leadId: note.leadId,
    clientId: note.clientId,
    type: activityType,
    description: note.title ?? note.content.slice(0, 160),
  })

  if (shouldAudit(existing) || shouldAudit(note) || ["NOTE_ARCHIVED", "NOTE_DELETED"].includes(activityType)) {
    await auditSensitiveNote({
      user,
      noteId: note.id,
      clientId: note.clientId,
      action: activityType,
      oldValue: { status: existing.status, isPinned: existing.isPinned },
      newValue: { status: note.status, isPinned: note.isPinned },
    })
  }

  return note
}

export function pinNote({ user, id }: { user: CurrentUser; id: string }) {
  return updateNoteState({ user, id, status: "PINNED", isPinned: true, activityType: "NOTE_PINNED" })
}

export function unpinNote({ user, id }: { user: CurrentUser; id: string }) {
  return updateNoteState({ user, id, status: "ACTIVE", isPinned: false, activityType: "NOTE_UNPINNED" })
}

export function archiveNote({ user, id }: { user: CurrentUser; id: string }) {
  return updateNoteState({ user, id, status: "ARCHIVED", isPinned: false, activityType: "NOTE_ARCHIVED", extraData: { archivedAt: new Date() } })
}

export function restoreNote({ user, id }: { user: CurrentUser; id: string }) {
  return updateNoteState({ user, id, status: "ACTIVE", activityType: "NOTE_RESTORED", extraData: { archivedAt: null, deletedAt: null } })
}

export function deleteNote({ user, id }: { user: CurrentUser; id: string }) {
  return updateNoteState({ user, id, status: "DELETED", isPinned: false, activityType: "NOTE_DELETED", extraData: { deletedAt: new Date() } })
}
