import type { DocumentType } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { getClientPortalApiUser, findClientPortalRecord } from "@/lib/client-portal"
import { createCrmActivity } from "@/lib/crm-events"
import { getFileChecksum, sanitizeFileName, validateDocumentFile } from "@/lib/documents/file-validation"
import { createDocumentVersionSnapshot, inferDocumentSecurityMetadata, inferDocumentSensitivity, linkDocumentToEntity, logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { markDocumentRequestItemsReceived } from "@/lib/services/document-requests"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : undefined
}

const allowedDocumentTypes = new Set<DocumentType>([
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "VOID_CHEQUE",
  "KYC_FORM",
  "RISK_PROFILE",
  "CONSENT_FORM",
  "POLICY_DOCUMENT",
  "PROPOSAL",
  "ILLUSTRATION",
  "INVESTMENT_STATEMENT",
  "INSURANCE_STATEMENT",
  "BENEFICIARY_FORM",
  "SIGNATURE_PAGE",
  "TAX_DOCUMENT",
  "CLIENT_NOTE",
  "OTHER",
])

function readDocumentType(formData: FormData): DocumentType {
  const value = readString(formData, "type")
  return value && allowedDocumentTypes.has(value as DocumentType) ? (value as DocumentType) : "OTHER"
}

async function assertClientPortalDocumentConsent({
  organizationId,
  clientId,
  documentType,
}: {
  organizationId: string
  clientId: string
  documentType: DocumentType
}) {
  if (documentType === "CONSENT_FORM") return
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "document_vault",
    errorCode: "DOCUMENT_VAULT_CONSENT_REQUIRED",
  })
}

