export const PRIORITY_WEIGHTS = {
  urgency: 0.3,
  compliance: 0.25,
  relationship: 0.15,
  commercial: 0.15,
  freshness: 0.1,
  effort: 0.05,
} as const

export const ACTIVE_LEAD_STATUSES = [
  "NEW",
  "TO_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
] as const

export const ACTIVE_CLIENT_STATUSES = ["ACTIVE", "REVIEW_NEEDED"] as const

export const PRIORITY_LEVEL_LABELS = {
  CRITICAL: "Critique",
  HIGH: "Priorité élevée",
  MEDIUM: "À planifier",
  LOW: "Peut attendre",
  BACKLOG: "Suivi secondaire",
} as const
