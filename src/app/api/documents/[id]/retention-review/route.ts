import { Prisma } from "@prisma/client"

import { ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { retentionReviewDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

function addYears(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const existing = await getDocumentById({ user, id })
    const payload = retentionReviewDocumentSchema.parse(await request.json())
    const reviewAt = payload.retentionReviewAt ?? addYears(7)
    const currentSecurityMetadata = existing.securityMetadata && typeof existing.securityMetadata === "object" && !Array.isArray(existing.securityMetadata)
      ? existing.securityMetadata as Record<string, unknown>
      : {}
    const previousRetentionEvents = Array.isArray(currentSecurityMetadata.retentionEvents) ? currentSecurityMetadata.retentionEvents : []
    const retentionEvent = {
      policy: payload.policy,
      action: payload.action,
      reason: payload.reason,
      retentionReviewAt: reviewAt.toISOString(),
      recordedAt: new Date().toISOString(),
      recordedById: user.id,
    }

    const document = await prisma.document.update({
      where: { id: existing.id },
      data: {
        retentionPolicyId: payload.policy,
        retentionReviewAt: reviewAt,
        securityMetadata: {
          ...currentSecurityMetadata,
          retentionEvents: [...previousRetentionEvents, retentionEvent],
        } as Prisma.InputJsonValue,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
        task: { select: { id: true, title: true } },
        folder: { select: { id: true, name: true, path: true, parentId: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    })

    await logDocumentAccess({
      user,
      document,
      eventType: payload.action === "ARCHIVE" ? "ARCHIVE" : "UPDATE",
      request,
      purpose: "Revue de conservation documentaire",
      metadata: retentionEvent as Prisma.InputJsonValue,
    })

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: document.clientId,
      leadId: document.leadId,
      documentId: document.id,
      type: "DOCUMENT_STATUS_CHANGED",
      title: "Revue de conservation planifiée",
      description: `${document.name}: ${payload.reason}`,
      entityType: "Document",
      entityId: document.id,
      metadata: retentionEvent,
    })

    return ok({ document, retention: retentionEvent })
  } catch (error) {
    return handleDocumentError(error)
  }
}
