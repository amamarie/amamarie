import { NextResponse } from "next/server"

import { sendDocumentedRecommendationForSignature } from "@/lib/recommendations/documented"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const result = await sendDocumentedRecommendationForSignature({ id, organizationId, userId })
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "RECOMMENDATION_NOT_FOUND") return NextResponse.json({ error: "Recommandation introuvable." }, { status: 404 })
    if (error instanceof Error && error.message === "RECOMMENDATION_LOCKED") return NextResponse.json({ error: "Cette recommandation est verrouillée. Créez une nouvelle version avant de relancer une signature." }, { status: 409 })
    if (error instanceof Error && error.message === "RECOMMENDATION_ALREADY_SIGNED") return NextResponse.json({ error: "Cette recommandation est déjà signée." }, { status: 409 })
    if (error instanceof Error && error.message === "REPORT_REQUIRED") return NextResponse.json({ error: "Générez le rapport de recommandation avant l’envoi à signature." }, { status: 409 })
    if (error instanceof Error && error.message === "REPORT_ALREADY_SENT") return NextResponse.json({ error: "Ce rapport a déjà été envoyé au client. Attendez la signature ou relancez depuis le dossier document." }, { status: 409 })
    if (error instanceof Error && error.message === "CLIENT_EMAIL_REQUIRED") return NextResponse.json({ error: "Le client doit avoir un courriel valide avant l’envoi à signature." }, { status: 409 })
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif d’analyse des besoins est requis avant l’envoi de la recommandation." }, { status: 403 })
    if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif de conservation documentaire est requis avant l’envoi de la recommandation." }, { status: 403 })
    if (error instanceof Error && error.message === "DISCLOSURE_CONSENT_REQUIRED") return NextResponse.json({ error: "Un consentement actif de communication/remise au tiers ou au client est requis avant l’envoi à signature." }, { status: 403 })
    if (error instanceof Error && error.message === "REPORT_FILE_REQUIRED") return NextResponse.json({ error: "Le fichier PDF du rapport est introuvable." }, { status: 409 })
    if (error instanceof Error && error.message === "PANDADOC_NOT_CONFIGURED") return NextResponse.json({ error: "PandaDoc n’est pas configuré dans l’environnement serveur." }, { status: 503 })
    if (error instanceof Error && error.message.startsWith("PANDADOC_NOT_READY")) return NextResponse.json({ error: "PandaDoc a créé le document, mais il n’est pas encore prêt à être envoyé. Réessayez dans quelques secondes." }, { status: 409 })
    if (error instanceof Error && error.message.startsWith("PANDADOC_API_ERROR")) return NextResponse.json({ error: error.message.replace("PANDADOC_API_ERROR:", "") }, { status: 502 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’envoyer la recommandation à signature." }, { status: 400 })
  }
}
