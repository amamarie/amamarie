import { prisma } from "@/lib/prisma"
import { buildClientContext } from "@/lib/ai/context/buildClientContext"
import { buildLeadContext } from "@/lib/ai/context/buildLeadContext"
import { runAI } from "@/lib/ai/core/run-ai"
import { aiMeetingPrepOutputSchema } from "@/lib/ai/schemas/ai-output"

import { buildMeetingPrepFallback } from "./fallbacks"

export async function prepareMeeting({
  organizationId,
  userId,
  clientId,
  leadId,
  meetingContext,
}: {
  organizationId: string
  userId: string
  clientId?: string
  leadId?: string
  meetingContext?: string
}) {
  const entity = clientId
    ? await prisma.client.findFirst({ where: { id: clientId, organizationId }, include: { products: true, tasks: true, documents: true, kycProfile: true, complianceAlerts: { where: { status: "OPEN" }, take: 8 } } })
    : leadId
      ? await prisma.lead.findFirst({ where: { id: leadId, organizationId }, include: { tasks: true, documents: true } })
      : null

  if (!entity) throw new Error("ENTITY_NOT_FOUND")
  const context = { ...(clientId ? buildClientContext(entity) : buildLeadContext(entity)), meetingContext }

  return runAI({
    organizationId,
    userId,
    feature: "meeting-prep",
    prompt: "Prépare le conseiller avant une rencontre. Liste sujets, questions et documents à vérifier. Actions administratives seulement. Retourne le JSON demandé.",
    schema: aiMeetingPrepOutputSchema,
    context,
    fallback: () => buildMeetingPrepFallback(context),
  })
}