export async function POST(request: Request) {
  let documentId: string | null = null

  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) return fail("VALIDATION_ERROR", "Le fichier est requis.", 422)
    validateDocumentFile(file)
    const existingDocumentId = readString(formData, "documentId")

    const clientFolder = await ensureClientFolderStructure({
      organizationId: client.organizationId,
      clientId: client.id,
      userId: user.id,
    })
    const targetFolder = await prisma.documentFolder.findFirst({
      where: {
        organizationId: client.organizationId,
        parentId: clientFolder.id,
        name: "Pièces jointes",
      },
      select: { id: true },
    })

    if (existingDocumentId) {
      const existing = await prisma.document.findFirst({
        where: {
          id: existingDocumentId,
          organizationId: client.organizationId,
          clientId: client.id,
          status: { not: "ARCHIVED" },
          visibility: { in: ["CLIENT_VISIBLE", "TEAM"] },
        },
      })
      if (!existing) return fail("DOCUMENT_NOT_FOUND", "Demande de document introuvable dans votre dossier.", 404)
      await assertClientPortalDocumentConsent({ organizationId: client.organizationId, clientId: client.id, documentType: existing.type })

      const safeFileName = sanitizeFileName(file.name)
      const bucket = getDocumentsBucket()
      const storagePath = `organizations/${client.organizationId}/clients/${client.id}/${existing.id}/${safeFileName}`
      const checksum = await getFileChecksum(file)
      const supabase = getSupabaseServerClient()
      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true,
      })

      if (uploadError) {
        return fail("UPLOAD_FAILED", "Le téléversement a échoué. Réessayez ou contactez votre conseiller.", 500)
      }

      const updated = await prisma.document.update({
        where: { id: existing.id },
        data: {
          uploadedById: user.id,
          folderId: existing.folderId ?? targetFolder?.id ?? clientFolder.id,
          name: readString(formData, "name") || existing.name || file.name,
          description: readString(formData, "description") || existing.description || "Document reçu depuis le portail client.",
          status: "RECEIVED",
          visibility: "CLIENT_VISIBLE",
          source: "PORTAL",
          receivedAt: new Date(),
          storageBucket: bucket,
          storagePath,
          storageProvider: "SUPABASE",
          storageKey: storagePath,
          originalFileName: file.name,
          fileName: safeFileName,
          mimeType: file.type,
          fileSize: file.size,
          checksum,
        },
      })
      await createDocumentVersionSnapshot({
        user: { id: user.id, organizationId: client.organizationId },
        document: updated,
        changeReason: "Fichier reçu depuis le portail client",
        metadata: { source: "client_portal", checksum },
      })
      await logDocumentAccess({
        user: { id: user.id, organizationId: client.organizationId },
        document: updated,
        eventType: "UPLOAD",
        request,
        purpose: "Téléversement client depuis le portail",
        metadata: { fileName: safeFileName, existingDocumentId: existing.id },
      })
      await linkDocumentToEntity({
        user: { id: user.id, organizationId: client.organizationId },
        document: updated,
        linkedEntityType: "CLIENT",
        linkedEntityId: client.id,
        relationshipType: "SUPPORTING_DOCUMENT",
        label: "Document reçu du client",
      })
      await markDocumentRequestItemsReceived({
        user: { id: user.id, organizationId: client.organizationId },
        documentId: updated.id,
        request,
        source: "client_portal",
      })

      await createCrmActivity({
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        documentId: updated.id,
        type: "DOCUMENT_UPLOADED",
        title: "Document demandé reçu",
        description: updated.name,
        entityType: "Document",
        entityId: updated.id,
      })

      await createCrmActivity({
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        documentId: updated.id,
        type: "DOCUMENT_RECEIVED",
        title: "Demande de document complétée",
        description: updated.name,
        entityType: "Document",
        entityId: updated.id,
      })

      if (client.advisorId) {
        await prisma.notification.create({
          data: {
            organizationId: client.organizationId,
            userId: client.advisorId,
            type: "DOCUMENT_REQUIRED",
            priority: "NORMAL",
            status: "UNREAD",
            title: "Document demandé reçu",
            message: `${client.firstName} ${client.lastName}: ${updated.name}`,
            actionLabel: "Valider le document",
            actionUrl: `/clients/${client.id}`,
            href: `/clients/${client.id}`,
            entityType: "DOCUMENT",
            entityId: updated.id,
            clientId: client.id,
            documentId: updated.id,
          },
        })
      }

      return ok(updated, { status: 200 })
    }

    const documentType = readDocumentType(formData)
    await assertClientPortalDocumentConsent({ organizationId: client.organizationId, clientId: client.id, documentType })
    const security = inferDocumentSecurityMetadata(documentType)
    const document = await prisma.document.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        uploadedById: user.id,
        folderId: targetFolder?.id ?? clientFolder.id,
        type: documentType,
        status: "RECEIVED",
        visibility: "CLIENT_VISIBLE",
        source: "PORTAL",
        sensitivityLevel: inferDocumentSensitivity(documentType, file.type),
        containsPersonalData: security.containsPersonalData,
        containsFinancialData: security.containsFinancialData,
        containsIdentityData: security.containsIdentityData,
        containsMedicalData: security.containsMedicalData,
        securityMetadata: security,
        name: readString(formData, "name") || file.name,
        description: readString(formData, "description") || "Document ajouté depuis le portail client.",
        receivedAt: new Date(),
      },
    })
    documentId = document.id

    const safeFileName = sanitizeFileName(file.name)
    const bucket = getDocumentsBucket()
    const storagePath = `organizations/${client.organizationId}/clients/${client.id}/${document.id}/${safeFileName}`
    const checksum = await getFileChecksum(file)
    const supabase = getSupabaseServerClient()
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      await prisma.document.deleteMany({ where: { id: document.id, organizationId: client.organizationId } }).catch(() => undefined)
      return fail("UPLOAD_FAILED", "Le téléversement a échoué. Réessayez ou contactez votre conseiller.", 500)
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        storageBucket: bucket,
        storagePath,
        storageProvider: "SUPABASE",
        storageKey: storagePath,
        originalFileName: file.name,
        fileName: safeFileName,
        mimeType: file.type,
        fileSize: file.size,
        checksum,
      },
    })
    await createDocumentVersionSnapshot({
      user: { id: user.id, organizationId: client.organizationId },
      document: updated,
      changeReason: "Fichier reçu depuis le portail client",
      metadata: { source: "client_portal", checksum },
    })
    await logDocumentAccess({
      user: { id: user.id, organizationId: client.organizationId },
      document: updated,
      eventType: "UPLOAD",
      request,
      purpose: "Téléversement client depuis le portail",
      metadata: { fileName: safeFileName },
    })
    await linkDocumentToEntity({
      user: { id: user.id, organizationId: client.organizationId },
      document: updated,
      linkedEntityType: "CLIENT",
      linkedEntityId: client.id,
      relationshipType: "SUPPORTING_DOCUMENT",
      label: "Document reçu du client",
    })
    await markDocumentRequestItemsReceived({
      user: { id: user.id, organizationId: client.organizationId },
      documentId: updated.id,
      request,
      source: "client_portal",
    })

    await createCrmActivity({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      documentId: updated.id,
      type: "DOCUMENT_UPLOADED",
      title: "Document ajouté par le client",
      description: updated.name,
      entityType: "Document",
      entityId: updated.id,
    })

    if (client.advisorId) {
      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "DOCUMENT_REQUIRED",
          priority: "NORMAL",
          status: "UNREAD",
          title: "Document reçu du client",
          message: `${client.firstName} ${client.lastName}: ${updated.name}`,
          actionLabel: "Valider le document",
          actionUrl: `/clients/${client.id}`,
          href: `/clients/${client.id}`,
          entityType: "DOCUMENT",
          entityId: updated.id,
          clientId: client.id,
          documentId: updated.id,
        },
      })
    }

    return ok(updated, { status: 201 })
  } catch (error) {
    if (documentId) {
      await prisma.document.deleteMany({ where: { id: documentId } }).catch(() => undefined)
    }
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") return fail("DOCUMENT_VAULT_CONSENT_REQUIRED", "Le consentement de conservation documentaire doit être actif avant de téléverser ce document.", 403)
    return handleApiError(error)
  }
}
