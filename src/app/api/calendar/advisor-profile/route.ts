import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { ensureAdvisorProfile, slugifyAdvisor } from "@/lib/calendar/public-advisors"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const profileSchema = z.object({
  publicSlug: z.string().trim().min(3).max(80).optional(),
  publicName: z.string().trim().min(2).max(160).optional(),
  publicDescription: z.string().trim().max(800).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  bookingEnabled: z.boolean().optional(),
  defaultMeetingLocation: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
})

async function currentAdvisor() {
  const { organizationId, userId } = await getTenantContext()
  const advisor = await prisma.user.findFirst({
    where: { id: userId, organizationId, role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] } },
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
  return advisor
}

export async function GET() {
  try {
    const advisor = await currentAdvisor()
    if (!advisor) return fail("FORBIDDEN", "Profil conseiller indisponible.", 403)
    const profile = await ensureAdvisorProfile(advisor)
    return ok(profile)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const advisor = await currentAdvisor()
    if (!advisor) return fail("FORBIDDEN", "Profil conseiller indisponible.", 403)
    const profile = await ensureAdvisorProfile(advisor)
    const payload = profileSchema.parse(await request.json())
    const publicSlug = payload.publicSlug ? slugifyAdvisor(payload.publicSlug) : undefined

    if (publicSlug && publicSlug !== profile.publicSlug) {
      const existing = await prisma.advisorProfile.findUnique({ where: { publicSlug }, select: { id: true } })
      if (existing) return fail("SLUG_TAKEN", "Ce lien public est déjà utilisé.", 409)
    }

    const updated = await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: {
        publicSlug,
        publicName: payload.publicName,
        publicDescription: payload.publicDescription === undefined ? undefined : payload.publicDescription?.trim() || null,
        avatarUrl: payload.avatarUrl === undefined ? undefined : payload.avatarUrl?.trim() || null,
        bookingEnabled: payload.bookingEnabled,
        defaultMeetingLocation: payload.defaultMeetingLocation,
        timezone: payload.timezone,
      },
    })
    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

