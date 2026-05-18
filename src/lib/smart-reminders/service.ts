import { Prisma } from "@prisma/client"
import { z } from "zod"

import { createAuditLog } from "@/lib/compliance/audit"
import { createAdvisorGoogleCalendarEvent, sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { runAI } from "@/lib/ai/core/run-ai"
import { prisma } from "@/lib/prisma"
import { ensureCommunicationSettings } from "@/lib/services/communications"
import { createNotification } from "@/lib/services/notifications"

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "SNOOZED"]
const MS_PER_DAY = 24 * 60 * 60 * 1000
const PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
}

type ReminderCandidate = {
  ruleCode: string
  title: string
  description?: string
  reason: string
  category: string
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL"
  dueDate?: Date
  sourceEntityType?: string
  sourceEntityId?: string
  recommendedAction: string
  actionUrl?: string
  urgencyScore: number
  riskScore: number
  commercialScore: number
  relationshipScore: number
  metadata?: Record<string, unknown>
}

const noteEventExtractionSchema = z.object({
  events: z.array(z.object({
    noteId: z.string(),
    eventType: z.enum(["BIRTH", "MARRIAGE", "DIVORCE", "JOB_CHANGE", "RETIREMENT", "MORTGAGE", "CHILD_18", "OTHER"]),
    confidence: z.number().min(0).max(1).default(0.5),
    rationale: z.string().min(2).max(500),
    recommendedAction: z.string().min(2).max(300),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("HIGH"),
  })).max(10),
  disclaimer: z.string().min(20),
})

type NoteEventExtraction = z.infer<typeof noteEventExtractionSchema>

const DEFAULT_RULES = [
  ["CLIENT_COMPREHENSIVE_REVIEW", "Revue client complète recommandée", "RELATION", "CLIENT", "HIGH", 7],
  ["POLICY_TERM_EXPIRY_24M", "Police temporaire expire dans 24 mois", "ASSURANCE", "FINANCIAL_PRODUCT", "HIGH", 14],
  ["POLICY_RENEWAL_6M", "Renouvellement de police dans 6 mois", "ASSURANCE", "FINANCIAL_PRODUCT", "HIGH", 7],
  ["BENEFICIARY_REVIEW_36M", "Bénéficiaires non revus depuis 36 mois", "ASSURANCE", "FINANCIAL_PRODUCT", "HIGH", 14],
  ["KYC_REVIEW_DUE", "KYC à mettre à jour", "KYC", "KYC_PROFILE", "CRITICAL", 3],
  ["INVESTMENT_PROFILE_REVIEW", "Profil investisseur à revoir", "PLACEMENT", "INVESTMENT_PROFILE", "CRITICAL", 7],
  ["CONSENT_EXPIRING_30D", "Consentement expiré ou à renouveler", "CONFORMITE", "CONSENT", "CRITICAL", 2],
  ["AML_REVIEW_DUE", "Revue AML / LBA-FAT requise", "AML", "AML_PROFILE", "CRITICAL", 2],
  ["DOCUMENT_EXPIRING_OR_MISSING", "Document expiré ou manquant", "DOCUMENTS", "DOCUMENT", "HIGH", 5],
  ["AGE_65_RETIREMENT_REVIEW", "Client atteint 65 ans", "PLACEMENT", "CLIENT", "HIGH", 30],
  ["AGE_71_RRSP_REVIEW", "Client atteint 71 ans", "FISCALITE", "CLIENT", "CRITICAL", 7],
  ["NO_MEETING_NOTE_12M", "Aucune rencontre récente", "RELATION", "NOTE", "NORMAL", 14],
  ["CLIENT_REVIEW_DUE", "Revue client annuelle à planifier", "RELATION", "CLIENT", "NORMAL", 14],
  ["GROUP_INSURANCE_REVIEW", "Assurance collective à revoir", "ASSURANCE", "CLIENT", "HIGH", 7],
  ["EMPLOYMENT_SELF_EMPLOYED_REVIEW", "Protection travailleur autonome à revoir", "ASSURANCE", "CLIENT", "HIGH", 7],
  ["DIVORCE_SEPARATION_REVIEW", "Revue post-séparation", "RELATION", "CLIENT", "CRITICAL", 3],
  ["CHILD_18_REVIEW", "Enfant atteint 18 ans", "FAMILY", "CLIENT", "HIGH", 14],
  ["MORTGAGE_DEBT_REVIEW", "Hypothèque ou dette importante à revoir", "ASSURANCE", "CLIENT", "HIGH", 14],
  ["NOTE_LIFE_EVENT_DETECTED", "Événement de vie détecté dans une note", "RELATION", "NOTE", "HIGH", 7],
] as const

function addDays(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY)
}

function daysUntil(date?: Date | null) {
  if (!date) return null
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_DAY)
}

function monthsBetweenOlderThan(date: Date | null | undefined, months: number) {
  if (!date) return true
  return Date.now() - date.getTime() > months * 30 * MS_PER_DAY
}

function ageOn(dateOfBirth: Date, at = new Date()) {
  let age = at.getFullYear() - dateOfBirth.getFullYear()
  const m = at.getMonth() - dateOfBirth.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < dateOfBirth.getDate())) age -= 1
  return age
}

function priorityScore(candidate: ReminderCandidate) {
  const priorityBase = { LOW: 10, NORMAL: 30, HIGH: 55, CRITICAL: 75 }[candidate.priority]
  return Math.min(100, priorityBase + candidate.urgencyScore + candidate.riskScore + candidate.commercialScore + candidate.relationshipScore)
}

function toTaskPriority(priority: string) {
  if (priority === "CRITICAL") return "URGENT"
  if (priority === "HIGH") return "HIGH"
  if (priority === "LOW") return "LOW"
  return "NORMAL"
}

function toCrossSellPriority(priority: string) {
  if (priority === "CRITICAL") return "CRITICAL"
  if (priority === "HIGH") return "HIGH"
  if (priority === "LOW") return "LOW"
  return "MEDIUM"
}

function toCrossSellCategory(category: string) {
  if (category === "PLACEMENT" || category === "FISCALITE") return "RETIREMENT"
  if (category === "ASSURANCE") return "PROTECTION"
  if (category === "FAMILY") return "FAMILY_NEEDS"
  if (category === "AML" || category === "KYC" || category === "CONFORMITE" || category === "DOCUMENTS") return "REVIEW_OPPORTUNITY"
  return "REVIEW_OPPORTUNITY"
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function childBirthdates(children: unknown): Date[] {
  if (!Array.isArray(children)) return []
  const dates: Date[] = []
  for (const child of children) {
    if (!child || typeof child !== "object") continue
    const record = child as Record<string, unknown>
    const raw = record.dateOfBirth ?? record.birthDate ?? record.dob ?? record.naissance
    if (typeof raw !== "string" && !(raw instanceof Date)) continue
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) dates.push(parsed)
  }
  return dates
}

function fallbackNoteEvents(notes: Array<{ id: string; title?: string | null; content?: string | null }>) {
  const events: NoteEventExtraction["events"] = []
  for (const note of notes) {
    const text = normalizeText(`${note.title ?? ""} ${note.content ?? ""}`)
    const match = [
      ["BIRTH", ["naissance", "bebe", "nouveau-ne", "enfant"]],
      ["MARRIAGE", ["mariage", "marie", "conjoint"]],
      ["DIVORCE", ["divorce", "separation", "separe"]],
      ["JOB_CHANGE", ["nouvel emploi", "changement emploi", "travail autonome", "perte emploi"]],
      ["RETIREMENT", ["retraite", "cessation emploi"]],
      ["MORTGAGE", ["hypotheque", "renouvellement hypothecaire", "maison"]],
    ].find(([, keywords]) => (keywords as string[]).some((keyword) => text.includes(keyword)))
    if (!match) continue
    events.push({
      noteId: note.id,
      eventType: match[0] as "BIRTH" | "MARRIAGE" | "DIVORCE" | "JOB_CHANGE" | "RETIREMENT" | "MORTGAGE",
      confidence: 0.65,
      rationale: `Mot-clé détecté dans la note: ${match[0]}.`,
      recommendedAction: "Valider l’événement de vie, mettre à jour le KYC et créer les suivis appropriés.",
      priority: match[0] === "DIVORCE" ? "CRITICAL" as const : "HIGH" as const,
    })
  }
  return {
    events,
    disclaimer: "Analyse locale prudente: le conseiller doit valider tout événement détecté avant action client.",
  }
}

