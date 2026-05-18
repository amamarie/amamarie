import { NextResponse } from "next/server"

import { trackMarketingEvent } from "@/lib/marketing/automation"

type RouteContext = { params: Promise<{ token: string }> }

const transparentPixel = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64")

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params
  await trackMarketingEvent({
    token,
    type: "OPENED",
    metadata: {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    },
  })
  return new NextResponse(transparentPixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
