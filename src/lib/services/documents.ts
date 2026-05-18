import type { DocumentStatus, DocumentVisibility, Prisma, UserRole } from "@prisma/client"
import type { z } from "zod"

import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { createDocumentVersionSnapshot, inferDocumentSecurityMetadata, inferDocumentSensitivity, linkDocumentToEntity } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { ensureClientFolderStructure, getUnclassifiedFolder } from "@/lib/services/document-folders"
import type { createDocumentSchema, documentQuerySchema, updateDocumentSchema } from "@/lib/validations/document"

type CurrentUser = { id: string; organizationId: string; role: UserRole }
type CreateDocumentInput = z.infer<typeof createDocumentSchema>
type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
type DocumentQueryInput = z.infer<typeof documentQuerySchema>
type DocumentActivityType =
  | "DOCUMENT_ADDED"
  | "DOCUMENT_STATUS_CHANGED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_RECEIVED"
  | "DOCUMENT_VALIDATED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_WAIVED"
  | "DOCUMENT_EXPIRED"
  | "DOCUMENT_ARCHIVED"
  | "DOCUMENT_RESTORED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DOWNLOADED"
  | "DOCUMENT_PREVIEWED"

const documentInclude = {
  client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
  lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
  product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
  task: { select: { id: true, title: true } },
  folder: { select: { id: true, name: true, path: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.DocumentInclude

function canViewComplianceDocuments(user: CurrentUser) {
  return user.role === "OWNER" || user.role === "COMPLIANCE"
}

function canEditComplianceDocuments(user: CurrentUser) {
  return user.role === "OWNER" || user.role === "COMPLIANCE"
}

function visibleWhere(user: CurrentUser): Prisma.DocumentWhereInput {
  if (canViewComplianceDocuments(user)) return {}
  return { visibility: { not: "COMPLIANCE_ONLY" } }
}

function assertCanUseVisibility(user: CurrentUser, visibility?: DocumentVisibility | null) {
  if (visibility === "COMPLIANCE_ONLY" && !canViewComplianceDocuments(user)) throw new Error("DOCUMENT_FORBIDDEN")
}

async function assertRelatedOwnership(organizationId: string, data: Partial<CreateDocumentInput>) {
  const checks: Promise<unknown>[] = []
  if (data.clientId) checks.push(prisma.client.findFirstOrThrow({ where: { id: data.clientId, organizationId }, select: { id: true } }))
  if (data.leadId) checks.push(prisma.lead.findFirstOrThrow({ where: { id: data.leadId, organizationId }, select: { id: true } }))
  if (data.productId) checks.push(prisma.financialProduct.findFirstOrThrow({ where: { id: data.productId, organizationId }, select: { id: true } }))
  if (data.taskId) checks.push(prisma.task.findFirstOrThrow({ where: { id: data.taskId, organizationId }, select: { id: true } }))
  if (data.kycProfileId) checks.push(prisma.clientKycProfile.findFirstOrThrow({ where: { id: data.kycProfileId, organizationId }, select: { id: true } }))
  if (data.folderId) checks.push(prisma.documentFolder.findFirstOrThrow({ where: { id: data.folderId, organizationId }, select: { id: true } }))
  await Promise.all(checks)
}

function statusDates(status: DocumentStatus) {
  const now = new Date()
  if (status === "REQUESTED") return { requestedAt: now }
  if (status === "RECEIVED") return { receivedAt: now }
  if (status === "VALIDATED") return { validatedAt: now, receivedAt: now }
  if (status === "REJECTED") return { rejectedAt: now }
  if (status === "ARCHIVED") return { archivedAt: now }
  return {}
}

function documentActivityForStatus(status: DocumentStatus): DocumentActivityType {
  if (status === "RECEIVED") return "DOCUMENT_RECEIVED"
  if (status === "VALIDATED") return "DOCUMENT_VALIDATED"
  if (status === "REJECTED") return "DOCUMENT_REJECTED"
  if (status === "WAIVED") return "DOCUMENT_WAIVED"
  if (status === "EXPIRED") return "DOCUMENT_EXPIRED"
  if (status === "ARCHIVED") return "DOCUMENT_ARCHIVED"
  return "DOCUMENT_STATUS_CHANGED"
}

async function logDocumentActivity({ user, document, type, description }: { user: CurrentUser; document: { id: string; name: string; leadId?: string | null; clientId?: string | null }; type: DocumentActivityType; description?: string }) {
  await createCrmActivity({
    organizationId: user.organizationId,
    userId: user.id,
    leadId: document.leadId,
    clientId: document.clientId,
    documentId: document.id,
    type,
    title: type === "DOCUMENT_UPLOADED" ? "Document téléversé" : type === "DOCUMENT_ADDED" ? "Document ajouté" : "Document mis à jour",
    description: description ?? document.name,
    entityType: "Document",
    entityId: document.id,
  })
}

async function auditDocument(user: CurrentUser, document: { id: string; clientId?: string | null; visibility?: string; type?: string }, action: string, newValue?: Prisma.InputJsonValue) {
  if (document.visibility === "COMPLIANCE_ONLY" || document.type === "KYC_FORM" || document.type === "RISK_PROFILE" || action.includes("REJECT") || action.includes("VALIDATED")) {
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: document.clientId,
      entityType: "DOCUMENT",
      entityId: document.id,
      action,
      newValue,
    })
  }
}

async function refreshComplianceAlertsForDocument(user: CurrentUser, document: { clientId?: string | null }) {
  if (!document.clientId) return
  await generateComplianceAlertsForClient({
    organizationId: user.organizationId,
    clientId: document.clientId,
    userId: user.id,
  })
}

export async function getDocuments({ user, query }: { user: CurrentUser; query: DocumentQueryInput }) {
  const now = new Date()
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)

  const where: Prisma.DocumentWhereInput = {
    organizationId: user.organizationId,
    ...visibleWhere(user),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.taskId ? { taskId: query.taskId } : {}),
    ...(query.kycProfileId ? { kycProfileId: query.kycProfileId } : {}),
    ...(query.folderId ? { folderId: query.folderId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.isRequired !== undefined ? { isRequired: query.isRequired } : {}),
    ...(query.expired ? { expiresAt: { lt: now } } : {}),
    ...(query.expiresSoon ? { expiresAt: { gte: now, lte: soon } } : {}),
    ...(query.dateFrom || query.dateTo ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } } : {}),
    ...(query.search ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }, { originalFileName: { contains: query.search, mode: "insensitive" } }] } : {}),
  }

  const skip = (query.page - 1) * query.limit
  const [items, total] = await Promise.all([
    prisma.document.findMany({ where, include: documentInclude, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
    prisma.document.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) }
}

export async function getDocumentById({ user, id }: { user: CurrentUser; id: string }) {
  const document = await prisma.document.findFirst({ where: { id, organizationId: user.organizationId, ...visibleWhere(user) }, include: documentInclude })
  if (!document) throw new Error("DOCUMENT_NOT_FOUND")
  return document
}

export async function createDocument({ user, data }: { user: CurrentUser; data: CreateDocumentInput }) {
  assertCanUseVisibility(user, data.visibility)
  await assertRelatedOwnership(user.organizationId, data)
  const defaultFolder = data.folderId
    ? null
    : data.clientId
      ? await ensureClientFolderStructure({ organizationId: user.organizationId, clientId: data.clientId, userId: user.id })
      : await getUnclassifiedFolder(user.organizationId)
  const security = inferDocumentSecurityMetadata(data.type)
  const document = await prisma.document.create({
    data: {
      ...data,
      folderId: data.folderId ?? defaultFolder?.id,
      organizationId: user.organizationId,
      uploadedById: user.id,
      sensitivityLevel: inferDocumentSensitivity(data.type, data.mimeType),
      containsPersonalData: security.containsPersonalData,
      containsFinancialData: security.containsFinancialData,
      containsIdentityData: security.containsIdentityData,
      containsMedicalData: security.containsMedicalData,
      source: data.status === "REQUESTED" || data.status === "REQUIRED" ? "SYSTEM" : "ADVISOR",
      securityMetadata: security as Prisma.InputJsonValue,
      ...statusDates(data.status),
      isRequired: data.isRequired || data.status === "REQUIRED",
    },
    include: documentInclude,
  })
  await createDocumentVersionSnapshot({ user, document, changeReason: "Création initiale du document", metadata: { status: document.status, type: document.type } })
  if (document.clientId) {
    await linkDocumentToEntity({
      user,
      document,
      linkedEntityType: "CLIENT",
      linkedEntityId: document.clientId,
      relationshipType: "SUPPORTING_DOCUMENT",
      label: "Document au dossier client",
    })
  }
  if (document.kycProfileId) {
    await linkDocumentToEntity({
      user,
      document,
      linkedEntityType: "KYC_PROFILE",
      linkedEntityId: document.kycProfileId,
      relationshipType: "PROOF",
      label: "Preuve liée au profil client",
    })
  }
  if (document.productId) {
    await linkDocumentToEntity({
      user,
      document,
      linkedEntityType: "FINANCIAL_PRODUCT",
      linkedEntityId: document.productId,
      relationshipType: "SOURCE",
      label: "Document source du produit",
    })
  }
  await logDocumentActivity({ user, document, type: "DOCUMENT_ADDED" })
  await auditDocument(user, document, "DOCUMENT_ADDED", { status: document.status, type: document.type })
  await runAutomationsForEvent({ organizationId: user.organizationId, userId: user.id, leadId: document.leadId, clientId: document.clientId, event: "DOCUMENT_CREATED", title: "Document ajouté", description: document.name, payload: { status: document.status, type: document.type, documentName: document.name } })
  await refreshComplianceAlertsForDocument(user, document)
  return document
}

export async function updateDocument({ user, id, data }: { user: CurrentUser; id: string; data: UpdateDocumentInput }) {
  const existing = await getDocumentById({ user, id })
  if (existing.visibility === "COMPLIANCE_ONLY" && !canEditComplianceDocuments(user)) throw new Error("DOCUMENT_FORBIDDEN")
  if (existing.isLocked && !canEditComplianceDocuments(user)) throw new Error("DOCUMENT_LOCKED")
  assertCanUseVisibility(user, data.visibility ?? existing.visibility)
  await assertRelatedOwnership(user.organizationId, data)
  const security = data.type ? inferDocumentSecurityMetadata(data.type) : null
  await prisma.document.updateMany({
    where: { id, organizationId: user.organizationId },
    data: {
      ...data,
      ...(data.type ? {
        sensitivityLevel: inferDocumentSensitivity(data.type, data.mimeType ?? existing.mimeType),
        containsPersonalData: security?.containsPersonalData,
        containsFinancialData: security?.containsFinancialData,
        containsIdentityData: security?.containsIdentityData,
        containsMedicalData: security?.containsMedicalData,
        securityMetadata: security as Prisma.InputJsonValue,
      } : {}),
    },
  })
  const document = await prisma.document.findFirstOrThrow({ where: { id, organizationId: user.organizationId }, include: documentInclude })
  await createDocumentVersionSnapshot({ user, document, changeReason: "Métadonnées documentaires mises à jour", metadata: { previousStatus: existing.status, status: document.status, type: document.type } })
  await logDocumentActivity({ user, document, type: "DOCUMENT_UPDATED" })
  await auditDocument(user, document, "DOCUMENT_UPDATED", { status: document.status, type: document.type })
  await refreshComplianceAlertsForDocument(user, document)
  return document
}

export async function updateDocumentStatus({ user, id, status, rejectedReason, waiverReason, notes, expiresAt }: { user: CurrentUser; id: string; status: DocumentStatus; rejectedReason?: string; waiverReason?: string; notes?: string; expiresAt?: Date }) {
  const existing = await getDocumentById({ user, id })
  if (existing.visibility === "COMPLIANCE_ONLY" && !canEditComplianceDocuments(user)) throw new Error("DOCUMENT_FORBIDDEN")
  if (existing.isLocked && status !== "VALIDATED" && !canEditComplianceDocuments(user)) throw new Error("DOCUMENT_LOCKED")
  if (status === "REJECTED" && !rejectedReason) throw new Error("DOCUMENT_REJECT_REASON_REQUIRED")
  if (status === "WAIVED" && !waiverReason) throw new Error("DOCUMENT_WAIVER_REASON_REQUIRED")
  await prisma.document.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { status, rejectedReason, waiverReason, notes: notes ?? existing.notes, expiresAt, ...statusDates(status), isRequired: status === "REQUIRED" ? true : existing.isRequired },
  })
  const document = await prisma.document.findFirstOrThrow({ where: { id, organizationId: user.organizationId }, include: documentInclude })
  if (status === "VALIDATED") {
    if (document.clientId) {
      await linkDocumentToEntity({
        user,
        document,
        linkedEntityType: "CLIENT",
        linkedEntityId: document.clientId,
        relationshipType: "PROOF",
        label: "Document validé comme preuve",
        proofStatus: "VALIDATED_BY_ADVISOR",
        metadata: { status, validatedAt: document.validatedAt?.toISOString() },
      })
    } else if (document.leadId) {
      await linkDocumentToEntity({
        user,
        document,
        linkedEntityType: "LEAD",
        linkedEntityId: document.leadId,
        relationshipType: "PROOF",
        label: "Document validé comme preuve",
        proofStatus: "VALIDATED_BY_ADVISOR",
        metadata: { status, validatedAt: document.validatedAt?.toISOString() },
      })
    }
  }
  await logDocumentActivity({ user, document, type: documentActivityForStatus(status), description: `${existing.status} → ${document.status}` })
  await logDocumentActivity({ user, document, type: "DOCUMENT_STATUS_CHANGED", description: `${existing.status} → ${document.status}` })
  await auditDocument(user, document, `DOCUMENT_${status}`, { status, rejectedReason, waiverReason })
  await runAutomationsForEvent({ organizationId: user.organizationId, userId: user.id, leadId: document.leadId, clientId: document.clientId, event: "DOCUMENT_STATUS_CHANGED", title: "Statut document modifié", description: document.name, payload: { oldStatus: existing.status, newStatus: document.status, status: document.status, type: document.type, documentName: document.name } })
  await refreshComplianceAlertsForDocument(user, document)
  return document
}

