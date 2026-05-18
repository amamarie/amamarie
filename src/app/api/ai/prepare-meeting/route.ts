import { NextResponse } from "next/server"
import { z } from "zod"

import { prepareMeeting } from "@/lib/ai/services/prepareMeeting"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const schema = z.object({
  clientId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  meetingContext: z.string().trim().max(1000).optional(),
}).refine((data) => data.clientId || data.leadId, "clientId ou leadId est requis.")

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = schema.parse(await request.json())
    if (payload.clientId) await assertActiveAiConsent({ organizationId, clientId: payload.clientId })
    const data = await prepareMeeting({ organizationId, userId, ...payload })
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ENTITY_NOT_FOUND") return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant de préparer une rencontre client." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de préparer la rencontre." }, { status: 400 })
  }
}
