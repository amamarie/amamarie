import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, "Le nom du cabinet est requis.").max(160),
  legalName: z.string().trim().max(200).optional().default(""),
  businessNumber: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  contactEmail: z.string().trim().email("Adresse courriel invalide.").or(z.literal("")).optional().default(""),
  website: z.string().trim().url("Site web invalide.").or(z.literal("")).optional().default(""),
  country: z.enum(["Canada", "France"]).optional().default("Canada"),
  region: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  publicAddress: z.string().trim().max(1200).optional().default(""),
})

export async function PATCH(request: Request) {
  try {
    const user = await requireOwner()
    const parsed = organizationSettingsSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Impossible d’enregistrer l’organisation.", 422, parsed.error.flatten())
    }

    const data = parsed.data
    const organization = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: data.name,
        legalName: data.legalName || null,
        businessNumber: data.businessNumber || null,
        phone: data.phone || null,
        contactEmail: data.contactEmail || null,
        website: data.website || null,
        country: data.country,
        region: data.region || null,
        city: data.city || null,
        publicAddress: data.publicAddress || null,
      },
      select: {
        name: true,
        legalName: true,
        businessNumber: true,
        phone: true,
        contactEmail: true,
        website: true,
        country: true,
        region: true,
        city: true,
        publicAddress: true,
      },
    })

    return ok(organization)
  } catch (error) {
    return handleApiError(error)
  }
}
