import { Prisma } from "@prisma/client"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { appendLeadFormSubmissionToSheet, createLeadFormSpreadsheet } from "@/lib/google/sheets"
import { enrollLeadInMarketingSequences, processDueMarketingSequences } from "@/lib/marketing/automation"
import { prisma } from "@/lib/prisma"
import { sendAutomatedSms } from "@/lib/services/automated-sms"
import { runLeadIntakeAutomation } from "@/lib/services/lead-intake-automation"
import { routeLeadFromFormQualification } from "@/lib/services/lead-routing"
import { findDuplicateLead } from "@/lib/services/lead-service"
import { createLeadFormSchema, defaultLeadFormFields, leadFormFieldSchema, submitLeadFormSchema, updateLeadFormSchema, type LeadFormField } from "@/lib/validations/lead-form"

export function publicLeadFormUrl(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  return `${appUrl.replace(/\/$/, "")}/f/${slug}/contact`
}

function normalizeOptional(value?: string | null) {
  const next = value?.trim()
  return next ? next : null
}

function parseLeadFormFields(value: Prisma.JsonValue): LeadFormField[] {
  const parsed = leadFormFieldSchema.array().safeParse(value)
  return parsed.success ? parsed.data : [...defaultLeadFormFields]
}

function validateDynamicRequiredFields(fields: LeadFormField[], data: Record<string, unknown>) {
  for (const field of fields) {
    if (!field.required) continue
    const value = data[field.name]
    const missing = field.type === "checkbox" ? value !== true : typeof value !== "string" || value.trim().length === 0
    if (missing) throw new Error(`${field.label} est requis.`)
  }
}

function customAnswersText(fields: LeadFormField[], data: Record<string, unknown>) {
  const baseFields = new Set(["firstName", "lastName", "email", "phone", "interestType", "message", "consent"])
  return fields
    .filter((field) => !baseFields.has(field.name))
    .map((field) => {
      const value = data[field.name]
      if (value === undefined || value === null || value === "") return null
      return `${field.label}: ${value === true ? "Oui" : String(value)}`
    })
    .filter(Boolean)
    .join("\n")
}

function ruleTargetsLeadForm(conditions: Prisma.JsonValue, leadFormId: string) {
  const serialized = JSON.stringify(conditions ?? {})
  return !serialized.includes("\"leadFormId\"") || serialized.includes(leadFormId)
}

async function hasActiveLeadFormMultichannelN8n({ organizationId, leadFormId }: { organizationId: string; leadFormId: string }) {
  const rules = await prisma.automationRule.findMany({
    where: {
      organizationId,
      name: "Formulaire web - multicanal n8n",
      trigger: "LEAD_CREATED",
      isActive: true,
    },
    select: { conditions: true },
  })
  return rules.some((rule) => ruleTargetsLeadForm(rule.conditions, leadFormId))
}

