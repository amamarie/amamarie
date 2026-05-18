import { NextResponse } from "next/server"

import { clearInternalSessionCookie } from "@/lib/auth/internal"

export async function POST() {
  await clearInternalSessionCookie()

  return NextResponse.json({ ok: true })
}
