import { handleApiError, ok } from "@/lib/api-response"
import { updateMarketingPreferences } from "@/lib/marketing/automation"

type RouteContext = { params: Promise<{ token: string }> }

function html(message: string) {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Préférences marketing</title></head><body style="font-family:system-ui;margin:40px;color:#0f172a;background:#f8fafc"><main style="max-width:680px;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:28px"><p style="font-size:12px;font-weight:800;color:#059669;text-transform:uppercase">Préférences marketing</p><h1>${message}</h1><p>Vous pouvez retirer votre consentement aux communications marketing. Les messages opérationnels liés à un rendez-vous ou à un dossier client peuvent rester nécessaires.</p><form method="post"><label style="display:flex;gap:10px;align-items:center;margin:20px 0;font-weight:700"><input type="checkbox" name="unsubscribeAll" value="true" checked> Me désinscrire des emails marketing</label><button style="background:#0f172a;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:800" type="submit">Enregistrer mes préférences</button></form></main></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params
  if (!token) return html("Lien invalide")
  return html("Gérer mes préférences")
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { token } = await params
    const formData = await request.formData()
    const unsubscribeAll = formData.get("unsubscribeAll") === "true"
    await updateMarketingPreferences({
      token,
      unsubscribeAll,
      metadata: {
        source: "PREFERENCE_CENTER",
        userAgent: request.headers.get("user-agent"),
      },
    })
    return html(unsubscribeAll ? "Désinscription enregistrée" : "Préférences enregistrées")
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    return ok(await updateMarketingPreferences({ token, unsubscribeAll: body.unsubscribeAll !== false, metadata: body }))
  } catch (error) {
    return handleApiError(error)
  }
}
