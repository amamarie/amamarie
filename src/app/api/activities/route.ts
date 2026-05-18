import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/db"
import { createActivity, getActivities } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"
import { createActivitySchema } from "@/lib/validations/activity"

function queryObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries())
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const activities = await getActivities({
      organizationId,
      query: queryObject(request),
    })

    return ok(activities)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = createActivitySchema.parse(await request.json())

    if (payload.userId) {
      const user = await prisma.user.findFirst({
        where: { id: payload.userId, organizationId },
        select: { id: true },
      })
      if (!user) return fail("NOT_FOUND", "L’utilisateur lié est introuvable.", 404)
    }

    if (payload.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: payload.leadId, organizationId },
        select: { id: true },
      })
      if (!lead) return fail("NOT_FOUND", "Le prospect lié est introuvable.", 404)
    }

    if (payload.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: payload.clientId, organizationId },
        select: { id: true },
      })
      if (!client) return fail("NOT_FOUND", "Le client lié est introuvable.", 404)
    }

    const activity = await createActivity({
      ...payload,
      organizationId,
      userId: payload.userId ?? userId,
    })

    return ok(activity, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
