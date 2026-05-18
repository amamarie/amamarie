import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestedRoleMatchesUser,
  resolveInternalAuthUser,
  setInternalSessionCookie,
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

    await setInternalSessionCookie(user.id)

    return NextResponse.json({
      ok: true,
      redirectUrl: redirectUrl ?? "/post-auth",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Connexion impossible.",
      },
      { status: 400 }
    )
  }
}
