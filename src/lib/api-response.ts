import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { ForbiddenError } from "@/lib/auth"
import { UnauthorizedError } from "@/lib/tenant"

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiFailure = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init)
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message, details } },
    { status }
  )
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return fail("UNAUTHORIZED", error.message, 401)
  }

  if (error instanceof ForbiddenError) {
    return fail("FORBIDDEN", error.message, 403)
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return fail("UNAUTHORIZED", "Authentification requise.", 401)
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Authentification requise.", 401)
  }

  if (error instanceof Error && error.message === "USER_NOT_FOUND") {
    return fail("UNAUTHORIZED", "Utilisateur introuvable.", 401)
  }

  if (error instanceof Error && error.message === "INVALID_ID") {
    return fail("INVALID_ID", "Identifiant invalide.", 400)
  }

  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return fail("RATE_LIMITED", "Trop de requêtes. Réessayez plus tard.", 429)
  }

  if (error instanceof Error && error.message === "SMS_CONSENT_REVOKED") {
    return fail("SMS_CONSENT_REVOKED", "Le consentement SMS du client est révoqué.", 403)
  }

  if (error instanceof Error && error.message === "SMS_CONTENT_NOT_ALLOWED") {
    return fail("VALIDATION_ERROR", "Le message SMS doit rester administratif et ne pas contenir de conseil financier.", 422)
  }

  if (error instanceof Error && error.message === "MARKETING_CONSENT_REQUIRED") {
    return fail("MARKETING_CONSENT_REQUIRED", "Un consentement marketing actif est requis avant d’envoyer une communication commerciale.", 403)
  }

  if (error instanceof Error && error.message === "GMAIL_NOT_CONNECTED") {
    return fail("GMAIL_NOT_CONNECTED", "Connectez Gmail dans les intégrations avant de lancer un envoi email réel.", 409)
  }

  if (error instanceof Error && error.message === "TWILIO_NOT_CONFIGURED") {
    return fail("TWILIO_NOT_CONFIGURED", "Configurez Twilio avant d’ajouter un numéro personnel de conseiller.", 409)
  }

  if (error instanceof Error && error.message === "TWILIO_CALLER_ID_INVALID_PHONE") {
    return fail("TWILIO_CALLER_ID_INVALID_PHONE", "Le numéro personnel doit être au format international, par exemple +15145551234.", 422)
  }

  if (error instanceof Error && error.message === "MARKETING_VALIDATION_REQUIRED") {
    return fail("MARKETING_VALIDATION_REQUIRED", "Cette campagne doit être validée avant l’envoi.", 409)
  }

  if (error instanceof Error && error.message === "MARKETING_APPROVAL_FORBIDDEN") {
    return fail("MARKETING_APPROVAL_FORBIDDEN", "Seuls le propriétaire, le responsable conformité ou le développeur peuvent valider cette campagne.", 403)
  }

  if (error instanceof Error && error.message === "MARKETING_RISKY_TERMS") {
    return fail("MARKETING_RISKY_TERMS", "Le contenu contient des termes sensibles. Modifiez le message avant validation.", 422)
  }

  if (error instanceof Error && error.message === "MARKETING_CAMPAIGN_NOT_FOUND") {
    return fail("MARKETING_CAMPAIGN_NOT_FOUND", "Campagne marketing introuvable.", 404)
  }

  if (error instanceof Error && error.message === "MARKETING_SEQUENCE_NOT_FOUND") {
    return fail("MARKETING_SEQUENCE_NOT_FOUND", "Séquence marketing introuvable.", 404)
  }

  if (error instanceof Error && error.message === "MARKETING_SEND_NOT_FOUND") {
    return fail("MARKETING_SEND_NOT_FOUND", "Envoi marketing introuvable.", 404)
  }

  if (error instanceof Error && error.message === "CLIENT_PROFILE_COLLECTION_CONSENT_REQUIRED") {
    return fail("CLIENT_PROFILE_COLLECTION_CONSENT_REQUIRED", "Un consentement actif de collecte du profil client est requis avant de modifier le profil client.", 403)
  }

  if (error instanceof Error && error.message === "KYC_USE_CONSENT_REQUIRED") {
    return fail("KYC_USE_CONSENT_REQUIRED", "Un consentement actif d’utilisation du profil client est requis avant de modifier le profil client.", 403)
  }

  if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") {
    return fail("DOCUMENT_VAULT_CONSENT_REQUIRED", "Un consentement actif de conservation documentaire est requis avant d’ajouter ce document.", 403)
  }

  if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_CONSENT_REQUIRED") {
    return fail("INSURANCE_ANALYSIS_CONSENT_REQUIRED", "Un consentement actif d’analyse des besoins est requis avant de poursuivre.", 403)
  }

  if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") {
    return fail("AI_CONSENT_REQUIRED", "Le consentement d’assistance technologique / IA doit être actif avant cette action.", 403)
  }

  if (error instanceof ZodError) {
    const details = error.flatten()
    const messages = [
      ...details.formErrors,
      ...Object.values(details.fieldErrors).flat(),
    ].filter(Boolean)
    return fail(
      "VALIDATION_ERROR",
      messages.length > 0 ? messages.join(" ") : "Les données envoyées sont invalides.",
      422,
      details
    )
  }

  console.error({
    action: "api_error",
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown server error",
  })
  return fail("INTERNAL_ERROR", "Une erreur serveur est survenue.", 500)
}
