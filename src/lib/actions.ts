"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/db"
import { createActivity } from "@/lib/services/activities"
import { getDefaultOrganizationId } from "@/lib/tenant"
import {
  clientCreateSchema,
  leadCreateSchema,
  taskCreateSchema,
} from "@/lib/validators"

function value(formData: FormData, key: string) {
  const item = formData.get(key)
  return typeof item === "string" && item.trim() ? item.trim() : undefined
}

export async function createLeadAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const payload = leadCreateSchema.parse({
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    source: value(formData, "source") ?? "MANUAL",
    interestType: value(formData, "interest") ?? value(formData, "interestType"),
    priority: value(formData, "priority") ?? "NORMAL",
    nextAction: value(formData, "nextAction"),
    notes: value(formData, "notes"),
  })

  const lead = await prisma.lead.create({
    data: { ...payload, organizationId },
  })

  await createActivity({
    organizationId,
    leadId: lead.id,
    type: "LEAD_CREATED",
    title: "Prospect créé",
    description: `${lead.firstName} ${lead.lastName} a été ajouté depuis le formulaire.`,
    entityType: "Lead",
    entityId: lead.id,
  })

  revalidatePath("/prospects")
}

export async function archiveLeadAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const id = value(formData, "id")

  if (!id) {
    throw new Error("Lead id is required.")
  }

  await prisma.lead.updateMany({
    where: { id, organizationId },
    data: { status: "LOST" },
  })

  revalidatePath("/prospects")
}

export async function convertLeadAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const id = value(formData, "id")

  if (!id) {
    throw new Error("Lead id is required.")
  }

  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, organizationId },
  })

  const client = await prisma.client.create({
    data: {
      organizationId,
      advisorId: lead.advisorId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      phonePrimary: lead.phone,
      email: lead.email,
      emailPrimary: lead.email,
      address: lead.address,
      addressLine1: lead.address,
      goals: lead.interestType,
      financialGoals: lead.interestType,
      notes: lead.notes,
    },
  })

  await prisma.lead.updateMany({
    where: { id, organizationId },
    data: { status: "CONVERTED", convertedAt: new Date() },
  })

  await createActivity({
    organizationId,
    leadId: lead.id,
    clientId: client.id,
    type: "LEAD_CONVERTED",
    title: "Prospect converti",
    description: `${lead.firstName} ${lead.lastName} a été converti en client.`,
    entityType: "Lead",
    entityId: lead.id,
  })

  revalidatePath("/prospects")
  revalidatePath("/clients")
  redirect(`/clients/${client.id}`)
}

export async function createClientAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const payload = clientCreateSchema.parse({
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    phonePrimary: value(formData, "phonePrimary") ?? value(formData, "phone"),
    emailPrimary: value(formData, "emailPrimary") ?? value(formData, "email"),
    occupation: value(formData, "occupation"),
    status: "ACTIVE",
    riskProfile: value(formData, "riskLevel") ?? "MODERATE",
    financialGoals: value(formData, "objective") ?? "Protection familiale",
  })

  await prisma.client.create({
    data: {
      ...payload,
      organizationId,
      phone: payload.phone ?? payload.phonePrimary,
      email: payload.emailPrimary ?? payload.email ?? null,
      goals: payload.goals ?? payload.financialGoals,
    },
  })

  revalidatePath("/clients")
}

export async function createTaskAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const payload = taskCreateSchema.parse({
    title: value(formData, "title"),
    description: value(formData, "description"),
    priority: value(formData, "priority") ?? "NORMAL",
    status: "TODO",
  })

  await prisma.task.create({
    data: { ...payload, organizationId },
  })

  revalidatePath("/taches")
}

export async function completeTaskAction(formData: FormData) {
  const organizationId = await getDefaultOrganizationId()
  const id = value(formData, "id")

  if (!id) {
    throw new Error("Task id is required.")
  }

  await prisma.task.updateMany({
    where: { id, organizationId },
    data: { status: "DONE", completedAt: new Date() },
  })

  revalidatePath("/taches")
}
