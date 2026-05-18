import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const confirmSchema = z.object({
  startAt: z.string().datetime(),
  notifyClient: z.boolean().optional().default(true),
})

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function parseContactLine(description: string | null | undefined, label: string) {
  const line = description?.split("\n").find((item) => item.toLowerCase().startsWith(label.toLowerCase()))
  return line?.split(":").slice(1).join(":").trim() ?? ""
}

function serviceFromTitle(title: string) {
  return title.split(" - ").slice(1).join(" - ").trim() || "rendez-vous"
}

function meetingModeLabel(description?: string | null) {
  const mode = parseContactLine(description, "Mode souhaité")
  return mode || "à confirmer"
}

function durationFromDescription(description?: string | null) {
  const raw = parseContactLine(description, "Durée")
  const minutes = Number(raw.match(/\d+/)?.[0] ?? "")
  return Number.isFinite(minutes) && minutes >= 15 && minutes <= 180 ? minutes : 45
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = confirmSchema.parse(await request.json())
    const startAt = new Date(payload.startAt)

    const task = await prisma.task.findFirst({
      where: { id, organizationId, type: "MEETING", status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
      include: { assignedTo: true, client: true },
    })
    if (!task) return fail("NOT_FOUND", "Demande de rendez-vous introuvable.", 404)

    const durationMinutes = durationFromDescription(task.description)
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000)
    const advisorId = task.assignedToId ?? userId
    const slots = await prisma.advisorAvailabilitySlot.findMany({
      where: { organizationId, advisorId, isActive: true },
      select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
    })
    const startMinutes = minutesSinceMidnight(startAt)
    const endMinutes = minutesSinceMidnight(endAt)
    const isInsideAvailability = slots.some((slot) => (
      slot.dayOfWeek === startAt.getDay() &&
      slot.startMinutes <= startMinutes &&
      slot.endMinutes >= endMinutes
    ))
    if (!isInsideAvailability) return fail("SLOT_UNAVAILABLE", "Ce créneau n’est pas dans vos disponibilités.", 409)

    const conflict = await prisma.task.findFirst({
      where: {
        id: { not: task.id },
        organizationId,
        assignedToId: advisorId,
        type: "MEETING",
        status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
        dueDate: {
          gte: new Date(startAt.getTime() - 15 * 60 * 1000),
          lte: new Date(startAt.getTime() + Math.max(15, durationMinutes - 1) * 60 * 1000),
        },
      },
      select: { id: true },
    })
    if (conflict) return fail("SLOT_UNAVAILABLE", "Un rendez-vous existe déjà sur ce créneau.", 409)

    const service = serviceFromTitle(task.title)
    const contactName = task.client ? `${task.client.firstName} ${task.client.lastName}`.trim() : parseContactLine(task.description, "Nom")
    const contactEmail = parseContactLine(task.description, "Courriel")
    const mode = meetingModeLabel(task.description)
    const confirmationLine = `Créneau confirmé par le conseiller: ${startAt.toISOString()}`
    const nextDescription = [
      task.description,
      "",
      "CONFIRMATION",
      confirmationLine,
    ].filter(Boolean).join("\n")

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        title: `Rendez-vous confirmé - ${service}`,
        description: nextDescription,
        startDate: startAt,
        dueDate: startAt,
        status: "TODO",
        priority: "HIGH",
      },
      include: { assignedTo: true, createdBy: true, lead: true, client: true, product: true },
    })

    await prisma.activity.create({
      data: {
        organizationId,
        userId,
        clientId: updated.clientId,
        taskId: updated.id,
        type: "TASK_UPDATED",
        title: "Rendez-vous confirmé",
        description: `${contactName || "Client"} - ${startAt.toLocaleString("fr-CA", { timeZone: "America/Toronto" })}`,
        source: "CRM",
        entityType: "Task",
        entityId: updated.id,
      },
    })

    if (payload.notifyClient && contactEmail) {
      const advisorEmail = task.assignedTo?.email ?? undefined
      const subject = `Rendez-vous confirmé - ${service}`
      const text = [
        `Bonjour ${contactName || ""}`.trim() + ",",
        "",
        `Votre rendez-vous est confirmé.`,
        `Date: ${startAt.toLocaleString("fr-CA", { timeZone: "America/Toronto" })}`,
        `Type: ${service}`,
        `Mode: ${mode}`,
        "",
        "Merci.",
      ].join("\n")

      const gmailResult = await sendAdvisorGmailEmail({
        organizationId,
        userId: advisorId,
        to: contactEmail,
        subject,
        text,
        replyTo: advisorEmail,
      }).catch(() => null)

      if (!gmailResult && isResendConfigured()) {
        await sendTransactionalEmail({ to: contactEmail, subject, text, replyTo: advisorEmail }).catch(() => null)
      }
    }

    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
