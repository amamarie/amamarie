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

export async function sendTransactionalEmail({ to, from: customFrom, replyTo, cc, bcc, subject, text, html }: SendTransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = customFrom || process.env.EMAIL_FROM || "FinAssuro CRM <no-reply@finassuro.local>"

  if (!isResendConfigured(apiKey)) {
    throw new Error("EMAIL_NOT_CONFIGURED")
  }

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
