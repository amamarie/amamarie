import { NextResponse } from "next/server"
import { z } from "zod"

import { summarizeClient } from "@/lib/ai/services/summarizeClient"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const schema = z.object({ clientId: z.string().min(1) })

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { clientId } = schema.parse(await request.json())
    await assertActiveAiConsent({ organizationId, clientId })
    const data = await summarizeClient({ organizationId, userId, clientId })
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant de générer un résumé client." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de générer le résumé IA." }, { status: 400 })
  }
}
