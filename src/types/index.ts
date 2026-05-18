export type StatusTone =
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "slate"

export type LeadStatus =
  | "Nouveau"
  | "À contacter"
  | "Contacté"
  | "Qualifié"
  | "Proposition envoyée"
  | "En discussion"
  | "Gagné"
  | "Converti"
  | "Perdu"
  | "Archivé"

export type Priority = "Basse" | "Normale" | "Haute" | "Urgente"

export type Lead = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  address: string
  source: string
  status: LeadStatus
  interest: string
  priority: Priority
  advisor: string
  nextAction: string
  createdAt: string
  lastContact: string
  notes: string
  tone: StatusTone
}

export type Client = {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  phone: string
  email: string
  address: string
  occupation: string
  employer: string
  income: string
  familySituation: string
  dependents: number
  advisor: string
  status: string
  riskLevel: string
  objectives: string[]
  importantNotes: string
  nextReview: string
  tone: StatusTone
}

export type CrmTask = {
  id: string
  title: string
  relatedTo: string
  relationType: "Prospect" | "Client"
  dueDate: string
  priority: Priority
  status: "À faire" | "En cours" | "Terminée" | "En retard" | "Annulée"
  advisor: string
}

export type Activity = {
  id: string
  type: string
  description: string
  user: string
  dateTime: string
  relatedTo: string
  source: string
}

export type FinancialProduct = {
  id: string
  clientId: string
  type: string
  company: string
  contractNumber: string
  issueDate: string
  renewalDate: string
  premium: string
  coverage: string
  beneficiaries: string
  status: string
  estimatedCommission: string
}

export type CrmDocument = {
  id: string
  title: string
  relatedTo: string
  type: string
  status: string
  addedAt: string
}

export type AutomationRule = {
  id: string
  name: string
  trigger: string
  actions: string[]
  status: "Active" | "Inactive" | "Brouillon"
  executions: number
  lastRun: string
}

export type Communication = {
  id: string
  relatedTo: string
  direction: "Entrant" | "Sortant"
  channel: "SMS" | "Appel" | "Courriel"
  dateTime: string
  summary: string
}

export type Notification = {
  id: string
  label: string
  description: string
  tone: StatusTone
}
