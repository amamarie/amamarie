import { NextResponse } from "next/server"

import { createInsuranceNeedsAnalysisVersion } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const analysis = await createInsuranceNeedsAnalysisVersion({ organizationId, userId, analysisId: id })
    return NextResponse.json({ data: analysis })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de créer une nouvelle version." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de créer une nouvelle version." }, { status: 400 })
  }
}
