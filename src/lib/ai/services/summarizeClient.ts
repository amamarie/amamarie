import { prisma } from "@/lib/prisma"
import { buildClientContext } from "@/lib/ai/context/buildClientContext"
import { runAI } from "@/lib/ai/core/run-ai"
import { aiSummaryOutputSchema } from "@/lib/ai/schemas/ai-output"

import { buildClientSummaryFallback } from "./fallbacks"

export async function summarizeClient({ organizationId, userId, clientId }: { organizationId: string; userId: string; clientId: string }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      products: true,
      tasks: { orderBy: { createdAt: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      kycProfile: true,
      complianceAlerts: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  })

  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const notes = await prisma.note.findMany({
    where: { organizationId, clientId, status: { not: "DELETED" }, isSensitive: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const context = buildClientContext({ ...client, noteItems: notes })
  return runAI({
    organizationId,
    userId,
    feature: "client-summary",
    prompt: "Résume ce client pour un conseiller. Identifie seulement des points importants, données manquantes et actions administratives. Retourne le JSON demandé.",
    schema: aiSummaryOutputSchema,
    context,
    fallback: () => buildClientSummaryFallback(context),
  })
}
