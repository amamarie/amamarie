import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestedRoleMatchesUser,
  resolveInternalAuthUser,
  startInternalTwoFactorChallenge,
} from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"
import { normalizeSubscriptionCurrency, normalizeSubscriptionPlan, normalizeSubscriptionPricingMode } from "@/lib/billing/plans"

function authEmailErrorMessage(message: string) {
  if (message === "EMAIL_INVALID_API_KEY") return "La clé Resend configurée est invalide. Créez une nouvelle clé API Resend et mettez à jour RESEND_API_KEY."
  if (message === "EMAIL_DOMAIN_NOT_VERIFIED") return "Le domaine expéditeur n’est pas vérifié dans Resend. Vérifiez finassuro.com ou utilisez un expéditeur validé."
  if (message === "EMAIL_INVALID_FROM") return "L’expéditeur EMAIL_FROM est invalide. Utilisez un format comme FinAssuro <noreply@finassuro.com>."
  if (message === "EMAIL_NOT_CONFIGURED") return "Aucun fournisseur courriel n’est configuré. Ajoutez RESEND_API_KEY et EMAIL_FROM ou connectez Gmail."
  if (message.startsWith("EMAIL_SEND_FAILED:")) return "Connexion validée, mais le fournisseur courriel a refusé l’envoi du code."
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
  const email = typeof payload?.email === "string" ? payload.email : ""
  const password = typeof payload?.password === "string" ? payload.password : ""
  const name = typeof payload?.name === "string" ? payload.name : undefined
  const role = normalizeSaasAppRole(payload?.role)
  const subscriptionPlan = normalizeSubscriptionPlan(payload?.subscriptionPlan)
  const subscriptionPricingMode = normalizeSubscriptionPricingMode(payload?.subscriptionPricingMode)
  const subscriptionCurrency = normalizeSubscriptionCurrency(payload?.subscriptionCurrency)
  const redirectUrl =
    typeof payload?.redirectUrl === "string" && payload.redirectUrl.startsWith("/")
      ? payload.redirectUrl
      : undefined
  const mode = payload?.mode === "sign-up" ? "sign-up" : "sign-in"

  try {
    const user = await resolveInternalAuthUser({
      email,
      password,
      role,
      name,
      redirectUrl,
      subscriptionPlan,
      subscriptionPricingMode,
      subscriptionCurrency,
      mode,
    })

    if (!requestedRoleMatchesUser(role, user.role)) {
      return NextResponse.json(
        { ok: false, error: "Ce compte n’a pas accès à cet espace." },
        { status: 403 }
      )
    }

    const challenge = await startInternalTwoFactorChallenge(user)

    return NextResponse.json({
      ok: true,
      requiresTwoFactor: true,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      email: challenge.email,
      redirectUrl: redirectUrl ?? "/post-auth",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion impossible."
    const emailError = authEmailErrorMessage(message)

    return NextResponse.json(
      {
        ok: false,
        error: emailError ?? message,
      },
      { status: emailError ? 503 : 400 }
    )
  }
}
