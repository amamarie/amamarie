import { fail, ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { getFileChecksum, sanitizeFileName, validateDocumentFile } from "@/lib/documents/file-validation"
import { createCrmActivity } from "@/lib/crm-events"
import { createDocumentVersionSnapshot, logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { createDocument } from "@/lib/services/documents"
import { markDocumentRequestItemsReceived } from "@/lib/services/document-requests"
import { assertRateLimit, rateLimitKey } from "@/lib/security/rate-limit"
import { getSupabaseServerClient, getDocumentsBucket } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/tenant"
import { createDocumentSchema } from "@/lib/validations/document"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

function buildStoragePath({
  organizationId,
  documentId,
  fileName,
  clientId,
  leadId,
  productId,
  kycProfileId,
}: {
  organizationId: string
  documentId: string
  fileName: string
  clientId?: string
  leadId?: string
  productId?: string
  kycProfileId?: string
}) {
  if (clientId) return `organizations/${organizationId}/clients/${clientId}/${documentId}/${fileName}`
  if (leadId) return `organizations/${organizationId}/leads/${leadId}/${documentId}/${fileName}`
  if (productId) return `organizations/${organizationId}/products/${productId}/${documentId}/${fileName}`
  if (kycProfileId) return `organizations/${organizationId}/kyc/${kycProfileId}/${documentId}/${fileName}`
  return `organizations/${organizationId}/documents/${documentId}/${fileName}`
}

async function assertDocumentVaultConsent({
  organizationId,
  clientId,
}: {
  organizationId: string
  clientId?: string | null
}) {
  if (!clientId) return
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "document_vault",
    errorCode: "DOCUMENT_VAULT_CONSENT_REQUIRED",
  })
}