function webhookTimeoutMs() {
  const configured = Number(process.env.SMART_REMINDERS_WEBHOOK_TIMEOUT_MS ?? 5000)
  return Number.isFinite(configured) && configured > 0 ? configured : 5000
}

async function postWebhook(url: string, payload: unknown) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), webhookTimeoutMs())
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    return { ok: response.ok, status: response.status }
  } finally {
    clearTimeout(timeout)
  }
}

async function maybeAutoNotifyExternalChannels({
  organizationId,
  reminderId,
  priority,
  userId,
}: {
  organizationId: string
  reminderId: string
  priority: string
  userId?: string | null
}) {
  const settings = await ensureCommunicationSettings(organizationId)
  if (!settings.smartRemindersExternalAutoNotify) return
  const minPriority = settings.smartRemindersExternalNotifyMinPriority || "CRITICAL"
  if ((PRIORITY_RANK[priority] ?? 0) < (PRIORITY_RANK[minPriority] ?? PRIORITY_RANK.CRITICAL)) return
  if (!settings.smartRemindersSlackWebhookUrl && !settings.smartRemindersTeamsWebhookUrl && !process.env.SMART_REMINDERS_SLACK_WEBHOOK_URL && !process.env.SMART_REMINDERS_TEAMS_WEBHOOK_URL) return

  try {
    await notifyExternalChannelsFromSmartReminder({ organizationId, reminderId, userId })
  } catch (error) {
    await prisma.smartReminderAction.create({
      data: {
        organizationId,
        reminderId,
        actionType: "EXTERNAL_NOTIFICATION",
        status: "FAILED",
        createdEntityType: "AUTO_EXTERNAL_NOTIFICATION",
        metadata: { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" } as Prisma.InputJsonValue,
      },
    })
  }
}

function dedupeKey(clientId: string, candidate: ReminderCandidate) {
  return [
    clientId,
    candidate.ruleCode,
    candidate.sourceEntityType ?? "CLIENT",
    candidate.sourceEntityId ?? clientId,
  ].join(":")
}

async function auditReminder({
  organizationId,
  reminderId,
  eventType,
  userId,
  oldValue,
  newValue,
}: {
  organizationId: string
  reminderId: string
  eventType: string
  userId?: string | null
  oldValue?: unknown
  newValue?: unknown
}) {
  await prisma.smartReminderAuditLog.create({
    data: {
      organizationId,
      reminderId,
      eventType,
      userId,
      oldValue: oldValue as Prisma.InputJsonValue,
      newValue: newValue as Prisma.InputJsonValue,
    },
  })
}

export async function ensureDefaultSmartReminderRules({ organizationId }: { organizationId: string }) {
  const results = []
  for (const [code, name, category, sourceEntityType, priority, offset] of DEFAULT_RULES) {
    results.push(await prisma.smartReminderRule.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name, category, sourceEntityType, defaultPriority: priority, defaultDueOffsetDays: offset, active: true },
      create: {
        organizationId,
        code,
        name,
        category,
        sourceEntityType,
        defaultPriority: priority,
        defaultDueOffsetDays: offset,
        description: `Règle native du moteur de rappels intelligents: ${name}.`,
        conditionConfig: { native: true, code },
        actionConfig: { createReminder: true, canCreateTask: true },
      },
    }))
  }
  return results
}

async function enabledRules(organizationId: string) {
  await ensureDefaultSmartReminderRules({ organizationId })
  const rules = await prisma.smartReminderRule.findMany({ where: { organizationId, active: true } })
  return new Map(rules.map((rule) => [rule.code, rule]))
}

async function upsertReminder({
  organizationId,
  clientId,
  advisorId,
  candidate,
  ruleId,
  userId,
  request,
}: {
  organizationId: string
  clientId: string
  advisorId?: string | null
  candidate: ReminderCandidate
  ruleId?: string | null
  userId?: string | null
  request?: Request
}) {
  const key = dedupeKey(clientId, candidate)
  const score = priorityScore(candidate)
  const data = {
    clientId,
    advisorId: advisorId ?? null,
    ruleId: ruleId ?? null,
    title: candidate.title,
    description: candidate.description ?? null,
    reason: candidate.reason,
    category: candidate.category,
    priority: candidate.priority,
    status: "OPEN",
    dueDate: candidate.dueDate ?? addDays(candidate.priority === "CRITICAL" ? 2 : candidate.priority === "HIGH" ? 7 : 14),
    sourceEntityType: candidate.sourceEntityType ?? null,
    sourceEntityId: candidate.sourceEntityId ?? null,
    recommendedAction: candidate.recommendedAction,
    actionUrl: candidate.actionUrl ?? `/clients/${clientId}`,
    priorityScore: score,
    urgencyScore: candidate.urgencyScore,
    riskScore: candidate.riskScore,
    commercialScore: candidate.commercialScore,
    relationshipScore: candidate.relationshipScore,
    metadata: (candidate.metadata ?? {}) as Prisma.InputJsonValue,
  }

  const existing = await prisma.smartReminder.findUnique({ where: { organizationId_dedupeKey: { organizationId, dedupeKey: key } } })
  if (existing) {
    if (!OPEN_STATUSES.includes(existing.status)) return { reminder: existing, created: false, updated: false }
    const reminder = await prisma.smartReminder.update({ where: { id: existing.id }, data })
    await auditReminder({ organizationId, reminderId: reminder.id, eventType: "REMINDER_REFRESHED", userId, oldValue: existing, newValue: data })
    return { reminder, created: false, updated: true }
  }

  const reminder = await prisma.smartReminder.create({
    data: {
      organizationId,
      dedupeKey: key,
      ...data,
    },
  })
  await auditReminder({ organizationId, reminderId: reminder.id, eventType: "REMINDER_CREATED", userId, newValue: data })
  if (["HIGH", "CRITICAL"].includes(candidate.priority)) {
    await createNotification({
      organizationId,
      userId: advisorId ?? userId ?? undefined,
      type: candidate.priority === "CRITICAL" ? "ALERT" : "CLIENT_REVIEW_DUE",
      priority: candidate.priority === "CRITICAL" ? "URGENT" : "HIGH",
      title: candidate.priority === "CRITICAL" ? "Rappel intelligent critique" : "Rappel intelligent prioritaire",
      message: candidate.title,
      actionLabel: "Ouvrir rappel",
      actionUrl: "/rappels-intelligents",
      entityType: "SmartReminder",
      entityId: reminder.id,
      clientId,
      metadata: { ruleCode: candidate.ruleCode, category: candidate.category },
    })
  }
  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "SmartReminder",
    entityId: reminder.id,
    action: "SMART_REMINDER_CREATED",
    source: "system",
    sensitivityLevel: candidate.priority === "CRITICAL" ? "HIGH" : "MEDIUM",
    newValue: { title: reminder.title, reason: reminder.reason, priority: reminder.priority, ruleCode: candidate.ruleCode },
    request,
  })
  await maybeAutoNotifyExternalChannels({ organizationId, reminderId: reminder.id, priority: candidate.priority, userId })
  return { reminder, created: true, updated: false }
}

