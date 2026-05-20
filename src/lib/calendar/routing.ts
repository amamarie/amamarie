import { getServerAvailableSlots } from "@/lib/calendar/server-availability"
import { prisma } from "@/lib/prisma"

export type AdvisorRoutingCandidate = {
  advisorId: string
  advisorName: string
  advisorEmail: string
  publicSlug: string
  nextSlot: string | null
  nextSlotEnd: string | null
  score: number
  loadToday: number
  loadNextSevenDays: number
  routingPriority: number
  matchedSpecialty: boolean
  matchedLanguage: boolean
}

function tokenMatch(value: string | null | undefined, query: string | null | undefined) {
  if (!query?.trim()) return false
  return (value ?? "").toLowerCase().includes(query.trim().toLowerCase())
}

export async function findBestAdvisor({
  organizationId,
  meetingTypeId,
  date,
  timezone,
  specialty,
  language,
}: {
  organizationId: string
  meetingTypeId?: string | null
  date: Date
  timezone: string
  specialty?: string | null
  language?: string | null
}): Promise<{ candidates: AdvisorRoutingCandidate[]; selected: AdvisorRoutingCandidate | null }> {
  const startOfToday = new Date(date)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(date)
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWindow = new Date(startOfToday)
  endOfWindow.setDate(endOfWindow.getDate() + 7)

  const advisors = await prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] },
      advisorProfile: { is: { bookingEnabled: true } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      specialties: true,
      routingLanguages: true,
      routingPriority: true,
      advisorProfile: { select: { publicSlug: true, publicName: true, timezone: true } },
    },
    orderBy: [{ routingPriority: "desc" }, { name: "asc" }],
  })

  const candidates = await Promise.all(advisors.map(async (advisor) => {
    const [availability, loadToday, loadNextSevenDays] = await Promise.all([
      getServerAvailableSlots({
        organizationId,
        advisorId: advisor.id,
        date,
        meetingTypeId,
        timezone: timezone || advisor.advisorProfile?.timezone || "America/Toronto",
      }).catch(() => ({ slots: [] })),
      prisma.booking.count({
        where: {
          organizationId,
          advisorId: advisor.id,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId,
          advisorId: advisor.id,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { gte: startOfToday, lt: endOfWindow },
        },
      }),
    ])
    const nextSlot = availability.slots[0] ?? null
    const matchedSpecialty = tokenMatch(advisor.specialties, specialty)
    const matchedLanguage = tokenMatch(advisor.routingLanguages, language)
    const score = (advisor.routingPriority ?? 50)
      + (nextSlot ? 100 : -1000)
      + (matchedSpecialty ? 30 : 0)
      + (matchedLanguage ? 20 : 0)
      - loadToday * 12
      - loadNextSevenDays * 3

    return {
      advisorId: advisor.id,
      advisorName: advisor.advisorProfile?.publicName || advisor.name,
      advisorEmail: advisor.email,
      publicSlug: advisor.advisorProfile?.publicSlug ?? advisor.id,
      nextSlot: nextSlot?.start ?? null,
      nextSlotEnd: nextSlot?.end ?? null,
      score,
      loadToday,
      loadNextSevenDays,
      routingPriority: advisor.routingPriority ?? 50,
      matchedSpecialty,
      matchedLanguage,
    }
  }))

  const availableCandidates = candidates
    .filter((candidate) => candidate.nextSlot)
    .sort((a, b) => b.score - a.score || a.loadNextSevenDays - b.loadNextSevenDays || a.advisorName.localeCompare(b.advisorName))

  return { candidates: availableCandidates, selected: availableCandidates[0] ?? null }
}
