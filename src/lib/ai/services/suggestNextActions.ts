import { prisma } from "@/lib/prisma"
import { buildClientContext } from "@/lib/ai/context/buildClientContext"
import { buildLeadContext } from "@/lib/ai/context/buildLeadContext"
import { runAI } from "@/lib/ai/core/run-ai"
import { aiActionsOutputSchema } from "@/lib/ai/schemas/ai-output"

import { buildActionsFallback } from "./fallbacks"

export async function suggestNextActions({
  organizationId,
  userId,
  entityType,
  entityId,
}: {
  organizationId: string
  userId: string
  entityType: "client" | "lead"
  entityId: string
}) {
  const entity =
    entityType === "client"
      ? await prisma.client.findFirst({ where: { id: entityId, organizationId }, include: { products: true, tasks: true, documents: true, kycProfile: true, complianceAlerts: { where: { status: "OPEN" }, take: 8 } } })
      : await prisma.lead.findFirst({ where: { id: entityId, organizationId }, include: { tasks: true, documents: true } })

  if (!entity) throw new Error("ENTITY_NOT_FOUND")
  const context = entityType === "client" ? buildClientContext(entity) : buildLeadContext(entity)

  return runAI({
    organizationId,
    userId,
    feature: "next-actions",
    prompt: "Suggère uniquement des actions administratives utiles pour la prochaine étape. Ne recommande aucun produit financier. Retourne le JSON demandé.",
    schema: aiActionsOutputSchema,
    context,
    fallback: () => buildActionsFallback(context),
  })
}