export function validateDocument({ user, id, expiresAt, notes }: { user: CurrentUser; id: string; expiresAt?: Date; notes?: string }) {
  return updateDocumentStatus({ user, id, status: "VALIDATED", expiresAt, notes })
}

export function rejectDocument({ user, id, rejectedReason, notes }: { user: CurrentUser; id: string; rejectedReason: string; notes?: string }) {
  return updateDocumentStatus({ user, id, status: "REJECTED", rejectedReason, notes })
}

export function waiveDocument({ user, id, waiverReason, notes }: { user: CurrentUser; id: string; waiverReason: string; notes?: string }) {
  return updateDocumentStatus({ user, id, status: "WAIVED", waiverReason, notes })
}

export function archiveDocument({ user, id }: { user: CurrentUser; id: string }) {
  return updateDocumentStatus({ user, id, status: "ARCHIVED" })
}

export async function restoreDocument({ user, id }: { user: CurrentUser; id: string }) {
  const existing = await getDocumentById({ user, id })
  await prisma.document.updateMany({ where: { id, organizationId: user.organizationId }, data: { status: "RECEIVED", archivedAt: null } })
  const document = await prisma.document.findFirstOrThrow({ where: { id, organizationId: user.organizationId }, include: documentInclude })
  await logDocumentActivity({ user, document, type: "DOCUMENT_RESTORED", description: existing.name })
  await refreshComplianceAlertsForDocument(user, document)
  return document
}
