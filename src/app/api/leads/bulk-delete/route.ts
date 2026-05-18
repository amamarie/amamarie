import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

export async function DELETE(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { ids } = bulkDeleteSchema.parse(await request.json())
    const uniqueIds = Array.from(new Set(ids))
    const leads = await prisma.lead.findMany({
      where: { id: { in: uniqueIds }, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (leads.length === 0) {
      return NextResponse.json({ data: { deleted: 0, ids: [] } })
    }

    await prisma.$transaction(async (tx) => {
      await tx.activity.createMany({
        data: leads.map((lead) => ({
          organizationId,
          userId,
          leadId: lead.id,
          type: "LEAD_ARCHIVED",
          title: "Prospect supprimé",
          description: `${lead.firstName} ${lead.lastName} a été supprimé de la liste des prospects.`,
          source: "USER",
          metadata: { deletedLeadId: lead.id, bulkDelete: true },
        })),
      })

      await tx.lead.deleteMany({
        where: { id: { in: leads.map((lead) => lead.id) }, organizationId },
      })
    })

    return NextResponse.json({ data: { deleted: leads.length, ids: leads.map((lead) => lead.id) } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de supprimer les prospects sélectionnés." },
      { status: 500 }
    )
  }
}
