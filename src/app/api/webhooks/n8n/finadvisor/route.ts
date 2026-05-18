import { timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { workflowSecret } from "@/lib/automation/workflows"
import { createCrmActivity } from "@/lib/crm-events"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { appendLeadFormSubmissionToSheet } from "@/lib/google/sheets"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { sendAutomatedSms } from "@/lib/services/automated-sms"
import { routeLeadFromFormQualification } from "@/lib/services/lead-routing"
import { createNotification } from "@/lib/services/notifications"
import { smsSendErrorMessage } from "@/lib/twilio/errors"

const callbackSchema = z.object({
  action: z.enum(["create_task", "create_activity", "send_sms", "send_email", "append_google_sheet", "route_lead", "notify_advisor", "noop"]).default("noop"),
  organizationId: z.string().min(1),
  userId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  callId: z.string().nullable().optional(),
  leadFormId: z.string().nullable().optional(),
  submissionId: z.string().nullable().optional(),
  automationRuleId: z.string().nullable().optional(),
  workflowKey: z.string().optional(),
  title: z.string().min(1).default("Action automatisée"),
  description: z.string().nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
  subject: z.string().max(180).nullable().optional(),
  html: z.string().max(20000).nullable().optional(),
  text: z.string().max(10000).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueInHours: z.coerce.number().positive().optional(),
  dueInDays: z.coerce.number().positive().optional(),
  detectedNeed: z.string().max(160).nullable().optional(),
  urgency: z.string().max(80).nullable().optional(),
  budget: z.string().max(120).nullable().optional(),
  rationale: z.string().max(1000).nullable().optional(),
})

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : ""
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function dueDate({ dueInHours, dueInDays }: { dueInHours?: number; dueInDays?: number }) {
  if (Number.isFinite(dueInHours)) return new Date(Date.now() + Number(dueInHours) * 60 * 60 * 1000)
  if (Number.isFinite(dueInDays)) return new Date(Date.now() + Number(dueInDays) * 24 * 60 * 60 * 1000)
  return undefined
}

function renderTemplate(value: string | null | undefined, context: Record<string, unknown>) {
  if (!value) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(context[key] ?? ""))
}

async function resolveAssignee({
  organizationId,
  userId,
  leadId,
  clientId,
  callId,
}: {
  organizationId: string
  userId?: string | null
  leadId?: string | null
  clientId?: string | null
  callId?: string | null
}) {
  if (userId) return userId

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { advisorId: true },
    })
    if (lead?.advisorId) return lead.advisorId
  }

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId },
      select: { advisorId: true },
    })
    if (client?.advisorId) return client.advisorId
  }

  if (callId) {
    const call = await prisma.callLog.findFirst({
      where: { id: callId, organizationId },
      select: { advisorId: true },
    })
    if (call?.advisorId) return call.advisorId
  }

  return null
}

async function createWorkflowErrorTask({
  organizationId,
  userId,
  leadId,
  clientId,
  callId,
  automationRuleId,
  workflowKey,
  title,
  message,
}: {
  organizationId: string
  userId?: string | null
  leadId?: string | null
  clientId?: string | null
  callId?: string | null
  automationRuleId?: string | null
  workflowKey?: string | null
  title: string
  message: string
}) {
  const assignedToId = await resolveAssignee({ organizationId, userId, leadId, clientId, callId })
  const task = await prisma.task.create({
    data: {
      organizationId,
      assignedToId,
      createdById: assignedToId,
      leadId: leadId ?? null,
      clientId: clientId ?? null,
      automationRuleId: automationRuleId ?? null,
      title,
      description: message.slice(0, 240),
      priority: "HIGH",
      type: "FOLLOW_UP",
      status: "TODO",
      isAutomated: true,
      dueDate: new Date(),
    },
  })

  await createCrmActivity({
    organizationId,
    userId: assignedToId,
    leadId: leadId ?? null,
    clientId: clientId ?? null,
    taskId: task.id,
    automationRuleId: automationRuleId ?? null,
    type: "AUTOMATION_FAILED",
    title,
    description: message.slice(0, 160),
    entityType: "Task",
    entityId: task.id,
    source: "AUTOMATION",
    metadata: { workflowKey },
  })

  return task
}

