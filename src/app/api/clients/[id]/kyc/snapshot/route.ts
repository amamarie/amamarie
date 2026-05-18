import { fail, handleApiError, ok } from "@/lib/api-response"
import { createKycSnapshot } from "@/lib/compliance/snapshots"
import { getTenantContext } from "@/lib/tenant"
import { snapshotKycSchema } from "@/lib/validations/kyc"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = snapshotKycSchema.parse(await request.json().catch(() => ({})))
    return ok(await createKycSnapshot({
      organizationId,
      clientId: id,
      userId,
      reason: payload.reason,
      advisorAttestationAccepted: payload.advisorAttestationAccepted,
      clientAccuracyConfirmed: payload.clientAccuracyConfirmed,
      useForAnalysisOrRecommendation: payload.useForAnalysisOrRecommendation,
      sendToClientForConfirmation: payload.sendToClientForConfirmation,
      origin: request.headers.get("origin"),
    }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "ADVISOR_ATTESTATION_REQUIRED") {
      return fail("ADVISOR_ATTESTATION_REQUIRED", "L’attestation conseiller est requise avant de créer le snapshot.", 422)
    }
    if (error instanceof Error && error.message === "SNAPSHOT_USE_CONFIRMATION_REQUIRED") {
      return fail("SNAPSHOT_USE_CONFIRMATION_REQUIRED", "Vous devez confirmer que le snapshot sera utilisé pour l’analyse ou la recommandation.", 422)
    }
    return handleApiError(error)
  }
}
