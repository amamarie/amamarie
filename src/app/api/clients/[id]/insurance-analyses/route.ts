import { NextResponse } from "next/server"
import { z } from "zod"

import { createInsuranceNeedsAnalysis, listInsuranceNeedsAnalyses } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const createSchema = z.object({
  type: z.enum(["LIFE", "DISABILITY", "CRITICAL_ILLNESS", "BUSINESS", "REPLACEMENT"]),
  opportunityId: z.string().optional().nullable(),
})

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const analyses = await listInsuranceNeedsAnalyses({ organizationId, clientId: id })
    return NextResponse.json({ data: analyses })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: "Impossible de récupérer les analyses des besoins." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createSchema.parse(await request.json())
    const analysis = await createInsuranceNeedsAnalysis({ organizationId, userId, clientId: id, type: payload.type, opportunityId: payload.opportunityId })
    return NextResponse.json({ data: analysis }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "OPPORTUNITY_NOT_FOUND") return NextResponse.json({ error: "Opportunité d’assurance introuvable pour ce client." }, { status: 404 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant de créer une analyse." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de créer l’analyse des besoins." }, { status: 400 })
  }
}
