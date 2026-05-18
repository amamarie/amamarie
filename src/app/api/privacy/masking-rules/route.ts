import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.sensitiveMaskingRule.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { dataCategory: "asc" }] }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const dataCategory = typeof body.dataCategory === "string" ? body.dataCategory.trim() : ""
    const fieldPattern = typeof body.fieldPattern === "string" ? body.fieldPattern.trim() : ""
    if (!dataCategory || !fieldPattern) return fail("VALIDATION_ERROR", "La catégorie et le champ à masquer sont requis.", 422)
    const rule = await prisma.sensitiveMaskingRule.create({
      data: {
        organizationId,
        createdById: userId,
        dataCategory,
        fieldPattern,
        maskingMode: typeof body.maskingMode === "string" ? body.maskingMode : "PARTIAL",
        rolesAllowed: body.rolesAllowed === undefined ? Prisma.JsonNull : body.rolesAllowed,
        appliesToPortal: typeof body.appliesToPortal === "boolean" ? body.appliesToPortal : true,
        active: typeof body.active === "boolean" ? body.active : true,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "SensitiveMaskingRule", entityId: rule.id, action: "MASKING_RULE_CREATED", newValue: { dataCategory, fieldPattern } })
    return ok(rule, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
