import { NextResponse } from "next/server"
import { z } from "zod"

import { suggestNextActions } from "@/lib/ai/services/suggestNextActions"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const schema = z.object({
  entityType: z.enum(["client", "lead"]),
  entityId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = schema.parse(await request.json())
    if (payload.entityType === "client") await assertActiveAiConsent({ organizationId, clientId: payload.entityId })
    const data = await suggestNextActions({ organizationId, userId, ...payload })
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ENTITY_NOT_FOUND") return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant de suggérer des actions client." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de suggérer les actions." }, { status: 400 })
  }
}