async function createGroupedClientReview({
  organizationId,
  clientId,
  advisorId,
  userId,
  request,
  candidates,
  ruleId,
}: {
  organizationId: string
  clientId: string
  advisorId?: string | null
  userId?: string | null
  request?: Request
  candidates: ReminderCandidate[]
  ruleId?: string | null
}) {
  const significant = candidates.filter((candidate) => candidate.priority !== "LOW")
  if (significant.length < 3) return null
  const top = significant
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 6)
  const candidate: ReminderCandidate = {
    ruleCode: "CLIENT_COMPREHENSIVE_REVIEW",
    title: "Revue client complète recommandée",
    reason: top.map((item) => `- ${item.title}: ${item.reason}`).join("\n"),
    description: "Plusieurs signaux importants sont actifs dans le dossier. Le CRM les regroupe pour éviter la fatigue des rappels.",
    category: "RELATION",
    priority: top.some((item) => item.priority === "CRITICAL") ? "CRITICAL" : "HIGH",
    dueDate: addDays(top.some((item) => item.priority === "CRITICAL") ? 3 : 7),
    sourceEntityType: "CLIENT",
    sourceEntityId: clientId,
    recommendedAction: "Planifier une revue client complète, mettre à jour le KYC, traiter les alertes et convertir les sous-actions pertinentes en tâches.",
    actionUrl: `/clients/${clientId}?tab=reminders`,
    urgencyScore: Math.max(...top.map((item) => item.urgencyScore), 0),
    riskScore: Math.max(...top.map((item) => item.riskScore), 0),
    commercialScore: Math.max(...top.map((item) => item.commercialScore), 0),
    relationshipScore: 15,
    metadata: { groupedRuleCodes: top.map((item) => item.ruleCode), groupedCount: significant.length },
  }
  return upsertReminder({ organizationId, clientId, advisorId, candidate, ruleId, userId, request })
}

