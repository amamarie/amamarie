import { prisma } from "@/lib/db"
import {
  activities as mockActivities,
  automations as mockAutomations,
  clients as mockClients,
  documents as mockDocuments,
  products as mockProducts,
  prospects as mockProspects,
  tasks as mockTasks,
} from "@/lib/mock-data"
import { getDefaultOrganizationId } from "@/lib/tenant"
import type {
  Activity,
  AutomationRule,
  Client,
  CrmDocument,
  CrmTask,
  FinancialProduct,
  Lead,
  LeadStatus,
  Priority,
  StatusTone,
} from "@/types"

type PersonRef = {
  firstName: string
  lastName: string
}

type AdvisorRef = {
  name: string
}

type DbLead = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  address: string | null
  source: string
  status: string
  interestType: string | null
  priority: string
  nextAction: string | null
  createdAt: Date
  lastContactAt: Date | null
  notes: string | null
  advisor?: AdvisorRef | null
}

type DbClient = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: Date | null
  phone: string
  email: string | null
  address: string | null
  occupation: string | null
  employer: string | null
  approximateIncome: number | null
  familyStatus: string | null
  dependents: number | null
  advisor?: AdvisorRef | null
  status: string
  riskProfile: string | null
  goals: string | null
  notes: string | null
}

type DbTask = {
  id: string
  title: string
  dueDate: Date | null
  priority: string
  status: string
  assignedTo?: AdvisorRef | null
  lead?: PersonRef | null
  client?: PersonRef | null
}

type DbActivity = {
  id: string
  type: string
  title: string
  description: string | null
  createdAt: Date
  user?: AdvisorRef | null
  lead?: PersonRef | null
  client?: PersonRef | null
}

type DbDocument = {
  id: string
  name: string
  type: string
  status: string
  createdAt: Date
  lead?: PersonRef | null
  client?: PersonRef | null
}

type DbProduct = {
  id: string
  clientId: string
  type: string
  company: string | null
  policyNumber: string | null
  issuedAt: Date | null
  renewalAt: Date | null
  premium: number | null
  coverageAmount: number | null
  commissionAmount: number | null
  primaryBeneficiary: string | null
  contingentBeneficiary: string | null
  status: string
}

type DbAutomation = {
  id: string
  name: string
  trigger: string
  actions: unknown
  isActive: boolean
  runCount: number
  lastRunAt: Date | null
}

const leadStatusLabels: Record<string, LeadStatus> = {
  NEW: "Nouveau",
  TO_CONTACT: "À contacter",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Proposition envoyée",
  CONVERTED: "Converti",
  LOST: "Perdu",
}

const priorityLabels: Record<string, Priority> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
}

const toneByLeadStatus: Record<string, StatusTone> = {
  NEW: "emerald",
  TO_CONTACT: "amber",
  CONTACTED: "sky",
  QUALIFIED: "sky",
  PROPOSAL_SENT: "violet",
  CONVERTED: "emerald",
  LOST: "slate",
}

const taskStatusLabels: Record<string, CrmTask["status"]> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
}

const sourceLabels: Record<string, string> = {
  INBOUND_CALL: "Appel entrant",
  SMS: "SMS entrant",
  WEBSITE: "Site web",
  REFERRAL: "Référence",
  SOCIAL_MEDIA: "Réseaux sociaux",
  EVENT: "Événement",
  MANUAL: "Import manuel",
  CAMPAIGN: "Campagne marketing",
  OTHER: "Autre",
}

const clientStatusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  PROSPECT_CONVERTED: "Prospect converti",
  REVIEW_NEEDED: "Révision requise",
}

const productTypeLabels: Record<string, string> = {
  LIFE_INSURANCE: "Assurance vie",
  DISABILITY_INSURANCE: "Assurance invalidité",
  CRITICAL_ILLNESS: "Maladie grave",
  HEALTH_INSURANCE: "Assurance santé",
  GROUP_INSURANCE: "Assurance collective",
  LONG_TERM_CARE: "Soins longue durée",
  TRAVEL_INSURANCE: "Assurance voyage",
  OTHER_INSURANCE: "Autre assurance",
  RRSP: "REER",
  TFSA: "CELI",
  INVESTMENT: "Placement",
  RESP: "REEE",
  FHSA: "CELIAPP",
  NON_REGISTERED: "Compte non enregistré",
  MUTUAL_FUND: "Fonds commun",
  SEGREGATED_FUND: "Fonds distinct",
  GIC: "CPG",
  ANNUITY: "Rente",
  OTHER_INVESTMENT: "Autre placement",
  OTHER: "Autre",
}

function formatDate(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ""
}

function toLead(lead: DbLead): Lead {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email ?? "",
    address: lead.address ?? "",
    source: sourceLabels[lead.source] ?? lead.source,
    status: leadStatusLabels[lead.status] ?? "Nouveau",
    interest: lead.interestType ?? "À définir",
    priority: priorityLabels[lead.priority] ?? "Normale",
    advisor: lead.advisor?.name ?? "Non assigné",
    nextAction: lead.nextAction ?? "À définir",
    createdAt: formatDate(lead.createdAt),
    lastContact: formatDate(lead.lastContactAt),
    notes: lead.notes ?? "",
    tone: toneByLeadStatus[lead.status] ?? "slate",
  }
}

