import type { Lead, Priority, TaskType } from "@prisma/client"

import { qualifyLeadIntake, type LeadIntakeQualification } from "@/lib/ai/services/qualifyLeadIntake"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

type LeadIntakeSource = "SMS" | "INBOUND_CALL" | "WEBSITE" | "VOICEMAIL" | "EMAIL" | "GOOGLE_SHEETS"

type RunLeadIntakeAutomationInput = {
  organizationId: string
  advisorId?: string | null
  leadId: string
  source: LeadIntakeSource
  message?: string | null
  phone?: string | null
  email?: string | null
  formName?: string | null
  createFollowUpTasks?: boolean
  extraContext?: Record<string, unknown>
}

type LeadForQualification = Pick<Lead, "id" | "firstName" | "lastName" | "email" | "phone" | "status" | "priority" | "interestType" | "nextAction" | "notes">

function priorityFromQualification(qualification: LeadIntakeQualification): Priority {
  if (qualification.urgency === "URGENT" || qualification.temperature === "HOT") return "URGENT"
  if (qualification.urgency === "HIGH" || qualification.temperature === "WARM") return "HIGH"
  if (qualification.urgency === "LOW" || qualification.temperature === "COLD") return "NORMAL"
  return "HIGH"
}

function taskTypeFromSource(source: LeadIntakeSource): TaskType {
  if (source === "INBOUND_CALL" || source === "VOICEMAIL") return "CALL"
  if (source === "SMS") return "SMS"
  if (source === "EMAIL") return "EMAIL"
  return "FOLLOW_UP"
}

function dueDateForPriority(priority: Priority) {
  const date = new Date()
  if (priority === "URGENT") date.setMinutes(date.getMinutes() + 15)
  else if (priority === "HIGH") date.setHours(date.getHours() + 2)
  else date.setDate(date.getDate() + 1)
  return date
}

function followUpDate(delayHours: number) {
  return new Date(Date.now() + delayHours * 60 * 60 * 1000)
}

function labelTemperature(value: LeadIntakeQualification["temperature"]) {
  return value === "HOT" ? "Chaud" : value === "WARM" ? "Tiède" : "Froid"
}

function buildQualificationNote({ source, qualification }: { source: LeadIntakeSource; qualification: LeadIntakeQualification }) {
  return [
    "Qualification automatique FinAssuro",
    `Source: ${source}`,
    `Température: ${labelTemperature(qualification.temperature)}`,
    `Intention: ${qualification.intent}`,
    `Urgence: ${qualification.urgency}`,
    `Besoin probable: ${qualification.probableNeed}`,
    `Prochaine action: ${qualification.nextBestAction}`,
    qualification.missingData.length ? `Données à préciser: ${qualification.missingData.join(", ")}` : null,
    `Raison: ${qualification.rationale}`,
    qualification.disclaimer,
  ]
    .filter(Boolean)
    .join("\n")
}

async function createAutomatedTaskIfNeeded({
  organizationId,
  advisorId,
  leadId,
  title,
  description,
  priority,
  type,
  dueDate,
}: {
  organizationId: string
  advisorId?: string | null
  leadId: string
  title: string
  description: string
  priority: Priority
  type: TaskType
  dueDate: Date
}) {
  const existing = await prisma.task.findFirst({
    where: {
      organizationId,
      leadId,
      title,
      isAutomated: true,
      status: { in: ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] },
    },
    select: { id: true },
  })
  if (existing) return null

  const task = await prisma.task.create({
    data: {
      organizationId,
      leadId,
      assignedToId: advisorId ?? undefined,
      createdById: advisorId ?? undefined,
      type,
      title,
      description,
      priority,
      status: "TODO",
      dueDate,
      isAutomated: true,
    },
  })

  await createCrmActivity({
    organizationId,
    userId: advisorId ?? null,
    leadId,
    taskId: task.id,
    type: "TASK_CREATED",
    title: "Tâche intelligente créée",
    description: task.title,
    entityType: "Task",
    entityId: task.id,
    source: "AI",
  })

  await runAutomationsForEvent({
    organizationId,
    userId: advisorId ?? null,
    leadId,
    event: "TASK_CREATED",
    title: task.title,
    description: task.description,
    entityType: "task",
    entityId: task.id,
    payload: { source: "lead_intake_automation", priority: task.priority, type: task.type },
  })

  return task
}

