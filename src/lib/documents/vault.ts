import type { DocumentAccessEventType, DocumentLinkEntityType, DocumentLinkRelationshipType, Prisma, UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { logPrivacyAccessRisk } from "@/lib/privacy/advanced"

type CurrentUser = { id: string; organizationId: string; role?: UserRole }

type DocumentSnapshot = {
  id: string
  organizationId: string
  clientId?: string | null
  version?: number | null
  fileName?: string | null
  storageBucket?: string | null
  storagePath?: string | null
  storageProvider?: string | null
  mimeType?: string | null
  fileSize?: number | null
  checksum?: string | null
}

export async function createDocumentVersionSnapshot({
  user,
  document,
  changeReason,
  metadata,
}: {
  user: CurrentUser
  document: DocumentSnapshot
  changeReason?: string
  metadata?: Prisma.InputJsonValue
}) {
  const versionNumber = document.version ?? 1
  return prisma.documentVersion.upsert({
    where: {
      documentId_versionNumber: {
        documentId: document.id,
        versionNumber,
      },
    },
    create: {
      organizationId: document.organizationId,
      documentId: document.id,
      clientId: document.clientId,
      changedById: user.id,
      versionNumber,
      fileName: document.fileName,
      storageBucket: document.storageBucket,
      storagePath: document.storagePath,
      storageProvider: document.storageProvider,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      checksum: document.checksum,
      changeReason,
      metadata,
    },
    update: {
      changedById: user.id,
      fileName: document.fileName,
      storageBucket: document.storageBucket,
      storagePath: document.storagePath,
      storageProvider: document.storageProvider,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      checksum: document.checksum,
      changeReason,
      metadata,
    },
  })
}

export async function logDocumentAccess({
  user,
  document,
  eventType,
  request,
  purpose,
  metadata,
}: {
  user: CurrentUser
  document: Pick<DocumentSnapshot, "id" | "organizationId" | "clientId">
  eventType: DocumentAccessEventType
  request?: Request
  purpose?: string
  metadata?: Prisma.InputJsonValue
}) {
  const ipAddress = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request?.headers.get("x-real-ip") ?? undefined
  const userAgent = request?.headers.get("user-agent") ?? undefined
  await prisma.documentAccessLog.create({
    data: {
      organizationId: document.organizationId,
      documentId: document.id,
      clientId: document.clientId,
      userId: user.id,
      eventType,
      ipAddress,
      userAgent,
      purpose,
      metadata,
    },
  })
  await prisma.document.update({
    where: { id: document.id },
    data: {
      lastAccessedAt: new Date(),
      lastAccessedById: user.id,
      ...(eventType === "DOWNLOAD" ? { downloadCount: { increment: 1 } } : {}),
    },
  })
  await logPrivacyAccessRisk({
    organizationId: document.organizationId,
    userId: user.id,
    clientId: document.clientId,
    documentId: document.id,
    eventType,
    request,
    metadata: { purpose, documentAccessMetadata: metadata ?? null },
  })
}

export async function linkDocumentToEntity({
  user,
  document,
  linkedEntityType,
  linkedEntityId,
  relationshipType = "SUPPORTING_DOCUMENT",
  label,
  sourceFieldKey,
  proofStatus,
  metadata,
}: {
  user: CurrentUser
  document: Pick<DocumentSnapshot, "id" | "organizationId" | "clientId">
  linkedEntityType: DocumentLinkEntityType
  linkedEntityId: string
  relationshipType?: DocumentLinkRelationshipType
  label?: string
  sourceFieldKey?: string
  proofStatus?: string
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.documentLink.upsert({
    where: {
      documentId_linkedEntityType_linkedEntityId_relationshipType: {
        documentId: document.id,
        linkedEntityType,
        linkedEntityId,
        relationshipType,
      },
    },
    create: {
      organizationId: document.organizationId,
      documentId: document.id,
      clientId: document.clientId,
      createdById: user.id,
      linkedEntityType,
      linkedEntityId,
      relationshipType,
      label,
      sourceFieldKey,
      proofStatus,
      metadata,
    },
    update: {
      label,
      sourceFieldKey,
      proofStatus,
      metadata,
    },
  })
}

export function inferDocumentSensitivity(type: string, mimeType?: string | null) {
  if (type === "GOVERNMENT_ID" || type === "KYC_FORM" || type === "RISK_PROFILE") return "CRITICAL"
  if (type === "TAX_DOCUMENT" || type === "INVESTMENT_STATEMENT" || type === "INSURANCE_STATEMENT" || type === "POLICY_DOCUMENT") return "HIGH"
  if (type === "CONSENT_FORM" || type === "SIGNATURE_PAGE" || type === "BENEFICIARY_FORM") return "HIGH"
  if (mimeType?.startsWith("image/")) return "MEDIUM"
  return "MEDIUM"
}

export function inferDocumentSecurityMetadata(type: string) {
  return {
    containsPersonalData: true,
    containsFinancialData: ["TAX_DOCUMENT", "INVESTMENT_STATEMENT", "INSURANCE_STATEMENT", "POLICY_DOCUMENT", "VOID_CHEQUE"].includes(type),
    containsIdentityData: ["GOVERNMENT_ID", "PROOF_OF_ADDRESS"].includes(type),
    containsMedicalData: ["POLICY_DOCUMENT", "INSURANCE_STATEMENT"].includes(type),
  }
}
