import { NextResponse } from "next/server"
import { z } from "zod"

import { generateMessage } from "@/lib/ai/services/generateMessage"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const schema = z.object({
  context: z.string().trim().min(3).max(2000),
  clientName: z.string().trim().max(120).optional(),
  tone: z.enum(["professional", "warm", "short"]).optional(),
})

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = schema.parse(await request.json())
    const data = await generateMessage({ organizationId, userId, ...payload })
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de générer le message." }, { status: 400 })
  }
}
