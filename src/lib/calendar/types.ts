export const defaultMeetingTypes = [
  {
    id: "review",
    name: "Revue de dossier",
    description: "KYC, besoins, priorités et prochaines étapes.",
    durationMinutes: 45,
    slotStepMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minimumNoticeHours: 24,
    maxBookingsPerDay: 6,
    locationType: "VIDEO",
    isPublic: true,
    questionnaire: [
      { key: "main_goal", label: "Quel est votre objectif principal ?", type: "select", options: ["Préparer ma retraite", "Réduire ma fiscalité", "Protéger ma famille", "Faire le point"] },
      { key: "status", label: "Votre statut", type: "select", options: ["Salarié", "Indépendant", "Dirigeant", "Retraité"] },
    ],
    createsOpportunity: true,
    campaignKey: "retirement",
  },
  {
    id: "intro",
    name: "Appel découverte",
    description: "Premier échange pour comprendre la situation.",
    durationMinutes: 30,
    slotStepMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minimumNoticeHours: 24,
    maxBookingsPerDay: 6,
    locationType: "PHONE",
    isPublic: true,
    questionnaire: [
      { key: "need", label: "Quel sujet souhaitez-vous aborder ?", type: "text" },
    ],
    createsOpportunity: false,
    campaignKey: null,
  },
  {
    id: "insurance",
    name: "Revue assurance",
    description: "Protection, bénéficiaires, polices et échéances.",
    durationMinutes: 45,
    slotStepMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minimumNoticeHours: 24,
    maxBookingsPerDay: 4,
    locationType: "VIDEO",
    isPublic: true,
    questionnaire: [
      { key: "product", label: "Produit concerné", type: "select", options: ["Assurance-vie", "Prévoyance", "Santé", "Emprunteur", "Autre"] },
    ],
    createsOpportunity: true,
    campaignKey: "insurance",
  },
  {
    id: "signature",
    name: "Signature contrat",
    description: "Finaliser une souscription ou vérifier les documents avant signature.",
    durationMinutes: 30,
    slotStepMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minimumNoticeHours: 24,
    maxBookingsPerDay: 4,
    locationType: "VIDEO",
    isPublic: true,
    questionnaire: [
      { key: "contract", label: "Contrat ou dossier concerné", type: "text" },
    ],
    createsOpportunity: false,
    campaignKey: null,
  },
] as const

export function generateMeetingUrl(locationType: string, provider?: string | null) {
  if (locationType === "PHONE" || locationType === "IN_PERSON") return null
  const base = provider === "TEAMS" ? "https://teams.microsoft.com/l/meetup-join/" : "https://meet.google.com/"
  const token = Math.random().toString(36).slice(2, 5) + "-" + Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 5)
  return `${base}${token}`
}
