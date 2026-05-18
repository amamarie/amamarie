import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!lead) {
      return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          organizationId,
          userId,
          leadId: lead.id,
          type: "LEAD_ARCHIVED",
          title: "Prospect supprimé",
          description: `${lead.firstName} ${lead.lastName} a été supprimé de la liste des prospects.`,
          source: "USER",
          metadata: { deletedLeadId: lead.id },
        },
      })

      await tx.lead.delete({
        where: { id: lead.id },
      })
    })

    return NextResponse.json({ data: { id: lead.id } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de supprimer le prospect." },
      { status: 500 }
    )
  }
}
