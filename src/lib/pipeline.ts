import type { LeadStatus } from "@prisma/client"

export const pipelineStatuses: LeadStatus[] = [
  "NEW",
  "TO_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
]

export const archivePipelineStatuses: LeadStatus[] = ["CONVERTED", "LOST", "ARCHIVED"]

export const pipelineStatusDescriptions: Record<LeadStatus, string> = {
  NEW: "Nouveaux dossiers à qualifier.",
  TO_CONTACT: "Prospects à rappeler rapidement.",
  CONTACTED: "Contact initial effectué.",
  QUALIFIED: "Besoin validé, proposition à préparer.",
  PROPOSAL_SENT: "Proposition envoyée, suivi requis.",
  NEGOTIATION: "Questions ou ajustements en cours.",
  WON: "Prospects gagnés à convertir en clients.",
  CONVERTED: "Fiche client créée.",
  LOST: "Prospects perdus.",
  ARCHIVED: "Prospects archivés.",
}
