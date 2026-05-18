import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.privacyVendor.findMany({
      where: { organizationId },
      include: { ownerUser: { select: { id: true, name: true, role: true } }, reviewedBy: { select: { id: true, name: true, role: true } } },
      orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "desc" }],
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : ""
    if (!name || !serviceType) return fail("VALIDATION_ERROR", "Le nom et le type de service sont requis.", 422)
    const vendor = await prisma.privacyVendor.create({
      data: {
        organizationId,
        ownerUserId: typeof body.ownerUserId === "string" ? body.ownerUserId : userId,
        name,
        serviceType,
        status: typeof body.status === "string" ? body.status : "ACTIVE",
        dataCategories: body.dataCategories === undefined ? Prisma.JsonNull : body.dataCategories,
        dataLocation: typeof body.dataLocation === "string" ? body.dataLocation : null,
        outsideQuebec: Boolean(body.outsideQuebec),
        subprocessors: body.subprocessors === undefined ? Prisma.JsonNull : body.subprocessors,
        contractSigned: Boolean(body.contractSigned),
        contractReference: typeof body.contractReference === "string" ? body.contractReference : null,
        piaId: typeof body.piaId === "string" ? body.piaId : null,
        piaCompleted: Boolean(body.piaCompleted),
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "MEDIUM",
        safeguards: typeof body.safeguards === "string" ? body.safeguards : null,
        lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : null,
        nextReviewAt: body.nextReviewAt ? new Date(body.nextReviewAt) : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyVendor", entityId: vendor.id, action: "PRIVACY_VENDOR_CREATED", newValue: { name: vendor.name, outsideQuebec: vendor.outsideQuebec } })
    return ok(vendor, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
