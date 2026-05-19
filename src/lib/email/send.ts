type SendTransactionalEmailInput = {
  to: string
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text: string
  html?: string
}

const DEFAULT_RESEND_FALLBACK_FROM = "FinAssuro <onboarding@resend.dev>"

function resendErrorCode(status: number, body: string) {
  const lower = body.toLowerCase()

  if (status === 401 || lower.includes("api key is invalid")) return "EMAIL_INVALID_API_KEY"
  if (lower.includes("domain") && (lower.includes("not verified") || lower.includes("verify"))) return "EMAIL_DOMAIN_NOT_VERIFIED"
  if (lower.includes("from") && lower.includes("invalid")) return "EMAIL_INVALID_FROM"

  return `EMAIL_SEND_FAILED:${status}:${body.slice(0, 180)}`
}

export function isResendConfigured(apiKey = process.env.RESEND_API_KEY) {
  const value = apiKey?.trim()
  if (!value) return false
  if (value === "crée-le moi" || value === "cree-le moi") return false
  if (value.includes("REMPLACE") || value.includes("xxxxxxxx")) return false
  return true
}

function fallbackFromAddress() {
  return process.env.RESEND_FALLBACK_EMAIL_FROM?.trim() || DEFAULT_RESEND_FALLBACK_FROM
}

function sameAddress(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

async function sendResendEmail({
  apiKey,
  from,
  to,
  replyTo,
  cc,
  bcc,
  subject,
  text,
  html,
}: SendTransactionalEmailInput & { apiKey: string; from: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      ...(html ? { html } : {}),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(resendErrorCode(response.status, errorBody))
  }

  return response.json() as Promise<{ id?: string }>
}

export async function sendTransactionalEmail({ to, from: customFrom, replyTo, cc, bcc, subject, text, html }: SendTransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = customFrom || process.env.EMAIL_FROM || "FinAssuro CRM <no-reply@finassuro.local>"

  if (!isResendConfigured(apiKey)) {
    throw new Error("EMAIL_NOT_CONFIGURED")
  }

  const resendApiKey = apiKey as string

  try {
    return await sendResendEmail({ apiKey: resendApiKey, from, to, replyTo, cc, bcc, subject, text, html })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "EMAIL_DOMAIN_NOT_VERIFIED") {
      throw error
    }

    const fallbackFrom = fallbackFromAddress()
    if (!fallbackFrom || sameAddress(from, fallbackFrom)) {
      throw error
    }

    return sendResendEmail({
      apiKey: resendApiKey,
      from: fallbackFrom,
      to,
      replyTo: replyTo || customFrom || from,
      cc,
      bcc,
      subject,
      text,
      html,
    })
  }
}
