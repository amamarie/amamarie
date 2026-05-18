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
    return ok(await prisma.consentTemplate.findMany({ where: { organizationId }, include: { purpose: true }, orderBy: [{ active: "desc" }, { updatedAt: "desc" }] }))
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
    const template = await prisma.consentTemplate.create({
      data: {
        organizationId,
        purposeId: typeof body.purposeId === "string" ? body.purposeId : null,
        createdById: user.id,
        version: String(body.version ?? "1.0"),
        language: String(body.language ?? "FR"),
        title: String(body.title ?? "").trim(),
        body: String(body.body ?? "").trim(),
        requiresExplicitAction: body.requiresExplicitAction !== false,
        isSensitive: Boolean(body.isSensitive),
        active: body.active !== false,
      },
    })
    await createAuditLog({ organizationId, userId: user.id, entityType: "ConsentTemplate", entityId: template.id, action: "CONSENT_TEMPLATE_CREATED", newValue: { title: template.title, version: template.version } })
    return ok(template, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
