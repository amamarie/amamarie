import type { Lead, LeadSource, Prisma } from "@prisma/client"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { findDuplicateLead } from "@/lib/services/lead-service"
import { runLeadIntakeAutomation } from "@/lib/services/lead-intake-automation"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

type IntakeSourceKind = "EMAIL" | "GOOGLE_SHEETS"

type CreateOrQualifyLeadFromSourceInput = {
  organizationId: string
  advisorId?: string | null
  sourceKind: IntakeSourceKind
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  message?: string | null
  interestType?: string | null
  externalId?: string | null
  externalType?: string | null
  metadata?: Record<string, unknown>
}

function leadSourceFromKind(kind: IntakeSourceKind): LeadSource {
  return kind === "GOOGLE_SHEETS" ? "CAMPAIGN" : "OTHER"
}

function clean(value?: string | null) {
  const next = value?.trim()
  return next ? next : null
}

function fallbackNameFromEmail(email?: string | null) {
  const localPart = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim()
  if (!localPart) return { firstName: "Nouveau", lastName: "prospect" }
  const parts = localPart.split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? "Nouveau",
    lastName: parts.slice(1).join(" ") || "prospect",
  }
}

function buildSourceNote(input: CreateOrQualifyLeadFromSourceInput) {
  return [
    input.sourceKind === "EMAIL" ? "Courriel entrant reçu." : "Ligne Google Sheets importée.",
    input.message,
  ].filter(Boolean).join("\n\n")
}

async function resolveAdvisorId(organizationId: string, advisorId?: string | null) {
  if (advisorId) {
    const advisor = await prisma.user.findFirst({ where: { id: advisorId, organizationId }, select: { id: true } })
    if (advisor) return advisor.id
  }
  const owner = await prisma.user.findFirst({ where: { organizationId, role: "OWNER" }, select: { id: true } })
  if (owner) return owner.id
  const user = await prisma.user.findFirst({ where: { organizationId }, select: { id: true } })
  return user?.id ?? null
}

export async function createOrQualifyLeadFromSource(input: CreateOrQualifyLeadFromSourceInput) {
  const advisorId = await resolveAdvisorId(input.organizationId, input.advisorId)
  const email = clean(input.email)?.toLowerCase() ?? null
  const phone = normalizePhoneNumber(input.phone)
  const fallbackName = fallbackNameFromEmail(email)
  const firstName = clean(input.firstName) ?? fallbackName.firstName
  const lastName = clean(input.lastName) ?? fallbackName.lastName
  const sourceNote = buildSourceNote(input)

  const duplicate = await findDuplicateLead({
    prisma,
    organizationId: input.organizationId,
    phone: phone || undefined,
    email,
  })

  let lead: Lead
  const activeDuplicate = duplicate && duplicate.status !== "ARCHIVED"

  if (activeDuplicate) {
    lead = await prisma.lead.update({
      where: { id: duplicate.id },
      data: {
        advisorId: advisorId ?? undefined,
        email: duplicate.email ?? email,
        phone: duplicate.phone || phone || "unknown",
        interestType: duplicate.interestType ?? clean(input.interestType) ?? undefined,
        nextAction: input.sourceKind === "EMAIL" ? "Répondre au courriel entrant" : "Traiter la ligne Google Sheets importée",
        lastContactAt: new Date(),
        notes: [duplicate.notes, sourceNote].filter(Boolean).join("\n\n---\n\n"),
      },
    })
  } else {
    lead = await prisma.lead.create({
      data: {
        organizationId: input.organizationId,
        advisorId: advisorId ?? undefined,
        firstName,
        lastName,
        email,
        phone: phone || "unknown",
        source: leadSourceFromKind(input.sourceKind),
        status: "NEW",
        priority: "HIGH",
        interestType: clean(input.interestType) ?? (input.sourceKind === "EMAIL" ? "courriel entrant" : "google sheets"),
        nextAction: input.sourceKind === "EMAIL" ? "Répondre au courriel entrant" : "Contacter le prospect importé",
        notes: sourceNote,
      },
    })

    await createCrmActivity({
      organizationId: input.organizationId,
      userId: advisorId,
      leadId: lead.id,
      type: "LEAD_CREATED",
      title: input.sourceKind === "EMAIL" ? "Prospect créé depuis courriel entrant" : "Prospect créé depuis Google Sheets",
      description: `${lead.firstName} ${lead.lastName}`,
      source: input.sourceKind === "EMAIL" ? "IMPORT" : "WEBHOOK",
      entityType: input.externalType,
      entityId: input.externalId,
      metadata: input.metadata as Prisma.InputJsonObject | undefined,
    })

    await runAutomationsForEvent({
      organizationId: input.organizationId,
      userId: advisorId,
      leadId: lead.id,
      event: "LEAD_CREATED",
      title: input.sourceKind === "EMAIL" ? "Prospect créé depuis courriel entrant" : "Prospect créé depuis Google Sheets",
      description: `${lead.firstName} ${lead.lastName}`,
      payload: {
        source: input.sourceKind,
        email,
        phone,
        firstName: lead.firstName,
        lastName: lead.lastName,
        externalId: input.externalId,
        ...(input.metadata ?? {}),
      },
    })
  }

  const intake = await runLeadIntakeAutomation({
    organizationId: input.organizationId,
    advisorId,
    leadId: lead.id,
    source: input.sourceKind,
    message: input.message,
    phone,
    email,
    createFollowUpTasks: true,
    extraContext: {
      externalId: input.externalId,
      externalType: input.externalType,
      ...(input.metadata ?? {}),
    },
  })

  return { lead, intake, created: !activeDuplicate }
}
