import { z } from "zod"
import { Prisma } from "@prisma/client"

import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string; fieldId: string }> }

const validateFieldSchema = z.object({
  value: z.unknown().optional(),
  status: z.enum(["VALIDATED", "CORRECTED", "REJECTED", "NOT_APPLICABLE", "SYNCHRONIZED"]).default("VALIDATED"),
  note: z.string().trim().optional(),
})

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

function toJsonValue(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, fieldId } = await params
    const user = await getCurrentTenantUser()
    const document = await getDocumentById({ user, id })
    const payload = validateFieldSchema.parse(await request.json())

    const existing = await prisma.documentExtractedField.findFirstOrThrow({
      where: {
        id: fieldId,
        documentId: document.id,
        organizationId: user.organizationId,
      },
    })

    const field = await prisma.documentExtractedField.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        validatedValue: payload.value === undefined ? existing.extractedValue ?? Prisma.JsonNull : toJsonValue(payload.value),
        validationNote: payload.note,
        validatedById: user.id,
        validatedAt: new Date(),
      },
    })

    const remaining = await prisma.documentExtractedField.count({
      where: {
        extractionId: existing.extractionId,
        status: { in: ["PROPOSED", "TO_VALIDATE"] },
      },
    })
    if (remaining === 0) {
      await prisma.documentExtraction.update({
        where: { id: existing.extractionId },
        data: {
          status: "VALIDATED",
          validatedById: user.id,
          validatedAt: new Date(),
        },
      })
    }

    await logDocumentAccess({
      user,
      document,
      eventType: "VALIDATE",
      request,
      purpose: "Validation humaine d’un champ extrait",
      metadata: { fieldId: field.id, fieldKey: field.fieldKey, status: field.status },
    })

    return ok(field)
  } catch (error) {
    return handleDocumentError(error)
  }
}

