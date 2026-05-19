"use server"

import { revalidatePath } from "next/cache"

import {
  upsertInboundCallReceptionWorkflow,
  upsertLeadFormAutomationWorkflows,
  upsertRetellAssurancePhoneAgentWorkflow,
} from "@/lib/automation/n8n"
import { requireSaasRole } from "@/lib/auth/roles"

export async function syncAllAutomationWorkflows() {
  await requireSaasRole(["DEVELOPER"])
  await upsertLeadFormAutomationWorkflows()
  revalidatePath("/developpeur/automatisations")
}

export async function syncInboundCallWorkflow() {
  await requireSaasRole(["DEVELOPER"])
  await upsertInboundCallReceptionWorkflow()
  revalidatePath("/developpeur/automatisations")
}

export async function syncRetellAssuranceWorkflow() {
  await requireSaasRole(["DEVELOPER"])
  await upsertRetellAssurancePhoneAgentWorkflow()
  revalidatePath("/developpeur/automatisations")
}
