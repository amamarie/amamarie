import { NextResponse } from "next/server"
import { z } from "zod"

import { summarizeCall } from "@/lib/ai/services/summarizeCall"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const schema = z.object({ note: z.string().trim().min(3).max(4000) })

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { note } = schema.parse(await request.json())
    const data = await summarizeCall({ organizationId, userId, note })
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de résumer l’appel." }, { status: 400 })
  }
}
