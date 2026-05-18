import { ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { lockDocumentSchema } from "@/lib/validations/document"

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
    const existing = await getDocumentById({ user, id })
    const payload = lockDocumentSchema.parse(await request.json().catch(() => ({})))

    const document = await prisma.document.update({
      where: { id: existing.id },
      data: { isLocked: true, lockedAt: existing.lockedAt ?? new Date() },
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
      eventType: "LOCK",
      request,
      purpose: payload.reason ?? "Document verrouillé comme preuve documentaire",
      metadata: { reason: payload.reason ?? null },
    })

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: document.clientId,
      leadId: document.leadId,
      documentId: document.id,
      type: "DOCUMENT_STATUS_CHANGED",
      title: "Document verrouillé",
      description: payload.reason ?? "Document figé comme preuve au dossier.",
      entityType: "Document",
      entityId: document.id,
      metadata: { reason: payload.reason ?? null, lockedAt: document.lockedAt?.toISOString() ?? null },
    })

    return ok(document)
  } catch (error) {
    return handleDocumentError(error)
  }
}
