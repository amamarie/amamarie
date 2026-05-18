import type { CrossSellPriority, CrossSellStatus } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { dedupeCrossSell, crossSellDedupeKey } from "@/lib/cross-sell/dedupe"
import { runCrossSellRules } from "@/lib/cross-sell/rules"
import type { CrossSellCandidate } from "@/lib/cross-sell/types"
import { prisma } from "@/lib/prisma"

const activeStatuses: CrossSellStatus[] = ["OPEN", "REVIEWED"]

function notificationType(priority: CrossSellPriority) {
  return priority === "CRITICAL" ? "ALERT" : "WARNING"
}

export async function generateCrossSellOpportunitiesForClient({
  organizationId,
  clientId,
  advisorId,
  userId,
}: {
  organizationId: string
  clientId: string
  advisorId?: string | null
  userId?: string | null
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: { products: true },
  })

  if (!client) throw new Error("Client introuvable.")

  const candidates = dedupeCrossSell(runCrossSellRules({ client, products: client.products }))
  const candidateKeys = new Set(candidates.map(crossSellDedupeKey))
  const existingActive = await prisma.crossSellOpportunity.findMany({
    where: { organizationId, clientId, status: { in: activeStatuses } },
  })
  const existingByKey = new Map(
    existingActive.map((opportunity) => [
      crossSellDedupeKey({
        ruleKey: opportunity.ruleKey,
        relatedProductType: opportunity.relatedProductType,
        relatedProductId: opportunity.relatedProductId,
      } as CrossSellCandidate),
      opportunity,
    ])
  )

  for (const candidate of candidates) {
    const key = crossSellDedupeKey(candidate)
    const existing = existingByKey.get(key)

    if (existing) {
      await prisma.crossSellOpportunity.update({
        where: { id: existing.id },
        data: {
          category: candidate.category,
          priority: candidate.priority,
          title: candidate.title,
          description: candidate.description,
          rationale: candidate.rationale,
          actionLabel: candidate.actionLabel,
          actionUrl: candidate.actionUrl,
          suggestedDiscussionTopic: candidate.suggestedDiscussionTopic,
          relatedProductType: candidate.relatedProductType,
          confidence: candidate.confidence,
          metadata: candidate.metadata,
          advisorId: advisorId ?? client.advisorId ?? existing.advisorId,
        },
      })
      continue
    }

    const opportunity = await prisma.crossSellOpportunity.create({
      data: {
        organizationId,
        clientId,
        advisorId: advisorId ?? client.advisorId ?? null,
        category: candidate.category,
        priority: candidate.priority,
        title: candidate.title,
        description: candidate.description,
        rationale: candidate.rationale,
        actionLabel: candidate.actionLabel,
        actionUrl: candidate.actionUrl,
        suggestedDiscussionTopic: candidate.suggestedDiscussionTopic,
        relatedProductType: candidate.relatedProductType,
        relatedProductId: candidate.relatedProductId,
        ruleKey: candidate.ruleKey,
        confidence: candidate.confidence,
        metadata: candidate.metadata,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId,
      type: "CROSS_SELL_CREATED",
      title: "Opportunité créée",
      description: opportunity.title,
    })

    if (["HIGH", "CRITICAL"].includes(opportunity.priority)) {
      await prisma.notification.create({
        data: {
          organizationId,
          userId: opportunity.advisorId ?? userId,
          type: notificationType(opportunity.priority),
          title: "Nouvelle opportunité prioritaire",
          message: `${client.firstName} ${client.lastName}: ${opportunity.title}`,
          href: `/clients/${clientId}`,
        },
      })
    }
  }

  const stale = existingActive.filter((opportunity) => {
    const key = crossSellDedupeKey({
      ruleKey: opportunity.ruleKey,
      relatedProductType: opportunity.relatedProductType,
      relatedProductId: opportunity.relatedProductId,
    } as CrossSellCandidate)
    return !candidateKeys.has(key)
  })

  if (stale.length > 0) {
    await prisma.crossSellOpportunity.updateMany({
      where: { id: { in: stale.map((opportunity) => opportunity.id) } },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    })
  }

  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    type: "CROSS_SELL_GENERATED",
    title: "Opportunités recalculées",
    description: `${candidates.length} opportunité(s) active(s) selon les règles internes.`,
  })

  return prisma.crossSellOpportunity.findMany({
    where: { organizationId, clientId },
    include: { client: true, advisor: true, relatedProduct: true },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  })
}