async function collectClientCandidates({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      products: true,
      kycProfile: true,
      investmentProfile: true,
      consents: true,
      documents: true,
      noteItems: { orderBy: { createdAt: "desc" }, take: 10 },
      amlProfile: true,
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const candidates: ReminderCandidate[] = []
  const name = `${client.firstName} ${client.lastName}`.trim()
  const lastMeetingNote = client.noteItems[0]
  const activeProducts = client.products.filter((product) => product.status === "ACTIVE")
  const employment = normalizeText(client.employmentStatus)
  const familyStatus = normalizeText(client.familyStatus)

  for (const product of activeProducts) {
    const maturityDays = daysUntil(product.maturityAt)
    const renewalDays = daysUntil(product.renewalAt)
    const label = product.productName ?? product.policyNumber ?? product.type
    const isInsurance = product.category === "INSURANCE"
    if (isInsurance && product.type === "LIFE_INSURANCE" && maturityDays !== null && maturityDays >= 0 && maturityDays <= 730) {
      candidates.push({
        ruleCode: "POLICY_TERM_EXPIRY_24M",
        title: "Police temporaire à revoir",
        reason: `${label} arrive à échéance dans ${maturityDays} jours. Une revue du besoin doit être planifiée avant toute décision de maintien, conversion ou remplacement.`,
        description: "Détection automatique d'une échéance de protection vie dans les 24 mois.",
        category: "ASSURANCE",
        priority: maturityDays <= 365 ? "HIGH" : "NORMAL",
        dueDate: addDays(maturityDays <= 365 ? 7 : 30),
        sourceEntityType: "FINANCIAL_PRODUCT",
        sourceEntityId: product.id,
        recommendedAction: "Planifier une revue d’assurance vie, mettre à jour le KYC et lancer l’analyse des besoins.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: maturityDays <= 180 ? 20 : 10,
        riskScore: client.dependents || client.hasChildren ? 10 : 5,
        commercialScore: Number(product.coverageAmount ?? 0) >= 500000 ? 10 : 5,
        relationshipScore: 0,
        metadata: { maturityAt: product.maturityAt, coverageAmount: product.coverageAmount },
      })
    }
    if (isInsurance && renewalDays !== null && renewalDays >= 0 && renewalDays <= 180) {
      candidates.push({
        ruleCode: "POLICY_RENEWAL_6M",
        title: "Renouvellement de police à préparer",
        reason: `${label} renouvelle dans ${renewalDays} jours. Le conseiller doit revoir le besoin, le budget et les options avant renouvellement.`,
        category: "ASSURANCE",
        priority: renewalDays <= 30 ? "CRITICAL" : "HIGH",
        dueDate: addDays(renewalDays <= 30 ? 1 : 7),
        sourceEntityType: "FINANCIAL_PRODUCT",
        sourceEntityId: product.id,
        recommendedAction: "Créer une tâche de suivi, comparer les options et documenter la décision client.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: renewalDays <= 30 ? 25 : 15,
        riskScore: 8,
        commercialScore: 6,
        relationshipScore: 0,
        metadata: { renewalAt: product.renewalAt },
      })
    }
    if (isInsurance && monthsBetweenOlderThan(product.lastReviewAt, 36) && (product.primaryBeneficiary || product.contingentBeneficiary)) {
      candidates.push({
        ruleCode: "BENEFICIARY_REVIEW_36M",
        title: "Bénéficiaires à revoir",
        reason: `${label} contient une désignation bénéficiaire et n’a pas été revu depuis plus de 36 mois.`,
        category: "ASSURANCE",
        priority: client.familyStatus?.toLowerCase().includes("divorc") || client.familyStatus?.toLowerCase().includes("sépar") ? "HIGH" : "NORMAL",
        dueDate: addDays(14),
        sourceEntityType: "FINANCIAL_PRODUCT",
        sourceEntityId: product.id,
        recommendedAction: "Valider les bénéficiaires, l’état civil et les objectifs successoraux.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 5,
        riskScore: 10,
        commercialScore: 2,
        relationshipScore: 5,
      })
    }
    if (isInsurance && product.type === "GROUP_INSURANCE" && (monthsBetweenOlderThan(product.lastReviewAt, 12) || renewalDays !== null && renewalDays <= 180)) {
      candidates.push({
        ruleCode: "GROUP_INSURANCE_REVIEW",
        title: "Assurance collective à revoir",
        reason: `${label} doit être revue: régime collectif, protections vie/invalidité, maximums et coordination avec les protections personnelles.`,
        category: "ASSURANCE",
        priority: "HIGH",
        dueDate: addDays(7),
        sourceEntityType: "FINANCIAL_PRODUCT",
        sourceEntityId: product.id,
        recommendedAction: "Demander ou valider la brochure collective et comparer les protections avec les besoins actuels.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 8,
        riskScore: 12,
        commercialScore: 5,
        relationshipScore: 4,
        metadata: { renewalAt: product.renewalAt, lastReviewAt: product.lastReviewAt },
      })
    }
  }

  if (client.kycProfile && (client.kycProfile.nextKycReviewAt && client.kycProfile.nextKycReviewAt <= addDays(30) || monthsBetweenOlderThan(client.kycProfile.lastKycReviewAt, 24))) {
    candidates.push({
      ruleCode: "KYC_REVIEW_DUE",
      title: "KYC à mettre à jour",
      reason: `Le profil KYC de ${name} est dû ou n’a pas été revu depuis plus de 24 mois.`,
      category: "KYC",
      priority: "CRITICAL",
      dueDate: addDays(3),
      sourceEntityType: "KYC_PROFILE",
      sourceEntityId: client.kycProfile.id,
      recommendedAction: "Demander une confirmation client et verrouiller une nouvelle version KYC avant toute recommandation.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 20,
      riskScore: 20,
      commercialScore: 0,
      relationshipScore: 0,
    })
  }

  const investmentReviewDate = client.investmentProfile?.advisorValidatedAt ?? client.investmentProfile?.clientConfirmedAt
  if (client.investmentProfile && monthsBetweenOlderThan(investmentReviewDate, 24)) {
    candidates.push({
      ruleCode: "INVESTMENT_PROFILE_REVIEW",
      title: "Profil investisseur à revoir",
      reason: "Le profil investisseur n’a pas été confirmé récemment. Une recommandation placement pourrait exiger une mise à jour.",
      category: "PLACEMENT",
      priority: "CRITICAL",
      dueDate: addDays(7),
      sourceEntityType: "INVESTMENT_PROFILE",
      sourceEntityId: client.investmentProfile.id,
      recommendedAction: "Mettre à jour objectifs, horizon, liquidité, tolérance et capacité de risque.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 12,
      riskScore: 18,
      commercialScore: 0,
      relationshipScore: 0,
    })
  }

  for (const consent of client.consents) {
    const expiryDays = daysUntil(consent.expiresAt)
    if (consent.status === "EXPIRED" || consent.status === "REVOKED" || expiryDays !== null && expiryDays <= 30) {
      candidates.push({
        ruleCode: "CONSENT_EXPIRING_30D",
        title: "Consentement à renouveler",
        reason: `Consentement ${consent.type} ${consent.status === "GIVEN" ? `expire dans ${expiryDays} jours` : `est ${consent.status}`}.`,
        category: "CONFORMITE",
        priority: "CRITICAL",
        dueDate: addDays(2),
        sourceEntityType: "CONSENT",
        sourceEntityId: consent.id,
        recommendedAction: "Renouveler le consentement ou bloquer les actions liées à cette finalité.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 20,
        riskScore: 20,
        commercialScore: 0,
        relationshipScore: 0,
      })
    }
  }

  if (client.amlProfile && (client.amlProfile.riskLevel === "HIGH" || client.amlProfile.status === "BLOCKED" || client.amlProfile.nextReviewAt && client.amlProfile.nextReviewAt <= addDays(30))) {
    candidates.push({
      ruleCode: "AML_REVIEW_DUE",
      title: "Revue AML / LBA-FAT requise",
      reason: `Statut AML ${client.amlProfile.status}, niveau ${client.amlProfile.riskLevel}. Une revue est requise ou approche.`,
      category: "AML",
      priority: client.amlProfile.status === "BLOCKED" ? "CRITICAL" : "HIGH",
      dueDate: addDays(2),
      sourceEntityType: "AML_PROFILE",
      sourceEntityId: client.amlProfile.id,
      recommendedAction: "Revoir alertes AML, sanctions, PPV/DOI, sources des fonds et décisions conformité.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 20,
      riskScore: 25,
      commercialScore: 0,
      relationshipScore: 0,
    })
  }

  for (const document of client.documents) {
    const expiryDays = daysUntil(document.expiresAt)
    const missingRequired = document.isRequired && !document.receivedAt && (!document.requiredBy || document.requiredBy <= addDays(14))
    if (missingRequired || expiryDays !== null && expiryDays <= 30) {
      candidates.push({
        ruleCode: "DOCUMENT_EXPIRING_OR_MISSING",
        title: missingRequired ? "Document obligatoire manquant" : "Document à renouveler",
        reason: missingRequired ? `${document.name} est requis et non reçu.` : `${document.name} expire dans ${expiryDays} jours.`,
        category: "DOCUMENTS",
        priority: missingRequired ? "HIGH" : "NORMAL",
        dueDate: addDays(missingRequired ? 5 : 14),
        sourceEntityType: "DOCUMENT",
        sourceEntityId: document.id,
        recommendedAction: "Créer une demande de document client et fermer le rappel à la réception/validation.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: missingRequired ? 12 : 6,
        riskScore: missingRequired ? 12 : 6,
        commercialScore: 0,
        relationshipScore: 0,
      })
    }
  }

  if (client.dateOfBirth) {
    const age = ageOn(client.dateOfBirth)
    if (age === 64 || age === 65) {
      candidates.push({
        ruleCode: "AGE_65_RETIREMENT_REVIEW",
        title: "Revue retraite autour de 65 ans",
        reason: `${name} a ${age} ans. Revoir revenus de retraite, décaissement, protections et objectifs.`,
        category: "PLACEMENT",
        priority: "HIGH",
        dueDate: addDays(30),
        sourceEntityType: "CLIENT",
        sourceEntityId: client.id,
        recommendedAction: "Planifier une revue retraite et mettre à jour le KYC.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 8,
        riskScore: 8,
        commercialScore: 6,
        relationshipScore: 5,
      })
    }
    if (age === 70 || age === 71) {
      candidates.push({
        ruleCode: "AGE_71_RRSP_REVIEW",
        title: "Échéance REER / FERR à gérer",
        reason: `${name} a ${age} ans. Préparer les options REER/FERR/rente et la décision avant l’échéance applicable.`,
        category: "FISCALITE",
        priority: "CRITICAL",
        dueDate: addDays(7),
        sourceEntityType: "CLIENT",
        sourceEntityId: client.id,
        recommendedAction: "Vérifier comptes REER, préparer options FERR/rente/retrait et documenter la décision.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 20,
        riskScore: 18,
        commercialScore: 5,
        relationshipScore: 5,
      })
    }
  }

  if (client.isSelfEmployed || employment.includes("autonome") || employment.includes("entrepreneur")) {
    candidates.push({
      ruleCode: "EMPLOYMENT_SELF_EMPLOYED_REVIEW",
      title: "Protection travailleur autonome à revoir",
      reason: `${name} est identifié comme travailleur autonome ou entrepreneur. Les protections collectives, invalidité, revenu et capacité de prime doivent être revues.`,
      category: "ASSURANCE",
      priority: "HIGH",
      dueDate: addDays(7),
      sourceEntityType: "CLIENT",
      sourceEntityId: client.id,
      recommendedAction: "Mettre à jour l’emploi, vérifier l’assurance collective perdue ou absente et lancer une revue invalidité/vie.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 8,
      riskScore: 14,
      commercialScore: 8,
      relationshipScore: 5,
    })
  }

  if (familyStatus.includes("divorc") || familyStatus.includes("separ")) {
    candidates.push({
      ruleCode: "DIVORCE_SEPARATION_REVIEW",
      title: "Revue post-séparation urgente",
      reason: `${name} a un état civil indiquant une séparation ou un divorce. Les bénéficiaires, autorisations, budget, objectifs et protections doivent être revus.`,
      category: "RELATION",
      priority: "CRITICAL",
      dueDate: addDays(3),
      sourceEntityType: "CLIENT",
      sourceEntityId: client.id,
      recommendedAction: "Planifier une revue post-séparation, vérifier bénéficiaires, accès, consentements, KYC et besoins d’assurance.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 18,
      riskScore: 20,
      commercialScore: 4,
      relationshipScore: 10,
    })
  }

  for (const birthdate of childBirthdates(client.children)) {
    const childAge = ageOn(birthdate)
    if (childAge === 17 || childAge === 18) {
      candidates.push({
        ruleCode: "CHILD_18_REVIEW",
        title: "Enfant atteint 18 ans",
        reason: `Un enfant au dossier a ${childAge} ans. Revoir bénéficiaires, dépendance financière, REEE, autorisations et besoins familiaux.`,
        category: "FAMILY",
        priority: "HIGH",
        dueDate: addDays(14),
        sourceEntityType: "CLIENT",
        sourceEntityId: client.id,
        recommendedAction: "Planifier une revue familiale et mettre à jour le KYC du ménage.",
        actionUrl: `/clients/${client.id}`,
        urgencyScore: 6,
        riskScore: 8,
        commercialScore: 6,
        relationshipScore: 8,
        metadata: { childBirthdate: birthdate.toISOString().slice(0, 10), childAge },
      })
      break
    }
  }

  if ((client.liabilities ?? 0) >= 100000) {
    candidates.push({
      ruleCode: "MORTGAGE_DEBT_REVIEW",
      title: "Hypothèque ou dette importante à revoir",
      reason: `${name} a des passifs importants au dossier (${Math.round(client.liabilities ?? 0).toLocaleString("fr-CA")} $). L’analyse d’assurance vie, invalidité, budget et capacité de paiement devrait être revue.`,
      category: "ASSURANCE",
      priority: "HIGH",
      dueDate: addDays(14),
      sourceEntityType: "CLIENT",
      sourceEntityId: client.id,
      recommendedAction: "Demander les détails de dette ou relevé hypothécaire, puis mettre à jour l’analyse des besoins.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 6,
      riskScore: 14,
      commercialScore: 8,
      relationshipScore: 4,
      metadata: { liabilities: client.liabilities },
    })
  }

  const recentLifeEventNote = client.noteItems.find((note) => {
    const text = normalizeText(`${note.title ?? ""} ${note.content ?? ""}`)
    return ["naissance", "bebe", "enfant", "mariage", "marie", "divorce", "separation", "nouvel emploi", "perte emploi", "retraite", "hypotheque"].some((keyword) => text.includes(keyword))
  })
  if (recentLifeEventNote) {
    candidates.push({
      ruleCode: "NOTE_LIFE_EVENT_DETECTED",
      title: "Événement de vie détecté dans une note",
      reason: `Une note récente semble mentionner un événement de vie important: "${recentLifeEventNote.title ?? "Note client"}".`,
      category: "RELATION",
      priority: "HIGH",
      dueDate: addDays(7),
      sourceEntityType: "NOTE",
      sourceEntityId: recentLifeEventNote.id,
      recommendedAction: "Valider l’événement, mettre à jour le KYC et créer les actions pertinentes.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 8,
      riskScore: 10,
      commercialScore: 6,
      relationshipScore: 8,
      metadata: { noteId: recentLifeEventNote.id, detectedBy: "keyword_context_detector" },
    })
  }

  if (!lastMeetingNote || monthsBetweenOlderThan(lastMeetingNote.createdAt, 12)) {
    candidates.push({
      ruleCode: "NO_MEETING_NOTE_12M",
      title: "Revue client annuelle à planifier",
      reason: !lastMeetingNote ? "Aucune note de rencontre au dossier." : `Dernière note de rencontre il y a plus de 12 mois (${lastMeetingNote.createdAt.toISOString().slice(0, 10)}).`,
      category: "RELATION",
      priority: activeProducts.length > 0 ? "NORMAL" : "LOW",
      dueDate: addDays(14),
      sourceEntityType: "CLIENT",
      sourceEntityId: client.id,
      recommendedAction: "Planifier une rencontre annuelle et documenter la note de suivi.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: 4,
      riskScore: 4,
      commercialScore: activeProducts.length > 0 ? 5 : 0,
      relationshipScore: 12,
    })
  }

  return { client, candidates }
}

export async function evaluateSmartRemindersForClient({
  organizationId,
  clientId,
  userId,
  request,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  request?: Request
}) {
  const rules = await enabledRules(organizationId)
  const { client, candidates } = await collectClientCandidates({ organizationId, clientId })
  let created = 0
  let updated = 0
  const activeKeys = new Set<string>()
  const reminders = []

  for (const candidate of candidates) {
    const rule = rules.get(candidate.ruleCode)
    if (!rule) continue
    activeKeys.add(dedupeKey(clientId, candidate))
    const result = await upsertReminder({
      organizationId,
      clientId,
      advisorId: client.advisorId,
      candidate,
      ruleId: rule.id,
      userId,
      request,
    })
    if (result.created) created += 1
    if (result.updated) updated += 1
    reminders.push(result.reminder)
  }

  const groupedRule = rules.get("CLIENT_COMPREHENSIVE_REVIEW")
  const grouped = groupedRule
    ? await createGroupedClientReview({ organizationId, clientId, advisorId: client.advisorId, candidates, ruleId: groupedRule.id, userId, request })
    : null
  if (grouped) {
    activeKeys.add(`${clientId}:CLIENT_COMPREHENSIVE_REVIEW:CLIENT:${clientId}`)
    if (grouped.created) created += 1
    if (grouped.updated) updated += 1
    reminders.push(grouped.reminder)
  }

  const stale = await prisma.smartReminder.updateMany({
    where: {
      organizationId,
      clientId,
      status: { in: OPEN_STATUSES },
      dedupeKey: { notIn: Array.from(activeKeys) },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNote: "Résolu automatiquement: la condition de rappel n’est plus active.",
    },
  })

  return { evaluated: candidates.length, created, updated, resolved: stale.count, reminders }
}

export async function runSmartReminderEngine({
  organizationId,
  userId,
  request,
  clientId,
}: {
  organizationId: string
  userId?: string | null
  request?: Request
  clientId?: string
}) {
  const clients = clientId
    ? await prisma.client.findMany({ where: { id: clientId, organizationId }, select: { id: true } })
    : await prisma.client.findMany({ where: { organizationId, status: { not: "ARCHIVED" } }, select: { id: true } })

  let created = 0
  let updated = 0
  let resolved = 0
  let evaluated = 0
  for (const client of clients) {
    const result = await evaluateSmartRemindersForClient({ organizationId, clientId: client.id, userId, request })
    created += result.created
    updated += result.updated
    resolved += result.resolved
    evaluated += result.evaluated
  }
  return { clients: clients.length, evaluated, created, updated, resolved }
}

export async function getSmartReminderDashboard({ organizationId, advisorId }: { organizationId: string; advisorId?: string }) {
  const today = new Date()
  const week = addDays(7)
  const where = { organizationId, status: { in: OPEN_STATUSES }, ...(advisorId ? { advisorId } : {}) }
  const [open, todayCount, weekCount, overdue, critical, important, byCategory, reminders] = await Promise.all([
    prisma.smartReminder.count({ where }),
    prisma.smartReminder.count({ where: { ...where, dueDate: { lte: today } } }),
    prisma.smartReminder.count({ where: { ...where, dueDate: { lte: week } } }),
    prisma.smartReminder.count({ where: { ...where, dueDate: { lt: today } } }),
    prisma.smartReminder.count({ where: { ...where, priority: "CRITICAL" } }),
    prisma.smartReminder.count({ where: { ...where, priority: "HIGH" } }),
    prisma.smartReminder.groupBy({ by: ["category"], where, _count: { _all: true } }),
    prisma.smartReminder.findMany({
      where,
      include: { client: { select: { id: true, firstName: true, lastName: true } }, advisor: { select: { id: true, name: true } }, task: { select: { id: true, status: true } } },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
      take: 100,
    }),
  ])
  return { summary: { open, today: todayCount, thisWeek: weekCount, overdue, critical, important }, byCategory, reminders }
}

export async function getSmartReminderReport({ organizationId, advisorId }: { organizationId: string; advisorId?: string }) {
  const where = { organizationId, ...(advisorId ? { advisorId } : {}) }
  const [summary, byStatus, byPriority, byCategory, overdueByAdvisor] = await Promise.all([
    getSmartReminderDashboard({ organizationId, advisorId }),
    prisma.smartReminder.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.smartReminder.groupBy({ by: ["priority"], where, _count: { _all: true } }),
    prisma.smartReminder.groupBy({ by: ["category"], where, _count: { _all: true } }),
    prisma.smartReminder.findMany({
      where: { ...where, status: { in: OPEN_STATUSES }, dueDate: { lt: new Date() } },
      include: { advisor: { select: { id: true, name: true } }, client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 250,
    }),
  ])
  return { summary: summary.summary, byStatus, byPriority, byCategory, overdueByAdvisor }
}

export async function sendSmartReminderDigest({ organizationId, userId, advisorId }: { organizationId: string; userId?: string | null; advisorId?: string }) {
  const advisors = advisorId
    ? await prisma.user.findMany({ where: { id: advisorId, organizationId }, select: { id: true, name: true, email: true } })
    : await prisma.user.findMany({
        where: {
          organizationId,
          assignedSmartReminders: { some: { status: { in: OPEN_STATUSES } } },
        },
        select: { id: true, name: true, email: true },
        take: 250,
      })

  const deliveries = []
  for (const advisor of advisors) {
    const reminders = await prisma.smartReminder.findMany({
      where: { organizationId, advisorId: advisor.id, status: { in: OPEN_STATUSES } },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
      take: 15,
    })
    if (reminders.length === 0) continue

    const urgent = reminders.filter((reminder) => reminder.priority === "CRITICAL").length
    const subject = `Digest rappels intelligents - ${reminders.length} action(s)`
    const text = [
      `Bonjour ${advisor.name ?? ""}`.trim() + ",",
      "",
      `Voici les rappels intelligents prioritaires à traiter. Critiques: ${urgent}.`,
      "",
      ...reminders.map((reminder, index) => `${index + 1}. ${reminder.title} - ${reminder.client.firstName} ${reminder.client.lastName} - ${reminder.reason}`),
      "",
      "Ouvrir le CRM: /rappels-intelligents",
    ].join("\n")

    const notification = await createNotification({
      organizationId,
      userId: advisor.id,
      type: urgent > 0 ? "ALERT" : "CLIENT_REVIEW_DUE",
      priority: urgent > 0 ? "URGENT" : "HIGH",
      title: subject,
      message: `${reminders.length} rappel(s) ouvert(s), dont ${urgent} critique(s).`,
      actionLabel: "Ouvrir rappels",
      actionUrl: "/rappels-intelligents",
      entityType: "SmartReminderDigest",
      entityId: advisor.id,
      metadata: { reminderIds: reminders.map((reminder) => reminder.id), channel: "CRM_DIGEST" },
    })

    const email = advisor.email
      ? await sendAdvisorGmailEmail({
          organizationId,
          userId: advisor.id,
          to: advisor.email,
          subject,
          text,
        }).catch(() => null)
      : null

    deliveries.push({ advisorId: advisor.id, notificationId: notification.id, email })
    await prisma.smartReminderAction.createMany({
      data: reminders.map((reminder) => ({
        organizationId,
        reminderId: reminder.id,
        actionType: "DIGEST_NOTIFICATION",
        status: email ? "SENT" : "CREATED",
        createdEntityType: email ? "GmailMessage" : "Notification",
        createdEntityId: email?.id ?? notification.id,
        metadata: { notificationId: notification.id, emailProvider: email?.provider ?? null } as Prisma.InputJsonValue,
      })),
    })
  }

  await createAuditLog({
    organizationId,
    userId,
    entityType: "SmartReminderDigest",
    entityId: advisorId ?? "all",
    action: "SMART_REMINDER_DIGEST_SENT",
    source: "system",
    sensitivityLevel: "LOW",
    newValue: { deliveries: deliveries.length },
  })
  return { advisors: advisors.length, deliveries }
}

export async function extractNoteEventsForSmartReminders({ organizationId, userId, clientId }: { organizationId: string; userId: string; clientId?: string }) {
  const notes = await prisma.note.findMany({
    where: { organizationId, ...(clientId ? { clientId } : { clientId: { not: null } }), status: { not: "DELETED" } },
    select: { id: true, clientId: true, title: true, content: true, client: { select: { advisorId: true } } },
    orderBy: { createdAt: "desc" },
    take: clientId ? 25 : 100,
  })
  const extraction = await runAI({
    organizationId,
    userId,
    feature: "smart-reminder-note-event-extraction",
    prompt: "Détecte uniquement les événements de vie explicites qui justifient un rappel CRM. Retourne du JSON strict. N’invente rien.",
    schema: noteEventExtractionSchema,
    context: { notes: notes.map((note) => ({ id: note.id, title: note.title, content: note.content?.slice(0, 1200) })) },
    fallback: () => fallbackNoteEvents(notes),
  })

  const rules = await enabledRules(organizationId)
  const rule = rules.get("NOTE_LIFE_EVENT_DETECTED")
  if (!rule) return { extracted: extraction.events.length, created: 0, updated: 0, events: extraction.events }

  let created = 0
  let updated = 0
  for (const event of extraction.events) {
    const note = notes.find((item) => item.id === event.noteId)
    if (!note?.clientId) continue
    const result = await upsertReminder({
      organizationId,
      clientId: note.clientId,
      advisorId: note.client?.advisorId,
      ruleId: rule.id,
      userId,
      candidate: {
        ruleCode: "NOTE_LIFE_EVENT_DETECTED",
        title: `Événement de vie détecté: ${event.eventType}`,
        reason: event.rationale,
        description: "Analyse IA/fallback des notes client.",
        category: "RELATION",
        priority: event.priority,
        dueDate: addDays(event.priority === "CRITICAL" ? 3 : 7),
        sourceEntityType: "NOTE",
        sourceEntityId: note.id,
        recommendedAction: event.recommendedAction,
        actionUrl: `/clients/${note.clientId}?tab=reminders`,
        urgencyScore: event.priority === "CRITICAL" ? 18 : 10,
        riskScore: event.eventType === "DIVORCE" ? 20 : 10,
        commercialScore: ["BIRTH", "JOB_CHANGE", "MORTGAGE", "RETIREMENT"].includes(event.eventType) ? 8 : 4,
        relationshipScore: 10,
        metadata: { eventType: event.eventType, confidence: event.confidence, extractor: "ai_or_fallback" },
      },
    })
    if (result.created) created += 1
    if (result.updated) updated += 1
  }
  return { extracted: extraction.events.length, created, updated, events: extraction.events }
}

export async function listSmartReminders({ organizationId, clientId, status }: { organizationId: string; clientId?: string; status?: string }) {
  return prisma.smartReminder.findMany({
    where: {
      organizationId,
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : { status: { in: OPEN_STATUSES } }),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } }, advisor: { select: { id: true, name: true } }, task: { select: { id: true, status: true, title: true } } },
    orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })
}

