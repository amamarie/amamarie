import { Prisma } from "@prisma/client"
import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"
import {
  recommendationFiltersSchema,
  recommendationPrioritySchema,
  recommendationStatusSchema,
  recommendationTypeSchema,
} from "@/lib/validations/recommendation"

type RouteContext = {
  params: Promise<{ id: string }>
}

const createRecommendationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(1200),
  type: recommendationTypeSchema.default("FOLLOW_UP"),
  priority: recommendationPrioritySchema.default("MEDIUM"),
  relatedProductId: z.string().trim().min(1).optional(),
  sourceNeedsAnalysisId: z.string().trim().min(1).optional(),
  rationale: z.string().trim().max(3000).optional(),
})

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const filters = recommendationFiltersSchema.parse({
      status: recommendationStatusSchema.safeParse(searchParams.get("status")).success
        ? searchParams.get("status")
        : undefined,
      priority: recommendationPrioritySchema.safeParse(searchParams.get("priority")).success
        ? searchParams.get("priority")
        : undefined,
      type: recommendationTypeSchema.safeParse(searchParams.get("type")).success
        ? searchParams.get("type")
        : undefined,
    })

    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const where: Prisma.ProductRecommendationWhereInput = {
      organizationId,
      clientId: id,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    }

    const recommendations = await prisma.productRecommendation.findMany({
      where,
      include: {
        client: true,
        advisor: true,
        relatedProduct: true,
        sourceKycVersion: true,
        options: { orderBy: { createdAt: "asc" } },
        documents: { include: { document: true }, orderBy: { createdAt: "asc" } },
        risks: { orderBy: { createdAt: "asc" } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return ok(recommendations)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createRecommendationSchema.parse(await request.json().catch(() => ({})))
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true, advisorId: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    await assertActivePurposeConsent({ organizationId, clientId: id, purposeCode: "kyc_use", errorCode: "KYC_USE_CONSENT_REQUIRED" })
    await assertActivePurposeConsent({ organizationId, clientId: id, purposeCode: "insurance_needs_analysis", errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED" })

    const recommendation = await prisma.productRecommendation.create({
      data: {
        organizationId,
        clientId: id,
        advisorId: client.advisorId ?? userId,
        type: payload.type,
        priority: payload.priority,
        status: "DRAFT",
        title: payload.title,
        description: payload.description,
        rationale: payload.rationale,
        relatedProductId: payload.relatedProductId,
        sourceNeedsAnalysisId: payload.sourceNeedsAnalysisId,
        ruleKey: `manual_documented:${id}:${Date.now()}`,
        metadata: { documentedRecommendation: true, source: "manual" },
      },
      include: { client: true, advisor: true, relatedProduct: true, options: true, documents: true, risks: true, versions: true },
    })

    await prisma.recommendationAuditLog.create({
      data: {
        organizationId,
        recommendationId: recommendation.id,
        clientId: id,
        userId,
        eventType: "CREEE",
        newValue: { title: recommendation.title, type: recommendation.type, status: recommendation.status },
      },
    })

    return ok(recommendation)
  } catch (error) {
    return handleApiError(error)
  }
}
