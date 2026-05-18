export class TwilioWebhookError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = "TwilioWebhookError"
  }
}

type TwilioApiErrorLike = {
  code?: number | string
  status?: number
  message?: string
}

export function smsSendErrorMessage(error: unknown) {
  const twilioError = error as TwilioApiErrorLike
  const message = twilioError.message ?? ""
  const code = twilioError.code ? String(twilioError.code) : ""
  const status = twilioError.status

  if (message === "Authenticate" || status === 401 || code === "20003") {
    return "Twilio refuse l'authentification. Vérifiez que TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN appartiennent au même compte ou sous-compte."
  }

  if (code === "21608") {
    return "Compte Twilio en mode essai: le numéro destinataire doit être vérifié dans Twilio."
  }

  if (code === "21606" || code === "21212") {
    return "Le numéro Twilio configuré ne peut pas envoyer de SMS. Vérifiez le numéro expéditeur dans Twilio."
  }

  if (code === "21211") {
    return "Le numéro destinataire est invalide. Utilisez le format international, par exemple +15145551234."
  }

  if (message) return message
  return "Impossible d'envoyer le SMS avec Twilio."
}
