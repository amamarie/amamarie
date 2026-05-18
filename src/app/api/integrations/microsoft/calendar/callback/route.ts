import { NextResponse } from "next/server"

import { saveMicrosoftCalendarConnection, verifyMicrosoftCalendarOAuthState } from "@/lib/microsoft/calendar"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const state = url.searchParams.get("state")
  const parsedState = verifyMicrosoftCalendarOAuthState(request, state)
  const redirect = new URL(parsedState.returnTo || "/calendrier", url.origin)

  if (error || !code) {
    redirect.searchParams.set("calendar_status", "microsoft_error")
    return NextResponse.redirect(redirect)
  }

  await saveMicrosoftCalendarConnection({
    request,
    organizationId: parsedState.organizationId,
    userId: parsedState.userId,
    code,
  })
  redirect.searchParams.set("calendar_status", "microsoft_connected")
  return NextResponse.redirect(redirect)
}
