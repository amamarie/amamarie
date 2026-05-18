import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestedRoleMatchesUser,
  resolveInternalAuthUser,
  startInternalTwoFactorChallenge,
} from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"
import { normalizeSubscriptionCurrency, normalizeSubscriptionPlan, normalizeSubscriptionPricingMode } from "@/lib/billing/plans"

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
    const isEmailError = message === "EMAIL_NOT_CONFIGURED" || message.startsWith("EMAIL_SEND_FAILED:")

    return NextResponse.json(
      {
        ok: false,
        error: isEmailError
          ? "Connexion validée, mais l’envoi du code de vérification a échoué. Vérifiez la configuration courriel."
          : message,
      },
      { status: isEmailError ? 503 : 400 }
    )
  }
}
