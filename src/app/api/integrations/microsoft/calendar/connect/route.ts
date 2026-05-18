import { NextResponse } from "next/server"

import { createMicrosoftCalendarOAuthUrl } from "@/lib/microsoft/calendar"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  const { organizationId, userId } = await getTenantContext()
  const url = createMicrosoftCalendarOAuthUrl({ request, organizationId, userId, returnTo: "/calendrier" })
  return NextResponse.redirect(url)
}
