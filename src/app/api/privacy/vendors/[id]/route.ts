import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const vendor = await prisma.privacyVendor.findFirst({ where: { id, organizationId }, include: { ownerUser: { select: { id: true, name: true, role: true } }, reviewedBy: { select: { id: true, name: true, role: true } } } })
    if (!vendor) return fail("NOT_FOUND", "Fournisseur introuvable.", 404)
    return ok(vendor)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existing = await prisma.privacyVendor.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!existing) return fail("NOT_FOUND", "Fournisseur introuvable.", 404)
    const body = await request.json()
    const vendor = await prisma.privacyVendor.update({
      where: { id },
      data: {
        name: typeof body.name === "string" ? body.name.trim() : undefined,
        serviceType: typeof body.serviceType === "string" ? body.serviceType.trim() : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        dataCategories: body.dataCategories === undefined ? undefined : body.dataCategories === null ? Prisma.JsonNull : body.dataCategories,
        dataLocation: typeof body.dataLocation === "string" ? body.dataLocation : undefined,
        outsideQuebec: typeof body.outsideQuebec === "boolean" ? body.outsideQuebec : undefined,
        subprocessors: body.subprocessors === undefined ? undefined : body.subprocessors === null ? Prisma.JsonNull : body.subprocessors,
        contractSigned: typeof body.contractSigned === "boolean" ? body.contractSigned : undefined,
        contractReference: typeof body.contractReference === "string" ? body.contractReference : undefined,
        piaId: typeof body.piaId === "string" ? body.piaId : undefined,
        piaCompleted: typeof body.piaCompleted === "boolean" ? body.piaCompleted : undefined,
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : undefined,
        safeguards: typeof body.safeguards === "string" ? body.safeguards : undefined,
        lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : undefined,
        nextReviewAt: body.nextReviewAt ? new Date(body.nextReviewAt) : undefined,
        reviewedById: body.markReviewed ? userId : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyVendor", entityId: vendor.id, action: "PRIVACY_VENDOR_UPDATED", newValue: { status: vendor.status, riskLevel: vendor.riskLevel } })
    return ok(vendor)
  } catch (error) {
    return handleApiError(error)
  }
}
