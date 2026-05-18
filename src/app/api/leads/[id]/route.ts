import { NextResponse } from "next/server"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import {
  duplicateLeadErrorMessage,
  findDuplicateLead,
} from "@/lib/services/lead-service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { updateLeadSchema } from "@/lib/validations/lead"
import { formatValidationError } from "@/lib/validation-error"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        advisor: true,
        tasks: {
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        },
        activities: true,
        calls: true,
        sms: true,
        documents: true,
        leadFormSubmissions: {
          orderBy: { createdAt: "desc" },
          include: {
            leadForm: {
              select: {
                id: true,
                name: true,
                slug: true,
                googleSheetId: true,
              },
            },
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    const notes = await prisma.note.findMany({
      where: { organizationId, leadId: id, status: { not: "DELETED" } },
      include: { user: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ data: { ...lead, noteItems: notes } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de récupérer le prospect." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateLeadSchema.parse(body)
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

    if (data.status === "LOST" && !data.lostReason?.trim()) {
      return NextResponse.json(
        { error: "La raison de perte est requise avant de passer le prospect à Perdu." },
        { status: 400 }
      )
    }

    if (data.phone || data.email) {
      const duplicateLead = await findDuplicateLead({
        prisma,
        organizationId,
        excludeId: id,
        phone: data.phone,
        email: data.email,
      })

      if (duplicateLead && duplicateLead.status !== "ARCHIVED") {
        return NextResponse.json(
          {
            error: duplicateLeadErrorMessage({
              duplicate: duplicateLead,
              phone: data.phone,
              prefix: "Un autre prospect existe déjà",
            }),
            duplicateId: duplicateLead.id,
          },
          { status: 409 }
        )
      }
    }

    await prisma.lead.updateMany({
      where: { id, organizationId },
      data: {
        ...data,
        email: data.email === "" ? null : data.email,
        lostAt: data.status === "LOST" ? data.lostAt ?? new Date() : data.lostAt,
      },
    })

    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, organizationId },
    })

    const statusChanged = data.status && data.status !== existingLead.status
    const activityType = statusChanged ? "LEAD_STATUS_CHANGED" : "LEAD_UPDATED"
    const title = statusChanged ? "Statut du prospect modifié" : "Prospect modifié"
    const description = statusChanged
      ? `${lead.firstName} ${lead.lastName}: ${existingLead.status} -> ${data.status}.`
      : `${lead.firstName} ${lead.lastName} a été mis à jour.`

    await createCrmActivity({
      organizationId,
      userId,
      leadId: lead.id,
      type: activityType,
      title,
      description,
    })

    if (statusChanged) {
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
          newStatus: data.status,
          status: data.status,
          source: lead.source,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
        },
      })
    }

    return NextResponse.json({ data: lead })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: formatValidationError(
          error,
          "Données invalides ou erreur serveur."
        ),
      },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existingLead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!existingLead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    const lead = await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id: existingLead.id, organizationId },
        data: { status: "ARCHIVED" },
      })

      await tx.activity.create({
        data: {
          organizationId,
          userId,
          leadId: existingLead.id,
          type: "LEAD_ARCHIVED",
          title: "Prospect archivé",
          description: `${existingLead.firstName} ${existingLead.lastName} a été archivé.`,
        },
      })

      const archivedLead = await tx.lead.findFirstOrThrow({
        where: { id: existingLead.id, organizationId },
      })

      return archivedLead
    })

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
