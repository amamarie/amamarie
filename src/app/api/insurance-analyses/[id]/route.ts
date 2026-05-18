import { NextResponse } from "next/server"
import { z } from "zod"

import { getInsuranceNeedsAnalysis, linkInsuranceNeedsAnalysisToOpportunity, updateInsuranceNeedsInput } from "@/lib/insurance-needs/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const inputPatchSchema = z.object({
  inputKey: z.string().min(1),
  value: z.unknown(),
})

const opportunityPatchSchema = z.object({
  opportunityId: z.string().min(1),
})

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    return NextResponse.json({ data: await getInsuranceNeedsAnalysis({ organizationId, analysisId: id }) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    return NextResponse.json({ error: "Impossible de récupérer l’analyse." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const rawPayload = await request.json()
    const isOpportunityPatch = rawPayload && typeof rawPayload === "object" && "opportunityId" in rawPayload
    const analysis = isOpportunityPatch
      ? await linkInsuranceNeedsAnalysisToOpportunity({
          organizationId,
          userId,
          analysisId: id,
          opportunityId: opportunityPatchSchema.parse(rawPayload).opportunityId,
        })
      : await (async () => {
          const payload = inputPatchSchema.parse(rawPayload)
          return updateInsuranceNeedsInput({ organizationId, userId, analysisId: id, inputKey: payload.inputKey, value: payload.value })
        })()
    return NextResponse.json({ data: analysis })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ANALYSIS_NOT_FOUND") return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "ANALYSIS_SIGNED_LOCKED") return NextResponse.json({ error: "Cette analyse est signée ou validée. Créez une nouvelle version pour modifier les données." }, { status: 409 })
    if (error instanceof Error && error.message === "OPPORTUNITY_NOT_FOUND") return NextResponse.json({ error: "Opportunité d’assurance introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "ANALYSIS_ALREADY_LINKED") return NextResponse.json({ error: "Cette analyse est déjà liée à une autre opportunité." }, { status: 409 })
    if (error instanceof Error && error.message === "OPPORTUNITY_TYPE_INCOMPATIBLE") return NextResponse.json({ error: "Cette analyse ne correspond pas au type d’assurance de l’opportunité." }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de modifier l’analyse." }, { status: 400 })
  }
}
