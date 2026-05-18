import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { setInternalSessionCookie } from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" || !isInternalAuthEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const redirectUrl = url.searchParams.get("redirect_url")?.startsWith("/")
    ? url.searchParams.get("redirect_url")
    : "/developpeur"

  if (!process.env.INTERNAL_AUTH_BOOTSTRAP_PASSWORD || token !== process.env.INTERNAL_AUTH_BOOTSTRAP_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  const user = await prisma.user.findFirst({
    where: {
      email: "admin.developpeur@finadvisor.local",
      role: "DEVELOPER",
    },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Compte développeur local introuvable." },
      { status: 404 }
    )
  }

  await setInternalSessionCookie(user.id)

  const origin = url.origin.replace("0.0.0.0", "127.0.0.1").replace("localhost", "127.0.0.1")

  return NextResponse.redirect(new URL(redirectUrl ?? "/developpeur", origin))
}
