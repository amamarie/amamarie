import type { Lead, Priority, User } from "@prisma/client"

import type { LeadIntakeQualification } from "@/lib/ai/services/qualifyLeadIntake"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

export type LeadRoutingNeed = "LIFE_INSURANCE" | "DISABILITY" | "INVESTMENT" | "RETIREMENT" | "BUSINESS" | "GENERAL"

type LeadRoutingContext = {
  need: LeadRoutingNeed
  urgency: Priority
  budget: string | null
  keywords: string[]
  rationale: string
}

type AdvisorForRouting = Pick<User, "id" | "name" | "email" | "role" | "title" | "specialties" | "routingTerritories" | "routingLanguages" | "licenseNumber" | "routingPriority"> & {
  _count: { leads: number; assignedTasks: number; availabilitySlots: number }
  availabilitySlots: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number; isActive: boolean }>
}

const NEED_LABELS: Record<LeadRoutingNeed, string> = {
  LIFE_INSURANCE: "assurance vie",
  DISABILITY: "invalidité",
  INVESTMENT: "placement",
  RETIREMENT: "retraite",
  BUSINESS: "entreprise",
  GENERAL: "besoin général",
}

const NEED_KEYWORDS: Record<LeadRoutingNeed, string[]> = {
  LIFE_INSURANCE: ["assurance vie", "vie", "deces", "décès", "hypotheque", "hypothèque", "protection familiale", "famille"],
  DISABILITY: ["invalidite", "invalidité", "maladie", "revenu protege", "revenu protégé", "arret de travail", "arrêt de travail", "incapacite", "incapacité"],
  INVESTMENT: ["placement", "investissement", "investir", "portefeuille", "celi", "reer", "rendement", "fnb", "fonds"],
  RETIREMENT: ["retraite", "decaissement", "décaissement", "ferr", "rrq", "psv", "pension"],
  BUSINESS: ["entreprise", "incorpore", "incorporé", "societe", "société", "actionnaire", "rachat", "personne cle", "personne clé"],
  GENERAL: [],
}

