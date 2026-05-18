import { Prisma } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createTask } from "@/lib/services/tasks"

type BookingAssistantInput = {
  organizationId: string
  advisorId?: string | null
  leadId?: string | null
  clientId?: string | null
  smsId?: string | null
  fromNumber: string
  body: string
}

type BookingAssistantResult = {
  handled: boolean
  reply?: string
  leadId?: string | null
  clientId?: string | null
  taskIds: string[]
}

type SubjectProfile = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  service?: string | null
}

type AppointmentSlot = {
  index: number
  startsAt: Date
}

const bookingTimeZone = process.env.FINADVISOR_BOOKING_TIMEZONE ?? "America/Toronto"
const pendingAppointmentTitle = "RDV proposé - attente confirmation"
const confirmedAppointmentTitle = "Rendez-vous confirmé"

const serviceKeywords = [
  "assurance vie",
  "vie",
  "invalidite",
  "invalidité",
  "maladie grave",
  "hypotheque",
  "hypothèque",
  "habitation",
  "auto",
  "entreprise",
  "placement",
  "retraite",
]

const appointmentKeywords = [
  "rdv",
  "rendez-vous",
  "rendez vous",
  "appointment",
  "réserver",
  "reserver",
  "disponible",
  "créneau",
  "creneau",
  "assurance",
  "soumission",
  "devis",
  "conseiller",
  "parler",
]

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function isBookingIntent(message: string) {
  const normalized = normalizeText(message)
  return appointmentKeywords.some((keyword) => normalized.includes(normalizeText(keyword))) || isConfirmation(message)
}

function isConfirmation(message: string) {
  const normalized = normalizeText(message).trim()
  return ["oui", "ok", "confirm", "confirmer", "je confirme", "parfait"].some((keyword) => normalized.includes(keyword))
}

function isSlotSelection(message: string) {
  return extractSlotChoice(message) !== null
}

function extractSlotChoice(message: string) {
  const normalized = normalizeText(message).trim()
  const exact = normalized.match(/^(?:option\s*)?([1-3])$/)?.[1]
  if (exact) return Number.parseInt(exact, 10)
  if (/\b(premier|premiere|première)\b/.test(normalized)) return 1
  if (/\b(deuxieme|deuxième|second|seconde)\b/.test(normalized)) return 2
  if (/\b(troisieme|troisième)\b/.test(normalized)) return 3
  return null
}

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()
}

function extractService(message: string) {
  const normalized = normalizeText(message)
  return serviceKeywords.find((keyword) => normalized.includes(normalizeText(keyword))) ?? null
}

function extractName(message: string) {
  const patterns = [
    /(?:je m'appelle|je suis|mon nom est|moi c'est)\s+([A-Za-zÀ-ÿ' -]{2,60})/i,
    /(?:prenom|prénom|nom)\s*[:=-]\s*([A-Za-zÀ-ÿ' -]{2,60})/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim()
    if (match) return match.replace(/\s+/g, " ")
  }

  return null
}

function splitName(fullName: string | null) {
  if (!fullName) return null
  const parts = fullName.split(" ").filter(Boolean)
  if (parts.length === 0) return null
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || "Prospect",
  }
}

async function fallbackUserId(organizationId: string, advisorId?: string | null) {
  if (advisorId) return advisorId
  const owner = await prisma.user.findFirst({
    where: { organizationId, role: "OWNER" },
    select: { id: true },
  })
  if (owner) return owner.id
  const user = await prisma.user.findFirst({ where: { organizationId }, select: { id: true } })
  return user?.id ?? null
}

async function getExistingOpenTask({
  organizationId,
  title,
  leadId,
  clientId,
}: {
  organizationId: string
  title: string
  leadId?: string | null
  clientId?: string | null
}) {
  return prisma.task.findFirst({
    where: {
      organizationId,
      title,
      leadId: leadId ?? null,
      clientId: clientId ?? null,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })
}

async function getSubjectProfile({
  organizationId,
  leadId,
  clientId,
}: {
  organizationId: string
  leadId?: string | null
  clientId?: string | null
}): Promise<SubjectProfile> {
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { firstName: true, lastName: true, email: true, interestType: true },
    })
    return {
      firstName: lead?.firstName,
      lastName: lead?.lastName,
      email: lead?.email,
      service: lead?.interestType,
    }
  }

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId },
      select: { firstName: true, lastName: true, email: true, emailPrimary: true, primaryGoal: true, protectionNeeds: true },
    })
    return {
      firstName: client?.firstName,
      lastName: client?.lastName,
      email: client?.email ?? client?.emailPrimary,
      service: client?.primaryGoal ?? (client?.protectionNeeds ? "protection financière" : null),
    }
  }

  return {}
}

