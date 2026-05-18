import { NextResponse } from "next/server"

import { createGoogleGmailOAuthUrl } from "@/lib/google/gmail"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

function publicAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const origin = new URL(request.url).origin
  return origin.replace("://0.0.0.0:", "://localhost:")
}

export async function GET(request: Request) {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    if (role === "DEVELOPER") {
      const blockedUrl = new URL("/parametres", publicAppOrigin(request))
      blockedUrl.searchParams.set("gmail", "developer_blocked")
      return NextResponse.redirect(blockedUrl)
    }
    const url = createGoogleGmailOAuthUrl({
      request,
      organizationId,
      userId,
      returnTo: "/parametres",
    })
    return NextResponse.redirect(url)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const url = new URL("/sign-in", publicAppOrigin(request))
      url.searchParams.set("role", "advisor")
      url.searchParams.set("redirect_url", "/parametres")
      return NextResponse.redirect(url)
    }

    const url = new URL("/parametres", publicAppOrigin(request))
    url.searchParams.set("gmail", "not_configured")
    return NextResponse.redirect(url)
  }
}