export async function completeSmartReminder({ organizationId, reminderId, userId, note }: { organizationId: string; reminderId: string; userId?: string | null; note?: string }) {
  const existing = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId } })
  if (!existing) throw new Error("REMINDER_NOT_FOUND")
  const reminder = await prisma.smartReminder.update({
    where: { id: reminderId },
    data: { status: "COMPLETED", resolvedAt: new Date(), resolvedById: userId ?? null, resolutionNote: note ?? "Rappel complété." },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_COMPLETED", userId, oldValue: existing, newValue: reminder })
  return reminder
}

export async function ignoreSmartReminder({ organizationId, reminderId, userId, reason }: { organizationId: string; reminderId: string; userId?: string | null; reason: string }) {
  const existing = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId } })
  if (!existing) throw new Error("REMINDER_NOT_FOUND")
  if (!reason.trim()) throw new Error("REMINDER_IGNORE_REASON_REQUIRED")
  const reminder = await prisma.smartReminder.update({
    where: { id: reminderId },
    data: { status: "IGNORED", ignoredAt: new Date(), ignoredById: userId ?? null, ignoredReason: reason, resolutionNote: reason },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_IGNORED", userId, oldValue: existing, newValue: reminder })
  return reminder
}

export async function snoozeSmartReminder({ organizationId, reminderId, userId, snoozedUntil, reason }: { organizationId: string; reminderId: string; userId?: string | null; snoozedUntil: Date; reason: string }) {
  const existing = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId } })
  if (!existing) throw new Error("REMINDER_NOT_FOUND")
  const reminder = await prisma.smartReminder.update({ where: { id: reminderId }, data: { status: "SNOOZED", snoozedUntil } })
  await prisma.smartReminderSnooze.create({ data: { organizationId, reminderId, snoozedById: userId ?? null, snoozedUntil, reason } })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_SNOOZED", userId, oldValue: existing, newValue: { snoozedUntil, reason } })
  return reminder
}