async function ensureN8nCallbackFollowUp({
  organizationId,
  advisorId,
  leadId,
  submissionId,
}: {
  organizationId: string
  advisorId: string
  leadId: string
  submissionId: string
}) {
  const callbackActivity = await prisma.activity.findFirst({
    where: {
      organizationId,
      leadId,
      source: "AUTOMATION",
      OR: [
        { type: "SMS_SENT" },
        { type: "EMAIL_SENT" },
        { title: { contains: "Google Sheets synchronisé" } },
        { title: { contains: "Tâche créée par workflow" } },
      ],
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  })
  if (callbackActivity) return

  const existingTask = await prisma.task.findFirst({
    where: {
      organizationId,
      leadId,
      title: "Vérifier automatisation multicanal n8n",
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })
  if (existingTask) return

  const task = await prisma.task.create({
    data: {
      organizationId,
      leadId,
      assignedToId: advisorId,
      createdById: advisorId,
      type: "FOLLOW_UP",
      title: "Vérifier automatisation multicanal n8n",
      description: "Le formulaire a déclenché le workflow n8n, mais aucun callback SMS, courriel, Google Sheets ou tâche n’a encore été reçu. Vérifier que le workflow n8n est créé, actif et qu’il rappelle FinAdvisor.",
      priority: "HIGH",
      status: "TODO",
      isAutomated: true,
      dueDate: new Date(Date.now() + 15 * 60 * 1000),
    },
  })

  await prisma.leadFormSubmission.update({
    where: { id: submissionId },
    data: {
      syncedToGoogleSheets: false,
      syncError: "En attente du callback n8n multicanal.",
    },
  })

  await createCrmActivity({
    organizationId,
    userId: advisorId,
    leadId,
    taskId: task.id,
    type: "AUTOMATION_FAILED",
    title: "Callback n8n multicanal non reçu",
    description: "Le workflow a été demandé, mais FinAdvisor n’a reçu aucune preuve d’exécution multicanale.",
    source: "AUTOMATION",
    entityType: "LeadFormSubmission",
    entityId: submissionId,
  })
}

const leadFormInclude = {
  advisor: { select: { id: true, name: true, email: true } },
  submissions: {
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
  },
  _count: { select: { submissions: true } },
} satisfies Prisma.LeadFormInclude

export async function listLeadForms({ organizationId, advisorId }: { organizationId: string; advisorId?: string }) {
  return prisma.leadForm.findMany({
    where: {
      organizationId,
      ...(advisorId ? { advisorId } : {}),
    },
    include: leadFormInclude,
    orderBy: { createdAt: "desc" },
  })
}

export async function createLeadForm({
  organizationId,
  advisorId,
  input,
}: {
  organizationId: string
  advisorId: string
  input: unknown
}) {
  const data = createLeadFormSchema.parse(input)
  const form = await prisma.leadForm.create({
    data: {
      organizationId,
      advisorId,
      name: data.name,
      slug: data.slug,
      subdomainSlug: normalizeOptional(data.subdomainSlug),
      publicTitle: data.publicTitle,
      publicDescription: normalizeOptional(data.publicDescription),
      successMessage: normalizeOptional(data.successMessage),
      googleSheetId: normalizeOptional(data.googleSheetId),
      googleSheetName: normalizeOptional(data.googleSheetName) ?? "Leads",
      fields: (data.fields.length ? data.fields : [...defaultLeadFormFields]) as unknown as Prisma.InputJsonValue,
    },
    include: leadFormInclude,
  })

  if (!form.googleSheetId) {
    try {
      const sheet = await createLeadFormSpreadsheet({
        organizationId,
        advisorId,
        title: `FinAdvisor - ${form.name}`,
        sheetName: form.googleSheetName,
      })
      if (!sheet.skipped) {
        return prisma.leadForm.update({
          where: { id: form.id },
          data: {
            googleSheetId: sheet.spreadsheetId,
            googleSheetName: sheet.sheetName,
          },
          include: leadFormInclude,
        })
      }
    } catch {
      // The CRM form must remain usable even if Google Workspace is not ready yet.
    }
  }

  return form
}

export async function updateLeadForm({
  organizationId,
  advisorId,
  formId,
  input,
}: {
  organizationId: string
  advisorId: string
  formId: string
  input: unknown
}) {
  const data = updateLeadFormSchema.parse(input)
  const existing = await prisma.leadForm.findFirst({
    where: { id: formId, organizationId, advisorId },
    select: { id: true },
  })
  if (!existing) throw new Error("LEAD_FORM_NOT_FOUND")

  return prisma.leadForm.update({
    where: { id: formId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.subdomainSlug !== undefined ? { subdomainSlug: normalizeOptional(data.subdomainSlug) } : {}),
      ...(data.publicTitle !== undefined ? { publicTitle: data.publicTitle } : {}),
      ...(data.publicDescription !== undefined ? { publicDescription: normalizeOptional(data.publicDescription) } : {}),
      ...(data.successMessage !== undefined ? { successMessage: normalizeOptional(data.successMessage) } : {}),
      ...(data.googleSheetId !== undefined ? { googleSheetId: normalizeOptional(data.googleSheetId) } : {}),
      ...(data.googleSheetName !== undefined ? { googleSheetName: normalizeOptional(data.googleSheetName) ?? "Leads" } : {}),
      ...(data.fields !== undefined ? { fields: data.fields as unknown as Prisma.InputJsonValue } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: leadFormInclude,
  })
}

export async function findPublicLeadForm(slug: string) {
  return prisma.leadForm.findFirst({
    where: { slug, isActive: true },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  })
}

export async function submitPublicLeadForm({
  slug,
  input,
  sourceUrl,
  ipAddress,
  userAgent,
}: {
  slug: string
  input: unknown
  sourceUrl?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  const form = await findPublicLeadForm(slug)
  if (!form) throw new Error("LEAD_FORM_NOT_FOUND")
  const data = submitLeadFormSchema.parse(input)
  const fields = parseLeadFormFields(form.fields)
  validateDynamicRequiredFields(fields, data)
  const extraAnswers = customAnswersText(fields, data)
  const fullName = `${data.firstName} ${data.lastName}`

  const duplicate = await findDuplicateLead({
    prisma,
    organizationId: form.organizationId,
    phone: data.phone,
    email: data.email,
  })

  const activeDuplicate = duplicate && duplicate.status !== "ARCHIVED"
  const lead = activeDuplicate
    ? await prisma.lead.update({
        where: { id: duplicate.id },
        data: {
          lastContactAt: new Date(),
          interestType: duplicate.interestType ?? data.interestType,
          nextAction: "Répondre à la nouvelle soumission formulaire",
          notes: [
            duplicate.notes,
            `Nouvelle soumission du formulaire ${form.name}.\n${data.message || "Aucun message ajouté."}${extraAnswers ? `\n\n${extraAnswers}` : ""}`,
          ].filter(Boolean).join("\n\n"),
        },
      })
    : await prisma.lead.create({
        data: {
          organizationId: form.organizationId,
          advisorId: form.advisorId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          source: "WEBSITE",
          priority: "HIGH",
          interestType: data.interestType,
          nextAction: "Contacter le prospect issu du formulaire",
          notes: [data.message || `Soumission du formulaire ${form.name}.`, extraAnswers].filter(Boolean).join("\n\n"),
        },
      })

  const submission = await prisma.leadFormSubmission.create({
    data: {
      organizationId: form.organizationId,
      leadFormId: form.id,
      advisorId: form.advisorId,
      leadId: lead.id,
      payload: data as unknown as Prisma.InputJsonValue,
      sourceUrl: sourceUrl ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  })
  const multichannelN8nActive = await hasActiveLeadFormMultichannelN8n({
    organizationId: form.organizationId,
    leadFormId: form.id,
  })

  const title = activeDuplicate ? "Nouvelle soumission formulaire liée à un prospect existant" : "Prospect créé depuis formulaire"
  const description = `${fullName} a soumis le formulaire ${form.name}.`

  await createCrmActivity({
    organizationId: form.organizationId,
    userId: form.advisorId,
    leadId: lead.id,
    type: activeDuplicate ? "LEAD_UPDATED" : "LEAD_CREATED",
    title,
    description,
    entityType: "LeadFormSubmission",
    entityId: submission.id,
    metadata: { leadFormId: form.id, submissionId: submission.id },
  })

  try {
    const enrollment = await enrollLeadInMarketingSequences({
      organizationId: form.organizationId,
      leadId: lead.id,
      email: lead.email,
      name: fullName,
      consent: data.consent === true,
      metadata: {
        leadFormId: form.id,
        submissionId: submission.id,
        formName: form.name,
        interestType: data.interestType,
      },
    })
    if (enrollment.enrolled > 0 && form.advisorId) {
      await processDueMarketingSequences({ organizationId: form.organizationId, userId: form.advisorId })
    }
  } catch (error) {
    await createCrmActivity({
      organizationId: form.organizationId,
      userId: form.advisorId,
      leadId: lead.id,
      type: "AUTOMATION_FAILED",
      title: "Inscription marketing automatique non réalisée",
      description: error instanceof Error ? error.message.slice(0, 180) : "Impossible d’inscrire ce prospect dans une séquence marketing.",
      source: "AUTOMATION",
      entityType: "LeadFormSubmission",
      entityId: submission.id,
    })
  }

  const intake = await runLeadIntakeAutomation({
    organizationId: form.organizationId,
    advisorId: form.advisorId,
    leadId: lead.id,
    source: "WEBSITE",
    message: [data.message, extraAnswers].filter(Boolean).join("\n\n"),
    phone: data.phone,
    email: data.email,
    formName: form.name,
    createFollowUpTasks: !multichannelN8nActive,
    extraContext: {
      leadFormId: form.id,
      submissionId: submission.id,
      interestType: data.interestType,
      sourceUrl,
    },
  })

  if (intake?.qualification) {
    await routeLeadFromFormQualification({
      organizationId: form.organizationId,
      leadId: lead.id,
      userId: form.advisorId,
      qualification: intake.qualification,
      workflowKey: "lead.form.local_ai_routing",
    })
  }

  if (intake?.clientSmsBody && !multichannelN8nActive) {
    try {
      await sendAutomatedSms({
        organizationId: form.organizationId,
        advisorId: form.advisorId,
        leadId: lead.id,
        to: data.phone,
        body: intake.clientSmsBody,
      })
    } catch (error) {
      await createCrmActivity({
        organizationId: form.organizationId,
        userId: form.advisorId,
        leadId: lead.id,
        type: "SMS_FAILED",
        title: "Échec SMS automatique formulaire",
        description: error instanceof Error ? error.message.slice(0, 160) : "Impossible d’envoyer le SMS automatique.",
        source: "SYSTEM",
        entityType: "LeadFormSubmission",
        entityId: submission.id,
      })
    }
  }

  await runAutomationsForEvent({
    organizationId: form.organizationId,
    userId: form.advisorId,
    leadId: lead.id,
    event: "LEAD_CREATED",
    title,
    description,
    payload: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      interestType: data.interestType,
      message: data.message ?? "",
      source: "lead_form",
      leadFormId: form.id,
      submissionId: submission.id,
    },
  })

  if (multichannelN8nActive) {
    await ensureN8nCallbackFollowUp({
      organizationId: form.organizationId,
      advisorId: form.advisorId,
      leadId: lead.id,
      submissionId: submission.id,
    })
  }

  if (!multichannelN8nActive) {
    try {
      const sheets = await appendLeadFormSubmissionToSheet({
        organizationId: form.organizationId,
        advisorId: form.advisorId,
        spreadsheetId: form.googleSheetId,
        sheetName: form.googleSheetName,
        row: {
          Date: new Date().toISOString(),
          Formulaire: form.name,
          "Prénom": data.firstName,
          Nom: data.lastName,
          Courriel: data.email,
          "Téléphone": data.phone,
          "Intérêt": data.interestType,
          Message: data.message ?? "",
          "Réponses personnalisées": extraAnswers,
          "Lead ID": lead.id,
          "Submission ID": submission.id,
        },
      })
      await prisma.leadFormSubmission.update({
        where: { id: submission.id },
        data: {
          syncedToGoogleSheets: sheets.skipped ? false : true,
          googleSheetRowId: sheets.skipped ? null : sheets.updatedRange,
          syncError: sheets.skipped ? sheets.reason : null,
        },
      })
    } catch (syncError) {
      await prisma.leadFormSubmission.update({
        where: { id: submission.id },
        data: {
          syncedToGoogleSheets: false,
          syncError: syncError instanceof Error ? syncError.message.slice(0, 240) : "Erreur Google Sheets",
        },
      })
    }
  } else {
    await createCrmActivity({
      organizationId: form.organizationId,
      userId: form.advisorId,
      leadId: lead.id,
      type: "AUTOMATION_EXECUTED",
      title: "Traitement multicanal confié à n8n",
      description: "SMS, tâche conseiller et synchronisation Google Sheets sont gérés par le workflow multicanal actif.",
      source: "AUTOMATION",
      entityType: "LeadFormSubmission",
      entityId: submission.id,
    })
  }

  return {
    lead,
    submission,
    message: form.successMessage || "Merci. Votre demande a été envoyée au conseiller.",
  }
}
