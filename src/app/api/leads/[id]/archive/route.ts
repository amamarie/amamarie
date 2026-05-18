import { NextResponse } from "next/server"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()

    const existingLead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true, status: true },
    })

    if (!existingLead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    await prisma.lead.updateMany({
      where: { id, organizationId },
      data: { status: "ARCHIVED" },
    })

    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, organizationId },
      include: { advisor: true, tasks: true, activities: true },
    })

    if (existingLead.status !== "ARCHIVED") {
      await createCrmActivity({
        organizationId,
        userId,
        leadId: lead.id,
        type: "LEAD_ARCHIVED",
        title: "Prospect archivé",
        description: `${lead.firstName} ${lead.lastName} a été archivé.`,
      })
    }

    return NextResponse.json({ data: lead })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible d'archiver le prospect." },
      { status: 500 }
    )
  }
}
