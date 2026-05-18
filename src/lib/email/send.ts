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

export function isResendConfigured(apiKey = process.env.RESEND_API_KEY) {
  const value = apiKey?.trim()
  if (!value) return false
  if (value === "crée-le moi" || value === "cree-le moi") return false
  if (value.includes("REMPLACE") || value.includes("xxxxxxxx")) return false
  return true
}

export async function sendTransactionalEmail({ to, from: customFrom, replyTo, cc, bcc, subject, text, html }: SendTransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = customFrom || process.env.EMAIL_FROM || "FinAdvisor CRM <no-reply@finadvisor.local>"

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
    throw new Error(`EMAIL_SEND_FAILED:${response.status}:${errorBody.slice(0, 180)}`)
  }

  return response.json() as Promise<{ id?: string }>
}
