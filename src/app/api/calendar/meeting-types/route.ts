import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { defaultMeetingTypes } from "@/lib/calendar/types"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const meetingTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(800).optional().nullable(),
  durationMinutes: z.number().int().min(15).max(180),
  slotStepMinutes: z.number().int().min(5).max(120).default(30),
  bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(15),
  minimumNoticeHours: z.number().int().min(0).max(720).default(24),
  maxBookingsPerDay: z.number().int().min(1).max(30).default(6),
  locationType: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).default("VIDEO"),
  isPublic: z.boolean().default(true),
  questionnaire: z.unknown().optional().nullable(),
  createsOpportunity: z.boolean().default(false),
  campaignKey: z.string().trim().max(120).optional().nullable(),
})

async function ensureDefaultMeetingTypes(organizationId: string, userId: string) {
  const count = await prisma.meetingType.count({ where: { organizationId, advisorId: userId } })
  if (count > 0) return
  await prisma.meetingType.createMany({
    data: defaultMeetingTypes.map((item) => ({
      organizationId,
      advisorId: userId,
      name: item.name,
      description: item.description,
      durationMinutes: item.durationMinutes,
      slotStepMinutes: item.slotStepMinutes,
      bufferBeforeMinutes: item.bufferBeforeMinutes,
      bufferAfterMinutes: item.bufferAfterMinutes,
      minimumNoticeHours: item.minimumNoticeHours,
      maxBookingsPerDay: item.maxBookingsPerDay,
      locationType: item.locationType,
      isPublic: item.isPublic,
      questionnaire: item.questionnaire as never,
      createsOpportunity: item.createsOpportunity,
      campaignKey: item.campaignKey,
    })),
  })
}

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    await ensureDefaultMeetingTypes(organizationId, userId)
    const meetingTypes = await prisma.meetingType.findMany({
      where: { organizationId, OR: [{ advisorId: userId }, { advisorId: null }] },
      orderBy: [{ isPublic: "desc" }, { name: "asc" }],
    })
    return ok(meetingTypes)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = meetingTypeSchema.parse(await request.json())
    const created = await prisma.meetingType.create({ data: { ...payload, organizationId, advisorId: userId, questionnaire: payload.questionnaire as never } })
    return ok(created, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