export async function runLeadIntakeAutomation(input: RunLeadIntakeAutomationInput) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId: input.organizationId },
  })
  if (!lead) return null

  const qualification = await qualifyLeadIntake({
    organizationId: input.organizationId,
    userId: input.advisorId,
    source: input.source,
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email ?? input.email,
      phone: lead.phone ?? input.phone,
      status: lead.status,
      priority: lead.priority,
      interestType: lead.interestType,
      nextAction: lead.nextAction,
      notes: lead.notes,
    },
    message: input.message,
    formName: input.formName,
    extraContext: input.extraContext,
  })

  const priority = priorityFromQualification(qualification)
  const qualificationNote = buildQualificationNote({ source: input.source, qualification })
  const nextNotes = [lead.notes, qualificationNote].filter(Boolean).join("\n\n---\n\n")
  const nextInterestType = lead.interestType ?? qualification.intent.replaceAll("_", " ").toLowerCase()
  const previousStatus = lead.status
  const nextStatus = lead.status === "NEW" ? "TO_CONTACT" : lead.status

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      priority,
      status: nextStatus,
      previousStatus: nextStatus !== previousStatus ? previousStatus : lead.previousStatus,
      interestType: nextInterestType,
      nextAction: qualification.nextBestAction,
      notes: nextNotes,
      lastContactAt: new Date(),
    },
  })

  await createCrmActivity({
    organizationId: input.organizationId,
    userId: input.advisorId ?? null,
    leadId: lead.id,
    type: "LEAD_UPDATED",
    title: "Prospect qualifié automatiquement",
    description: `${labelTemperature(qualification.temperature)} · ${qualification.probableNeed}`,
    source: "AI",
    metadata: {
      source: input.source,
      qualification,
      oldStatus: previousStatus,
      newStatus: nextStatus,
      priority,
    },
  })

  if (nextStatus !== previousStatus) {
    await runAutomationsForEvent({
      organizationId: input.organizationId,
      userId: input.advisorId ?? null,
      leadId: lead.id,
      event: "LEAD_STATUS_CHANGED",
      title: "Statut prospect mis à jour par qualification automatique",
      description: `${previousStatus} → ${nextStatus}`,
      payload: { oldStatus: previousStatus, newStatus: nextStatus, priority, source: input.source },
    })
  }

  const tasks = []
  if (input.createFollowUpTasks ?? true) {
    const mainTask = await createAutomatedTaskIfNeeded({
      organizationId: input.organizationId,
      advisorId: input.advisorId ?? lead.advisorId,
      leadId: lead.id,
      title: qualification.advisorTaskTitle,
      description: qualification.advisorTaskDescription,
      priority,
      type: taskTypeFromSource(input.source),
      dueDate: dueDateForPriority(priority),
    })
    if (mainTask) tasks.push(mainTask)

    const followUpTask = await createAutomatedTaskIfNeeded({
      organizationId: input.organizationId,
      advisorId: input.advisorId ?? lead.advisorId,
      leadId: lead.id,
      title: "Relancer le prospect si aucune réponse",
      description: `Suivi automatique planifié par FinAssuro après la qualification. Prochaine action: ${qualification.nextBestAction}`,
      priority: priority === "URGENT" ? "HIGH" : "NORMAL",
      type: "FOLLOW_UP",
      dueDate: followUpDate(qualification.followUpDelayHours),
    })
    if (followUpTask) tasks.push(followUpTask)
  }

  return {
    lead: updatedLead as LeadForQualification,
    qualification,
    priority,
    clientSmsBody: qualification.clientSms,
    tasks,
  }
}
