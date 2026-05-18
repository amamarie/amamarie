import { NextResponse } from "next/server"

import { trackMarketingEvent } from "@/lib/marketing/automation"

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params
  const url = new URL(request.url)
  const target = url.searchParams.get("url")
  await trackMarketingEvent({
    token,
    type: "CLICKED",
    url: target,
    metadata: {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    },
  })
  if (!target) return NextResponse.redirect("/marketing")
  const redirectUrl = new URL(target, request.url)
  redirectUrl.searchParams.set("marketingToken", token)
  return NextResponse.redirect(redirectUrl)
}
