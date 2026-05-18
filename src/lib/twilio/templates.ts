const templates = {
  AUTO_REPLY_INBOUND_CALL: "Bonjour {{firstName}}, merci pour votre appel. Un conseiller vous contactera sous peu.",
  AUTO_REPLY_INBOUND_SMS: "Bonjour {{firstName}}, merci pour votre message. Nous vous répondrons sous peu.",
  FOLLOW_UP: "Bonjour {{firstName}}, je fais un suivi concernant votre demande. Êtes-vous disponible pour un court appel?",
  DOCUMENT_REQUEST: "Bonjour {{firstName}}, pourriez-vous nous transmettre le document demandé lorsque possible?",
} as const

export type SmsTemplateKey = keyof typeof templates

export function renderSmsTemplate(key: SmsTemplateKey, data: Record<string, string | null | undefined>) {
  return templates[key].replace(/\{\{(\w+)\}\}/g, (_match, variable: string) => data[variable] ?? "")
}

export function assertAdministrativeSms(body: string) {
  const forbidden = [
    /doit acheter/i,
    /recommande(z)?\s+\d/i,
    /meilleur choix/i,
    /rendement garanti/i,
    /optimisera/i,
    /couverture de\s+\d/i,
    /investir dans/i,
    /stratégie d'investissement/i,
  ]
  if (forbidden.some((pattern) => pattern.test(body))) {
    throw new Error("SMS_CONTENT_NOT_ALLOWED")
  }
}
