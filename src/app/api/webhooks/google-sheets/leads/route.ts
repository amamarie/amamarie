import { timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { workflowSecret } from "@/lib/automation/workflows"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createOrQualifyLeadFromSource } from "@/lib/services/lead-intake-sources"

const payloadSchema = z.object({
  organizationId: z.string().min(1),
  advisorId: z.string().min(1).nullable().optional(),
  spreadsheetId: z.string().min(1).optional(),
  sheetName: z.string().min(1).optional(),
  rowNumber: z.coerce.number().int().positive().optional(),
  sourceUrl: z.string().url().optional(),
  row: z.record(z.string(), z.unknown()).optional(),
  values: z.array(z.unknown()).optional(),
  mapping: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    interestType: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
})

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : ""
}

function webhookSecret() {
  return process.env.FINADVISOR_GOOGLE_SHEETS_WEBHOOK_SECRET?.trim() || workflowSecret()
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

function normalizedRow(payload: z.infer<typeof payloadSchema>) {
  if (payload.row) return payload.row
  const values = payload.values ?? []
  return {
    firstName: values[0],
    lastName: values[1],
    email: values[2],
    phone: values[3],
    interestType: values[4],
    message: values[5],
  }
}

function field(row: Record<string, unknown>, preferred: string | undefined, fallbacks: string[]) {
  const keys = [preferred, ...fallbacks].filter(Boolean) as string[]
  for (const key of keys) {
    const exact = stringValue(row[key])
    if (exact) return exact
    const matchingKey = Object.keys(row).find((candidate) => candidate.toLowerCase().trim() === key.toLowerCase().trim())
    const matched = matchingKey ? stringValue(row[matchingKey]) : null
    if (matched) return matched
  }
  return null
}

function splitFullName(fullName?: string | null) {
  const parts = fullName?.split(/\s+/).filter(Boolean) ?? []
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  }
}

function rowExternalId(payload: z.infer<typeof payloadSchema>) {
  if (!payload.spreadsheetId || !payload.rowNumber) return null
  return `${payload.spreadsheetId}:${payload.sheetName ?? "Sheet1"}:${payload.rowNumber}`
}

export async function POST(request: Request) {
  try {
    const secret = webhookSecret()
    if (!secret) return fail("GOOGLE_SHEETS_WEBHOOK_SECRET_MISSING", "Secret webhook Google Sheets non configuré.", 503)
    if (!safeEqual(bearerToken(request), secret)) return fail("UNAUTHORIZED", "Webhook Google Sheets non autorisé.", 401)

    const payload = payloadSchema.parse(await request.json())
    const externalId = rowExternalId(payload)
    if (externalId) {
      const existing = await prisma.activity.findFirst({
        where: {
          organizationId: payload.organizationId,
          entityType: "GoogleSheetRow",
          entityId: externalId,
        },
        select: { id: true, leadId: true },
      })
      if (existing) return ok({ created: false, skipped: true, reason: "already_imported", leadId: existing.leadId })
    }

    const row = normalizedRow(payload)
    const fullName = field(row, payload.mapping?.fullName, ["fullName", "Full Name", "Nom complet", "name", "Nom"])
    const splitName = splitFullName(fullName)
    const firstName = field(row, payload.mapping?.firstName, ["firstName", "First Name", "Prénom", "prenom"]) ?? splitName.firstName
    const lastName = field(row, payload.mapping?.lastName, ["lastName", "Last Name", "Nom", "name"]) ?? splitName.lastName
    const email = field(row, payload.mapping?.email, ["email", "Email", "Courriel", "courriel"])
    const phone = field(row, payload.mapping?.phone, ["phone", "Phone", "Téléphone", "telephone", "Cellulaire"])
    const interestType = field(row, payload.mapping?.interestType, ["interestType", "Besoin", "Intérêt", "interet", "Produit"])
    const message = field(row, payload.mapping?.message, ["message", "Message", "Notes", "Commentaire", "commentaire"])

    if (!email && !phone) {
      return fail("MISSING_CONTACT", "La ligne doit contenir au moins un courriel ou un téléphone.", 422)
    }

    const imported = await createOrQualifyLeadFromSource({
      organizationId: payload.organizationId,
      advisorId: payload.advisorId ?? null,
      sourceKind: "GOOGLE_SHEETS",
      firstName,
      lastName,
      email,
      phone,
      interestType,
      message,
      externalId,
      externalType: "GoogleSheetRow",
      metadata: {
        spreadsheetId: payload.spreadsheetId,
        sheetName: payload.sheetName,
        rowNumber: payload.rowNumber,
        sourceUrl: payload.sourceUrl,
        row,
      },
    })

    await createCrmActivity({
      organizationId: payload.organizationId,
      userId: payload.advisorId ?? null,
      leadId: imported.lead.id,
      type: "LEAD_UPDATED",
      title: "Ligne Google Sheets importée",
      description: `${imported.lead.firstName} ${imported.lead.lastName}`,
      source: "WEBHOOK",
      entityType: "GoogleSheetRow",
      entityId: externalId,
      metadata: {
        spreadsheetId: payload.spreadsheetId,
        sheetName: payload.sheetName,
        rowNumber: payload.rowNumber,
      },
    })

    return ok({ created: imported.created, leadId: imported.lead.id, qualified: Boolean(imported.intake) }, { status: imported.created ? 201 : 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
