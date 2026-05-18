import { NextResponse } from "next/server"

import { sendInsuranceNeedsSmartDocumentRequests } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const result = await sendInsuranceNeedsSmartDocumentRequests({ organizationId, userId, analysisId: id })
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_SUMMARY_MISSING") return NextResponse.json({ error: "Recalculez l’analyse avant de demander les documents suggérés." }, { status: 409 })
    if (error instanceof Error && error.message === "AI_DOCUMENTS_EMPTY") return NextResponse.json({ error: "Aucun document suggéré à demander." }, { status: 409 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de demander les documents suggérés." }, { status: 403 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant d’utiliser les suggestions de documents." }, { status: 403 })
    if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif de conservation documentaire est requis avant de demander les documents suggérés." }, { status: 403 })
    if (error instanceof Error && error.message === "CLIENT_EMAIL_MISSING") return NextResponse.json({ error: "Aucun courriel client disponible pour envoyer la demande." }, { status: 409 })
    if (error instanceof Error && error.message === "CLIENT_PHONE_MISSING") return NextResponse.json({ error: "Aucun numéro client disponible pour envoyer la demande." }, { status: 409 })
    if (error instanceof Error && error.message === "GMAIL_NOT_CONNECTED") return NextResponse.json({ error: "Connectez Gmail dans Paramètres ou configurez un expéditeur courriel avant d’envoyer la demande." }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’envoyer les demandes de documents." }, { status: 400 })
  }
}
