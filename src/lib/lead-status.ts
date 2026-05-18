import type { LeadStatus, Priority } from "@prisma/client"

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: "Nouveau",
  TO_CONTACT: "À contacter",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Proposition envoyée",
  NEGOTIATION: "En discussion",
  WON: "Gagné",
  CONVERTED: "Converti en client",
  LOST: "Perdu",
  ARCHIVED: "Archivé",
}

export const activePipelineStatuses: LeadStatus[] = [
  "NEW",
  "TO_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
]

export const leadStatusTaskTemplates: Partial<
  Record<LeadStatus, { title: string; description: string; dueInHours: number; priority: Priority }>
> = {
  NEW: {
    title: "Premier contact",
    description: "Contacter le prospect pour confirmer son besoin et le meilleur moment pour discuter.",
    dueInHours: 24,
    priority: "HIGH",
  },
  TO_CONTACT: {
    title: "Contacter le prospect",
    description: "Effectuer le premier suivi et documenter le résultat dans le dossier.",
    dueInHours: 8,
    priority: "HIGH",
  },
  CONTACTED: {
    title: "Qualifier le besoin",
    description: "Valider le besoin, le budget, le moment d'achat et le consentement à poursuivre.",
    dueInHours: 24,
    priority: "NORMAL",
  },
  QUALIFIED: {
    title: "Préparer proposition",
    description: "Préparer une proposition ou une illustration adaptée au besoin identifié.",
    dueInHours: 24,
    priority: "HIGH",
  },
  PROPOSAL_SENT: {
    title: "Suivi proposition 48h",
    description: "Faire un suivi après l'envoi de la proposition.",
    dueInHours: 48,
    priority: "HIGH",
  },
  NEGOTIATION: {
    title: "Suivi rapproché",
    description: "Répondre aux questions et ajuster la proposition si nécessaire.",
    dueInHours: 24,
    priority: "HIGH",
  },
  WON: {
    title: "Convertir en client",
    description: "Créer la fiche client et compléter les informations de démarrage.",
    dueInHours: 8,
    priority: "HIGH",
  },
}
