import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const shareSchema = z.object({
  clientId: z.string().trim().min(1),
  serviceLabel: z.string().trim().min(2).max(120),
  durationMinutes: z.number().int().min(15).max(180),
  note: z.string().trim().max(1200).optional().nullable(),
})

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = shareSchema.parse(await request.json())
    const [client, advisor] = await Promise.all([
      prisma.client.findFirst({
        where: { id: payload.clientId, organizationId },
        select: { id: true, firstName: true, lastName: true, email: true, emailPrimary: true, advisorId: true },
      }),
      prisma.user.findFirst({
        where: { id: userId, organizationId },
        select: { id: true, name: true, email: true },
      }),
    ])
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (!advisor) return fail("USER_NOT_FOUND", "Utilisateur introuvable.", 404)

    const email = client.emailPrimary ?? client.email
    if (!email) return fail("CLIENT_EMAIL_MISSING", "Ce client n’a pas de courriel au dossier.", 422)

    const origin = request.headers.get("origin") ?? new URL(request.url).origin
    const bookingUrl = `${origin}/rendez-vous/${advisor.id}?client=${encodeURIComponent(client.id)}&service=${encodeURIComponent(payload.serviceLabel)}&duration=${payload.durationMinutes}`
    const subject = `Choisir votre rendez-vous avec ${advisor.name}`
    const text = [
      `Bonjour ${client.firstName},`,
      "",
      `Vous pouvez choisir un créneau disponible pour: ${payload.serviceLabel}.`,
      payload.note ? `Note du conseiller: ${payload.note}` : null,
      "",
      `Lien de réservation: ${bookingUrl}`,
      "",
      `Merci,`,
      advisor.name,
    ].filter(Boolean).join("\n")
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">Choisir votre rendez-vous</h2>
        <p>Bonjour ${htmlEscape(client.firstName)},</p>
        <p>Vous pouvez choisir un créneau disponible pour <strong>${htmlEscape(payload.serviceLabel)}</strong>.</p>
        ${payload.note ? `<p><strong>Note du conseiller:</strong> ${htmlEscape(payload.note)}</p>` : ""}
        <p><a href="${bookingUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Voir les disponibilités</a></p>
        <p style="font-size:13px;color:#475569">Si le bouton ne fonctionne pas, copiez ce lien :<br>${bookingUrl}</p>
      </div>
    `

    let delivery: { provider: string; id?: string | null; status: "SENT" | "DRAFT" }
    const gmail = await sendAdvisorGmailEmail({
      organizationId,
      userId,
      to: email,
      subject,
      text,
      html,
      replyTo: advisor.email,
    }).catch((error) => {
      console.warn({
        action: "calendar_share_gmail_failed",
        name: error instanceof Error ? error.name : "UnknownError",
      })
      return null
    })
    if (gmail) {
      delivery = { provider: "GMAIL", id: gmail.id, status: "SENT" }
    } else if (isResendConfigured()) {
      const resend = await sendTransactionalEmail({ to: email, subject, text, html, replyTo: advisor.email }).catch((error) => {
        console.warn({
          action: "calendar_share_resend_failed",
          name: error instanceof Error ? error.name : "UnknownError",
        })
        return null
      })
      delivery = resend ? { provider: "RESEND", id: resend.id, status: "SENT" } : { provider: "NONE", id: null, status: "DRAFT" }
    } else {
      delivery = { provider: "NONE", id: null, status: "DRAFT" }
    }

    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: delivery.status === "SENT" ? "EMAIL_SENT" : "NOTE_ADDED",
      title: delivery.status === "SENT" ? "Calendrier envoyé au client" : "Lien calendrier préparé",
      description: `${payload.serviceLabel} - ${bookingUrl}`,
      entityType: "Client",
      entityId: client.id,
      metadata: { bookingUrl, delivery },
    })

    return ok({ bookingUrl, delivery })
  } catch (error) {
    return handleApiError(error)
  }
}
