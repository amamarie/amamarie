import { fail, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const document = await getDocumentById({ user, id })
    if (document.clientId) {
      await assertActiveAiConsent({ organizationId: user.organizationId, clientId: document.clientId })
    }

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: document.clientId,
      leadId: document.leadId,
      documentId: document.id,
      type: "DOCUMENT_UPDATED",
      title: "OCR demandé",
      description: `${document.name} sera analysé, puis validé manuellement.`,
      entityType: "Document",
      entityId: document.id,
      metadata: {
        requiresHumanReview: true,
        documentName: document.name,
      },
    })

    return ok({
      queued: true,
      requiresHumanReview: true,
      message: "OCR planifié. Une validation humaine sera requise.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return fail("AI_CONSENT_REQUIRED", "Le consentement d’assistance technologique / IA doit être actif avant de lancer l’OCR.", 403)
    return handleDocumentError(error)
  }
}
