import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

export type MatchedPerson = {
  type: "CLIENT" | "LEAD" | null
  id: string | null
  advisorId?: string | null
  displayName?: string
}

function phoneCandidates(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber)
  const national = normalized.startsWith("+1") ? normalized.slice(2) : normalized.replace(/^\+/, "")
  return Array.from(new Set([normalized, national, phoneNumber].filter(Boolean)))
}

export async function findPersonByPhone({ organizationId, phoneNumber }: { organizationId: string; phoneNumber: string }): Promise<MatchedPerson> {
  const candidates = phoneCandidates(phoneNumber)
  const client = await prisma.client.findFirst({
    where: {
      organizationId,
      OR: [
        { phone: { in: candidates } },
        { phonePrimary: { in: candidates } },
        { phoneSecondary: { in: candidates } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, advisorId: true },
  })
  if (client) return { type: "CLIENT", id: client.id, advisorId: client.advisorId, displayName: `${client.firstName} ${client.lastName}` }

  const lead = await prisma.lead.findFirst({
    where: { organizationId, phone: { in: candidates }, status: { notIn: ["ARCHIVED", "LOST", "CONVERTED"] } },
    select: { id: true, firstName: true, lastName: true, advisorId: true },
  })
  if (lead) return { type: "LEAD", id: lead.id, advisorId: lead.advisorId, displayName: `${lead.firstName} ${lead.lastName}` }

  return { type: null, id: null }
}

export async function findOrganizationByTwilioNumber(toNumber: string) {
  const normalized = normalizePhoneNumber(toNumber)
  const settings = await prisma.organizationCommunicationSettings.findFirst({
    where: { twilioPhoneNumber: normalized },
    include: { organization: true },
  })
  if (settings) return { organizationId: settings.organizationId, settings }

  const defaultNumber = normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER)
  if (defaultNumber && defaultNumber === normalized) {
    const organizations = await prisma.organization.findMany({ select: { id: true }, take: 2 })
    if (organizations.length === 1) return { organizationId: organizations[0].id, settings: null }
  }

  return null
}