function toClient(client: DbClient): Client {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    birthDate: formatDate(client.dateOfBirth),
    phone: client.phone,
    email: client.email ?? "",
    address: client.address ?? "",
    occupation: client.occupation ?? "",
    employer: client.employer ?? "",
    income: client.approximateIncome ? `${client.approximateIncome} $` : "",
    familySituation: client.familyStatus ?? "",
    dependents: client.dependents ?? 0,
    advisor: client.advisor?.name ?? "Non assigné",
    status: clientStatusLabels[client.status] ?? client.status,
    riskLevel: client.riskProfile ?? "Non défini",
    objectives: client.goals ? client.goals.split(";").map((goal) => goal.trim()) : [],
    importantNotes: client.notes ?? "",
    nextReview: "",
    tone:
      client.riskProfile === "Eleve"
        ? "rose"
        : client.riskProfile === "Faible"
          ? "emerald"
          : "sky",
  }
}

function toTask(task: DbTask): CrmTask {
  const related = task.lead ?? task.client
  return {
    id: task.id,
    title: task.title,
    relatedTo: related ? `${related.firstName} ${related.lastName}` : "General",
    relationType: task.lead ? "Prospect" : "Client",
    dueDate: task.dueDate ? task.dueDate.toLocaleString("fr-CA") : "À définir",
    priority: priorityLabels[task.priority] ?? "Normale",
    status: taskStatusLabels[task.status] ?? "À faire",
    advisor: task.assignedTo?.name ?? "Non assigné",
  }
}

function toActivity(activity: DbActivity): Activity {
  const related = activity.lead ?? activity.client
  return {
    id: activity.id,
    type: activity.type,
    description: activity.description ?? activity.title,
    user: activity.user?.name ?? "Systeme",
    dateTime: activity.createdAt.toLocaleString("fr-CA"),
    relatedTo: related ? `${related.firstName} ${related.lastName}` : "General",
    source: "CRM",
  }
}

function toDocument(document: DbDocument): CrmDocument {
  const related = document.lead ?? document.client
  return {
    id: document.id,
    title: document.name,
    relatedTo: related ? `${related.firstName} ${related.lastName}` : "General",
    type: document.type,
    status: document.status,
    addedAt: formatDate(document.createdAt),
  }
}

function toProduct(product: DbProduct): FinancialProduct {
  return {
    id: product.id,
    clientId: product.clientId,
    type: productTypeLabels[product.type] ?? product.type,
    company: product.company ?? "",
    contractNumber: product.policyNumber ?? "",
    issueDate: formatDate(product.issuedAt),
    renewalDate: formatDate(product.renewalAt),
    premium: product.premium ? `${product.premium} $` : "",
    coverage: product.coverageAmount ? `${product.coverageAmount} $` : "",
    beneficiaries: [product.primaryBeneficiary, product.contingentBeneficiary].filter(Boolean).join(", "),
    status: product.status,
    estimatedCommission: product.commissionAmount ? `${product.commissionAmount} $` : "",
  }
}

function toAutomation(rule: DbAutomation): AutomationRule {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    actions: Array.isArray(rule.actions) ? rule.actions.map(String) : [String(rule.actions)],
    status: rule.isActive ? "Active" : "Inactive",
    executions: rule.runCount,
    lastRun: rule.lastRunAt ? rule.lastRunAt.toLocaleString("fr-CA") : "Jamais",
  }
}

export async function getLeads(): Promise<Lead[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const leads = await prisma.lead.findMany({
      where: { organizationId },
      include: { advisor: true },
      orderBy: { createdAt: "desc" },
    })
    return leads.map(toLead)
  } catch {
    return mockProspects
  }
}

export async function getClients(): Promise<Client[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const clients = await prisma.client.findMany({
      where: { organizationId },
      include: { advisor: true },
      orderBy: { createdAt: "desc" },
    })
    return clients.map(toClient)
  } catch {
    return mockClients
  }
}

export async function getTasks(): Promise<CrmTask[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const tasks = await prisma.task.findMany({
      where: { organizationId },
      include: { assignedTo: true, lead: true, client: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    })
    return tasks.map(toTask)
  } catch {
    return mockTasks
  }
}

export async function getActivities(): Promise<Activity[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const activities = await prisma.activity.findMany({
      where: { organizationId },
      include: { user: true, lead: true, client: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    return activities.map(toActivity)
  } catch {
    return mockActivities
  }
}

export async function getDocuments(): Promise<CrmDocument[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const documents = await prisma.document.findMany({
      where: { organizationId },
      include: { lead: true, client: true },
      orderBy: { createdAt: "desc" },
    })
    return documents.map(toDocument)
  } catch {
    return mockDocuments
  }
}

export async function getFinancialProducts(): Promise<FinancialProduct[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const products = await prisma.financialProduct.findMany({
      where: { organizationId },
    })
    return products.map(toProduct)
  } catch {
    return mockProducts
  }
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  try {
    const organizationId = await getDefaultOrganizationId()
    const rules = await prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    })
    return rules.map(toAutomation)
  } catch {
    return mockAutomations
  }
}