const ADVISOR_KEYWORDS: Record<LeadRoutingNeed, string[]> = {
  LIFE_INSURANCE: ["assurance", "vie", "protection"],
  DISABILITY: ["invalidite", "invalidité", "assurance", "protection"],
  INVESTMENT: ["placement", "investissement", "patrimoine", "portefeuille"],
  RETIREMENT: ["retraite", "decaissement", "décaissement", "patrimoine"],
  BUSINESS: ["entreprise", "corporatif", "affaires", "entrepreneur"],
  GENERAL: [],
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function includesKeyword(text: string, keyword: string) {
  return normalize(text).includes(normalize(keyword))
}

function detectBudget(text: string) {
  const match = text.match(/(?:budget|prime|investir|placement|montant|revenu)?\s*(?:de|d'environ|environ|:)?\s*(\d[\d\s.,]*(?:k|K)?\s?\$?|\$\s?\d[\d\s.,]*(?:k|K)?)/i)
  return match?.[1]?.trim() ?? null
}

function priorityFromUrgency(text: string, qualification?: LeadIntakeQualification | null, callbackUrgency?: string | null): Priority {
  const urgency = normalize([callbackUrgency, qualification?.urgency, qualification?.temperature, text].filter(Boolean).join(" "))
  if (urgency.includes("urgent") || urgency.includes("aujourd") || urgency.includes("rapidement") || urgency.includes("hot")) return "URGENT"
  if (urgency.includes("high") || urgency.includes("eleve") || urgency.includes("élevé") || urgency.includes("cette semaine") || urgency.includes("warm")) return "HIGH"
  if (urgency.includes("low") || urgency.includes("faible") || urgency.includes("pas presse") || urgency.includes("pas pressé") || urgency.includes("cold")) return "LOW"
  return "HIGH"
}

export function detectLeadRoutingContext({
  message,
  interestType,
  qualification,
  detectedNeed,
  urgency,
  budget,
  rationale,
}: {
  message?: string | null
  interestType?: string | null
  qualification?: LeadIntakeQualification | null
  detectedNeed?: string | null
  urgency?: string | null
  budget?: string | null
  rationale?: string | null
}): LeadRoutingContext {
  const text = [
    detectedNeed,
    interestType,
    message,
    qualification?.intent,
    qualification?.probableNeed,
    qualification?.nextBestAction,
    qualification?.rationale,
  ]
    .filter(Boolean)
    .join(" ")

  const need = (Object.keys(NEED_KEYWORDS) as LeadRoutingNeed[]).find((candidate) => {
    if (candidate === "GENERAL") return false
    return NEED_KEYWORDS[candidate].some((keyword) => includesKeyword(text, keyword))
  }) ?? "GENERAL"

  const keywords = need === "GENERAL" ? [] : NEED_KEYWORDS[need].filter((keyword) => includesKeyword(text, keyword)).slice(0, 5)
  const detectedBudget = budget?.trim() || detectBudget(text)
  const priority = priorityFromUrgency(text, qualification, urgency)
  const reason = rationale?.trim()
    || qualification?.rationale
    || (keywords.length ? `Mots-clés détectés: ${keywords.join(", ")}.` : "Aucun besoin spécialisé détecté; routage général.")

  return {
    need,
    urgency: priority,
    budget: detectedBudget,
    keywords,
    rationale: reason,
  }
}

function hasAvailabilityNow(advisor: AdvisorForRouting) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (!advisor.availabilitySlots.length) return true
  return advisor.availabilitySlots.some((slot) => slot.isActive && slot.dayOfWeek === dayOfWeek && slot.startMinutes <= minutes && slot.endMinutes >= minutes)
}

function advisorScore(advisor: AdvisorForRouting, context: LeadRoutingContext, leadText: string) {
  const need = context.need
  const specialties = normalize(advisor.specialties ?? "")
  const profile = normalize([advisor.name, advisor.email, advisor.title, advisor.licenseNumber].filter(Boolean).join(" "))
  const territory = normalize(advisor.routingTerritories ?? "")
  const language = normalize(advisor.routingLanguages ?? "")
  const normalizedLeadText = normalize(leadText)
  const keywordScore = need === "GENERAL" ? 0 : ADVISOR_KEYWORDS[need].reduce((score, keyword) => {
    const specialtyMatch = includesKeyword(specialties, keyword) ? 3 : 0
    const profileMatch = includesKeyword(profile, keyword) ? 1 : 0
    return score + specialtyMatch + profileMatch
  }, 0)
  const territoryScore = territory && territory.split(/[,;\n]/).some((item) => item.trim() && normalizedLeadText.includes(normalize(item.trim()))) ? 4 : 0
  const languageScore = language && (normalizedLeadText.includes("anglais") || normalizedLeadText.includes("english")) && includesKeyword(language, "anglais") ? 2 : 0
  const licenseScore = advisor.licenseNumber ? 1 : -2
  const availabilityScore = hasAvailabilityNow(advisor) ? 2 : -3
  const workloadPenalty = Math.min(8, Math.floor((advisor._count.leads + advisor._count.assignedTasks) / 5))
  const priorityScore = Math.round((advisor.routingPriority ?? 50) / 10)

  return keywordScore + territoryScore + languageScore + licenseScore + availabilityScore + priorityScore - workloadPenalty
}

async function chooseAdvisor({
  organizationId,
  currentAdvisorId,
  context,
  leadText,
}: {
  organizationId: string
  currentAdvisorId?: string | null
  context: LeadRoutingContext
  leadText: string
}) {
  const advisors = await prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ["ADVISOR", "OWNER"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      specialties: true,
      routingTerritories: true,
      routingLanguages: true,
      licenseNumber: true,
      routingPriority: true,
      availabilitySlots: {
        where: { isActive: true },
        select: { dayOfWeek: true, startMinutes: true, endMinutes: true, isActive: true },
      },
      _count: {
        select: {
          leads: { where: { status: { notIn: ["CONVERTED", "LOST", "ARCHIVED"] } } },
          assignedTasks: { where: { status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } } },
          availabilitySlots: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  if (!advisors.length) return null

  const specialized = advisors
    .map((advisor) => ({ advisor, score: advisorScore(advisor, context, leadText) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.advisor.name.localeCompare(right.advisor.name))

  if (specialized[0]) return specialized[0].advisor

  if (currentAdvisorId) {
    const current = advisors.find((advisor) => advisor.id === currentAdvisorId)
    if (current) return current
  }

  return advisors.find((advisor) => advisor.role === "OWNER") ?? advisors[0]
}

function routeTaskDescription({ lead, context, advisor }: { lead: Pick<Lead, "firstName" | "lastName" | "interestType" | "notes">; context: LeadRoutingContext; advisor: AdvisorForRouting | null }) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ")
  return [
    `Prospect: ${fullName}`,
    `Besoin détecté: ${NEED_LABELS[context.need]}`,
    `Urgence: ${context.urgency}`,
    context.budget ? `Budget ou montant mentionné: ${context.budget}` : "Budget: à préciser",
    advisor ? `Conseiller assigné: ${advisor.name}` : "Conseiller assigné: à déterminer",
    advisor?.specialties ? `Spécialités conseiller: ${advisor.specialties}` : null,
    advisor?.routingTerritories ? `Territoires: ${advisor.routingTerritories}` : null,
    advisor?.routingLanguages ? `Langues: ${advisor.routingLanguages}` : null,
    advisor ? `Charge active: ${advisor._count.leads} prospect(s), ${advisor._count.assignedTasks} tâche(s)` : null,
    `Raison: ${context.rationale}`,
    lead.interestType ? `Intérêt déclaré: ${lead.interestType}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function routeLeadFromFormQualification({
  organizationId,
  leadId,
  userId,
  automationRuleId,
  workflowKey,
  qualification,
  detectedNeed,
  urgency,
  budget,
  rationale,
}: {
  organizationId: string
  leadId: string
  userId?: string | null
  automationRuleId?: string | null
  workflowKey?: string | null
  qualification?: LeadIntakeQualification | null
  detectedNeed?: string | null
  urgency?: string | null
  budget?: string | null
  rationale?: string | null
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      advisorId: true,
      interestType: true,
      address: true,
      notes: true,
      priority: true,
      status: true,
    },
  })
  if (!lead) return { routed: false, reason: "lead_not_found" }

  const context = detectLeadRoutingContext({
    message: lead.notes,
    interestType: lead.interestType,
    qualification,
    detectedNeed,
    urgency,
    budget,
    rationale,
  })
  const leadText = [lead.interestType, lead.address, lead.notes].filter(Boolean).join(" ")
  const advisor = await chooseAdvisor({
    organizationId,
    currentAdvisorId: lead.advisorId,
    context,
    leadText,
  })

  const nextAdvisorId = advisor?.id ?? lead.advisorId ?? userId ?? null
  const nextPriority: Priority = context.urgency === "LOW" ? lead.priority : context.urgency
  const nextAction = `Qualifier la demande ${NEED_LABELS[context.need]}${context.budget ? ` (${context.budget})` : ""}`

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      advisorId: nextAdvisorId,
      priority: nextPriority,
      nextAction,
      status: lead.status === "NEW" ? "TO_CONTACT" : lead.status,
    },
  })

  const title = `Routage prospect - ${NEED_LABELS[context.need]}`
  const existingTask = await prisma.task.findFirst({
    where: {
      organizationId,
      leadId: lead.id,
      title,
      isAutomated: true,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })

  const dueDate = new Date()
  if (nextPriority === "URGENT") dueDate.setMinutes(dueDate.getMinutes() + 15)
  else if (nextPriority === "HIGH") dueDate.setHours(dueDate.getHours() + 2)
  else dueDate.setDate(dueDate.getDate() + 1)

  const task = existingTask
    ? null
    : await prisma.task.create({
        data: {
          organizationId,
          leadId: lead.id,
          assignedToId: nextAdvisorId,
          createdById: userId ?? nextAdvisorId,
          automationRuleId: automationRuleId ?? null,
          type: "FOLLOW_UP",
          title,
          description: routeTaskDescription({ lead, context, advisor }),
          priority: nextPriority,
          status: "TODO",
          dueDate,
          isAutomated: true,
        },
      })

  const activity = await createCrmActivity({
    organizationId,
    userId: userId ?? nextAdvisorId,
    leadId: lead.id,
    taskId: task?.id ?? existingTask?.id ?? null,
    automationRuleId: automationRuleId ?? null,
    type: nextAdvisorId && nextAdvisorId !== lead.advisorId ? "LEAD_ASSIGNED" : "LEAD_UPDATED",
    title: "Qualification IA et routage conseiller",
    description: `${NEED_LABELS[context.need]} · ${nextPriority}${advisor ? ` · ${advisor.name}` : ""}`,
    entityType: "Lead",
    entityId: lead.id,
    source: workflowKey ? "AUTOMATION" : "AI",
    metadata: {
      workflowKey,
      routing: context,
      advisorId: nextAdvisorId,
      previousAdvisorId: lead.advisorId,
    },
  })

  return {
    routed: true,
    leadId: lead.id,
    advisorId: nextAdvisorId,
    advisorName: advisor?.name ?? null,
    taskId: task?.id ?? existingTask?.id ?? null,
    activityId: activity?.id ?? null,
    context,
  }
}
