import type { ClientConsent } from "@prisma/client"

import { createActivity } from "@/lib/services/activities"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { createConsentEvent } from "@/lib/privacy/service"
import { createNotification } from "@/lib/services/notifications"

function clientEmail(client: { emailPrimary?: string | null; email?: string | null; emailSecondary?: string | null }) {
  return client.emailPrimary ?? client.email ?? client.emailSecondary ?? null
}

function validEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

export async function sendConsentRequestToClient({
  organizationId,
  userId,
  consent,
}: {
  organizationId: string
  userId: string
  consent: Pick<ClientConsent, "id" | "clientId" | "type" | "purposeText">
}) {
  const client = await prisma.client.findFirst({
    where: { id: consent.clientId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailPrimary: true,
      emailSecondary: true,
      advisor: { select: { id: true, name: true, email: true } },
    },
  })
  if (!client) return null
  const email = clientEmail(client)
  const portalUrl = appUrl(`/espace-client?clientId=${client.id}#portal-consents`)
  const advisorName = client.advisor?.name ?? "votre conseiller"
  const subject = `Consentement requis - ${consent.type}`
  const text = `Bonjour ${client.firstName},

${advisorName} vous demande de revoir et confirmer le consentement suivant : ${consent.type}.

Acceder a votre espace client securise :
${portalUrl}

Ce consentement est conserve avec sa finalite, sa version, sa methode et son historique.`
  const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px"><p>Bonjour ${client.firstName},</p><p>${advisorName} vous demande de revoir et confirmer le consentement suivant : <strong>${consent.type}</strong>.</p><p><a href="${portalUrl}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">Ouvrir mon espace client</a></p><p style="color:#475569;font-size:13px">Ce consentement est conserve avec sa finalite, sa version, sa methode et son historique.</p></div>`
  let status: "SENT" | "QUEUED" | "FAILED" | "SKIPPED" = "SKIPPED"
  let detail = "Aucun courriel client au dossier."

  if (validEmail(email)) {
    try {
      const gmailResult = client.advisor?.id
        ? await sendAdvisorGmailEmail({
            organizationId,
            userId: client.advisor.id,
            to: email!,
            subject,
            text,
            html,
            replyTo: validEmail(client.advisor.email) ? client.advisor.email : undefined,
          })
        : null
      const delivery = gmailResult ?? (isResendConfigured() ? await sendTransactionalEmail({ to: email!, subject, text, html, replyTo: validEmail(client.advisor?.email) ? client.advisor?.email : undefined }) : null)
      if (!delivery) throw new Error("EMAIL_NOT_CONFIGURED")
      status = "SENT"
      detail = delivery.id ?? "sent"
    } catch (error) {
      status = "FAILED"
      detail = error instanceof Error ? error.message : "Envoi impossible"
    }
  }

  await prisma.note.create({
    data: {
      organizationId,
      userId,
      clientId: client.id,
      type: "COMPLIANCE",
      visibility: "TEAM",
      title: `Demande de consentement - ${consent.type}`,
      content: `${text}\n\nStatut d'envoi: ${status}. ${detail}`,
    },
  })
  await createConsentEvent({ organizationId, consentId: consent.id, eventType: status === "SENT" ? "SENT_TO_CLIENT" : "DELIVERY_RECORDED", actorType: "SYSTEM", actorId: userId, metadata: { status, detail, portalUrl } })
  await createActivity({ organizationId, userId, clientId: client.id, type: "CONSENT_GIVEN", title: "Demande de consentement envoyee", description: `${consent.type} - ${status}`, source: "SYSTEM", entityType: "CONSENT", entityId: consent.id })
  return { status, detail, portalUrl }
}

