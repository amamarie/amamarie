import { fail, handleApiError, ok } from "@/lib/api-response"
import { getClientPortalApiUser, findClientPortalRecord } from "@/lib/client-portal"
import { syncOpportunityFromAnalysis } from "@/lib/insurance-needs/opportunity-sync"
import { prisma } from "@/lib/prisma"

const confirmationText =
  "Je confirme avoir accès au rapport d’analyse des besoins dans mon espace client. Je comprends que ce rapport sert de base de discussion et que la recommandation finale doit être validée avec mon conseiller."

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1000) : null
}

function requiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.accepted !== true) return fail("CONSENT_REQUIRED", "La confirmation explicite est requise.", 422)
    const typedSignature = requiredText(body.typedSignature)
    if (typedSignature.length < 2) return fail("SIGNATURE_REQUIRED", "La signature électronique par nom tapé est requise.", 422)

    const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
      where: { id, clientId: client.id, organizationId: client.organizationId },
      include: { reportDocument: true },
    })
    if (!analysis) return fail("ANALYSIS_NOT_FOUND", "Analyse introuvable pour ce dossier client.", 404)
    if (!analysis.reportDocumentId) return fail("REPORT_REQUIRED", "Le rapport doit être disponible avant la confirmation.", 422)
    if (!analysis.reportDocument || analysis.reportDocument.visibility !== "CLIENT_VISIBLE") {
      return fail("REPORT_NOT_SENT", "Le rapport doit être envoyé au client par le conseiller avant la confirmation.", 422)
    }
    if (!["REQUESTED", "VALIDATED"].includes(analysis.reportDocument.status)) {
      return fail("REPORT_NOT_READY", "Le rapport n’est pas encore prêt pour confirmation client.", 422)
    }

    const now = new Date()
    const note = cleanText(body.note)

    const consent = await prisma.clientConsent.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        capturedById: user.id,
        type: "INSURANCE_ANALYSIS_RECEIPT",
        status: "GIVEN",
        consentText: confirmationText,
        version: "portal-insurance-analysis-v1",
        givenAt: now,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
        notes: JSON.stringify({ note, typedSignature }),
      },
    })

    const updated = await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: {
        clientConfirmedAt: now,
        deliveredAt: analysis.deliveredAt ?? now,
        signatureDocumentId: analysis.signatureDocumentId ?? analysis.reportDocumentId,
        signedAt: analysis.signedAt ?? now,
        status: analysis.status === "USED_FOR_SUBMISSION" || analysis.status === "ARCHIVED" ? analysis.status : "DELIVERED",
      },
      include: {
        reportDocument: true,
        results: { orderBy: { createdAt: "desc" }, take: 1 },
        recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    })

    await prisma.document.update({
      where: { id: analysis.reportDocumentId },
      data: {
        status: "VALIDATED",
        validatedAt: now,
      },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        documentId: analysis.reportDocumentId,
        type: "CONSENT_GIVEN",
        title: "Rapport d’analyse confirmé par le client",
        description: note ?? `Signature client: ${typedSignature}`,
        source: "CLIENT_PORTAL",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        action: "CLIENT_RECEIPT_CONFIRMED",
        newValue: {
          consentId: consent.id,
          reportDocumentId: analysis.reportDocumentId,
          signatureDocumentId: updated.signatureDocumentId,
          deliveredAt: updated.deliveredAt,
          signedAt: updated.signedAt,
          status: updated.status,
          typedSignature,
        },
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    })
    await syncOpportunityFromAnalysis({ organizationId: client.organizationId, userId: user.id, analysisId: analysis.id })

    if (client.advisorId) {
      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "INFO",
          priority: "NORMAL",
          status: "UNREAD",
          title: "Rapport d’analyse confirmé",
          message: `${client.firstName} ${client.lastName} a confirmé la réception du rapport d’analyse.`,
          actionLabel: "Ouvrir l’analyse",
          actionUrl: `/clients/${client.id}?tab=needs&analysisId=${analysis.id}`,
          href: `/clients/${client.id}?tab=needs&analysisId=${analysis.id}`,
          entityType: "CLIENT",
          entityId: client.id,
          clientId: client.id,
        },
      })
    }

    return ok({ analysis: updated, consent }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
