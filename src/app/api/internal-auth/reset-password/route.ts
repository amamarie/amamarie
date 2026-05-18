import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestInternalPasswordReset,
  resetInternalPasswordWithToken,
} from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"

function resetEmailErrorMessage(message: string) {
  if (message === "EMAIL_INVALID_API_KEY") return "La clé Resend configurée est invalide. Créez une nouvelle clé API Resend et mettez à jour RESEND_API_KEY."
  if (message === "EMAIL_DOMAIN_NOT_VERIFIED") return "Le domaine expéditeur n’est pas vérifié dans Resend. Vérifiez finassuro.com ou utilisez un expéditeur validé."
  if (message === "EMAIL_INVALID_FROM") return "L’expéditeur EMAIL_FROM est invalide. Utilisez un format comme FinAssuro <noreply@finassuro.com>."
  if (message === "EMAIL_NOT_CONFIGURED") return "Aucun fournisseur courriel n’est configuré. Ajoutez RESEND_API_KEY et EMAIL_FROM ou connectez Gmail."
  if (message.startsWith("EMAIL_SEND_FAILED:")) return "Le fournisseur courriel a refusé l’envoi du lien de réinitialisation."
  return null
}

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
    const emailError = resetEmailErrorMessage(message)
    const status = emailError ? 503 : 400

    return NextResponse.json(
      {
        ok: false,
        error: emailError ?? message,
      },
      { status }
    )
  }
}
