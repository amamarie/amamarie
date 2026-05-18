import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { createDocument, getDocuments } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { createDocumentSchema, documentQuerySchema } from "@/lib/validations/document"

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentTenantUser()
    const query = documentQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
    return ok(await getDocuments({ user, query }))
  } catch (error) {
    return handleDocumentError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentTenantUser()
    const payload = createDocumentSchema.parse(await request.json())
    if (payload.clientId && !["REQUESTED", "REQUIRED"].includes(payload.status) && payload.type !== "CONSENT_FORM") {
      await assertActivePurposeConsent({
        organizationId: user.organizationId,
        clientId: payload.clientId,
        purposeCode: "document_vault",
        errorCode: "DOCUMENT_VAULT_CONSENT_REQUIRED",
      })
    }
    return ok(await createDocument({ user, data: payload }), { status: 201 })
  } catch (error) {
    return handleDocumentError(error)
  }
}
