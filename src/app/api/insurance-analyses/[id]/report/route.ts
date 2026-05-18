import { NextResponse } from "next/server"

import { generateInsuranceNeedsReport } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const analysis = await generateInsuranceNeedsReport({ organizationId, userId, analysisId: id })
    return NextResponse.json({ data: analysis })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "ANALYSIS_SIGNED_LOCKED") return NextResponse.json({ error: "Cette analyse est déjà signée. Créez une nouvelle version avant de générer un nouveau rapport." }, { status: 409 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_CALCULATED") return NextResponse.json({ error: "Calculez l’analyse avant de générer le rapport." }, { status: 409 })
    if (error instanceof Error && error.message === "ANALYSIS_MISSING_DATA") return NextResponse.json({ error: "Le rapport est bloqué parce que l’analyse contient encore des données manquantes. Complétez les champs requis, recalculez, puis générez le rapport." }, { status: 409 })
    if (error instanceof Error && error.message === "REPORT_ALREADY_SENT") return NextResponse.json({ error: "Ce rapport a déjà été envoyé au client. Il ne peut plus être régénéré sans relancer un nouveau cycle de remise." }, { status: 409 })
    if (error instanceof Error && error.message === "REPORT_ALREADY_CONFIRMED") return NextResponse.json({ error: "Ce rapport est déjà confirmé par le client. Créez une nouvelle analyse ou une nouvelle version si la situation a changé." }, { status: 409 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de générer le rapport." }, { status: 403 })
    if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif de conservation documentaire est requis avant de générer le rapport." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de générer le rapport." }, { status: 400 })
  }
}
