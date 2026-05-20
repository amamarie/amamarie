import { z } from "zod"
import crypto from "node:crypto"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { rangesOverlap } from "@/lib/calendar/availability"
import { createExternalCalendarEvent, getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { resolvePublicAdvisor } from "@/lib/calendar/public-advisors"
import { getServerAvailableSlots } from "@/lib/calendar/server-availability"
import { publicCalendarLinks } from "@/lib/calendar/public-calendar-links"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { runAutomationsForEvent } from "@/lib/crm-events"
import { enrollLeadInMarketingSequences, markMarketingBookingConversion, processDueMarketingSequences } from "@/lib/marketing/automation"
import { prisma } from "@/lib/prisma"
import { sendAutomatedSms } from "@/lib/services/automated-sms"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

const bookingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(220),
  phone: z.string().trim().max(40).optional().nullable(),
  service: z.string().trim().min(2).max(120),
  meetingTypeId: z.string().trim().min(1).optional().nullable(),
  holdId: z.string().trim().min(1).optional().nullable(),
  meetingMode: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).default("VIDEO"),
  startAt: z.string().datetime().optional().nullable(),
  proposedSlots: z.array(z.string().datetime()).max(8).optional().default([]),
  durationMinutes: z.number().int().min(15).max(180).default(30),
  message: z.string().trim().max(1200).optional().nullable(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  questionnaireAnswers: z.record(z.string(), z.unknown()).optional().default({}),
  marketingToken: z.string().trim().min(8).max(120).optional().nullable(),
  marketingConsent: z.boolean().default(false),
}).refine((payload) => Boolean(payload.startAt) || payload.proposedSlots.length > 0, {
  message: "Choisissez un créneau ou proposez au moins une disponibilité.",
  path: ["startAt"],
})

const meetingConflictWindowMinutes = 60
const bufferAfterMinutes = 15

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function fullName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const firstName = parts.shift() ?? "Prospect"
  const lastName = parts.join(" ") || "Calendrier"
  return { firstName, lastName }
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? null
}

