import { fail, ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { extractPolicyFromDocument } from "@/lib/documents/policy-extraction"
import { prisma } from "@/lib/prisma"
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
    return ok(await extractPolicyFromDocument({ user, documentId: id }))
  } catch (error) {
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return fail("AI_CONSENT_REQUIRED", "Le consentement d’assistance technologique / IA doit être actif avant l’extraction de police.", 403)
    if (error instanceof Error && error.message === "CLIENT_REQUIRED") return fail("CLIENT_REQUIRED", "Le document doit être lié à un client avant l’extraction.", 422)
    if (error instanceof Error && error.message === "POLICY_DOCUMENT_REQUIRED") return fail("POLICY_DOCUMENT_REQUIRED", "L’extraction IA est réservée aux polices ou contrats d’assurance.", 422)
    return handleDocumentError(error)
  }
}
