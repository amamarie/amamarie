import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { prisma } from "@/lib/prisma"
import { createConsentEvent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"
import { updateConsentSchema } from "@/lib/validations/consent"

type RouteContext = { params: Promise<{ id: string; consentId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, consentId } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = updateConsentSchema.parse(await request.json())
    const existing = await prisma.clientConsent.findFirst({ where: { id: consentId, clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Consentement introuvable.", 404)
    const dataCategories = payload.dataCategories === undefined ? undefined : payload.dataCategories === null ? Prisma.JsonNull : payload.dataCategories as Prisma.InputJsonValue
    const thirdParties = payload.thirdParties === undefined ? undefined : payload.thirdParties === null ? Prisma.JsonNull : payload.thirdParties as Prisma.InputJsonValue
    const consent = await prisma.clientConsent.update({
      where: { id: consentId },
      data: {
        type: payload.type,
        purposeId: payload.purposeId,
        templateId: payload.templateId,
        status: payload.status,
        consentText: payload.consentText,
        version: payload.version,
        language: payload.language,
        method: payload.method,
        purposeText: payload.purposeText,
        dataCategories,
        thirdParties,
        isSensitive: payload.isSensitive,
        isRequiredForService: payload.isRequiredForService,
        withdrawalAllowed: payload.withdrawalAllowed,
        proofDocumentId: payload.proofDocumentId,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
        givenAt: payload.status === "GIVEN" ? payload.givenAt ?? existing.givenAt ?? new Date() : payload.givenAt,
        revokedAt: payload.revokedAt,
        expiresAt: payload.expiresAt,
        notes: payload.notes,
      },
    })
    await createConsentEvent({
      organizationId,
      consentId: consent.id,
      eventType: "UPDATED",
      actorType: "ADVISOR",
      actorId: userId,
      metadata: { status: consent.status, type: consent.type },
    })
    await createAuditLog({ organizationId, userId, clientId: id, entityType: "CONSENT", entityId: consent.id, action: "CONSENT_UPDATED", newValue: { status: consent.status } })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId })
    return ok(consent)
  } catch (error) {
    return handleApiError(error)
  }
}
