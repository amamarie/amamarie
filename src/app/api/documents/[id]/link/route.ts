import { Prisma } from "@prisma/client"

import { ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { linkDocumentToEntity, logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { linkDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const document = await getDocumentById({ user, id })
    const payload = linkDocumentSchema.parse(await request.json())

    const link = await linkDocumentToEntity({
      user,
      document,
      linkedEntityType: payload.linkedEntityType,
      linkedEntityId: payload.linkedEntityId,
      relationshipType: payload.relationshipType,
      label: payload.label,
      sourceFieldKey: payload.sourceFieldKey,
      proofStatus: payload.proofStatus,
      metadata: payload.metadata as Prisma.InputJsonValue | undefined,
    })

    let updatedDocument = document
    if (payload.lockDocument || payload.relationshipType === "USED_FOR_RECOMMENDATION" || payload.relationshipType === "SIGNED_PROOF") {
      updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: { isLocked: true, lockedAt: document.lockedAt ?? new Date() },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
          product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
          task: { select: { id: true, title: true } },
          folder: { select: { id: true, name: true, path: true, parentId: true } },
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
      })
    }

    await logDocumentAccess({
      user,
      document: updatedDocument,
      eventType: "LINK",
      request,
      purpose: "Lien métier ajouté au coffre documentaire",
      metadata: {
        linkId: link.id,
        linkedEntityType: payload.linkedEntityType,
        linkedEntityId: payload.linkedEntityId,
        relationshipType: payload.relationshipType,
        lockDocument: payload.lockDocument,
      },
    })

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: updatedDocument.clientId,
      leadId: updatedDocument.leadId,
      documentId: updatedDocument.id,
      type: "DOCUMENT_STATUS_CHANGED",
      title: "Document lié au dossier",
      description: payload.label ?? `${payload.relationshipType} → ${payload.linkedEntityType}`,
      entityType: "DocumentLink",
      entityId: link.id,
      metadata: {
        documentId: updatedDocument.id,
        linkedEntityType: payload.linkedEntityType,
        linkedEntityId: payload.linkedEntityId,
        relationshipType: payload.relationshipType,
        locked: updatedDocument.isLocked,
      },
    })

    return ok({ document: updatedDocument, link })
  } catch (error) {
    return handleDocumentError(error)
  }
}