export async function notifyPrivacyIncident({
  organizationId,
  userId,
  incidentId,
  target,
}: {
  organizationId: string
  userId: string
  incidentId: string
  target: "CAI" | "CLIENTS" | "INTERNAL"
}) {
  const incident = await prisma.privacyIncident.findFirst({ where: { id: incidentId, organizationId } })
  if (!incident) throw new Error("PRIVACY_INCIDENT_NOT_FOUND")
  const affectedIds = Array.isArray(incident.affectedClientIds) ? incident.affectedClientIds.filter((value): value is string => typeof value === "string") : []
  const now = new Date()

  if (target === "CAI") {
    await prisma.privacyNotificationLog.create({
      data: {
        organizationId,
        incidentId,
        recipientType: "CAI",
        recipientName: "Commission d'acces a l'information",
        channel: "MANUAL_SECURE_SUBMISSION",
        notificationType: "CAI_INCIDENT_NOTICE",
        status: "READY_FOR_SUBMISSION",
        sentAt: now,
        payload: { incidentType: incident.incidentType, riskLevel: incident.riskLevel, seriousHarmRisk: incident.seriousHarmRisk },
      },
    })
    await prisma.privacyIncident.update({ where: { id: incident.id }, data: { notifiedCaiAt: now } })
  }

  if (target === "CLIENTS") {
    const clients = await prisma.client.findMany({
      where: { organizationId, id: { in: affectedIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailPrimary: true,
        emailSecondary: true,
        advisor: { select: { id: true, name: true, email: true } },
      },
    })
    await Promise.all(clients.map(async (client) => {
      const email = clientEmail(client)
      const portalUrl = appUrl(`/espace-client?clientId=${client.id}`)
      const subject = "Avis important concernant la confidentialite de votre dossier"
      const message = `Avis important : un incident de confidentialite concernant votre dossier est en evaluation. Le cabinet documente les mesures prises et communiquera les renseignements requis.`
      const text = `Bonjour ${client.firstName},

${message}

Vous pouvez consulter votre espace client securise ici :
${portalUrl}`
      const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px"><p>Bonjour ${client.firstName},</p><p>${message}</p><p><a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">Ouvrir mon espace client</a></p><p style="color:#475569;font-size:13px">Cet avis est conserve dans le registre des incidents de confidentialite du cabinet.</p></div>`
      let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED"
      let channel = "PORTAL_NOTE"
      let detail = "Aucun courriel client au dossier."

      if (validEmail(email)) {
        try {
          const gmailResult = client.advisor?.id
            ? await sendAdvisorGmailEmail({
                organizationId,
                userId: client.advisor.id,
                to: email!,
                subject,
                text,
                html,
                replyTo: validEmail(client.advisor.email) ? client.advisor.email : undefined,
              })
            : null
          const delivery = gmailResult ?? (isResendConfigured() ? await sendTransactionalEmail({ to: email!, subject, text, html, replyTo: validEmail(client.advisor?.email) ? client.advisor?.email : undefined }) : null)
          if (!delivery) throw new Error("EMAIL_NOT_CONFIGURED")
          status = "SENT"
          channel = "EMAIL"
          detail = delivery.id ?? "sent"
        } catch (error) {
          status = "FAILED"
          detail = error instanceof Error ? error.message : "Envoi impossible"
        }
      }

      await prisma.note.create({ data: { organizationId, userId, clientId: client.id, type: "COMPLIANCE", visibility: "TEAM", title: "Avis incident de confidentialite", content: message } })
      await prisma.privacyNotificationLog.create({
        data: {
          organizationId,
          incidentId,
          clientId: client.id,
          recipientType: "CLIENT",
          recipientName: `${client.firstName} ${client.lastName}`,
          recipientEmail: email,
          channel,
          notificationType: "CLIENT_INCIDENT_NOTICE",
          status,
          sentAt: status === "SENT" ? now : null,
          payload: { message, detail, portalUrl },
          error: status === "FAILED" ? detail : null,
        },
      })
    }))
    await prisma.privacyIncident.update({ where: { id: incident.id }, data: { notifiedClientsAt: now } })
  }

  if (target === "INTERNAL") {
    await createNotification({
      organizationId,
      type: "ALERT",
      priority: incident.seriousHarmRisk ? "URGENT" : "HIGH",
      title: "Incident de confidentialite - action requise",
      message: `${incident.incidentType} · ${incident.riskLevel}`,
      entityType: "PrivacyIncident",
      entityId: incident.id,
      actionLabel: "Ouvrir conformite",
      actionUrl: "/compliance",
    })
    await prisma.privacyNotificationLog.create({ data: { organizationId, incidentId, recipientType: "INTERNAL", channel: "IN_APP", notificationType: "INTERNAL_INCIDENT_NOTICE", status: "SENT", sentAt: now, payload: { riskLevel: incident.riskLevel } } })
  }

  return prisma.privacyNotificationLog.findMany({ where: { organizationId, incidentId }, orderBy: { createdAt: "desc" } })
}
