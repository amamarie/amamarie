import { Prisma } from "@prisma/client"

import { fail, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { assertComplianceWorkflowClear, ComplianceWorkflowBlockedError } from "@/lib/compliance/workflow-guards"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent, assertApprovedPia, assertConsentBelongsToClient } from "@/lib/privacy/service"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { shareDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const existing = await getDocumentById({ user, id })
    if (existing.visibility === "COMPLIANCE_ONLY" && user.role !== "OWNER" && user.role !== "COMPLIANCE") throw new Error("DOCUMENT_FORBIDDEN")

    const payload = shareDocumentSchema.parse(await request.json())
    const isExternalRecipient = !["CLIENT", "CONFORMITE"].includes(payload.recipientType) && payload.deliveryMethod !== "INTERNE"
    if (isExternalRecipient && existing.clientId) {
      await assertComplianceWorkflowClear({
        organizationId: user.organizationId,
        clientId: existing.clientId,
        action: "EXTERNAL_DOCUMENT_SHARE",
      })
    }
    if (payload.outsideQuebec) {
      await assertApprovedPia({ organizationId: user.organizationId, piaId: payload.piaId })
    }
    let disclosureConsentId = payload.consentId ?? null
    if (isExternalRecipient && existing.clientId) {
      if (payload.consentId) {
        await assertConsentBelongsToClient({ organizationId: user.organizationId, clientId: existing.clientId, consentId: payload.consentId, purposeCode: "insurer_disclosure" })
      } else {
        const consent = await assertActivePurposeConsent({
          organizationId: user.organizationId,
          clientId: existing.clientId,
          purposeCode: "insurer_disclosure",
          errorCode: "DISCLOSURE_CONSENT_REQUIRED",
        })
        disclosureConsentId = consent.id
      }
    }
    const shareMetadata = {
      recipientType: payload.recipientType,
      recipientName: payload.recipientName,
      recipientEmail: payload.recipientEmail ?? null,
      deliveryMethod: payload.deliveryMethod,
      purpose: payload.purpose,
      expiresAt: payload.expiresAt?.toISOString() ?? null,
      allowDownload: payload.allowDownload,
      consentId: disclosureConsentId,
      outsideQuebec: payload.outsideQuebec,
      piaId: payload.piaId ?? null,
      contractReference: payload.contractReference ?? null,
      sharedAt: new Date().toISOString(),
      sharedById: user.id,
    }

    const currentSecurityMetadata = existing.securityMetadata && typeof existing.securityMetadata === "object" && !Array.isArray(existing.securityMetadata)
      ? existing.securityMetadata as Record<string, unknown>
      : {}
    const previousShares = Array.isArray(currentSecurityMetadata.shares) ? currentSecurityMetadata.shares : []

    const document = await prisma.document.update({
      where: { id: existing.id },
      data: {
        externalSharingEnabled: payload.recipientType !== "CLIENT" && payload.deliveryMethod !== "INTERNE",
        publicLinkActive: false,
        securityMetadata: {
          ...currentSecurityMetadata,
          shares: [...previousShares, shareMetadata],
        } as Prisma.InputJsonValue,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        lead: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
        product: { select: { id: true, productName: true, company: true, type: true, clientId: true } },
        task: { select: { id: true, title: true } },
        folder: { select: { id: true, name: true, path: true, parentId: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
    })

    await logDocumentAccess({
      user,
      document,
      eventType: "SHARE",
      request,
      purpose: payload.purpose,
      metadata: shareMetadata as Prisma.InputJsonValue,
    })

    if (isExternalRecipient && document.clientId) {
      const purpose = await prisma.privacyPurpose.findFirst({
        where: { organizationId: user.organizationId, code: "insurer_disclosure" },
        select: { id: true },
      })
      await prisma.dataDisclosure.create({
        data: {
          organizationId: user.organizationId,
          clientId: document.clientId,
          purposeId: purpose?.id ?? null,
          consentId: disclosureConsentId,
          disclosedById: user.id,
          recipientName: payload.recipientName,
          recipientType: payload.recipientType,
          dataCategories: ["DOCUMENT", document.type, document.sensitivityLevel],
          documentIds: [document.id],
          method: payload.deliveryMethod,
          outsideQuebec: payload.outsideQuebec,
          piaId: payload.piaId ?? null,
          contractReference: payload.contractReference ?? null,
          notes: payload.purpose,
        },
      })
    }

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: document.clientId,
      leadId: document.leadId,
      documentId: document.id,
      type: "DOCUMENT_STATUS_CHANGED",
      title: "Partage documentaire journalisé",
      description: `${document.name} partagé avec ${payload.recipientName} (${payload.deliveryMethod}).`,
      entityType: "Document",
      entityId: document.id,
      metadata: shareMetadata,
    })

    return ok({ document, share: shareMetadata })
  } catch (error) {
    if (error instanceof Error && error.message === "DISCLOSURE_CONSENT_REQUIRED") return fail("DISCLOSURE_CONSENT_REQUIRED", "Un consentement actif de communication à un assureur ou tiers autorisé est requis avant ce partage externe.", 403)
    if (error instanceof Error && error.message === "CONSENT_NOT_ACTIVE_FOR_CLIENT") return fail("CONSENT_NOT_ACTIVE_FOR_CLIENT", "Le consentement fourni n’est pas actif pour ce client et cette finalité.", 403)
    if (error instanceof Error && error.message === "PIA_REQUIRED") return fail("PIA_REQUIRED", "Une EFVP est requise avant une communication hors Québec.", 422)
    if (error instanceof Error && error.message === "PIA_NOT_APPROVED") return fail("PIA_NOT_APPROVED", "L’EFVP liée doit être approuvée avant la communication hors Québec.", 422)
    if (error instanceof ComplianceWorkflowBlockedError) return fail("COMPLIANCE_WORKFLOW_BLOCKED", "Action bloquée par la conformité: une alerte critique, plainte, incident, supervision, checklist ou exception ouverte doit être résolue.", 409, { blockers: error.blockers })
    return handleDocumentError(error)
  }
}
