import { NextResponse } from "next/server"

import { assertComplianceWorkflowClear, ComplianceWorkflowBlockedError } from "@/lib/compliance/workflow-guards"
import { lockInsuranceNeedsAnalysis } from "@/lib/insurance-needs/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const current = await prisma.insuranceNeedsAnalysis.findFirst({
      where: { id, organizationId },
      select: { clientId: true },
    })
    if (!current) return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    await assertComplianceWorkflowClear({ organizationId, clientId: current.clientId, action: "INSURANCE_ANALYSIS_LOCK" })
    const analysis = await lockInsuranceNeedsAnalysis({ organizationId, userId, analysisId: id })
    return NextResponse.json({ data: analysis })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "REPORT_REQUIRED") return NextResponse.json({ error: "Générez le rapport avant de verrouiller l’analyse." }, { status: 409 })
    if (error instanceof Error && error.message === "CLIENT_CONFIRMATION_REQUIRED") return NextResponse.json({ error: "Le client doit confirmer la réception du rapport avant le verrouillage final." }, { status: 409 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de verrouiller l’analyse." }, { status: 403 })
    if (error instanceof ComplianceWorkflowBlockedError) return NextResponse.json({ error: "Action bloquée par la conformité: des éléments ouverts doivent être résolus avant le verrouillage.", details: { blockers: error.blockers } }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de verrouiller l’analyse." }, { status: 400 })
  }
}
