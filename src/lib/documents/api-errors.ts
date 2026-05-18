import { fail, handleApiError } from "@/lib/api-response"

export function handleDocumentError(error: unknown) {
  if (error instanceof Error && error.message === "DOCUMENT_FORBIDDEN") return fail("FORBIDDEN", "Accès refusé à ce document.", 403)
  if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") return fail("NOT_FOUND", "Document introuvable.", 404)
  if (error instanceof Error && error.message === "DOCUMENT_LOCKED") return fail("DOCUMENT_LOCKED", "Ce document est verrouillé comme preuve au dossier.", 409)
  if (error instanceof Error && error.message === "DOCUMENT_REJECT_REASON_REQUIRED") return fail("VALIDATION_ERROR", "La raison de rejet est requise.", 422)
  if (error instanceof Error && error.message === "DOCUMENT_WAIVER_REASON_REQUIRED") return fail("VALIDATION_ERROR", "La justification d’exemption est requise.", 422)
  if (error instanceof Error && error.message === "DOCUMENT_VAULT_CONSENT_REQUIRED") return fail("DOCUMENT_VAULT_CONSENT_REQUIRED", "Un consentement actif de conservation documentaire est requis avant d’ajouter un document au coffre client.", 403)
  if (error instanceof Error && error.message === "CLIENT_PHONE_MISSING") return fail("VALIDATION_ERROR", "Aucun numéro de téléphone client n’est disponible pour l’envoi SMS.", 422)
  if (error instanceof Error && error.message === "CLIENT_EMAIL_MISSING") return fail("VALIDATION_ERROR", "Aucune adresse courriel client n’est disponible pour l’envoi.", 422)
  if (error instanceof Error && error.message === "GMAIL_NOT_CONNECTED") return fail("GMAIL_NOT_CONNECTED", "Connectez Gmail dans Paramètres > Intégrations, ou configurez un expéditeur Resend vérifié pour envoyer des courriels.", 409)
  if (error instanceof Error && error.message.startsWith("GMAIL_SEND_FAILED")) return fail("GMAIL_SEND_FAILED", "Le courriel Gmail n’a pas pu être envoyé. Reconnectez Gmail puis réessayez.", 502)
  if (error instanceof Error && error.message.startsWith("GMAIL_TOKEN_REFRESH_FAILED")) return fail("GMAIL_RECONNECT_REQUIRED", "La connexion Gmail doit être renouvelée. Reconnectez Gmail dans Paramètres.", 409)
  if (error instanceof Error && error.message === "EMAIL_NOT_CONFIGURED") return fail("EMAIL_NOT_CONFIGURED", "L’envoi courriel réel n’est pas configuré. Ajoutez RESEND_API_KEY et EMAIL_FROM.", 503)
  if (error instanceof Error && error.message.startsWith("EMAIL_SEND_FAILED")) return fail("EMAIL_SEND_FAILED", "Le courriel n’a pas pu être envoyé. Connectez Gmail pour envoyer depuis le compte du conseiller, ou vérifiez l’expéditeur Resend.", 502)
  if (error instanceof Error && error.message === "SMS_CONSENT_REVOKED") return fail("SMS_CONSENT_REVOKED", "Le consentement SMS du client est révoqué.", 403)
  if (error instanceof Error && error.message === "SMS_CONTENT_NOT_ALLOWED") return fail("VALIDATION_ERROR", "Le message SMS doit rester administratif et ne pas contenir de conseil financier.", 422)
  return handleApiError(error)
}
