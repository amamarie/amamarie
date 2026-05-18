import { NextResponse } from "next/server"

import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"
import { saveGoogleGmailConnection, verifyGoogleGmailOAuthState } from "@/lib/google/gmail"

function publicAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const origin = new URL(request.url).origin
  return origin.replace("://0.0.0.0:", "://localhost:")
}

function redirectTo(request: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, publicAppOrigin(request))
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  try {
    const error = url.searchParams.get("error")
    if (error) return redirectTo(request, "/parametres", { gmail: "denied" })

    const code = url.searchParams.get("code")
    if (!code) return redirectTo(request, "/parametres", { gmail: "missing_code" })

    const state = verifyGoogleGmailOAuthState(request, url.searchParams.get("state"))

    await saveGoogleGmailConnection({
      request,
      organizationId: state.organizationId,
      userId: state.userId,
      code,
    })

    const currentUser = await getCurrentUserWithOrg()
    const returnTo = state.returnTo || "/parametres"

    if (!currentUser) {
      return redirectTo(request, "/sign-in", {
        role: "advisor",
        redirect_url: `${returnTo}?gmail=connected`,
      })
    }

    return redirectTo(request, currentUser.role === "OWNER" ? returnTo : homePathForUserRole(currentUser.role), { gmail: "connected" })
  } catch {
    return redirectTo(request, "/parametres", { gmail: "error" })
  }
}
