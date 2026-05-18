import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { ensureDefaultPrivacyPurposes } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    const { organizationId } = await getTenantContext()
    await ensureDefaultPrivacyPurposes(organizationId, user.id)
    return ok(await prisma.privacyPurpose.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!["OWNER", "COMPLIANCE", "DEVELOPER"].includes(user.role)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    const body = await request.json()
    const purpose = await prisma.privacyPurpose.create({
      data: {
        organizationId,
        code: String(body.code ?? "").trim(),
        name: String(body.name ?? "").trim(),
        description: typeof body.description === "string" ? body.description.trim() : null,
        isRequiredForService: Boolean(body.isRequiredForService),
        sensitiveDataAllowed: Boolean(body.sensitiveDataAllowed),
        consentRequired: body.consentRequired !== false,
        active: body.active !== false,
      },
    })
    await createAuditLog({ organizationId, userId: user.id, entityType: "PrivacyPurpose", entityId: purpose.id, action: "PRIVACY_PURPOSE_CREATED", newValue: { code: purpose.code, name: purpose.name } })
    return ok(purpose, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
