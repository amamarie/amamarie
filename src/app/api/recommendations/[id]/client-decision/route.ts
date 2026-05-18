import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { recordClientRecommendationDecision } from "@/lib/recommendations/documented"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const decisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED", "PARTIAL", "DEFERRED", "NO_RESPONSE"]),
  note: z.string().trim().max(1200).optional(),
})

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = decisionSchema.parse(await request.json().catch(() => ({})))
    const recommendation = await recordClientRecommendationDecision({ id, organizationId, userId, ...payload })
    return ok(recommendation)
  } catch (error) {
    return handleApiError(error)
  }
}
