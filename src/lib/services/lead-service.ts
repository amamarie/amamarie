import type { LeadStatus, Priority, PrismaClient } from "@prisma/client"

import { leadStatusTaskTemplates } from "@/lib/lead-status"

type PrismaLike = PrismaClient

export async function findLeadForOrganization({
  prisma,
  id,
  organizationId,
}: {
  prisma: PrismaLike
  id: string
  organizationId: string
}) {
  return prisma.lead.findFirst({
    where: { id, organizationId },
  })
}

export async function findDuplicateLead({
  prisma,
  organizationId,
  phone,
  email,
  excludeId,
}: {
  prisma: PrismaLike
  organizationId: string
  phone?: string
  email?: string | null
  excludeId?: string
}) {
  if (!phone && !email) return null

  return prisma.lead.findFirst({
    where: {
      organizationId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      status: true,
      interestType: true,
      notes: true,
    },
  })
}

export function duplicateLeadErrorMessage({
  duplicate,
  phone,
  prefix = "Un prospect existe déjà",
}: {
  duplicate: {
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  phone?: string
  prefix?: string
}) {
  const field = duplicate.phone === phone ? "téléphone" : "courriel"
  return `${prefix} avec ce ${field}: ${duplicate.firstName} ${duplicate.lastName}.`
}

export async function createStatusFollowUpTask({
  prisma,
  organizationId,
  userId,
  leadId,
  status,
}: {
  prisma: PrismaLike
  organizationId: string
  userId: string
  leadId: string
  status: LeadStatus
}) {
  const template = leadStatusTaskTemplates[status]
  if (!template) return null

  return prisma.task.create({
    data: {
      organizationId,
      assignedToId: userId,
      leadId,
      title: template.title,
      description: template.description,
      priority: template.priority as Priority,
      dueDate: new Date(Date.now() + template.dueInHours * 60 * 60 * 1000),
    },
  })
}
