import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestInternalPasswordReset,
  resetInternalPasswordWithToken,
} from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"

export async function POST(request: Request) {
  if (!isInternalAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "L’authentification interne n’est pas activée." },
      { status: 409 }
    )
  }

  const payload = await request.json().catch(() => null)
  const role = normalizeSaasAppRole(payload?.role)
  const token = typeof payload?.token === "string" ? payload.token : ""
  const password = typeof payload?.password === "string" ? payload.password : ""
  const email = typeof payload?.email === "string" ? payload.email : ""

  try {
    if (token) {
      await resetInternalPasswordWithToken({ token, password, role })

      return NextResponse.json({
        ok: true,
        message: "Mot de passe modifié. Vous pouvez maintenant vous connecter.",
      })
    }

    await requestInternalPasswordReset({ email, role })

    return NextResponse.json({
      ok: true,
      message: "Si un compte correspond à ce courriel, un lien sécurisé vient d’être envoyé.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Réinitialisation impossible."
    const isEmailError = message === "EMAIL_NOT_CONFIGURED" || message.startsWith("EMAIL_SEND_FAILED:")
    const status = isEmailError ? 503 : 400

    return NextResponse.json(
      {
        ok: false,
        error: isEmailError
          ? "L’envoi du courriel de réinitialisation a échoué. Vérifiez RESEND_API_KEY et EMAIL_FROM."
          : message,
      },
      { status }
    )
  }
}
