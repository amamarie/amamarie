import { twiml } from "twilio"

export function buildIncomingCallResponse(appUrl?: string) {
  const response = new twiml.VoiceResponse()
  response.say({ language: "fr-CA" }, "Bonjour. Vous avez joint le cabinet. Cet appel peut être enregistré afin d'assurer le suivi de votre demande.")
  response.pause({ length: 1 })
  response.say({ language: "fr-CA" }, "Veuillez laisser votre nom, votre numéro de téléphone et un court message après le signal sonore. Un conseiller recevra votre message et vous contactera dès que possible. Appuyez sur carré lorsque vous avez terminé.")
  response.record({
    action: appUrl ? `${appUrl}/api/webhooks/twilio/voicemail` : "/api/webhooks/twilio/voicemail",
    method: "POST",
    maxLength: 120,
    finishOnKey: "#",
    playBeep: true,
    trim: "trim-silence",
  })
  response.say({ language: "fr-CA" }, "Merci. Votre message a été enregistré. Vous pouvez raccrocher.")
  return response.toString()
}

export function buildEmptyMessagingResponse() {
  return new twiml.MessagingResponse().toString()
}
