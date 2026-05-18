import { NextResponse } from "next/server"
import { z } from "zod"

import { createCrmActivity } from "@/lib/crm-events"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

const sendLeadEmailSchema = z.object({
  subject: z.string().trim().min(1, "L'objet est requis.").max(180),
  body: z.string().trim().min(1, "Le message est requis.").max(10000),
})

function emailHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br />")
}

function isEmailAddress(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function emailErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Impossible d'envoyer le courriel."
  if (error.message === "EMAIL_NOT_CONFIGURED") return "Aucun fournisseur courriel n'est configuré. Connectez Gmail dans Paramètres > Intégrations, ou ajoutez RESEND_API_KEY et EMAIL_FROM."
  if (error.message.startsWith("GMAIL_TOKEN_REFRESH_FAILED")) return "La connexion Gmail doit être renouvelée. Reconnectez Gmail dans Paramètres > Intégrations."
  if (error.message.startsWith("GMAIL_SEND_FAILED")) return "Gmail n'a pas pu envoyer le courriel. Reconnectez Gmail ou vérifiez les permissions Gmail."
  if (error.message.startsWith("EMAIL_SEND_FAILED")) return "Resend n'a pas pu envoyer le courriel. Vérifiez RESEND_API_KEY et l'expéditeur EMAIL_FROM."
  return error.message
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const data = sendLeadEmailSchema.parse(await request.json())

    const [lead, user] = await Promise.all([
      prisma.lead.findFirst({
        where: { id, organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          advisor: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.user.findFirst({
        where: { id: userId, organizationId },
        select: { id: true, name: true, email: true },
      }),
    ])

    if (!lead) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: "Ce prospect n'a pas d'adresse courriel." }, { status: 422 })

    const advisor = lead.advisor ?? user
    const advisorEmail = isEmailAddress(advisor?.email) ? advisor?.email : null
    const senderUserId = lead.advisor?.id ?? userId

    const gmailResult = await sendAdvisorGmailEmail({
      organizationId,
      userId: senderUserId,
      to: lead.email,
      subject: data.subject,
      text: data.body,
      html: emailHtml(data.body),
      replyTo: advisorEmail ?? undefined,
    })

    const providerResult = gmailResult ?? (
      isResendConfigured()
        ? await sendTransactionalEmail({
            to: lead.email,
            subject: data.subject,
            text: data.body,
            html: emailHtml(data.body),
            replyTo: advisorEmail ?? undefined,
            bcc: advisorEmail ?? undefined,
          })
        : null
    )

    if (!providerResult) throw new Error("EMAIL_NOT_CONFIGURED")

    const activity = await createCrmActivity({
      organizationId,
      userId,
      leadId: lead.id,
      type: "EMAIL_SENT",
      title: data.subject,
      description: data.body.slice(0, 500),
      entityType: "Lead",
      entityId: lead.id,
      metadata: {
        to: lead.email,
        replyTo: advisorEmail,
        advisorId: advisor?.id ?? null,
        advisorEmail,
        provider: "provider" in providerResult ? providerResult.provider : "RESEND",
        emailId: providerResult.id ?? null,
      },
    })

    return NextResponse.json({ data: { activity, delivery: providerResult } }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: emailErrorMessage(error) }, { status: 400 })
  }
}
