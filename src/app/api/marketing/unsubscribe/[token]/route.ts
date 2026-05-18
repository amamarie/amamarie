import { NextResponse } from "next/server"

import { trackMarketingEvent } from "@/lib/marketing/automation"

type RouteContext = { params: Promise<{ token: string }> }

function html(message: string) {
  return new NextResponse(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désinscription</title></head><body style="font-family:system-ui;margin:40px;color:#0f172a"><main style="max-width:620px"><h1>${message}</h1><p>Votre préférence a été enregistrée. Vous ne recevrez plus cette campagne marketing.</p></main></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params
  const send = await trackMarketingEvent({ token, type: "UNSUBSCRIBED" })
  return html(send ? "Désinscription confirmée" : "Lien introuvable")
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { token } = await params
  const send = await trackMarketingEvent({ token, type: "UNSUBSCRIBED" })
  return NextResponse.json({ ok: Boolean(send) })
}