export async function POST(request: Request) {
  try {
    const secret = workflowSecret()
    if (!secret) return fail("WORKFLOW_SECRET_MISSING", "Secret n8n non configuré.", 503)
    if (!safeEqual(bearerToken(request), secret)) return fail("UNAUTHORIZED", "Webhook n8n non autorisé.", 401)

    const payload = callbackSchema.parse(await request.json())

    if (payload.action === "noop") {
      return ok({ received: true })
    }

    if (payload.action === "create_activity") {
      const activity = await createCrmActivity({
        organizationId: payload.organizationId,
        userId: payload.userId ?? null,
        leadId: payload.leadId ?? null,
        clientId: payload.clientId ?? null,
        automationRuleId: payload.automationRuleId ?? null,
        type: "AUTOMATION_EXECUTED",
        title: payload.title,
        description: payload.description,
        entityType: "AutomationWorkflow",
        entityId: payload.workflowKey,
        source: "AUTOMATION",
        metadata: { workflowKey: payload.workflowKey, callId: payload.callId ?? null },
      })
      return ok({ created: true, activityId: activity?.id ?? null })
    }

    if (payload.action === "notify_advisor") {
      const assignedToId = await resolveAssignee({
        organizationId: payload.organizationId,
        userId: payload.userId,
        leadId: payload.leadId,
        clientId: payload.clientId,
        callId: payload.callId,
      })

      if (!assignedToId) {
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: payload.userId,
          leadId: payload.leadId,
          clientId: payload.clientId,
          callId: payload.callId,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Notification n8n à vérifier",
          message: "Le workflow n8n a demandé une notification conseiller, mais aucun conseiller n’a été trouvé.",
        })
        return ok({ notified: false, taskId: task.id, reason: "advisor_missing" })
      }

      const notification = await createNotification({
        organizationId: payload.organizationId,
        userId: assignedToId,
        type: "CALL_RECEIVED",
        priority: payload.priority === "LOW" ? "NORMAL" : payload.priority,
        title: payload.title,
        message: payload.message ?? payload.description ?? "Action n8n à traiter.",
        actionLabel: "Ouvrir",
        actionUrl: payload.leadId ? `/prospects/${payload.leadId}` : payload.clientId ? `/clients/${payload.clientId}` : "/communications",
        entityType: payload.leadId ? "Lead" : payload.clientId ? "Client" : payload.callId ? "CallLog" : undefined,
        entityId: payload.leadId ?? payload.clientId ?? payload.callId ?? undefined,
        leadId: payload.leadId ?? undefined,
        clientId: payload.clientId ?? undefined,
      })

      return ok({ notified: true, notificationId: notification.id })
    }

    if (payload.action === "route_lead") {
      if (!payload.leadId) {
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: payload.userId,
          clientId: payload.clientId,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Routage n8n à vérifier",
          message: "Le workflow n8n a demandé un routage conseiller, mais aucun prospect n’est lié au callback.",
        })
        return ok({ routed: false, taskId: task.id, reason: "lead_missing" })
      }

      const result = await routeLeadFromFormQualification({
        organizationId: payload.organizationId,
        leadId: payload.leadId,
        userId: payload.userId,
        automationRuleId: payload.automationRuleId,
        workflowKey: payload.workflowKey,
        detectedNeed: payload.detectedNeed,
        urgency: payload.urgency ?? payload.priority,
        budget: payload.budget,
        rationale: payload.rationale ?? payload.description,
      })
      return ok(result)
    }

    if (payload.action === "send_sms") {
      const lead = payload.leadId
        ? await prisma.lead.findFirst({
            where: { id: payload.leadId, organizationId: payload.organizationId },
            select: { id: true, phone: true, advisorId: true, firstName: true, lastName: true },
          })
        : null
      const client = payload.clientId
        ? await prisma.client.findFirst({
            where: { id: payload.clientId, organizationId: payload.organizationId },
            select: { id: true, phone: true, phonePrimary: true, advisorId: true, firstName: true, lastName: true },
          })
        : null
      const call = payload.callId
        ? await prisma.callLog.findFirst({
            where: { id: payload.callId, organizationId: payload.organizationId },
            select: { id: true, fromNumber: true, advisorId: true },
          })
        : null

      const advisorId = payload.userId ?? lead?.advisorId ?? client?.advisorId ?? call?.advisorId ?? null
      const to = lead?.phone ?? client?.phonePrimary ?? client?.phone ?? call?.fromNumber ?? null
      const fullName = [lead?.firstName ?? client?.firstName, lead?.lastName ?? client?.lastName].filter(Boolean).join(" ")
      const body = renderTemplate(payload.message?.trim() || "Bonjour, votre demande a bien été reçue. Un conseiller vous contactera sous peu.", {
        firstName: lead?.firstName ?? client?.firstName ?? "",
        lastName: lead?.lastName ?? client?.lastName ?? "",
        fullName,
      }) ?? "Bonjour, votre demande a bien été reçue. Un conseiller vous contactera sous peu."

      try {
        const sms = await sendAutomatedSms({
          organizationId: payload.organizationId,
          advisorId,
          leadId: payload.leadId ?? null,
          clientId: payload.clientId ?? null,
          to,
          body,
        })

        await createCrmActivity({
          organizationId: payload.organizationId,
          userId: advisorId,
          leadId: payload.leadId ?? null,
          clientId: payload.clientId ?? null,
          automationRuleId: payload.automationRuleId ?? null,
          type: sms ? "SMS_SENT" : "AUTOMATION_EXECUTED",
          title: sms ? payload.title : "SMS n8n non envoyé",
          description: sms ? body.slice(0, 160) : "Le workflow n8n a demandé un SMS, mais l’envoi automatique est désactivé ou incomplet.",
          entityType: sms ? "SMSMessage" : "AutomationWorkflow",
          entityId: sms?.id ?? payload.workflowKey,
          source: "AUTOMATION",
          metadata: { workflowKey: payload.workflowKey, callbackAction: "send_sms" },
        })

        return ok({ sent: Boolean(sms), smsId: sms?.id ?? null })
      } catch (error) {
        const message = smsSendErrorMessage(error)
        const isTwilioTrialBlock = message.toLowerCase().includes("mode essai")
        const assignedToId = await resolveAssignee({
          organizationId: payload.organizationId,
          userId: advisorId,
          leadId: payload.leadId,
          clientId: payload.clientId,
          callId: payload.callId,
        })

        const task = await prisma.task.create({
          data: {
            organizationId: payload.organizationId,
            assignedToId,
            createdById: assignedToId,
            leadId: payload.leadId ?? null,
            clientId: payload.clientId ?? null,
            automationRuleId: payload.automationRuleId ?? null,
            title: isTwilioTrialBlock ? "Activer Twilio production ou vérifier le numéro" : "Erreur SMS n8n à traiter",
            description: isTwilioTrialBlock
              ? "Twilio est en mode essai: vérifiez le numéro destinataire dans Twilio ou passez le compte en production. Le courriel et la tâche conseiller continuent."
              : message.slice(0, 240),
            priority: "HIGH",
            type: "FOLLOW_UP",
            status: "TODO",
            isAutomated: true,
            dueDate: new Date(),
          },
        })

        await createCrmActivity({
          organizationId: payload.organizationId,
          userId: assignedToId,
          leadId: payload.leadId ?? null,
          clientId: payload.clientId ?? null,
          taskId: task.id,
          automationRuleId: payload.automationRuleId ?? null,
          type: "SMS_FAILED",
          title: isTwilioTrialBlock ? "SMS bloqué par Twilio essai" : "Erreur SMS n8n",
          description: message.slice(0, 160),
          entityType: "Task",
          entityId: task.id,
          source: "AUTOMATION",
          metadata: { workflowKey: payload.workflowKey, callbackAction: "send_sms" },
        })

        return ok({ sent: false, taskId: task.id, error: message, reason: isTwilioTrialBlock ? "twilio_trial_unverified_number" : "twilio_send_failed" })
      }
    }

    if (payload.action === "send_email") {
      const lead = payload.leadId
        ? await prisma.lead.findFirst({
            where: { id: payload.leadId, organizationId: payload.organizationId },
            select: { id: true, email: true, firstName: true, lastName: true, advisorId: true },
          })
        : null
      const advisorId = payload.userId ?? lead?.advisorId ?? null
      const to = lead?.email?.trim()
      const fullName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ")
      const context = { firstName: lead?.firstName ?? "", lastName: lead?.lastName ?? "", fullName }
      const subject = renderTemplate(payload.subject?.trim() || "Votre demande a bien été reçue", context) ?? "Votre demande a bien été reçue"
      const text = renderTemplate(payload.text?.trim() || payload.message?.trim() || "Votre demande a bien été reçue. Un conseiller vous contactera sous peu.", context) ?? "Votre demande a bien été reçue. Un conseiller vous contactera sous peu."
      const html = renderTemplate(payload.html?.trim(), context) || undefined

      if (!to || !advisorId) {
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: advisorId,
          leadId: payload.leadId,
          clientId: payload.clientId,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Courriel n8n à vérifier",
          message: "Le workflow n8n a demandé un courriel, mais le prospect ou le conseiller est incomplet.",
        })
        return ok({ sent: false, taskId: task.id, reason: "missing_recipient_or_advisor" })
      }

      try {
        const gmailResult = await sendAdvisorGmailEmail({
          organizationId: payload.organizationId,
          userId: advisorId,
          to,
          subject,
          text,
          html,
        })
        const delivery = gmailResult ?? (
          isResendConfigured()
            ? await sendTransactionalEmail({ to, subject, text, html })
            : null
        )

        if (!delivery) {
          const task = await createWorkflowErrorTask({
            organizationId: payload.organizationId,
            userId: advisorId,
            leadId: payload.leadId,
            clientId: payload.clientId,
            automationRuleId: payload.automationRuleId,
            workflowKey: payload.workflowKey,
            title: "Courriel n8n non envoyé",
            message: "Aucun fournisseur courriel n’est connecté. Connectez Gmail ou configurez Resend.",
          })
          return ok({ sent: false, taskId: task.id, reason: "email_provider_missing" })
        }

        await createCrmActivity({
          organizationId: payload.organizationId,
          userId: advisorId,
          leadId: payload.leadId ?? null,
          clientId: payload.clientId ?? null,
          automationRuleId: payload.automationRuleId ?? null,
          type: "EMAIL_SENT",
          title: payload.title || "Courriel HTML envoyé par workflow",
          description: `${subject} · ${to}`,
          entityType: "AutomationWorkflow",
          entityId: payload.workflowKey,
          source: "AUTOMATION",
          metadata: { workflowKey: payload.workflowKey, callbackAction: "send_email" },
        })

        return ok({ sent: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur courriel n8n"
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: advisorId,
          leadId: payload.leadId,
          clientId: payload.clientId,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Erreur courriel n8n à traiter",
          message,
        })
        return ok({ sent: false, taskId: task.id, error: message })
      }
    }

    if (payload.action === "append_google_sheet") {
      const submission = payload.submissionId
        ? await prisma.leadFormSubmission.findFirst({
            where: { id: payload.submissionId, organizationId: payload.organizationId },
            include: { leadForm: true, lead: true },
          })
        : null
      const leadForm = submission?.leadForm ?? (payload.leadFormId
        ? await prisma.leadForm.findFirst({ where: { id: payload.leadFormId, organizationId: payload.organizationId } })
        : null)

      if (!leadForm || !submission) {
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: payload.userId,
          leadId: payload.leadId,
          clientId: payload.clientId,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Google Sheets n8n à vérifier",
          message: "Le workflow n8n ne trouve pas la soumission formulaire à synchroniser.",
        })
        return ok({ synced: false, taskId: task.id, reason: "submission_not_found" })
      }

      const formPayload = submission.payload && typeof submission.payload === "object" && !Array.isArray(submission.payload)
        ? submission.payload as Record<string, unknown>
        : {}
      const lead = submission.lead
      try {
        const result = await appendLeadFormSubmissionToSheet({
          organizationId: payload.organizationId,
          advisorId: leadForm.advisorId,
          spreadsheetId: leadForm.googleSheetId,
          sheetName: leadForm.googleSheetName,
          row: {
            Date: new Date().toISOString(),
            Formulaire: leadForm.name,
            "Prénom": String(formPayload.firstName ?? lead?.firstName ?? ""),
            Nom: String(formPayload.lastName ?? lead?.lastName ?? ""),
            Courriel: String(formPayload.email ?? lead?.email ?? ""),
            "Téléphone": String(formPayload.phone ?? lead?.phone ?? ""),
            "Intérêt": String(formPayload.interestType ?? lead?.interestType ?? ""),
            Message: String(formPayload.message ?? ""),
            "Réponses personnalisées": "",
            "Lead ID": lead?.id ?? payload.leadId ?? "",
            "Submission ID": submission.id,
          },
        })

        await prisma.leadFormSubmission.update({
          where: { id: submission.id },
          data: {
            syncedToGoogleSheets: !result.skipped,
            googleSheetRowId: result.skipped ? null : result.updatedRange,
            syncError: result.skipped ? result.reason : null,
          },
        })

        await createCrmActivity({
          organizationId: payload.organizationId,
          userId: leadForm.advisorId,
          leadId: payload.leadId ?? lead?.id ?? null,
          automationRuleId: payload.automationRuleId ?? null,
          type: "AUTOMATION_EXECUTED",
          title: result.skipped ? "Google Sheets non synchronisé" : "Google Sheets synchronisé par n8n",
          description: result.skipped ? result.reason : result.updatedRange,
          entityType: "LeadFormSubmission",
          entityId: submission.id,
          source: "AUTOMATION",
          metadata: { workflowKey: payload.workflowKey, callbackAction: "append_google_sheet" },
        })

        if (result.skipped) {
          const taskTitle = result.reason === "GOOGLE_WORKSPACE_NOT_CONNECTED"
            ? "Connecter Google Workspace pour synchroniser Sheets"
            : result.reason === "SHEET_NOT_CONFIGURED"
              ? "Configurer le Google Sheet du formulaire"
              : "Vérifier la synchronisation Google Sheets"
          const taskMessage = result.reason === "GOOGLE_WORKSPACE_NOT_CONNECTED"
            ? "Google Workspace n’est pas connecté avec les autorisations Sheets. Connectez Google dans Paramètres > Intégrations, puis relancez la synchronisation."
            : result.reason === "SHEET_NOT_CONFIGURED"
              ? "Le formulaire n’a pas de Google Sheet configuré. Créez ou associez une feuille au formulaire avant de synchroniser les nouvelles lignes."
              : `Synchronisation Google Sheets non complétée: ${result.reason}`
          await createWorkflowErrorTask({
            organizationId: payload.organizationId,
            userId: leadForm.advisorId,
            leadId: payload.leadId ?? lead?.id ?? null,
            automationRuleId: payload.automationRuleId,
            workflowKey: payload.workflowKey,
            title: taskTitle,
            message: taskMessage,
          })
        }

        return ok({ synced: !result.skipped, result })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur Google Sheets n8n"
        await prisma.leadFormSubmission.update({
          where: { id: submission.id },
          data: { syncedToGoogleSheets: false, syncError: message.slice(0, 240) },
        })
        const task = await createWorkflowErrorTask({
          organizationId: payload.organizationId,
          userId: leadForm.advisorId,
          leadId: payload.leadId ?? lead?.id ?? null,
          automationRuleId: payload.automationRuleId,
          workflowKey: payload.workflowKey,
          title: "Erreur Google Sheets n8n à traiter",
          message,
        })
        return ok({ synced: false, taskId: task.id, error: message })
      }
    }

    const existingTask = payload.leadId || payload.clientId
      ? await prisma.task.findFirst({
          where: {
            organizationId: payload.organizationId,
            title: payload.title,
            leadId: payload.leadId ?? null,
            clientId: payload.clientId ?? null,
            automationRuleId: payload.automationRuleId ?? undefined,
            status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
          },
          orderBy: { createdAt: "desc" },
        })
      : null

    if (existingTask) {
      return ok({ created: false, taskId: existingTask.id, reason: "already_exists" })
    }

    const assignedToId = await resolveAssignee({
      organizationId: payload.organizationId,
      userId: payload.userId,
      leadId: payload.leadId,
      clientId: payload.clientId,
      callId: payload.callId,
    })
    const taskLead = payload.leadId
      ? await prisma.lead.findFirst({
          where: { id: payload.leadId, organizationId: payload.organizationId },
          select: { firstName: true, lastName: true },
        })
      : null
    const taskContext = {
      firstName: taskLead?.firstName ?? "",
      lastName: taskLead?.lastName ?? "",
      fullName: [taskLead?.firstName, taskLead?.lastName].filter(Boolean).join(" "),
    }

    const task = await prisma.task.create({
      data: {
        organizationId: payload.organizationId,
        assignedToId,
        createdById: payload.userId ?? assignedToId,
        leadId: payload.leadId ?? null,
        clientId: payload.clientId ?? null,
        automationRuleId: payload.automationRuleId ?? null,
        title: renderTemplate(payload.title, taskContext) ?? payload.title,
        description: renderTemplate(payload.description, taskContext),
        priority: payload.priority,
        type: "FOLLOW_UP",
        status: "TODO",
        isAutomated: true,
        dueDate: dueDate(payload),
      },
    })

    await createCrmActivity({
      organizationId: payload.organizationId,
      userId: payload.userId ?? assignedToId,
      leadId: payload.leadId ?? null,
      clientId: payload.clientId ?? null,
      taskId: task.id,
      automationRuleId: payload.automationRuleId ?? null,
      type: "TASK_CREATED",
      title: "Tâche créée par workflow",
      description: task.title,
      entityType: "Task",
      entityId: task.id,
      source: "AUTOMATION",
      metadata: { workflowKey: payload.workflowKey, callId: payload.callId ?? null },
    })

    return ok({ created: true, taskId: task.id })
  } catch (error) {
    return handleApiError(error)
  }
}
