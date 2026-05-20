import { prisma } from "@/lib/prisma"

export type PublicAdvisorRecord = {
  id: string
  name: string
  email: string
  title: string | null
  phone: string | null
  avatarUrl: string | null
  organizationId: string
  organization: { name: string } | null
  advisorProfile: {
    id: string
    publicSlug: string
    publicName: string
    publicDescription: string | null
    avatarUrl: string | null
    bookingEnabled: boolean
    defaultMeetingLocation: string
    timezone: string
  } | null
}

export function slugifyAdvisor(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || "conseiller"
}

function baseAdvisorSlug(advisor: Pick<PublicAdvisorRecord, "name" | "email">) {
  return slugifyAdvisor(advisor.name || advisor.email.split("@")[0] || "conseiller")
}

async function createProfileSlug(advisor: Pick<PublicAdvisorRecord, "id" | "name" | "email">) {
  const base = baseAdvisorSlug(advisor)
  const candidates = [base, `${base}-${advisor.id.slice(-6).toLowerCase()}`]

  for (const candidate of candidates) {
    const existing = await prisma.advisorProfile.findUnique({ where: { publicSlug: candidate }, select: { id: true } })
    if (!existing) return candidate
  }

  return `${base}-${advisor.id.toLowerCase()}`
}

export async function ensureAdvisorProfile(advisor: PublicAdvisorRecord) {
  if (advisor.advisorProfile) return advisor.advisorProfile

  const publicSlug = await createProfileSlug(advisor)
  return prisma.advisorProfile.create({
    data: {
      organizationId: advisor.organizationId,
      userId: advisor.id,
      publicSlug,
      publicName: advisor.name,
      publicDescription: advisor.title,
      avatarUrl: advisor.avatarUrl,
      bookingEnabled: true,
      defaultMeetingLocation: "VIDEO",
      timezone: "America/Toronto",
    },
  })
}

export async function resolvePublicAdvisor(identifier: string): Promise<PublicAdvisorRecord | null> {
  const normalized = identifier.trim()
  if (!normalized) return null

  const profile = await prisma.advisorProfile.findUnique({
    where: { publicSlug: normalized },
    select: { userId: true, bookingEnabled: true },
  })

  const advisor = await prisma.user.findFirst({
    where: {
      role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] },
      ...(profile ? { id: profile.userId } : { id: normalized }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      phone: true,
      avatarUrl: true,
      organizationId: true,
      organization: { select: { name: true } },
      advisorProfile: {
        select: {
          id: true,
          publicSlug: true,
          publicName: true,
          publicDescription: true,
          avatarUrl: true,
          bookingEnabled: true,
          defaultMeetingLocation: true,
          timezone: true,
        },
      },
    },
  })

  if (!advisor) return null
  if (advisor.advisorProfile && !advisor.advisorProfile.bookingEnabled) return null

  return advisor
}