async function getPendingAppointmentTask({
  organizationId,
  leadId,
  clientId,
}: {
  organizationId: string
  leadId?: string | null
  clientId?: string | null
}) {
  return prisma.task.findFirst({
    where: {
      organizationId,
      title: pendingAppointmentTitle,
      leadId: leadId ?? null,
      clientId: clientId ?? null,
      status: { in: ["TODO", "WAITING", "IN_PROGRESS"] },
    },
    orderBy: { updatedAt: "desc" },
  })
}

async function createAssistantTask({
  organizationId,
  userId,
  leadId,
  clientId,
  title,
  description,
  priority = "HIGH",
  dueDate = new Date(),
}: {
  organizationId: string
  userId: string
  leadId?: string | null
  clientId?: string | null
  title: string
  description: string
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  dueDate?: Date
}) {
  const existing = await getExistingOpenTask({ organizationId, title, leadId, clientId })
  if (existing) return existing.id

  const task = await createTask({
    organizationId,
    userId,
    data: {
      title,
      description,
      type: "FOLLOW_UP",
      status: "TODO",
      priority,
      dueDate,
      leadId: leadId ?? undefined,
      clientId: clientId ?? undefined,
      isAutomated: true,
    },
  })

  return task.id
}

function isKnownName(profile: SubjectProfile, extractedName: string | null) {
  if (extractedName) return true
  return Boolean(profile.firstName && !["nouveau", "nouvelle"].includes(normalizeText(profile.firstName)))
}

function profileName(profile: SubjectProfile, extractedName: string | null) {
  const name = splitName(extractedName)
  if (name) return `${name.firstName} ${name.lastName}`
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "prospect"
}

function addHours(date: Date, hours: number) {
  const next = new Date(date)
  next.setHours(next.getHours() + hours)
  return next
}

function buildAppointmentSlots(now = new Date()): AppointmentSlot[] {
  const earliest = addHours(now, 3)
  const slotTimes = [
    { hour: 9, minute: 30 },
    { hour: 11, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 16, minute: 0 },
  ]
  const slots: AppointmentSlot[] = []

  for (let dayOffset = 0; dayOffset < 10 && slots.length < 3; dayOffset += 1) {
    const candidateDay = new Date(now)
    candidateDay.setDate(now.getDate() + dayOffset)
    const day = candidateDay.getDay()
    if (day === 0 || day === 6) continue

    for (const slotTime of slotTimes) {
      const startsAt = new Date(candidateDay)
      startsAt.setHours(slotTime.hour, slotTime.minute, 0, 0)
      if (startsAt <= earliest) continue
      slots.push({ index: slots.length + 1, startsAt })
      if (slots.length >= 3) break
    }
  }

  return slots
}

