"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireSaasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

const advisorRoles = ["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"] as const

export async function createAdvisorSupportTicket(formData: FormData) {
  const user = await requireSaasRole([...advisorRoles])
  const subject = String(formData.get("subject") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const ticketModule = String(formData.get("module") ?? "").trim() || null
  const priority = String(formData.get("priority") ?? "NORMAL")

  if (!subject) {
    redirect("/support?ticket=missing_subject")
  }

  const ticket = await prisma.superAdminTicket.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      subject,
      description,
      module: ticketModule,
      priority,
      status: "OPEN",
      source: "ADVISOR",
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      action: "ADVISOR_SUPPORT_TICKET_CREATED",
      entityType: "SuperAdminTicket",
      entityId: ticket.id,
      newValue: { subject, priority, module: ticketModule },
    },
  }).catch(() => null)

  revalidatePath("/support")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/support")
  revalidatePath(`/super-admin/clients/${user.organizationId}`)
  redirect("/support?ticket=created")
}
