import { fail, handleApiError, ok } from "@/lib/api-response"
import { processDueMarketingSequences, sendDueMarketingCampaigns } from "@/lib/marketing/automation"
import { prisma } from "@/lib/prisma"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== "production"

  const authorization = request.headers.get("authorization")
  return authorization === `Bearer ${secret}`
}

async function runMarketingCron() {
  const now = new Date()
  const [sequenceOrganizations, campaignOrganizations] = await Promise.all([
    prisma.marketingSequenceEnrollment.findMany({
      where: { status: "ACTIVE", nextRunAt: { lte: now } },
      distinct: ["organizationId"],
      select: { organizationId: true },
      take: 100,
    }),
    prisma.marketingCampaign.findMany({
      where: {
        status: "SCHEDULED",
        validationStatus: "VALIDATED",
        scheduledAt: { lte: now },
      },
      distinct: ["organizationId"],
      select: { organizationId: true },
      take: 100,
    }),
  ])

  const organizationIds = Array.from(new Set([
    ...sequenceOrganizations.map((item) => item.organizationId),
    ...campaignOrganizations.map((item) => item.organizationId),
  ]))

  const results = []
  for (const organizationId of organizationIds) {
    const user = await prisma.user.findFirst({
      where: { organizationId, role: { in: ["OWNER", "ADVISOR", "COMPLIANCE"] } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })
    if (!user) continue

    const [sequences, campaigns] = await Promise.all([
      processDueMarketingSequences({ organizationId, userId: user.id }),
      sendDueMarketingCampaigns({ organizationId, userId: user.id }),
    ])
    results.push({ organizationId, sequences, campaigns })
  }

  return {
    processedOrganizations: results.length,
    results,
  }
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) return fail("UNAUTHORIZED", "Cron non autorisé.", 401)
    return ok(await runMarketingCron())
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  return GET(request)
}