function formatBookingDate(date: Date | null, timezone: string) {
  if (!date) return null

  try {
    return date.toLocaleString("fr-CA", { timeZone: timezone })
  } catch {
    return date.toLocaleString("fr-CA", { timeZone: "America/Toronto" })
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(request: Request, { params }: { params: Promise<{ advisorId: string }> }) {
  try {
    const { advisorId } = await params
    const payload = bookingSchema.parse(await request.json())
    const origin = new URL(request.url).origin
    const advisor = await resolvePublicAdvisor(advisorId)
    if (!advisor) return fail("NOT_FOUND", "Ce calendrier n’est pas disponible.", 404)

    const confirmedStart = payload.startAt ? new Date(payload.startAt) : null
    const meetingType = payload.meetingTypeId ? await prisma.meetingType.findFirst({
      where: { id: payload.meetingTypeId, organizationId: advisor.organizationId, isPublic: true, OR: [{ advisorId: advisor.id }, { advisorId: null }] },
    }) : null
    let confirmedDurationMinutes = meetingType?.durationMinutes ?? payload.durationMinutes
    let lockedHoldId = payload.holdId ?? null
    if (confirmedStart) {
      const availability = await getServerAvailableSlots({
        organizationId: advisor.organizationId,
        advisorId: advisor.id,
        date: confirmedStart,
        meetingTypeId: payload.meetingTypeId,
        timezone: payload.timezone,
      })
      confirmedDurationMinutes = availability.rules.durationMinutes
      const end = new Date(confirmedStart.getTime() + confirmedDurationMinutes * 60 * 1000)
      const slotIsAvailable = availability.slots.some((slot) => {
        const slotStart = new Date(slot.start)
        const slotEnd = new Date(slot.end)
        return slotStart.getTime() === confirmedStart.getTime() && slotEnd.getTime() === end.getTime()
      })
      if (!slotIsAvailable && !payload.holdId) return fail("SLOT_UNAVAILABLE", "Ce créneau n’est plus disponible.", 409)

      lockedHoldId = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${advisor.id}))`
        await tx.bookingHold.updateMany({
          where: { organizationId: advisor.organizationId, advisorId: advisor.id, status: "ACTIVE", expiresAt: { lt: new Date() } },
          data: { status: "EXPIRED" },
        })

        if (payload.holdId) {
          const hold = await tx.bookingHold.findFirst({
            where: { id: payload.holdId, organizationId: advisor.organizationId, advisorId: advisor.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
            select: { id: true, startAt: true, endAt: true },
          })
          if (!hold || hold.startAt.getTime() !== confirmedStart.getTime() || hold.endAt.getTime() !== end.getTime()) return null
        }

        const [events, bookings, holds] = await Promise.all([
          tx.calendarEvent.findMany({
            where: {
              organizationId: advisor.organizationId,
              advisorId: advisor.id,
              status: { notIn: ["CANCELLED", "ARCHIVED"] },
              startAt: { lt: end },
              endAt: { gt: confirmedStart },
            },
            select: { startAt: true, endAt: true },
          }),
          tx.booking.findMany({
            where: {
              organizationId: advisor.organizationId,
              advisorId: advisor.id,
              status: { notIn: ["CANCELLED", "ARCHIVED"] },
              startAt: { lt: end },
              endAt: { gt: confirmedStart },
            },
            select: { startAt: true, endAt: true },
          }),
          tx.bookingHold.findMany({
            where: {
              organizationId: advisor.organizationId,
              advisorId: advisor.id,
              id: payload.holdId ? { not: payload.holdId } : undefined,
              status: "ACTIVE",
              expiresAt: { gt: new Date() },
              startAt: { lt: end },
              endAt: { gt: confirmedStart },
            },
            select: { startAt: true, endAt: true },
          }),
        ])

        const busy = [...events, ...bookings, ...holds]
        if (busy.some((range) => rangesOverlap(confirmedStart, end, range.startAt, range.endAt))) return null
        if (payload.holdId) return payload.holdId

        const hold = await tx.bookingHold.create({
          data: {
            organizationId: advisor.organizationId,
            advisorId: advisor.id,
            meetingTypeId: meetingType?.id ?? null,
            startAt: confirmedStart,
            endAt: end,
            timezone: payload.timezone,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            clientEmail: payload.email,
          },
          select: { id: true },
        })
        return hold.id
      })
      if (!lockedHoldId) return fail("SLOT_UNAVAILABLE", "La réservation temporaire a expiré ou ce créneau vient d’être réservé.", 409)
      const dayOfWeek = confirmedStart.getDay()
      const startMinutes = minutesSinceMidnight(confirmedStart)
      const endMinutes = minutesSinceMidnight(end)

      const slots = await prisma.advisorAvailabilitySlot.findMany({
        where: { advisorId: advisor.id, organizationId: advisor.organizationId, isActive: true },
      })
      const isInsideAvailability = slots.some((slot) => (
        slot.dayOfWeek === dayOfWeek &&
        slot.startMinutes <= startMinutes &&
        slot.endMinutes >= endMinutes
      ))
      if (!isInsideAvailability) return fail("SLOT_UNAVAILABLE", "Ce créneau n’est plus disponible.", 409)
      const conflictingMeeting = await prisma.task.findFirst({
        where: {
          organizationId: advisor.organizationId,
          assignedToId: advisor.id,
          type: "MEETING",
          status: { notIn: ["CANCELLED", "ARCHIVED", "DONE"] },
          dueDate: {
            gte: new Date(confirmedStart.getTime() - meetingConflictWindowMinutes * 60 * 1000),
            lt: new Date(end.getTime() + bufferAfterMinutes * 60 * 1000),
          },
        },
        select: { id: true },
      })
      if (conflictingMeeting) return fail("SLOT_UNAVAILABLE", "Ce créneau vient d’être réservé. Choisissez une autre heure.", 409)
      const [conflictingEvent, conflictingBooking, conflictingHold, externalBusy] = await Promise.all([
        prisma.calendarEvent.findFirst({
          where: {
            organizationId: advisor.organizationId,
            advisorId: advisor.id,
            status: { notIn: ["CANCELLED", "ARCHIVED"] },
            startAt: { lt: end },
            endAt: { gt: confirmedStart },
          },
          select: { id: true },
        }),
        prisma.booking.findFirst({
          where: {
            organizationId: advisor.organizationId,
            advisorId: advisor.id,
            status: { notIn: ["CANCELLED", "ARCHIVED"] },
            startAt: { lt: end },
            endAt: { gt: confirmedStart },
          },
          select: { id: true },
        }),
        prisma.bookingHold.findFirst({
          where: {
            organizationId: advisor.organizationId,
            advisorId: advisor.id,
            id: lockedHoldId ? { not: lockedHoldId } : undefined,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
            startAt: { lt: end },
            endAt: { gt: confirmedStart },
          },
          select: { id: true },
        }),
        getExternalCalendarBusyRanges({ organizationId: advisor.organizationId, advisorId: advisor.id, start: confirmedStart, end, timezone: payload.timezone }),
      ])
      if (conflictingEvent || conflictingBooking || conflictingHold || externalBusy.some((range) => confirmedStart < range.end && end > range.start)) {
        return fail("SLOT_UNAVAILABLE", "Ce créneau vient d’être réservé. Choisissez une autre heure.", 409)
      }
    }

    const existingClient = await prisma.client.findFirst({
      where: {
        organizationId: advisor.organizationId,
        OR: [
          { email: payload.email },
          { emailPrimary: payload.email },
          { emailSecondary: payload.email },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, phonePrimary: true, phoneSecondary: true },
    })
    const existingLead = existingClient ? null : await prisma.lead.findFirst({
      where: {
        organizationId: advisor.organizationId,
        status: { notIn: ["CONVERTED", "LOST", "ARCHIVED"] },
        OR: [
          { email: payload.email },
          ...(payload.phone ? [{ phone: payload.phone }] : []),
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })
    const createdLead = !existingClient && !existingLead
    const lead = existingClient || existingLead ? existingLead : await prisma.lead.create({
      data: {
        organizationId: advisor.organizationId,
        advisorId: advisor.id,
        ...splitName(payload.name),
        email: payload.email,
        phone: payload.phone?.trim() || "À renseigner",
        source: "WEBSITE",
        status: "NEW",
        priority: confirmedStart ? "HIGH" : "NORMAL",
        interestType: payload.service,
        nextAction: confirmedStart ? "Préparer le rendez-vous confirmé" : "Confirmer un créneau avec le prospect",
        notes: [
          "Prospect créé depuis la page publique de réservation.",
          payload.message ? `Message: ${payload.message}` : null,
        ].filter(Boolean).join("\n"),
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })
    const deliveryPhone = normalizePhoneNumber(firstNonEmpty(
      payload.phone,
      existingClient?.phonePrimary,
      existingClient?.phone,
      existingClient?.phoneSecondary,
      lead?.phone,
    ))

    const cancellationToken = crypto.randomBytes(24).toString("hex")
    const rescheduleToken = crypto.randomBytes(24).toString("hex")
    const confirmedEnd = confirmedStart ? new Date(confirmedStart.getTime() + confirmedDurationMinutes * 60 * 1000) : null
    const attendeeEmail = payload.email
    const external = confirmedStart && confirmedEnd ? await createExternalCalendarEvent({
      organizationId: advisor.organizationId,
      advisorId: advisor.id,
      title: `${payload.service} - ${payload.name}`,
      description: payload.message,
      start: confirmedStart,
      end: confirmedEnd,
      timezone: payload.timezone,
      locationType: payload.meetingMode,
      meetingProvider: payload.meetingMode === "VIDEO" ? "GOOGLE_MEET" : null,
      attendeeEmail,
    }).catch((error) => {
      console.warn({
        action: "public_booking_external_calendar_sync_failed",
        advisorId: advisor.id,
        name: error instanceof Error ? error.name : "UnknownError",
      })
      return null
    }) : null

    const calendarEvent = confirmedStart && confirmedEnd ? await prisma.calendarEvent.create({
      data: {
        organizationId: advisor.organizationId,
        advisorId: advisor.id,
        createdById: advisor.id,
        clientId: existingClient?.id,
        leadId: existingClient ? null : lead?.id,
        title: `${payload.service} - ${payload.name}`,
        description: payload.message,
        type: "MEETING",
        status: "CONFIRMED",
        priority: "HIGH",
        startAt: confirmedStart,
        endAt: confirmedEnd,
        timezone: payload.timezone,
        locationType: payload.meetingMode,
        meetingUrl: external?.meetingUrl ?? null,
        externalEventId: external?.externalEventId ?? null,
        source: external?.source ?? "PUBLIC_BOOKING",
        visibility: "DETAILS",
        questionnaireAnswers: payload.questionnaireAnswers as never,
      },
    }) : null

    const task = await prisma.task.create({
      data: {
        organizationId: advisor.organizationId,
        assignedToId: advisor.id,
        createdById: advisor.id,
        clientId: existingClient?.id,
        leadId: existingClient ? undefined : lead?.id,
        type: "MEETING",
        priority: "HIGH",
        status: "TODO",
        startDate: confirmedStart,
        dueDate: confirmedStart ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        title: confirmedStart ? `Rendez-vous confirmé - ${payload.service}` : `Disponibilités proposées - ${payload.service}`,
        description: [
          `Demande reçue depuis le calendrier public.`,
          `Nom: ${payload.name}`,
          `Courriel: ${payload.email}`,
          deliveryPhone ? `Téléphone: ${deliveryPhone}` : null,
          `Mode souhaité: ${payload.meetingMode === "PHONE" ? "Téléphone" : payload.meetingMode === "IN_PERSON" ? "Présentiel" : "Visio"}`,
          confirmedStart ? `Début demandé: ${confirmedStart.toISOString()}` : null,
          payload.proposedSlots.length ? `Disponibilités proposées:\n${payload.proposedSlots.map((slot, index) => `${index + 1}. ${new Date(slot).toISOString()}`).join("\n")}` : null,
          `Durée: ${confirmedDurationMinutes} minutes`,
          existingClient ? `Client lié: ${fullName(existingClient)}` : lead ? `Prospect lié: ${fullName(lead)}` : "Client lié: à vérifier",
          payload.message ? `Message: ${payload.message}` : null,
        ].filter(Boolean).join("\n"),
        isAutomated: true,
      },
    })

    if (calendarEvent) {
      await prisma.calendarEvent.update({
        where: { id: calendarEvent.id },
        data: { taskId: task.id },
      })
    }

    const booking = confirmedStart && confirmedEnd ? await prisma.booking.create({
      data: {
        organizationId: advisor.organizationId,
        advisorId: advisor.id,
        meetingTypeId: meetingType?.id ?? null,
        clientId: existingClient?.id,
        leadId: existingClient ? null : lead?.id,
        taskId: task.id,
        calendarEventId: calendarEvent?.id ?? null,
        startAt: confirmedStart,
        endAt: confirmedEnd,
        timezone: payload.timezone,
        status: "CONFIRMED",
        clientName: payload.name,
        clientEmail: payload.email,
        clientPhone: deliveryPhone || null,
        message: payload.message,
        cancellationToken,
        rescheduleToken,
        questionnaireAnswers: payload.questionnaireAnswers as never,
      },
    }) : null

    if (lockedHoldId) {
      await prisma.bookingHold.updateMany({
        where: { id: lockedHoldId, organizationId: advisor.organizationId, advisorId: advisor.id },
        data: { status: "CONVERTED" },
      })
    }

    const marketingConversion = await markMarketingBookingConversion({
      marketingToken: payload.marketingToken,
      bookingId: booking?.id,
      taskId: task.id,
      clientId: existingClient?.id,
      leadId: existingClient ? null : lead?.id,
      advisorId: advisor.id,
      service: payload.service,
      createOpportunity: Boolean(meetingType?.createsOpportunity),
    })

    let sequenceEnrollment: { enrolled: number; skipped: number } | null = null
    if (!booking && !existingClient && lead && payload.marketingConsent) {
      try {
        sequenceEnrollment = await enrollLeadInMarketingSequences({
          organizationId: advisor.organizationId,
          leadId: lead.id,
          email: payload.email,
          name: payload.name,
          consent: true,
          metadata: {
            source: "PUBLIC_BOOKING",
            service: payload.service,
            taskId: task.id,
            proposedSlotsCount: payload.proposedSlots.length,
          },
        })
        if (sequenceEnrollment.enrolled > 0) {
          await processDueMarketingSequences({ organizationId: advisor.organizationId, userId: advisor.id })
        }
      } catch (error) {
        await prisma.activity.create({
          data: {
            organizationId: advisor.organizationId,
            userId: advisor.id,
            leadId: lead.id,
            taskId: task.id,
            type: "AUTOMATION_FAILED",
            title: "Relance marketing automatique non lancée",
            description: error instanceof Error ? error.message.slice(0, 180) : "Impossible d’inscrire ce prospect dans une séquence marketing.",
            source: "AUTOMATION",
            entityType: "Task",
            entityId: task.id,
          },
        })
      }
    }

    await prisma.activity.create({
      data: {
        organizationId: advisor.organizationId,
        userId: advisor.id,
        clientId: existingClient?.id,
        leadId: existingClient ? undefined : lead?.id,
        taskId: task.id,
        type: existingClient ? "TASK_CREATED" : "LEAD_CREATED",
        title: confirmedStart ? "Rendez-vous confirmé depuis la page publique" : "Disponibilités client reçues",
        description: confirmedStart ? `${payload.name} a réservé ${payload.service}.` : `${payload.name} a demandé ${payload.service}.`,
        source: "CLIENT_PORTAL",
        entityType: "Task",
        entityId: task.id,
      },
    })

    await prisma.notification.create({
      data: {
        organizationId: advisor.organizationId,
        userId: advisor.id,
        type: "TASK_ASSIGNED",
        priority: "HIGH",
        status: "UNREAD",
        title: confirmedStart ? "Nouveau rendez-vous confirmé" : "Le client propose ses disponibilités",
        message: confirmedStart ? `${payload.name} a réservé ${payload.service}.` : `${payload.name} a proposé ${payload.proposedSlots.length} disponibilité(s).`,
        actionLabel: "Voir le calendrier",
        actionUrl: "/calendrier",
        href: "/calendrier",
        entityType: "Task",
        entityId: task.id,
        clientId: existingClient?.id,
        leadId: existingClient ? undefined : lead?.id,
        taskId: task.id,
      },
    })

    const automationPayload = {
      source: "public_booking",
      status: "NEW",
      firstName: splitName(payload.name).firstName,
      lastName: splitName(payload.name).lastName,
      fullName: payload.name,
      email: payload.email,
      phone: deliveryPhone ?? payload.phone ?? "",
      service: payload.service,
      meetingMode: payload.meetingMode,
      bookingId: booking?.id,
      calendarEventId: calendarEvent?.id,
      taskId: task.id,
      marketingToken: payload.marketingToken ?? null,
      marketingConsent: payload.marketingConsent,
      marketingSequenceEnrollments: sequenceEnrollment?.enrolled ?? 0,
    }

    if (createdLead && lead) {
      await runAutomationsForEvent({
        organizationId: advisor.organizationId,
        userId: advisor.id,
        leadId: lead.id,
        event: "LEAD_CREATED",
        title: "Prospect créé depuis la réservation publique",
        description: `${payload.name} a demandé ${payload.service}.`,
        entityType: "lead",
        entityId: lead.id,
        payload: automationPayload,
      })
    }

    await runAutomationsForEvent({
      organizationId: advisor.organizationId,
      userId: advisor.id,
      leadId: existingClient ? undefined : lead?.id,
      clientId: existingClient?.id,
      event: "TASK_CREATED",
      title: task.title,
      description: task.description,
      entityType: "task",
      entityId: task.id,
      payload: {
        ...automationPayload,
        taskType: task.type,
        taskPriority: task.priority,
        hasConfirmedBooking: Boolean(booking),
      },
    })

    if (marketingConversion?.opportunityId) {
      await runAutomationsForEvent({
        organizationId: advisor.organizationId,
        userId: advisor.id,
        leadId: existingClient ? undefined : lead?.id,
        clientId: existingClient?.id,
        event: "CROSS_SELL_CREATED",
        title: "Opportunité créée depuis le marketing",
        description: `Rendez-vous réservé après une campagne: ${payload.service}.`,
        entityType: existingClient ? "client" : "lead",
        entityId: existingClient?.id ?? lead?.id,
        payload: {
          ...automationPayload,
          opportunityId: marketingConversion.opportunityId,
          marketingAttribution: "campaign_to_booking",
        },
      })
    }

    const formattedDate = formatBookingDate(confirmedStart, payload.timezone)
    const calendarLinks = booking ? publicCalendarLinks({
      ...booking,
      advisor,
      meetingType: meetingType ? { name: meetingType.name } : { name: payload.service },
    }, origin) : null
    const clientSubject = confirmedStart ? `Rendez-vous confirmé - ${advisor.name}` : `Demande de rendez-vous reçue - ${advisor.name}`
    const clientText = [
      `Bonjour ${payload.name},`,
      "",
      confirmedStart ? `Votre rendez-vous est confirmé.` : `Votre demande de rendez-vous a été reçue.`,
      `Service: ${payload.service}`,
      formattedDate ? `Date confirmée: ${formattedDate}` : `Disponibilités proposées: ${payload.proposedSlots.length}`,
      `Mode souhaité: ${payload.meetingMode === "PHONE" ? "Téléphone" : payload.meetingMode === "IN_PERSON" ? "Présentiel" : "Visio"}`,
      calendarLinks ? `Ajouter au calendrier: Google Calendar, Outlook ou Apple Calendar / autre calendrier.` : null,
      booking ? `Modifier le rendez-vous: ${origin}/rendez-vous/gerer/${rescheduleToken}` : null,
      booking ? `Annuler le rendez-vous: ${origin}/rendez-vous/gerer/${cancellationToken}` : null,
      "",
      confirmedStart ? `${advisor.name} a reçu la réservation.` : `${advisor.name} vous confirmera la rencontre.`,
    ].filter(Boolean).join("\n")
    const clientHtml = [
      `<p>Bonjour ${escapeHtml(payload.name)},</p>`,
      `<p>${confirmedStart ? "Votre rendez-vous est confirmé." : "Votre demande de rendez-vous a été reçue."}</p>`,
      `<p><strong>Service :</strong> ${escapeHtml(payload.service)}<br />`,
      formattedDate ? `<strong>Date confirmée :</strong> ${escapeHtml(formattedDate)}<br />` : `<strong>Disponibilités proposées :</strong> ${payload.proposedSlots.length}<br />`,
      `<strong>Mode souhaité :</strong> ${payload.meetingMode === "PHONE" ? "Téléphone" : payload.meetingMode === "IN_PERSON" ? "Présentiel" : "Visio"}</p>`,
      calendarLinks ? `<p><strong>Ajouter à votre calendrier :</strong></p>
        <p>
          <a href="${escapeHtml(calendarLinks.google)}">Google Calendar</a> &nbsp;|&nbsp;
          <a href="${escapeHtml(calendarLinks.outlook)}">Outlook</a> &nbsp;|&nbsp;
          <a href="${escapeHtml(calendarLinks.ics)}">Apple / autre calendrier</a>
        </p>` : "",
      booking ? `<p><a href="${escapeHtml(`${origin}/rendez-vous/gerer/${rescheduleToken}`)}">Modifier le rendez-vous</a><br />
        <a href="${escapeHtml(`${origin}/rendez-vous/gerer/${cancellationToken}`)}">Annuler le rendez-vous</a></p>` : "",
      `<p>${confirmedStart ? `${escapeHtml(advisor.name)} a reçu la réservation.` : `${escapeHtml(advisor.name)} vous confirmera la rencontre.`}</p>`,
    ].join("")

    let clientEmailSent = false
    let clientSmsSent = false

    const gmailResult = await sendAdvisorGmailEmail({
      organizationId: advisor.organizationId,
      userId: advisor.id,
      to: payload.email,
      replyTo: advisor.email,
      subject: clientSubject,
      text: clientText,
      html: clientHtml,
    }).catch((error) => {
      console.warn({
        action: "public_booking_confirmation_gmail_failed",
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message.slice(0, 160) : undefined,
      })
      return null
    })

    if (gmailResult) {
      clientEmailSent = true
    } else if (isResendConfigured()) {
      const resendResult = await sendTransactionalEmail({
        to: payload.email,
        replyTo: advisor.email,
        subject: clientSubject,
        text: clientText,
        html: clientHtml,
      }).catch((error) => {
        console.warn({
          action: "public_booking_confirmation_email_failed",
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message.slice(0, 160) : undefined,
        })
        return null
      })
      clientEmailSent = Boolean(resendResult)
    } else {
      console.warn({ action: "public_booking_confirmation_email_not_configured", organizationId: advisor.organizationId })
    }

    if (deliveryPhone) {
      const smsDateLine = formattedDate ? ` le ${formattedDate}` : ""
      const calendarLinkLine = calendarLinks ? ` Ajouter au calendrier: ${calendarLinks.ics}` : ""
      const smsBody = confirmedStart
        ? `Bonjour ${splitName(payload.name).firstName}, votre rendez-vous ${payload.service} avec ${advisor.name} est confirmé${smsDateLine}.${calendarLinkLine}`
        : `Bonjour ${splitName(payload.name).firstName}, votre demande de rendez-vous ${payload.service} a été reçue. ${advisor.name} vous confirmera le meilleur créneau.`

      const smsResult = await sendAutomatedSms({
        organizationId: advisor.organizationId,
        advisorId: advisor.id,
        clientId: existingClient?.id,
        leadId: existingClient ? null : lead?.id,
        to: deliveryPhone,
        body: smsBody,
        requireAutoReplyEnabled: false,
      }).catch((error) => {
        console.warn({
          action: "public_booking_confirmation_sms_failed",
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message.slice(0, 160) : undefined,
        })
        return null
      })
      clientSmsSent = Boolean(smsResult)
    }

    const advisorText = [
      `Nouveau rendez-vous depuis la page publique.`,
      "",
      `Client: ${payload.name}`,
      `Courriel: ${payload.email}`,
      deliveryPhone ? `Téléphone: ${deliveryPhone}` : null,
      `Service: ${payload.service}`,
      formattedDate ? `Date confirmée: ${formattedDate}` : `Disponibilités proposées: ${payload.proposedSlots.length}`,
      `Mode souhaité: ${payload.meetingMode === "PHONE" ? "Téléphone" : payload.meetingMode === "IN_PERSON" ? "Présentiel" : "Visio"}`,
      payload.message ? `Message: ${payload.message}` : null,
      "",
      `Ouvrir le calendrier: ${origin}/calendrier`,
    ].filter(Boolean).join("\n")

    await sendAdvisorGmailEmail({
      organizationId: advisor.organizationId,
      userId: advisor.id,
      to: advisor.email,
      replyTo: payload.email,
      subject: confirmedStart ? `Nouveau rendez-vous confirmé - ${payload.name}` : `Disponibilités client reçues - ${payload.name}`,
      text: advisorText,
    }).catch(async () => {
      if (!isResendConfigured()) return null
      return sendTransactionalEmail({
        to: advisor.email,
        replyTo: payload.email,
        subject: confirmedStart ? `Nouveau rendez-vous confirmé - ${payload.name}` : `Disponibilités client reçues - ${payload.name}`,
        text: advisorText,
      }).catch((error) => {
        console.warn({
          action: "public_booking_advisor_email_failed",
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message.slice(0, 160) : undefined,
        })
        return null
      })
    })

    if (!clientEmailSent && !clientSmsSent) {
      await prisma.notification.create({
        data: {
          organizationId: advisor.organizationId,
          userId: advisor.id,
          type: "WARNING",
          priority: "HIGH",
          status: "UNREAD",
          title: "Confirmation client non envoyée",
          message: `Le rendez-vous de ${payload.name} a été créé, mais aucun courriel ni SMS automatique n’a pu être envoyé. Vérifiez Gmail, Resend ou Twilio.`,
          actionLabel: "Voir le calendrier",
          actionUrl: "/calendrier",
          href: "/calendrier",
          entityType: "Task",
          entityId: task.id,
          clientId: existingClient?.id,
          leadId: existingClient ? undefined : lead?.id,
          taskId: task.id,
        },
      })
    } else if (deliveryPhone && !clientSmsSent) {
      await prisma.notification.create({
        data: {
          organizationId: advisor.organizationId,
          userId: advisor.id,
          type: "SMS_FAILED",
          priority: "NORMAL",
          status: "UNREAD",
          title: "SMS de confirmation non envoyé",
          message: `Le rendez-vous de ${payload.name} a été créé et le courriel de confirmation est parti, mais le SMS automatique n’a pas pu être envoyé. Vérifiez le numéro client ou Twilio.`,
          actionLabel: "Voir le calendrier",
          actionUrl: "/calendrier",
          href: "/calendrier",
          entityType: "Task",
          entityId: task.id,
          clientId: existingClient?.id,
          leadId: existingClient ? undefined : lead?.id,
          taskId: task.id,
        },
      })
    }

    return ok({
      taskId: task.id,
      bookingId: booking?.id,
      calendarEventId: calendarEvent?.id,
      cancellationToken,
      rescheduleToken,
      confirmation: {
        emailSent: clientEmailSent,
        smsSent: clientSmsSent,
      },
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