function formatSlot(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: bookingTimeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatSlotList(slots: AppointmentSlot[]) {
  return slots.map((slot) => `${slot.index}. ${formatSlot(slot.startsAt)}`).join("\n")
}

function serializeSlots(slots: AppointmentSlot[]) {
  return slots.map((slot) => `Option ${slot.index}: ${slot.startsAt.toISOString()}`).join("\n")
}

function parseSlotsFromDescription(description?: string | null): AppointmentSlot[] {
  if (!description) return []
  const slots: AppointmentSlot[] = []
  const regex = /Option\s+([1-3]):\s+([^\n]+)/g
  let match = regex.exec(description)
  while (match) {
    const index = Number.parseInt(match[1], 10)
    const startsAt = new Date(match[2].trim())
    if (Number.isFinite(index) && !Number.isNaN(startsAt.getTime())) {
      slots.push({ index, startsAt })
    }
    match = regex.exec(description)
  }
  return slots
}

async function createOrUpdateAppointmentProposal({
  organizationId,
  userId,
  leadId,
  clientId,
  service,
  body,
}: {
  organizationId: string
  userId: string
  leadId?: string | null
  clientId?: string | null
  service: string
  body: string
}) {
  const slots = buildAppointmentSlots()
  const description = [
    "Assistant FinAssuro - créneaux proposés",
    `Service: ${service}`,
    serializeSlots(slots),
    "Réponse attendue: 1, 2 ou 3.",
    `Message initial: ${body.slice(0, 220)}`,
  ].join("\n")
  const dueDate = addHours(new Date(), 24)
  const existing = await getPendingAppointmentTask({ organizationId, leadId, clientId })

  if (existing) {
    await prisma.task.updateMany({
      where: { id: existing.id, organizationId },
      data: {
        description,
        status: "WAITING",
        priority: "HIGH",
        dueDate,
        assignedToId: existing.assignedToId ?? userId,
      },
    })
    return { taskId: existing.id, slots }
  }

  const task = await createTask({
    organizationId,
    userId,
    data: {
      title: pendingAppointmentTitle,
      description,
      type: "MEETING",
      status: "WAITING",
      priority: "HIGH",
      dueDate,
      leadId: leadId ?? undefined,
      clientId: clientId ?? undefined,
      isAutomated: true,
    },
  })

  return { taskId: task.id, slots }
}

async function createConfirmedAppointment({
  organizationId,
  userId,
  leadId,
  clientId,
  pendingTaskId,
  selectedSlot,
  service,
  name,
}: {
  organizationId: string
  userId: string
  leadId?: string | null
  clientId?: string | null
  pendingTaskId: string
  selectedSlot: AppointmentSlot
  service: string
  name: string
}) {
  await prisma.task.updateMany({
    where: { id: pendingTaskId, organizationId },
    data: {
      status: "DONE",
      completedAt: new Date(),
      outcome: `Créneau confirmé: ${selectedSlot.startsAt.toISOString()}`,
    },
  })

  const existing = await prisma.task.findFirst({
    where: {
      organizationId,
      title: `${confirmedAppointmentTitle} - ${name}`,
      leadId: leadId ?? null,
      clientId: clientId ?? null,
      type: "MEETING",
      dueDate: selectedSlot.startsAt,
      status: { notIn: ["CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const task = await createTask({
    organizationId,
    userId,
    data: {
      title: `${confirmedAppointmentTitle} - ${name}`,
      description: `Rendez-vous confirmé automatiquement par FinAssuro pour ${service}.`,
      type: "MEETING",
      status: "TODO",
      priority: "HIGH",
      dueDate: selectedSlot.startsAt,
      startDate: selectedSlot.startsAt,
      reminderAt: addHours(selectedSlot.startsAt, -2),
      leadId: leadId ?? undefined,
      clientId: clientId ?? undefined,
      isAutomated: true,
    },
  })

  if (leadId) {
    await prisma.lead.updateMany({
      where: { id: leadId, organizationId },
      data: {
        status: "QUALIFIED",
        priority: "HIGH",
        nextAction: `Rendez-vous confirmé le ${formatSlot(selectedSlot.startsAt)}`,
        lastContactAt: new Date(),
      },
    })
  }

  if (clientId) {
    await prisma.client.updateMany({
      where: { id: clientId, organizationId },
      data: {
        nextReviewDate: selectedSlot.startsAt,
        lastContactAt: new Date(),
        lastInteractionType: "Rendez-vous confirmé",
        lastInteractionDate: new Date(),
      },
    })
  }

  await createCrmActivity({
    organizationId,
    userId,
    leadId,
    clientId,
    taskId: task.id,
    type: "AUTOMATION_EXECUTED",
    title: "Rendez-vous FinAssuro confirmé",
    description: `${name} - ${formatSlot(selectedSlot.startsAt)}`,
    entityType: "Task",
    entityId: task.id,
    source: "AUTOMATION",
    metadata: {
      service,
      startsAt: selectedSlot.startsAt.toISOString(),
      bookingTimeZone,
      pendingTaskId,
    },
  })

  return task.id
}

async function updateLeadFromMessage({
  organizationId,
  leadId,
  body,
  service,
  email,
  fullName,
}: {
  organizationId: string
  leadId: string
  body: string
  service: string | null
  email?: string
  fullName: string | null
}) {
  const name = splitName(fullName)
  const data: Prisma.LeadUpdateInput = {
    priority: "HIGH",
    nextAction: "Qualifier la demande et proposer un rendez-vous",
    notes: `Dernier message assistant RDV: ${body.slice(0, 500)}`,
    ...(service ? { interestType: service } : {}),
    ...(email ? { email } : {}),
    ...(name ? { firstName: name.firstName, lastName: name.lastName } : {}),
  }

  return prisma.lead.updateMany({
    where: { id: leadId, organizationId },
    data,
  })
}

function buildReply({
  firstName,
  hasEmail,
  service,
  confirmed,
  slots,
}: {
  firstName?: string | null
  hasEmail: boolean
  service: string | null
  confirmed: boolean
  slots?: AppointmentSlot[]
}) {
  const greeting = firstName && firstName !== "Nouveau" ? `Merci ${firstName}.` : "Merci pour votre message."

  if (confirmed) {
    return `${greeting} Votre demande de rendez-vous est confirmée côté FinAssuro. Un conseiller valide le créneau et vous revient rapidement.`
  }

  if (!service || !hasEmail) {
    return `${greeting} Pour préparer votre rendez-vous, envoyez votre prénom, votre courriel et le type d'assurance recherché.`
  }

  if (slots?.length) {
    return `${greeting} Voici les prochains créneaux FinAssuro:\n${formatSlotList(slots)}\nRépondez 1, 2 ou 3 pour confirmer.`
  }

  return `${greeting} Votre demande pour ${service} est reçue. Un conseiller vous proposera les meilleurs créneaux disponibles sous peu.`
}

export async function runFinassuroBookingAssistant(input: BookingAssistantInput): Promise<BookingAssistantResult> {
  const subjectId = input.leadId ?? input.clientId ?? null
  const pendingTask = subjectId
    ? await getPendingAppointmentTask({
        organizationId: input.organizationId,
        leadId: input.leadId,
        clientId: input.clientId,
      })
    : null
  const pendingInteraction = Boolean(pendingTask && (isSlotSelection(input.body) || isConfirmation(input.body)))

  if (!isBookingIntent(input.body) && !pendingInteraction) {
    return { handled: false, leadId: input.leadId, clientId: input.clientId, taskIds: [] }
  }

  const userId = await fallbackUserId(input.organizationId, input.advisorId)
  if (!userId) return { handled: false, leadId: input.leadId, clientId: input.clientId, taskIds: [] }

  const email = extractEmail(input.body)
  const fullName = extractName(input.body)
  const profile = await getSubjectProfile({
    organizationId: input.organizationId,
    leadId: input.leadId,
    clientId: input.clientId,
  })
  const service = extractService(input.body) ?? profile.service ?? null
  const effectiveEmail = email ?? profile.email ?? null
  const effectiveName = profileName(profile, fullName)
  const confirmed = isConfirmation(input.body)
  const slotChoice = extractSlotChoice(input.body)
  const taskIds: string[] = []

  if (input.leadId) {
    await updateLeadFromMessage({
      organizationId: input.organizationId,
      leadId: input.leadId,
      body: input.body,
      service,
      email,
      fullName,
    })
  }

  if (pendingTask && slotChoice) {
    const slots = parseSlotsFromDescription(pendingTask.description)
    const selectedSlot = slots.find((slot) => slot.index === slotChoice)
    if (!selectedSlot) {
      return {
        handled: true,
        reply: "Je n'ai pas retrouvé ce créneau. Répondez 1, 2 ou 3 pour confirmer l'une des options proposées.",
        leadId: input.leadId,
        clientId: input.clientId,
        taskIds,
      }
    }

    const taskId = await createConfirmedAppointment({
      organizationId: input.organizationId,
      userId,
      leadId: input.leadId,
      clientId: input.clientId,
      pendingTaskId: pendingTask.id,
      selectedSlot,
      service: service ?? "assurance",
      name: effectiveName,
    })
    taskIds.push(taskId)

    return {
      handled: true,
      reply: `Parfait, votre rendez-vous FinAssuro est confirmé pour ${formatSlot(selectedSlot.startsAt)}. Un conseiller vous contactera au numéro utilisé pour ce message.`,
      leadId: input.leadId,
      clientId: input.clientId,
      taskIds,
    }
  }

  if (pendingTask && confirmed) {
    const slots = parseSlotsFromDescription(pendingTask.description)
    return {
      handled: true,
      reply: slots.length
        ? `Pour confirmer, répondez avec le numéro du créneau souhaité:\n${formatSlotList(slots)}`
        : "Pour confirmer, répondez 1, 2 ou 3 selon le créneau choisi.",
      leadId: input.leadId,
      clientId: input.clientId,
      taskIds,
    }
  }

  if (subjectId) {
    const title = service && effectiveEmail && isKnownName(profile, fullName)
      ? pendingAppointmentTitle
      : confirmed
        ? "Confirmer rendez-vous prospect"
        : "Qualifier demande de rendez-vous"

    if (service && effectiveEmail && isKnownName(profile, fullName)) {
      const proposal = await createOrUpdateAppointmentProposal({
        organizationId: input.organizationId,
        userId,
        leadId: input.leadId,
        clientId: input.clientId,
        service,
        body: input.body,
      })
      taskIds.push(proposal.taskId)

      await createCrmActivity({
        organizationId: input.organizationId,
        userId,
        leadId: input.leadId,
        clientId: input.clientId,
        type: "AUTOMATION_EXECUTED",
        title: "Créneaux FinAssuro proposés",
        description: `${effectiveName} - ${service}`,
        entityType: "Task",
        entityId: proposal.taskId,
        source: "AUTOMATION",
        metadata: {
          service,
          slots: proposal.slots.map((slot) => slot.startsAt.toISOString()),
          bookingTimeZone,
        },
      })

      return {
        handled: true,
        reply: buildReply({
          firstName: splitName(fullName)?.firstName ?? profile.firstName,
          hasEmail: true,
          service,
          confirmed: false,
          slots: proposal.slots,
        }),
        leadId: input.leadId,
        clientId: input.clientId,
        taskIds,
      }
    }

    const taskId = await createAssistantTask({
      organizationId: input.organizationId,
      userId,
      leadId: input.leadId,
      clientId: input.clientId,
      title,
      description: service
        ? `Demande reçue par SMS pour ${service}. Message: ${input.body.slice(0, 220)}`
        : `Demande reçue par SMS. Message: ${input.body.slice(0, 220)}`,
      priority: confirmed ? "URGENT" : "HIGH",
    })
    taskIds.push(taskId)
  }

  await createCrmActivity({
    organizationId: input.organizationId,
    userId,
    leadId: input.leadId,
    clientId: input.clientId,
    type: "AUTOMATION_EXECUTED",
    title: "Assistant RDV FinAssuro",
    description: input.body.slice(0, 160),
    entityType: "SMSMessage",
    entityId: input.smsId,
    source: "AUTOMATION",
    metadata: {
      service,
      emailFound: Boolean(email),
      nameFound: Boolean(fullName),
      confirmed,
      taskIds,
    },
  })

  return {
    handled: true,
    reply: buildReply({
      firstName: splitName(fullName)?.firstName ?? profile.firstName,
      hasEmail: Boolean(effectiveEmail),
      service,
      confirmed,
    }),
    leadId: input.leadId,
    clientId: input.clientId,
    taskIds,
  }
}