export async function createTaskFromSmartReminder({ organizationId, reminderId, userId }: { organizationId: string; reminderId: string; userId?: string | null }) {
  const reminder = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId }, include: { client: true } })
  if (!reminder) throw new Error("REMINDER_NOT_FOUND")
  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId: reminder.clientId,
      assignedToId: reminder.advisorId ?? userId ?? undefined,
      createdById: userId ?? undefined,
      type: reminder.category === "KYC" ? "KYC" : reminder.category === "DOCUMENTS" ? "DOCUMENT" : reminder.category === "ASSURANCE" ? "PRODUCT_REVIEW" : "FOLLOW_UP",
      title: reminder.title,
      description: `${reminder.reason}\n\nAction recommandée: ${reminder.recommendedAction ?? "À déterminer."}`,
      priority: toTaskPriority(reminder.priority),
      dueDate: reminder.dueDate,
      isAutomated: true,
      reminderAt: reminder.dueDate,
    },
  })
  const updated = await prisma.smartReminder.update({ where: { id: reminder.id }, data: { taskId: task.id, status: "IN_PROGRESS" } })
  await prisma.smartReminderAction.create({
    data: {
      organizationId,
      reminderId: reminder.id,
      actionType: "TASK",
      status: "CREATED",
      createdEntityType: "Task",
      createdEntityId: task.id,
      metadata: { title: task.title } as Prisma.InputJsonValue,
    },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_TASK_CREATED", userId, oldValue: reminder, newValue: { taskId: task.id } })
  return { reminder: updated, task }
}

export async function createOpportunityFromSmartReminder({ organizationId, reminderId, userId }: { organizationId: string; reminderId: string; userId?: string | null }) {
  const reminder = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId }, include: { client: true } })
  if (!reminder) throw new Error("REMINDER_NOT_FOUND")
  if (reminder.opportunityId) {
    const existing = await prisma.crossSellOpportunity.findFirst({ where: { id: reminder.opportunityId, organizationId } })
    if (existing) return { reminder, opportunity: existing, existing: true }
  }

  const ruleKey = `smart_reminder:${reminder.dedupeKey}`
  const existing = await prisma.crossSellOpportunity.findFirst({
    where: {
      organizationId,
      clientId: reminder.clientId,
      ruleKey,
      status: { in: ["OPEN", "REVIEWED"] },
    },
  })
  if (existing) {
    const updatedReminder = await prisma.smartReminder.update({ where: { id: reminder.id }, data: { opportunityId: existing.id, status: "IN_PROGRESS" } })
    return { reminder: updatedReminder, opportunity: existing, existing: true }
  }

  const opportunity = await prisma.crossSellOpportunity.create({
    data: {
      organizationId,
      clientId: reminder.clientId,
      advisorId: reminder.advisorId ?? reminder.client.advisorId ?? userId ?? null,
      category: toCrossSellCategory(reminder.category),
      priority: toCrossSellPriority(reminder.priority),
      status: "OPEN",
      title: reminder.title,
      description: reminder.description ?? reminder.reason,
      rationale: reminder.reason,
      actionLabel: "Traiter le rappel",
      actionUrl: reminder.actionUrl ?? `/clients/${reminder.clientId}?tab=reminders`,
      suggestedDiscussionTopic: reminder.recommendedAction ?? undefined,
      relatedProductType: reminder.sourceEntityType ?? undefined,
      relatedProductId: reminder.sourceEntityType === "FINANCIAL_PRODUCT" ? reminder.sourceEntityId : undefined,
      ruleKey,
      confidence: Math.min(0.98, Math.max(0.55, reminder.priorityScore / 100)),
      metadata: {
        smartReminderId: reminder.id,
        smartReminderRuleId: reminder.ruleId,
        sourceEntityType: reminder.sourceEntityType,
        sourceEntityId: reminder.sourceEntityId,
      } as Prisma.InputJsonValue,
    },
  })
  const updated = await prisma.smartReminder.update({ where: { id: reminder.id }, data: { opportunityId: opportunity.id, status: "IN_PROGRESS" } })
  await prisma.smartReminderAction.create({
    data: {
      organizationId,
      reminderId: reminder.id,
      actionType: "OPPORTUNITY",
      status: "CREATED",
      createdEntityType: "CrossSellOpportunity",
      createdEntityId: opportunity.id,
      metadata: { title: opportunity.title } as Prisma.InputJsonValue,
    },
  })
  await prisma.activity.create({
    data: {
      organizationId,
      userId,
      clientId: reminder.clientId,
      type: "CROSS_SELL_CREATED",
      title: "Opportunité créée depuis un rappel",
      description: opportunity.title,
      source: "USER",
      entityType: "CrossSellOpportunity",
      entityId: opportunity.id,
    },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_OPPORTUNITY_CREATED", userId, oldValue: reminder, newValue: { opportunityId: opportunity.id } })
  return { reminder: updated, opportunity, existing: false }
}

function consentDecisionForReminderMessage(consents: Array<{ type: string; status: string; purposeText?: string | null; expiresAt?: Date | null }>, kind: string) {
  const now = new Date()
  const normalizedKind = normalizeText(kind)
  const communicationConsents = consents.filter((consent) => {
    const label = normalizeText(`${consent.type} ${consent.purposeText ?? ""}`)
    return ["communication", "portal", "service", "marketing", "commercial", "courriel", "sms"].some((token) => label.includes(token))
  })
  if (normalizedKind.includes("marketing") || normalizedKind.includes("commercial")) {
    const marketingConsent = communicationConsents.find((consent) => {
      const label = normalizeText(`${consent.type} ${consent.purposeText ?? ""}`)
      return label.includes("marketing") || label.includes("commercial")
    })
    if (!marketingConsent) return { allowed: false, reason: "Consentement marketing/commercial absent." }
    if (marketingConsent.status !== "GIVEN") return { allowed: false, reason: `Consentement marketing/commercial ${marketingConsent.status}.` }
    if (marketingConsent.expiresAt && marketingConsent.expiresAt <= now) return { allowed: false, reason: "Consentement marketing/commercial expiré." }
    return { allowed: true, reason: "Consentement marketing/commercial actif." }
  }
  const revoked = communicationConsents.find((consent) => consent.status === "REVOKED" || consent.status === "EXPIRED" || consent.expiresAt && consent.expiresAt <= now)
  if (revoked) return { allowed: false, reason: `Communication bloquée par consentement ${revoked.type} ${revoked.status}.` }
  return { allowed: true, reason: communicationConsents.length > 0 ? "Aucun retrait de consentement de communication détecté." : "Message de service interne sans consentement marketing requis." }
}

export async function sendClientMessageFromSmartReminder({
  organizationId,
  reminderId,
  userId,
  subject,
  message,
  kind = "SERVICE",
}: {
  organizationId: string
  reminderId: string
  userId?: string | null
  subject?: string
  message?: string
  kind?: string
}) {
  const reminder = await prisma.smartReminder.findFirst({
    where: { id: reminderId, organizationId },
    include: { client: { include: { consents: true } } },
  })
  if (!reminder) throw new Error("REMINDER_NOT_FOUND")

  const decision = consentDecisionForReminderMessage(reminder.client.consents, kind)
  if (!decision.allowed) throw new Error(`CLIENT_MESSAGE_CONSENT_BLOCKED:${decision.reason}`)

  const finalSubject = (subject?.trim() || reminder.title).slice(0, 160)
  const finalMessage = (message?.trim() || [
    "Bonjour,",
    "",
    `Je vous contacte parce qu’un élément important de votre dossier demande une revue: ${reminder.title}.`,
    "",
    reminder.reason,
    "",
    `Action proposée: ${reminder.recommendedAction ?? "Planifier une courte revue de votre dossier."}`,
  ].join("\n")).slice(0, 5000)

  const note = await prisma.note.create({
    data: {
      organizationId,
      userId,
      clientId: reminder.clientId,
      type: "GENERAL",
      visibility: "TEAM",
      title: `Message portail client - ${finalSubject}`,
      content: finalMessage,
    },
  })
  await prisma.activity.create({
    data: {
      organizationId,
      userId,
      clientId: reminder.clientId,
      noteId: note.id,
      type: "NOTE_ADDED",
      title: "Message client préparé depuis un rappel",
      description: finalSubject,
      source: "USER",
      entityType: "SmartReminder",
      entityId: reminder.id,
      metadata: { messageKind: kind, consentDecision: decision.reason } as Prisma.InputJsonValue,
    },
  })
  await prisma.smartReminderAction.create({
    data: {
      organizationId,
      reminderId: reminder.id,
      actionType: "CLIENT_MESSAGE",
      status: "CREATED",
      createdEntityType: "Note",
      createdEntityId: note.id,
      metadata: { subject: finalSubject, kind, consentDecision: decision.reason } as Prisma.InputJsonValue,
    },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_CLIENT_MESSAGE_CREATED", userId, oldValue: reminder, newValue: { noteId: note.id, subject: finalSubject, kind, consentDecision: decision.reason } })
  return { reminder, note, consentDecision: decision }
}

export async function createCalendarEventFromSmartReminder({
  organizationId,
  reminderId,
  userId,
  startAt,
  durationMinutes = 30,
}: {
  organizationId: string
  reminderId: string
  userId?: string | null
  startAt?: Date
  durationMinutes?: number
}) {
  const reminder = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId }, include: { client: true } })
  if (!reminder) throw new Error("REMINDER_NOT_FOUND")
  const advisorId = reminder.advisorId ?? reminder.client.advisorId ?? userId
  if (!advisorId) throw new Error("REMINDER_ADVISOR_REQUIRED")
  const start = startAt ?? reminder.dueDate ?? addDays(1)
  const end = new Date(start.getTime() + Math.max(15, Math.min(durationMinutes, 240)) * 60 * 1000)
  const event = await createAdvisorGoogleCalendarEvent({
    organizationId,
    userId: advisorId,
    summary: `Revue client - ${reminder.client.firstName} ${reminder.client.lastName}`,
    description: `${reminder.title}\n\n${reminder.reason}\n\nAction recommandée: ${reminder.recommendedAction ?? ""}`,
    start,
    end,
    attendeeEmail: reminder.client.emailPrimary ?? reminder.client.email ?? null,
  })
  if (!event) throw new Error("GOOGLE_CALENDAR_NOT_CONNECTED")
  await prisma.smartReminderAction.create({
    data: {
      organizationId,
      reminderId: reminder.id,
      actionType: "CALENDAR_EVENT",
      status: "CREATED",
      createdEntityType: "GoogleCalendarEvent",
      createdEntityId: event.id ?? null,
      metadata: { url: event.url, startAt: start.toISOString(), endAt: end.toISOString() } as Prisma.InputJsonValue,
    },
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_CALENDAR_EVENT_CREATED", userId, oldValue: reminder, newValue: event })
  return { reminder, event }
}

export async function notifyExternalChannelsFromSmartReminder({ organizationId, reminderId, userId }: { organizationId: string; reminderId: string; userId?: string | null }) {
  const reminder = await prisma.smartReminder.findFirst({ where: { id: reminderId, organizationId }, include: { client: true, advisor: true } })
  if (!reminder) throw new Error("REMINDER_NOT_FOUND")
  const text = `Rappel intelligent ${reminder.priority}: ${reminder.title}\nClient: ${reminder.client.firstName} ${reminder.client.lastName}\n${reminder.reason}`
  const deliveries = []
  const settings = await ensureCommunicationSettings(organizationId)
  const slackUrl = settings.smartRemindersSlackWebhookUrl?.trim() || process.env.SMART_REMINDERS_SLACK_WEBHOOK_URL?.trim()
  const teamsUrl = settings.smartRemindersTeamsWebhookUrl?.trim() || process.env.SMART_REMINDERS_TEAMS_WEBHOOK_URL?.trim()
  if (slackUrl) deliveries.push({ channel: "SLACK", result: await postWebhook(slackUrl, { text }) })
  if (teamsUrl) deliveries.push({ channel: "TEAMS", result: await postWebhook(teamsUrl, { text, title: reminder.title }) })
  if (deliveries.length === 0) throw new Error("SMART_REMINDER_EXTERNAL_CHANNELS_NOT_CONFIGURED")
  await prisma.smartReminderAction.createMany({
    data: deliveries.map((delivery) => ({
      organizationId,
      reminderId: reminder.id,
      actionType: "EXTERNAL_NOTIFICATION",
      status: delivery.result.ok ? "SENT" : "FAILED",
      createdEntityType: delivery.channel,
      createdEntityId: `${delivery.result.status}`,
      metadata: delivery as Prisma.InputJsonValue,
    })),
  })
  await auditReminder({ organizationId, reminderId, eventType: "REMINDER_EXTERNAL_CHANNELS_NOTIFIED", userId, oldValue: reminder, newValue: { deliveries } })
  return { reminder, deliveries }
}

export async function testSmartReminderExternalChannels({ organizationId, channel, userId }: { organizationId: string; channel?: "SLACK" | "TEAMS" | "ALL"; userId?: string | null }) {
  const settings = await ensureCommunicationSettings(organizationId)
  const slackUrl = settings.smartRemindersSlackWebhookUrl?.trim() || process.env.SMART_REMINDERS_SLACK_WEBHOOK_URL?.trim()
  const teamsUrl = settings.smartRemindersTeamsWebhookUrl?.trim() || process.env.SMART_REMINDERS_TEAMS_WEBHOOK_URL?.trim()
  const selected = channel ?? "ALL"
  const text = "Test FinAssuro CRM - notifications Slack/Teams des rappels intelligents configurées."
  const deliveries = []

  if ((selected === "ALL" || selected === "SLACK") && slackUrl) {
    deliveries.push({ channel: "SLACK", result: await postWebhook(slackUrl, { text }) })
  }
  if ((selected === "ALL" || selected === "TEAMS") && teamsUrl) {
    deliveries.push({ channel: "TEAMS", result: await postWebhook(teamsUrl, { text, title: "Test rappels intelligents" }) })
  }
  if (deliveries.length === 0) throw new Error("SMART_REMINDER_EXTERNAL_CHANNELS_NOT_CONFIGURED")

  await createAuditLog({
    organizationId,
    entityType: "smart_reminder_channels",
    entityId: organizationId,
    action: "smart_reminder_external_channels_tested",
    userId,
    source: "advisor",
    reason: "Test manuel des webhooks Slack/Teams des rappels intelligents.",
    metadata: {
      channel: selected,
      deliveries: deliveries.map((delivery) => ({
        channel: delivery.channel,
        ok: delivery.result.ok,
        status: delivery.result.status,
      })),
    },
  })

  return { deliveries }
}

export async function closeSmartRemindersForCompletedTask({ organizationId, taskId, userId }: { organizationId: string; taskId: string; userId?: string | null }) {
  const reminders = await prisma.smartReminder.findMany({
    where: {
      organizationId,
      taskId,
      status: { in: OPEN_STATUSES },
    },
  })
  for (const reminder of reminders) {
    const updated = await prisma.smartReminder.update({
      where: { id: reminder.id },
      data: {
        status: "COMPLETED",
        resolvedAt: new Date(),
        resolvedById: userId ?? null,
        resolutionNote: "Fermé automatiquement après complétion de la tâche liée.",
      },
    })
    await auditReminder({ organizationId, reminderId: reminder.id, eventType: "REMINDER_AUTO_COMPLETED_FROM_TASK", userId, oldValue: reminder, newValue: updated })
  }
  return { completed: reminders.length }
}
