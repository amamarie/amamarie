import { prisma } from "@/lib/prisma"

import { ACTIVE_CLIENT_STATUSES, ACTIVE_LEAD_STATUSES } from "./constants"
import { commercialScoreFromPriority, daysSince, daysUntil, minScoreForSeverity } from "./rules"
import { freshnessScoreFromDate, relationshipScoreFromLastContact, urgencyScoreFromDueDate } from "./scoring"
import type { PriorityCandidate } from "./types"

function taskTitle(task: { title: string; client?: { firstName: string; lastName: string } | null; lead?: { firstName: string; lastName: string } | null }) {
  const target = task.client ? `${task.client.firstName} ${task.client.lastName}` : task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : null
  return target ? `${task.title} - ${target}` : task.title
}

export async function collectPriorityCandidates({
  organizationId,
  advisorId,
  clientId,
}: {
  organizationId: string
  advisorId?: string
  clientId?: string
}): Promise<PriorityCandidate[]> {
  const [tasks, alerts, leads, clients, products, recommendations, crossSell, documents] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId,
        status: { not: "DONE" },
        ...(clientId ? { clientId } : {}),
        ...(advisorId ? { assignedToId: advisorId } : {}),
      },
      include: { client: true, lead: true },
      take: 200,
    }),
    prisma.complianceAlert.findMany({
      where: {
        organizationId,
        status: "OPEN",
        ...(clientId ? { clientId } : {}),
      },
      include: { client: true },
      take: 200,
    }),
    prisma.lead.findMany({
      where: {
        organizationId,
        status: { in: [...ACTIVE_LEAD_STATUSES] },
        ...(advisorId ? { advisorId } : {}),
      },
      take: 200,
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: {
        organizationId,
        status: { in: [...ACTIVE_CLIENT_STATUSES] },
        ...(clientId ? { id: clientId } : {}),
        ...(advisorId ? { advisorId } : {}),
      },
      include: { kycProfile: true, complianceAlerts: { where: { status: "OPEN" } }, tasks: { where: { status: { not: "DONE" } } } },
      take: 200,
    }),
    prisma.financialProduct.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "UNDER_REVIEW", "PENDING"] },
        ...(clientId ? { clientId } : {}),
        ...(advisorId ? { advisorId } : {}),
        OR: [
          { renewalAt: { lte: new Date(Date.now() + 90 * 86_400_000) } },
          { nextReviewAt: { lte: new Date() } },
          { documentStatus: { in: ["REQUIRED", "MISSING", "EXPIRED"] } },
        ],
      },
      include: { client: true },
      take: 200,
    }),
    prisma.productRecommendation.findMany({
      where: {
        organizationId,
        status: "OPEN",
        priority: { in: ["CRITICAL", "HIGH", "MEDIUM"] },
        ...(clientId ? { clientId } : {}),
        ...(advisorId ? { advisorId } : {}),
      },
      include: { client: true },
      take: 200,
    }),
    prisma.crossSellOpportunity.findMany({
      where: {
        organizationId,
        status: "OPEN",
        priority: { in: ["CRITICAL", "HIGH", "MEDIUM"] },
        ...(clientId ? { clientId } : {}),
        ...(advisorId ? { advisorId } : {}),
      },
      include: { client: true },
      take: 200,
    }),
    prisma.document.findMany({
      where: {
        organizationId,
        status: { in: ["REQUIRED", "EXPIRED", "REJECTED"] },
        ...(clientId ? { clientId } : {}),
      },
      take: 200,
    }),
  ])

  const candidates: PriorityCandidate[] = []

  for (const task of tasks) {
    const overdueDays = task.dueDate ? Math.max(0, -(daysUntil(task.dueDate) ?? 0)) : 0
    candidates.push({
      entityType: "TASK",
      entityId: task.id,
      advisorId: task.assignedToId,
      clientId: task.clientId,
      leadId: task.leadId,
      title: taskTitle(task),
      description: task.description,
      reason: overdueDays > 0 ? `Tâche en retard depuis ${overdueDays} jour${overdueDays > 1 ? "s" : ""}.` : "Tâche ouverte à traiter selon son échéance.",
      suggestedAction: "Ouvrir la tâche et compléter le suivi prévu.",
      actionUrl: task.clientId ? `/clients/${task.clientId}` : task.leadId ? `/prospects/${task.leadId}` : "/taches",
      dueAt: task.dueDate,
      urgencyScore: urgencyScoreFromDueDate(task.dueDate),
      complianceScore: 0,
      relationshipScore: 20,
      commercialScore: commercialScoreFromPriority(task.priority),
      freshnessScore: freshnessScoreFromDate(task.createdAt),
      effortScore: task.description ? 50 : 80,
      guardrails: { minScore: overdueDays > 7 ? 80 : task.priority === "URGENT" ? 75 : undefined },
      metadata: { taskStatus: task.status, priority: task.priority },
    })
  }

  for (const alert of alerts) {
    candidates.push({
      entityType: "COMPLIANCE_ALERT",
      entityId: alert.id,
      clientId: alert.clientId,
      advisorId: alert.client.advisorId,
      title: alert.title,
      description: alert.description,
      reason: `Alerte conformité ${alert.severity.toLowerCase()} ouverte.`,
      suggestedAction: alert.actionLabel ?? "Réviser l’alerte et documenter le suivi.",
      actionUrl: `/clients/${alert.clientId}`,
      urgencyScore: minScoreForSeverity(alert.severity),
      complianceScore: alert.severity === "CRITICAL" ? 100 : alert.severity === "HIGH" ? 85 : 60,
      relationshipScore: relationshipScoreFromLastContact(alert.client.lastContactAt),
      commercialScore: 10,
      freshnessScore: freshnessScoreFromDate(alert.createdAt),
      effortScore: 55,
      guardrails: { minScore: minScoreForSeverity(alert.severity) },
      metadata: { alertType: alert.type, severity: alert.severity },
    })
  }

  for (const lead of leads) {
    const noContactDays = daysSince(lead.lastContactAt ?? lead.createdAt) ?? 0
    const hot = lead.priority === "URGENT" || lead.priority === "HIGH" || lead.status === "PROPOSAL_SENT" || lead.status === "WON"
    candidates.push({
      entityType: "LEAD",
      entityId: lead.id,
      advisorId: lead.advisorId,
      leadId: lead.id,
      title: `${lead.firstName} ${lead.lastName}`,
      description: lead.nextAction ?? lead.interestType,
      reason: hot ? "Prospect actif à fort potentiel ou étape avancée du pipeline." : "Prospect actif à suivre.",
      suggestedAction: lead.nextAction ?? "Planifier le prochain contact avec le prospect.",
      actionUrl: `/prospects/${lead.id}`,
      dueAt: lead.lastContactAt ?? lead.createdAt,
      urgencyScore: lead.status === "PROPOSAL_SENT" && noContactDays >= 2 ? 75 : noContactDays > 1 ? 60 : 35,
      complianceScore: 0,
      relationshipScore: noContactDays > 2 ? 55 : 20,
      commercialScore: hot ? 85 : commercialScoreFromPriority(lead.priority),
      freshnessScore: freshnessScoreFromDate(lead.createdAt),
      effortScore: 70,
      guardrails: { minScore: lead.source === "INBOUND_CALL" && noContactDays > 1 ? 75 : undefined },
      metadata: { status: lead.status, source: lead.source, priority: lead.priority },
    })
  }

  for (const client of clients) {
    const kycExpired = client.kycProfile?.status === "EXPIRED"
    const score = client.kycProfile?.complianceScore ?? 100
    const lastContactDays = daysSince(client.lastContactAt)
    const hasCriticalAlert = client.complianceAlerts.some((alert) => alert.severity === "CRITICAL")
    candidates.push({
      entityType: "CLIENT",
      entityId: client.id,
      advisorId: client.advisorId,
      clientId: client.id,
      title: `${client.firstName} ${client.lastName}`,
      description: client.notes,
      reason: kycExpired ? "Le profil client est expiré." : lastContactDays && lastContactDays > 90 ? `Aucun suivi client depuis ${lastContactDays} jours.` : "Dossier client actif à surveiller.",
      suggestedAction: kycExpired ? "Planifier une mise à jour du profil client." : "Vérifier les prochaines actions du dossier.",
      actionUrl: `/clients/${client.id}`,
      urgencyScore: kycExpired ? 90 : lastContactDays && lastContactDays > 180 ? 75 : 35,
      complianceScore: hasCriticalAlert ? 100 : kycExpired ? 95 : score < 70 ? 65 : 0,
      relationshipScore: relationshipScoreFromLastContact(client.lastContactAt),
      commercialScore: client.status === "REVIEW_NEEDED" ? 55 : 20,
      freshnessScore: freshnessScoreFromDate(client.updatedAt),
      effortScore: 45,
      guardrails: { minScore: kycExpired || hasCriticalAlert ? 90 : undefined },
      metadata: { status: client.status, complianceScore: score },
    })
  }

  for (const product of products) {
    const renewalDays = daysUntil(product.renewalAt)
    const reviewOverdue = product.nextReviewAt ? (daysUntil(product.nextReviewAt) ?? 1) < 0 : false
    candidates.push({
      entityType: "FINANCIAL_PRODUCT",
      entityId: product.id,
      advisorId: product.advisorId ?? product.client.advisorId,
      clientId: product.clientId,
      title: product.productName ?? product.company ?? `Produit ${product.type}`,
      description: `${product.type} - ${product.status}`,
      reason: renewalDays !== null && renewalDays <= 30 ? `Renouvellement dans ${renewalDays} jour${renewalDays > 1 ? "s" : ""}.` : reviewOverdue ? "Révision du produit dépassée." : "Produit financier à surveiller.",
      suggestedAction: renewalDays !== null && renewalDays <= 30 ? "Planifier une révision de renouvellement." : "Réviser les informations du produit.",
      actionUrl: `/clients/${product.clientId}`,
      dueAt: product.renewalAt ?? product.nextReviewAt,
      urgencyScore: urgencyScoreFromDueDate(product.renewalAt ?? product.nextReviewAt),
      complianceScore: product.documentStatus === "EXPIRED" ? 85 : product.documentStatus === "REQUIRED" ? 70 : product.primaryBeneficiary ? 0 : product.category === "INSURANCE" ? 60 : 0,
      relationshipScore: relationshipScoreFromLastContact(product.client.lastContactAt),
      commercialScore: renewalDays !== null && renewalDays <= 30 ? 70 : 30,
      freshnessScore: freshnessScoreFromDate(product.updatedAt),
      effortScore: 50,
      guardrails: { minScore: renewalDays !== null && renewalDays < 15 ? 75 : product.documentStatus === "EXPIRED" ? 85 : undefined },
      metadata: { productType: product.type, status: product.status },
    })
  }

  for (const recommendation of recommendations) {
    candidates.push({
      entityType: "RECOMMENDATION",
      entityId: recommendation.id,
      advisorId: recommendation.advisorId ?? recommendation.client.advisorId,
      clientId: recommendation.clientId,
      title: recommendation.title,
      description: recommendation.description,
      reason: `Recommandation interne ${recommendation.priority.toLowerCase()} ouverte.`,
      suggestedAction: recommendation.actionLabel ?? "Valider cette piste de suivi avec le conseiller.",
      actionUrl: `/clients/${recommendation.clientId}`,
      urgencyScore: commercialScoreFromPriority(recommendation.priority),
      complianceScore: recommendation.type === "COMPLIANCE" ? 70 : 0,
      relationshipScore: relationshipScoreFromLastContact(recommendation.client.lastContactAt),
      commercialScore: commercialScoreFromPriority(recommendation.priority),
      freshnessScore: freshnessScoreFromDate(recommendation.createdAt),
      effortScore: 45,
      guardrails: { minScore: recommendation.priority === "CRITICAL" ? 90 : recommendation.priority === "HIGH" ? 70 : undefined },
      metadata: { type: recommendation.type, priority: recommendation.priority },
    })
  }

  for (const opportunity of crossSell) {
    candidates.push({
      entityType: "CROSS_SELL",
      entityId: opportunity.id,
      advisorId: opportunity.advisorId ?? opportunity.client.advisorId,
      clientId: opportunity.clientId,
      title: opportunity.title,
      description: opportunity.description,
      reason: `Opportunité de discussion ${opportunity.priority.toLowerCase()} ouverte.`,
      suggestedAction: opportunity.actionLabel ?? "Préparer une discussion prudente avec le client.",
      actionUrl: `/clients/${opportunity.clientId}`,
      urgencyScore: commercialScoreFromPriority(opportunity.priority),
      complianceScore: 0,
      relationshipScore: relationshipScoreFromLastContact(opportunity.client.lastContactAt),
      commercialScore: commercialScoreFromPriority(opportunity.priority),
      freshnessScore: freshnessScoreFromDate(opportunity.createdAt),
      effortScore: 45,
      guardrails: { minScore: opportunity.priority === "CRITICAL" ? 90 : opportunity.priority === "HIGH" ? 70 : undefined },
      metadata: { category: opportunity.category, priority: opportunity.priority },
    })
  }

  for (const document of documents) {
    candidates.push({
      entityType: "DOCUMENT",
      entityId: document.id,
      clientId: document.clientId,
      leadId: document.leadId,
      title: document.name,
      description: `${document.type} - ${document.status}`,
      reason: `Document ${document.status.toLowerCase()} à traiter.`,
      suggestedAction: "Valider le document ou demander une mise à jour.",
      actionUrl: document.clientId ? `/clients/${document.clientId}` : document.leadId ? `/prospects/${document.leadId}` : "/documents",
      urgencyScore: document.status === "EXPIRED" ? 85 : 65,
      complianceScore: document.status === "EXPIRED" ? 85 : 70,
      relationshipScore: 20,
      commercialScore: 0,
      freshnessScore: freshnessScoreFromDate(document.updatedAt),
      effortScore: 70,
      guardrails: { minScore: document.status === "EXPIRED" ? 85 : undefined },
      metadata: { documentStatus: document.status, documentType: document.type },
    })
  }

  return candidates.filter((candidate) => !advisorId || !candidate.advisorId || candidate.advisorId === advisorId)
}
