import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  requestedRoleMatchesUser,
  setInternalSessionCookie,
  verifyInternalTwoFactorChallenge,
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
  const challengeId = typeof payload?.challengeId === "string" ? payload.challengeId : ""
  const code = typeof payload?.code === "string" ? payload.code : ""
  const role = normalizeSaasAppRole(payload?.role)
  const redirectUrl =
    typeof payload?.redirectUrl === "string" && payload.redirectUrl.startsWith("/")
      ? payload.redirectUrl
      : undefined

  try {
    const user = await verifyInternalTwoFactorChallenge({ challengeId, code, role })

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
        error: error instanceof Error ? error.message : "Vérification impossible.",
      },
      { status: 400 }
    )
  }
}
