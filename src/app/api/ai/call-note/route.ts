import { NextResponse } from "next/server"
import { z } from "zod"

import { saveGeneratedCallNote } from "@/lib/ai/call-notes/actions"
import { generateCallNote } from "@/lib/ai/call-notes/generateCallNote"
import { callNoteSchema } from "@/lib/ai/call-notes/schemas"
import { prisma } from "@/lib/prisma"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const generateSchema = z.object({
  mode: z.literal("generate").default("generate"),
  rawNote: z.string().trim().min(3).max(8000).optional(),
  transcript: z.string().trim().min(3).max(16000).optional(),
  clientId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
}).refine((data) => data.rawNote || data.transcript, "rawNote ou transcript est requis.")
  .refine((data) => data.clientId || data.leadId, "clientId ou leadId est requis.")

const saveSchema = z.object({
  mode: z.literal("save"),
  clientId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  note: callNoteSchema,
}).refine((data) => data.clientId || data.leadId, "clientId ou leadId est requis.")

async function getUser(userId: string, organizationId: string) {
  return prisma.user.findFirstOrThrow({
    where: { id: userId, organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

async function getContextEntity({ organizationId, clientId, leadId }: { organizationId: string; clientId?: string; leadId?: string }) {
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } })
    if (!client) throw new Error("ENTITY_NOT_FOUND")
    const previousNotes = await prisma.note.findMany({ where: { organizationId, clientId, status: { not: "DELETED" }, isSensitive: false }, orderBy: { createdAt: "desc" }, take: 5 })
    return { client, previousNotes }
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } })
  if (!lead) throw new Error("ENTITY_NOT_FOUND")
  const previousNotes = await prisma.note.findMany({ where: { organizationId, leadId, status: { not: "DELETED" }, isSensitive: false }, orderBy: { createdAt: "desc" }, take: 5 })
  return { lead, previousNotes }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()

    if (body?.mode === "save") {
      const payload = saveSchema.parse(body)
      await getContextEntity({ organizationId, clientId: payload.clientId, leadId: payload.leadId })
      const user = await getUser(userId, organizationId)
      const data = await saveGeneratedCallNote({
        organizationId,
        userId,
        userRole: user.role,
        clientId: payload.clientId,
        leadId: payload.leadId,
        note: payload.note,
      })
      return NextResponse.json({ data })
    }

    const payload = generateSchema.parse({ mode: "generate", ...body })
    if (payload.clientId) await assertActiveAiConsent({ organizationId, clientId: payload.clientId })
    const context = await getContextEntity({ organizationId, clientId: payload.clientId, leadId: payload.leadId })
    const note = await generateCallNote({
      organizationId,
      userId,
      rawNote: payload.rawNote,
      transcript: payload.transcript,
      client: context.client,
      lead: context.lead,
      previousNotes: context.previousNotes,
    })
    return NextResponse.json({ data: { note } })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "ENTITY_NOT_FOUND") return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") return NextResponse.json({ error: "Le consentement d’assistance technologique / IA doit être actif avant de générer une note d’appel client." }, { status: 403 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de traiter la note d’appel IA." }, { status: 400 })
  }
}
