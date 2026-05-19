import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createStatusFollowUpTask, duplicateLeadErrorMessage, findDuplicateLead } from "@/lib/services/lead-service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

const createLeadFromEmailSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(7, "Le téléphone est requis pour créer un prospect."),
})

function activityMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

function splitName(value?: string | null, email?: string | null) {
  const source = value?.trim() || email?.split("@")[0]?.replace(/[._-]+/g, " ")
  const parts = source?.split(/\s+/).filter(Boolean) ?? []
  return {
    firstName: parts[0] || "Nouveau",
    lastName: parts.slice(1).join(" ") || "prospect",
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createLeadFromEmailSchema.parse(await request.json())

    const activity = await prisma.activity.findFirst({
      where: { id, organizationId, type: "EMAIL_RECEIVED" },
      select: { id: true, title: true, description: true, metadata: true, leadId: true, clientId: true },
    })

    if (!activity) return fail("NOT_FOUND", "Courriel introuvable.", 404)
    if (activity.clientId || activity.leadId) return fail("ALREADY_LINKED", "Ce courriel est déjà lié à un dossier CRM.", 409)

    const metadata = activityMetadata(activity.metadata)
    const email = typeof metadata.from === "string" ? metadata.from : null
    const guessed = splitName(typeof metadata.fromName === "string" ? metadata.fromName : null, email)
    const firstName = payload.firstName?.trim() || guessed.firstName
    const lastName = payload.lastName?.trim() || guessed.lastName

    const duplicateLead = await findDuplicateLead({
      prisma,
      organizationId,
      phone: payload.phone,
      email: email ?? undefined,
    })

    if (duplicateLead && duplicateLead.status !== "ARCHIVED") {
      return fail("DUPLICATE_LEAD", duplicateLeadErrorMessage({ duplicate: duplicateLead, phone: payload.phone }), 409)
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        advisorId: userId,
        firstName,
        lastName,
        phone: payload.phone,
        email,
        source: "OTHER",
        status: "NEW",
        priority: metadata.priority === "HIGH" ? "HIGH" : "NORMAL",
        interestType: typeof metadata.inboxType === "string" ? `Courriel ${metadata.inboxType.toLowerCase()}` : "courriel entrant",
        nextAction: typeof metadata.recommendedAction === "string" ? metadata.recommendedAction : "Répondre au courriel entrant.",
        notes: [
          `Créé depuis un courriel entrant: ${activity.title}`,
          typeof metadata.summary === "string" ? `Résumé: ${metadata.summary}` : null,
          typeof metadata.snippet === "string" ? `Aperçu: ${metadata.snippet}` : null,
        ].filter(Boolean).join("\n\n"),
      },
    })

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        leadId: lead.id,
        metadata: {
          ...metadata,
          inboxStatus: "CLASSIFIED",
          linkedEntityType: "LEAD",
          linkedLeadId: lead.id,
          classifiedAt: new Date().toISOString(),
          classifiedByUserId: userId,
        },
      },
    })

    const title = "Prospect créé depuis courriel"
    const description = `${lead.firstName} ${lead.lastName} a été créé depuis un courriel entrant.`
    await createCrmActivity({
      organizationId,
      userId,
      leadId: lead.id,
      type: "LEAD_CREATED",
      title,
      description,
      entityType: "GmailMessage",
      entityId: typeof metadata.gmailMessageId === "string" ? metadata.gmailMessageId : activity.id,
      metadata: { sourceActivityId: activity.id },
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      leadId: lead.id,
      event: "LEAD_CREATED",
      title,
      description,
      payload: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        advisorId: lead.advisorId,
      },
    })

    await createStatusFollowUpTask({ prisma, organizationId, userId, leadId: lead.id, status: "NEW" })

    return ok({ lead }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
