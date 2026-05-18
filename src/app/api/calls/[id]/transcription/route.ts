import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getOwnedCall } from "@/lib/transcription/access"
import { redactTranscription } from "@/lib/transcription/redact"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { updateTranscriptionSchema } from "@/lib/validations/transcription"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const call = await getOwnedCall({ organizationId, callId: id })
    return NextResponse.json({ data: redactTranscription(call.transcription ?? null) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CALL_NOT_FOUND") return NextResponse.json({ error: "Appel introuvable." }, { status: 404 })
    return NextResponse.json({ error: "Impossible de récupérer la transcription." }, { status: 400 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    await getOwnedCall({ organizationId, callId: id })
    const payload = updateTranscriptionSchema.parse(await request.json())
    const data = await prisma.callTranscription.update({
      where: { callLogId: id },
      data: payload,
    })
    return NextResponse.json({ data: redactTranscription(data) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CALL_NOT_FOUND") return NextResponse.json({ error: "Appel introuvable." }, { status: 404 })
    return NextResponse.json({ error: "Impossible de modifier la transcription." }, { status: 400 })
  }
}
