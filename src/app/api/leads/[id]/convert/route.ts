import { NextResponse } from "next/server"

import { runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createActivity } from "@/lib/services/activities"
import { sendClientPortalInvitation } from "@/lib/services/client-portal-invitations"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId,
      },
    })

    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    if (lead.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Ce prospect est deja converti." },
        { status: 409 }
      )
    }

    const client = await prisma.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
        data: {
          organizationId,
          advisorId: lead.advisorId ?? userId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          goals: lead.interestType,
          notes: lead.notes,
          status: "PROSPECT_CONVERTED",
        },
      })

      await tx.lead.updateMany({
        where: { id: lead.id, organizationId },
        data: {
          status: "CONVERTED",
          previousStatus: lead.status,
          convertedAt: new Date(),
        },
      })

      return createdClient
    })

    await createActivity({
      organizationId,
      userId,
      leadId: lead.id,
      clientId: client.id,
      type: "LEAD_CONVERTED",
      title: "Prospect converti",
      description: `${lead.firstName} ${lead.lastName} a été converti en client.`,
      entityType: "Lead",
      entityId: lead.id,
      metadata: { oldStatus: lead.status, newStatus: "CONVERTED" },
    })

    await createActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "CLIENT_CREATED",
      title: "Client créé",
      description: `${lead.firstName} ${lead.lastName} a été créé depuis un prospect.`,
      entityType: "Client",
      entityId: client.id,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      leadId: lead.id,
      clientId: client.id,
      event: "CLIENT_CREATED",
      entityType: "client",
      entityId: client.id,
      title: "Client créé",
      description: `${lead.firstName} ${lead.lastName} a été créé depuis un prospect.`,
      payload: {
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        status: client.status,
        advisorId: client.advisorId,
        source: "LEAD_CONVERSION",
      },
    })

    await ensureClientFolderStructure({ organizationId, clientId: client.id, userId })

    try {
      const advisor = await prisma.user.findFirst({
        where: { id: client.advisorId ?? userId, organizationId },
        select: { id: true, name: true, email: true, organizationId: true },
      })
      await sendClientPortalInvitation({
        client,
        advisor,
        triggeredByUserId: userId,
        origin: request.headers.get("origin"),
      })
    } catch (portalInvitationError) {
      console.warn({
        action: "client_portal_invitation_failed",
        clientId: client.id,
        name: portalInvitationError instanceof Error ? portalInvitationError.name : "UnknownError",
      })
    }

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de convertir le prospect." },
      { status: 500 }
    )
  }
}
