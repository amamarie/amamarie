import { NextResponse } from "next/server"

import { applyInsuranceNeedsSmartActions } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const result = await applyInsuranceNeedsSmartActions({ organizationId, userId, analysisId: id })
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_SUMMARY_MISSING") return NextResponse.json({ error: "Recalculez l’analyse avant de créer les tâches intelligentes." }, { status: 409 })
    if (error instanceof Error && error.message === "AI_ACTIONS_EMPTY") return NextResponse.json({ error: "Aucune action intelligente à créer pour cette analyse." }, { status: 409 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de créer les tâches intelligentes." }, { status: 403 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant de créer les tâches intelligentes." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de créer les actions intelligentes." }, { status: 400 })
  }
}
