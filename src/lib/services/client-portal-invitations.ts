import type { Client, User } from "@prisma/client"

import { createActivity } from "@/lib/services/activities"
import { createNotification } from "@/lib/services/notifications"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { sendSmsFromCrm } from "@/lib/services/communications"

type PortalInvitationClient = Pick<
  Client,
  "id" | "organizationId" | "advisorId" | "firstName" | "lastName" | "email" | "emailPrimary" | "emailSecondary" | "phone" | "phonePrimary" | "phoneSecondary"
>

type PortalInvitationAdvisor = Pick<User, "id" | "name" | "email" | "organizationId"> | null

function contactEmail(client: PortalInvitationClient) {
  return client.emailPrimary ?? client.email ?? client.emailSecondary ?? null
}

function contactPhone(client: PortalInvitationClient) {
  return client.phonePrimary ?? client.phone ?? client.phoneSecondary ?? null
}

function isEmailAddress(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function appOrigin(origin?: string | null) {
  const cleanOrigin = origin?.replace(/\/$/, "")
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  const mobileAppUrl = process.env.NEXT_PUBLIC_MOBILE_APP_URL?.replace(/\/$/, "")
  const configuredUrl = mobileAppUrl || publicAppUrl

  if (!cleanOrigin) return configuredUrl || "http://localhost:3000"

  try {
    const url = new URL(cleanOrigin)
    const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
    if (isLocalHost && configuredUrl) return configuredUrl
  } catch {
    return configuredUrl || "http://localhost:3000"
  }

  return cleanOrigin
}

export function buildClientPortalSignUpUrl({ origin, email, clientId }: { origin?: string | null; email: string; clientId: string }) {
  const url = new URL("/sign-up", appOrigin(origin))
  url.searchParams.set("role", "client")
  url.searchParams.set("email", email)
  url.searchParams.set("redirect_url", `/espace-client?clientId=${clientId}#portal-profile-questionnaire`)
  return url.toString()
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function emailHtml({ firstName, advisorName, portalUrl }: { firstName: string; advisorName: string; portalUrl: string }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px">
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>${escapeHtml(advisorName)} vous invite à compléter votre profil client sécurisé. Ces renseignements serviront à tenir votre dossier à jour, préparer l’analyse de vos besoins et classer vos documents au bon endroit.</p>
      <p><a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">Compléter mon profil client</a></p>
      <p style="color:#475569;font-size:13px">Utilisez le même courriel que celui associé à votre dossier. Après l’inscription, votre espace sera relié automatiquement.</p>
    </div>
  `
}

function buildEmailText({ firstName, advisorName, portalUrl }: { firstName: string; advisorName: string; portalUrl: string }) {
  return `Bonjour ${firstName},

${advisorName} vous invite à compléter votre profil client sécurisé.

Ces renseignements serviront à tenir votre dossier à jour, préparer l’analyse de vos besoins et classer vos documents au bon endroit.

Compléter mon profil client:
${portalUrl}

Utilisez le même courriel que celui associé à votre dossier.`
}

function buildSmsText({ firstName, portalUrl }: { firstName: string; portalUrl: string }) {
  return `Bonjour ${firstName}, veuillez compléter votre profil client sécurisé FinAssuro ici: ${portalUrl}`
}

async function notifyAdvisor({
  client,
  advisor,
  title,
  message,
  priority = "NORMAL",
}: {
  client: PortalInvitationClient
  advisor: PortalInvitationAdvisor
  title: string
  message: string
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"
}) {
  if (!advisor?.id) return
  await createNotification({
    organizationId: client.organizationId,
    userId: advisor.id,
    type: "INFO",
    priority,
    title,
    message,
    clientId: client.id,
    entityType: "CLIENT",
    entityId: client.id,
    actionLabel: "Ouvrir le client",
    actionUrl: `/clients/${client.id}`,
  })
}

export async function sendClientPortalInvitation({
  client,
  advisor,
  triggeredByUserId,
  origin,
}: {
  client: PortalInvitationClient
  advisor: PortalInvitationAdvisor
  triggeredByUserId: string
  origin?: string | null
}) {
  const email = contactEmail(client)
  const phone = contactPhone(client)
  const advisorName = advisor?.name ?? "votre conseiller"
  const deliveries: Array<{ channel: "EMAIL" | "SMS"; status: "SENT" | "QUEUED" | "FAILED" | "SKIPPED"; detail?: string }> = []

  if (!email) {
    deliveries.push({ channel: "EMAIL", status: "SKIPPED", detail: "Aucun courriel client au dossier." })
  } else {
    const portalUrl = buildClientPortalSignUpUrl({ origin, email, clientId: client.id })
    const subject = "Compléter votre profil client sécurisé"
    const text = buildEmailText({ firstName: client.firstName, advisorName, portalUrl })
    try {
      const gmailResult = advisor?.id
        ? await sendAdvisorGmailEmail({
            organizationId: client.organizationId,
            userId: advisor.id,
            to: email,
            subject,
            text,
            html: emailHtml({ firstName: client.firstName, advisorName, portalUrl }),
            replyTo: isEmailAddress(advisor.email) ? advisor.email : undefined,
          })
        : null
      const delivery = gmailResult ?? (
        isResendConfigured()
          ? await sendTransactionalEmail({
              to: email,
              subject,
              text,
              html: emailHtml({ firstName: client.firstName, advisorName, portalUrl }),
              replyTo: isEmailAddress(advisor?.email) ? advisor?.email : undefined,
              bcc: isEmailAddress(advisor?.email) ? advisor?.email : undefined,
            })
          : null
      )
      if (!delivery) throw new Error("EMAIL_NOT_CONFIGURED")
      deliveries.push({ channel: "EMAIL", status: "SENT", detail: delivery.id ?? "sent" })
      await createActivity({
        organizationId: client.organizationId,
        userId: triggeredByUserId,
        clientId: client.id,
        type: "EMAIL_SENT",
        title: "Formulaire profil client envoyé",
        description: `Lien du profil client sécurisé envoyé à ${email}.`,
        entityType: "Client",
        entityId: client.id,
        metadata: { channel: "EMAIL", to: email, portalUrl },
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erreur courriel"
      deliveries.push({ channel: "EMAIL", status: "FAILED", detail })
      await createActivity({
        organizationId: client.organizationId,
        userId: triggeredByUserId,
        clientId: client.id,
        type: "EMAIL_SENT",
        title: "Formulaire profil client non envoyé",
        description: `Échec courriel vers ${email}: ${detail}`,
        entityType: "Client",
        entityId: client.id,
        metadata: { channel: "EMAIL", to: email, error: detail },
      })
    }
  }

  if (!phone || !email) {
    deliveries.push({ channel: "SMS", status: "SKIPPED", detail: !phone ? "Aucun téléphone client au dossier." : "Aucun courriel client pour créer le lien." })
  } else {
    const portalUrl = buildClientPortalSignUpUrl({ origin, email, clientId: client.id })
    try {
      const sms = await sendSmsFromCrm({
        user: { id: triggeredByUserId, organizationId: client.organizationId },
        to: phone,
        body: buildSmsText({ firstName: client.firstName, portalUrl }),
        clientId: client.id,
      })
      deliveries.push({ channel: "SMS", status: "QUEUED", detail: sms.id })
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erreur SMS"
      deliveries.push({ channel: "SMS", status: "FAILED", detail })
      await notifyAdvisor({
        client,
        advisor,
        title: "Invitation portail client: SMS non envoyé",
        message: detail,
        priority: "HIGH",
      })
    }
  }

  const sentCount = deliveries.filter((delivery) => delivery.status === "SENT" || delivery.status === "QUEUED").length
  await notifyAdvisor({
    client,
    advisor,
    title: sentCount > 0 ? "Formulaire profil client envoyé" : "Formulaire profil client à vérifier",
    message: sentCount > 0
      ? `${client.firstName} ${client.lastName} a reçu son lien pour compléter son profil client sécurisé.`
      : `Aucun canal n’a pu envoyer automatiquement le lien du profil client.`,
    priority: sentCount > 0 ? "NORMAL" : "HIGH",
  })

  return { deliveries }
}
