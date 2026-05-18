import { fail, ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { createDocument } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { createDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const tenant = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
    const client = await prisma.client.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const body = await request.json()
    const payload = createDocumentSchema.parse({ ...body, clientId: id })
    if (!["REQUESTED", "REQUIRED"].includes(payload.status) && payload.type !== "CONSENT_FORM") {
      await assertActivePurposeConsent({ organizationId: user.organizationId, clientId: id, purposeCode: "document_vault", errorCode: "DOCUMENT_VAULT_CONSENT_REQUIRED" })
    }
    return ok(await createDocument({ user, data: payload }), { status: 201 })
  } catch (error) {
    return handleDocumentError(error)
  }
}
