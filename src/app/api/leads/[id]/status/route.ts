import { NextResponse } from "next/server"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { leadStatusLabels, leadStatusTaskTemplates } from "@/lib/lead-status"
import { prisma } from "@/lib/prisma"
import { createTask } from "@/lib/services/tasks"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { updateLeadStatusSchema } from "@/lib/validations/pipeline"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const { status, lostReason, lostNote, nextAction } = updateLeadStatusSchema.parse(
      await request.json()
    )

    if (status === "CONVERTED") {
      return NextResponse.json(
        { error: "La conversion doit passer par l’action Convertir en client." },
        { status: 400 }
      )
    }

    const existingLead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        address: true,
        advisorId: true,
        interestType: true,
        notes: true,
        status: true,
      },
    })

    if (!existingLead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    await prisma.lead.updateMany({
      where: { id, organizationId },
      data: {
        status,
        previousStatus: existingLead.status,
        nextAction,
        lostReason: status === "LOST" ? lostReason : undefined,
        lostNote: status === "LOST" ? lostNote : undefined,
        lostAt: status === "LOST" ? new Date() : undefined,
        archivedAt: status === "ARCHIVED" ? new Date() : undefined,
      },
    })

    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, organizationId },
      include: { advisor: true, tasks: true, activities: true },
    })

    if (status !== existingLead.status) {
      const title = "Statut du prospect modifié"
      const description = `${lead.firstName} ${lead.lastName}: ${leadStatusLabels[existingLead.status]} -> ${leadStatusLabels[status]}.`

      await createCrmActivity({
        organizationId,
        userId,
        leadId: lead.id,
        type: status === "LOST" ? "LEAD_LOST" : status === "ARCHIVED" ? "LEAD_ARCHIVED" : "LEAD_STATUS_CHANGED",
        title,
        description,
        entityType: "Lead",
        entityId: lead.id,
        metadata: {
          oldStatus: existingLead.status,
          newStatus: status,
          lostReason,
          changedFromPipeline: true,
        },
      })

      await runAutomationsForEvent({
        organizationId,
        userId,
        leadId: lead.id,
        event: "LEAD_STATUS_CHANGED",
        entityType: "lead",
        entityId: lead.id,
        title,
        description,
        payload: {
          oldStatus: existingLead.status,
          newStatus: status,
          status,
          source: lead.source,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
        },
      })

      const template = leadStatusTaskTemplates[status]
      if (template) {
        await createTask({
          organizationId,
          userId,
          data: {
            assignedToId: userId,
            leadId: lead.id,
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: "TODO",
            type: status === "WON" ? "FOLLOW_UP" : "CALL",
            dueDate: new Date(Date.now() + template.dueInHours * 60 * 60 * 1000),
            isAutomated: true,
          },
        })
      }

      if (status === "WON") {
        try {
          await prisma.notification.create({
            data: {
              organizationId,
              userId,
              type: "SUCCESS",
              title: "Prospect gagné",
              message: `${lead.firstName} ${lead.lastName} a accepté l'offre. Vous pouvez le convertir en client.`,
              href: `/prospects/${lead.id}`,
            },
          })
        } catch (error) {
          console.warn({ action: "won_notification_failed", leadId: lead.id, name: error instanceof Error ? error.name : "UnknownError" })
        }
      }
    }

    return NextResponse.json({ data: lead })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de modifier le statut du prospect." },
      { status: 400 }
    )
  }
}