export async function POST(request: Request) {
  let createdDocumentId: string | null = null

  try {
    const user = await getCurrentTenantUser()
    assertRateLimit({ key: rateLimitKey(["upload_document", user.organizationId, user.id]), limit: 30, windowMs: 60_000 })
    const formData = await request.formData()
    const file = formData.get("file")
    const existingDocumentId = readString(formData, "documentId")

    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "Le fichier est requis.", 422)
    }

    validateDocumentFile(file)

    if (existingDocumentId) {
      const existing = await prisma.document.findFirst({
        where: { id: existingDocumentId, organizationId: user.organizationId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
          task: { select: { id: true, title: true } },
          folder: { select: { id: true, name: true, path: true, parentId: true } },
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
      })
      if (!existing) return fail("NOT_FOUND", "Document introuvable.", 404)
      await assertDocumentVaultConsent({ organizationId: user.organizationId, clientId: existing.clientId ?? existing.product?.clientId })

      const safeFileName = sanitizeFileName(file.name)
      const bucket = getDocumentsBucket()
      const storagePath = buildStoragePath({
        organizationId: user.organizationId,
        documentId: existing.id,
        fileName: safeFileName,
        clientId: existing.clientId ?? undefined,
        leadId: existing.leadId ?? undefined,
        productId: existing.productId ?? undefined,
        kycProfileId: existing.kycProfileId ?? undefined,
      })

      const supabase = getSupabaseServerClient()
      const checksum = await getFileChecksum(file)
      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true,
      })

      if (uploadError) {
        return fail("UPLOAD_FAILED", "Le téléversement Supabase a échoué. Vérifiez le bucket privé et la clé service role.", 500)
      }

      await prisma.document.updateMany({
        where: { id: existing.id, organizationId: user.organizationId },
        data: {
          name: readString(formData, "name") ?? existing.name,
          description: readString(formData, "description") ?? existing.description,
          status: "RECEIVED",
          storageBucket: bucket,
          storagePath,
          storageProvider: "SUPABASE",
          storageKey: storagePath,
          originalFileName: file.name,
          fileName: safeFileName,
          mimeType: file.type,
          fileSize: file.size,
          checksum,
          receivedAt: new Date(),
        },
      })

      const updated = await prisma.document.findFirstOrThrow({
        where: { id: existing.id, organizationId: user.organizationId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
          task: { select: { id: true, title: true } },
          folder: { select: { id: true, name: true, path: true, parentId: true } },
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
      })
      await createDocumentVersionSnapshot({
        user,
        document: updated,
        changeReason: "Fichier téléversé pour une demande documentaire existante",
        metadata: { source: "advisor_upload", checksum },
      })
      await logDocumentAccess({
        user,
        document: updated,
        eventType: "UPLOAD",
        request,
        purpose: "Téléversement conseiller",
        metadata: { fileName: safeFileName, existingDocumentId: existing.id },
      })
      await markDocumentRequestItemsReceived({
        user,
        documentId: updated.id,
        request,
        source: "advisor_upload",
      })

      await createCrmActivity({
        organizationId: user.organizationId,
        userId: user.id,
        clientId: updated.clientId,
        leadId: updated.leadId,
        type: "DOCUMENT_UPLOADED",
        title: "Document demandé reçu",
        description: updated.name,
      })

      return ok(updated)
    }

    const payload = createDocumentSchema.parse({
      clientId: readString(formData, "clientId"),
      leadId: readString(formData, "leadId"),
      productId: readString(formData, "productId"),
      taskId: readString(formData, "taskId"),
      kycProfileId: readString(formData, "kycProfileId"),
      folderId: readString(formData, "folderId"),
      type: readString(formData, "type") ?? "OTHER",
      visibility: readString(formData, "visibility") ?? "TEAM",
      status: "RECEIVED",
      name: readString(formData, "name") ?? file.name,
      description: readString(formData, "description"),
      expiresAt: readString(formData, "expiresAt"),
    })
    let consentClientId = payload.clientId
    if (!consentClientId && payload.productId) {
      const product = await prisma.financialProduct.findFirst({
        where: { id: payload.productId, organizationId: user.organizationId },
        select: { clientId: true },
      })
      consentClientId = product?.clientId
    }
    if (!consentClientId && payload.kycProfileId) {
      const profile = await prisma.clientKycProfile.findFirst({
        where: { id: payload.kycProfileId, organizationId: user.organizationId },
        select: { clientId: true },
      })
      consentClientId = profile?.clientId
    }
    await assertDocumentVaultConsent({ organizationId: user.organizationId, clientId: consentClientId })

    const document = await createDocument({ user, data: payload })
    createdDocumentId = document.id

    const safeFileName = sanitizeFileName(file.name)
    const bucket = getDocumentsBucket()
    const storagePath = buildStoragePath({
      organizationId: user.organizationId,
      documentId: document.id,
      fileName: safeFileName,
      clientId: payload.clientId,
      leadId: payload.leadId,
      productId: payload.productId,
      kycProfileId: payload.kycProfileId,
    })

    const supabase = getSupabaseServerClient()
    const checksum = await getFileChecksum(file)
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      await prisma.document.deleteMany({ where: { id: document.id, organizationId: user.organizationId } }).catch(() => undefined)
      return fail("UPLOAD_FAILED", "Le téléversement Supabase a échoué. Vérifiez le bucket privé et la clé service role.", 500)
    }

    await prisma.document.updateMany({
      where: { id: document.id, organizationId: user.organizationId },
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
        receivedAt: new Date(),
      },
    })

    const updated = await prisma.document.findFirstOrThrow({
      where: { id: document.id, organizationId: user.organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
        task: { select: { id: true, title: true } },
        folder: { select: { id: true, name: true, path: true, parentId: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    })
    await createDocumentVersionSnapshot({
      user,
      document: updated,
      changeReason: "Fichier téléversé au coffre documentaire",
      metadata: { source: "advisor_upload", checksum },
    })
    await logDocumentAccess({
      user,
      document: updated,
      eventType: "UPLOAD",
      request,
      purpose: "Téléversement conseiller",
      metadata: { fileName: safeFileName },
    })

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: updated.clientId,
      leadId: updated.leadId,
      type: "DOCUMENT_UPLOADED",
      title: "Document téléversé",
      description: updated.name,
    })

    return ok(updated, { status: 201 })
  } catch (error) {
    if (createdDocumentId) {
      const tenant = await getTenantContext().catch(() => null)
      if (tenant) {
        await prisma.document.deleteMany({ where: { id: createdDocumentId, organizationId: tenant.organizationId } }).catch(() => undefined)
      }
    }
    return handleDocumentError(error)
  }
}
