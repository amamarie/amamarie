import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const exceptionSchema = z.object({
  date: z.coerce.date(),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1).optional().nullable(),
  endMinutes: z.number().int().min(1).max(24 * 60).optional().nullable(),
  type: z.enum(["UNAVAILABLE", "AVAILABLE_OVERRIDE", "VACATION"]).default("UNAVAILABLE"),
  reason: z.string().trim().max(240).optional().nullable(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
})

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const exceptions = await prisma.availabilityException.findMany({
      where: { organizationId, advisorId: userId },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    })
    return ok(exceptions)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = exceptionSchema.parse(await request.json())
    const created = await prisma.availabilityException.create({ data: { ...payload, organizationId, advisorId: userId } })
    return ok(created, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
