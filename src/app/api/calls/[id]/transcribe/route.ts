import { NextResponse } from "next/server"

import { getOwnedCall } from "@/lib/transcription/access"
import { transcribeCall } from "@/lib/transcription/processor"
import { redactTranscription } from "@/lib/transcription/redact"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { transcribeCallSchema } from "@/lib/validations/transcription"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = transcribeCallSchema.parse(await request.json().catch(() => ({})))
    await getOwnedCall({ organizationId, callId: id })
    const data = await transcribeCall({ organizationId, userId, callLogId: id, language: payload.language })
    return NextResponse.json({ data: redactTranscription(data) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CALL_NOT_FOUND") return NextResponse.json({ error: "Appel introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "CALL_RECORDING_NOT_FOUND") return NextResponse.json({ error: "Aucun enregistrement disponible pour cet appel." }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transcription impossible." }, { status: 400 })
  }
}
