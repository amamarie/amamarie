import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent, assertApprovedPia, assertConsentBelongsToClient } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    return ok(await prisma.dataDisclosure.findMany({ where: { organizationId, clientId: id }, include: { purpose: true, consent: true, disclosedBy: { select: { id: true, name: true, role: true } } }, orderBy: { disclosedAt: "desc" } }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const purpose = typeof body.purposeId === "string"
      ? await prisma.privacyPurpose.findFirst({ where: { id: body.purposeId, organizationId }, select: { id: true, code: true } })
      : await prisma.privacyPurpose.findFirst({ where: { organizationId, code: "insurer_disclosure" }, select: { id: true, code: true } })
    const providedConsentId = typeof body.consentId === "string" ? body.consentId : null
    let consentId = providedConsentId
    if (purpose?.code === "insurer_disclosure" || !body.purposeId) {
      if (providedConsentId) {
        await assertConsentBelongsToClient({ organizationId, clientId: id, consentId: providedConsentId, purposeCode: "insurer_disclosure" })
      } else {
        const consent = await assertActivePurposeConsent({ organizationId, clientId: id, purposeCode: "insurer_disclosure", errorCode: "DISCLOSURE_CONSENT_REQUIRED" })
        consentId = consent.id
      }
    }
    if (body.outsideQuebec) await assertApprovedPia({ organizationId, piaId: typeof body.piaId === "string" ? body.piaId : null })
    const disclosure = await prisma.dataDisclosure.create({
      data: {
        organizationId,
        clientId: id,
        purposeId: purpose?.id ?? null,
        consentId,
        disclosedById: userId,
        recipientName: String(body.recipientName ?? "").trim(),
        recipientType: String(body.recipientType ?? "THIRD_PARTY"),
        dataCategories: body.dataCategories ?? undefined,
        documentIds: body.documentIds ?? undefined,
        method: String(body.method ?? "SECURE_PORTAL"),
        outsideQuebec: Boolean(body.outsideQuebec),
        piaId: typeof body.piaId === "string" ? body.piaId : null,
        contractReference: typeof body.contractReference === "string" ? body.contractReference : null,
        externalReference: typeof body.externalReference === "string" ? body.externalReference : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({ organizationId, userId, clientId: id, entityType: "DataDisclosure", entityId: disclosure.id, action: "DATA_DISCLOSURE_LOGGED", newValue: { recipientName: disclosure.recipientName, outsideQuebec: disclosure.outsideQuebec } })
    return ok(disclosure, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "DISCLOSURE_CONSENT_REQUIRED") return fail("DISCLOSURE_CONSENT_REQUIRED", "Un consentement actif de communication à un assureur ou tiers autorisé est requis.", 403)
    if (error instanceof Error && error.message === "CONSENT_NOT_ACTIVE_FOR_CLIENT") return fail("CONSENT_NOT_ACTIVE_FOR_CLIENT", "Le consentement fourni n’est pas actif pour ce client et cette finalité.", 403)
    if (error instanceof Error && error.message === "PIA_REQUIRED") return fail("PIA_REQUIRED", "Une EFVP est requise avant une communication hors Québec.", 422)
    if (error instanceof Error && error.message === "PIA_NOT_APPROVED") return fail("PIA_NOT_APPROVED", "L’EFVP liée doit être approuvée avant la communication hors Québec.", 422)
    return handleApiError(error)
  }
}
