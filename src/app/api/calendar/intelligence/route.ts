import { financialProductTypeLabels } from "@/lib/financial-products"
import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type CalendarEventType =
  | "CALL"
  | "SMS"
  | "EMAIL"
  | "MEETING"
  | "DOCUMENT"
  | "KYC"
  | "FOLLOW_UP"
  | "PRODUCT_REVIEW"
  | "RENEWAL"
  | "COMPLIANCE"
  | "INTERNAL"
  | "OTHER"
  | "CAMPAIGN"
  | "BIRTHDAY"
  | "ANNUAL_REVIEW"
  | "OPPORTUNITY"
  | "REMINDER"

type CalendarPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "INFO"

type IntelligentCalendarEvent = {
  id: string
  title: string
  description?: string | null
  type: CalendarEventType
  status: string
  priority: CalendarPriority
  dueDate?: string | null
  startDate?: string | null
  source?: string
  sourceLabel?: string
  href?: string
  lead?: { id: string; firstName: string; lastName: string; status?: string | null; email?: string | null; phone?: string | null } | null
  client?: { id: string; firstName: string; lastName: string; status?: string | null; email?: string | null; phone?: string | null } | null
  owner?: { id: string; name: string; email: string } | null
  product?: { id: string; label: string; type: string } | null
  context?: string[]
  alerts?: string[]
  opportunities?: string[]
  recommendedAction?: string | null
  preparation?: string[]
  afterMeeting?: string[]
  priorityReason?: string | null
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toIso(date?: Date | null) {
  return date ? date.toISOString() : null
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function daysBetween(from: Date, to: Date) {
  const start = new Date(from)
  const end = new Date(to)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY)
}

function withinHorizon(date: Date | null | undefined, horizonEnd: Date) {
  return Boolean(date && date.getTime() <= horizonEnd.getTime())
}

function clientRef(client: {
  id: string
  firstName: string
  lastName: string
  status?: unknown
  email?: string | null
  emailPrimary?: string | null
  phone?: string | null
  phonePrimary?: string | null
} | null | undefined) {
  if (!client) return null
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    status: client.status ? String(client.status) : null,
    email: client.emailPrimary ?? client.email ?? null,
    phone: client.phonePrimary ?? client.phone ?? null,
  }
}

function leadRef(lead: {
  id: string
  firstName: string
  lastName: string
  status?: unknown
  email?: string | null
  phone?: string | null
} | null | undefined) {
  if (!lead) return null
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    status: lead.status ? String(lead.status) : null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
  }
}

function userRef(user: { id: string; name: string; email: string } | null | undefined) {
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email }
}

function contactName(person: { firstName: string; lastName: string } | null | undefined) {
  return person ? `${person.firstName} ${person.lastName}` : "Contact"
}

function productLabel(product: { productName?: string | null; type: string; company?: string | null }) {
  const label = product.productName?.trim() || financialProductTypeLabels[product.type] || product.type
  return product.company ? `${label} · ${product.company}` : label
}

function nextBirthday(dateOfBirth: Date, today: Date, horizonEnd: Date) {
  const birthday = new Date(today.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate(), 9, 0, 0, 0)
  if (birthday.getTime() < today.getTime()) {
    birthday.setFullYear(today.getFullYear() + 1)
  }
  return birthday.getTime() <= horizonEnd.getTime() ? birthday : null
}

function parseMetadataDate(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>
  const keys = ["scheduledAt", "scheduled_at", "sendAt", "send_at", "startsAt", "date"]
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string") {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return null
}

function reminderType(category: string): CalendarEventType {
  const normalized = category.toUpperCase()
  if (normalized.includes("DOCUMENT")) return "DOCUMENT"
  if (normalized.includes("KYC") || normalized.includes("COMPLIANCE")) return "COMPLIANCE"
  if (normalized.includes("REVIEW") || normalized.includes("ANNUAL")) return "ANNUAL_REVIEW"
  if (normalized.includes("OPPORTUNITY") || normalized.includes("SALES")) return "OPPORTUNITY"
  return "REMINDER"
}

function normalizePriority(priority: unknown): CalendarPriority {
  const value = String(priority ?? "NORMAL").toUpperCase()
  if (value === "URGENT" || value === "HIGH" || value === "LOW") return value
  if (value === "INFO") return "INFO"
  return "NORMAL"
}

function normalizeBusinessPriority(priority: unknown): CalendarPriority {
  const value = String(priority ?? "NORMAL").toUpperCase()
  if (value === "CRITICAL") return "URGENT"
  if (value === "MEDIUM") return "NORMAL"
  return normalizePriority(value)
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const url = new URL(request.url)
    const range = Math.min(Math.max(Number(url.searchParams.get("range") ?? 90), 7), 180)
    const today = startOfToday()
    const horizonEnd = addDays(today, range)

    const [
      tasks,
      reminders,
      documents,
      products,
      clients,
      campaigns,
      leads,
      crossSellOpportunities,
      recommendations,
      complianceAlerts,
      complianceEvents,
      kycAlerts,
      kycProfiles,
    ] = await Promise.all([
      prisma.task.findMany({
        where: {
          organizationId,
          status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
          dueDate: { lte: horizonEnd },
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, lastContactAt: true, nextReviewDate: true, advisor: { select: { id: true, name: true, email: true } } } },
          lead: { select: { id: true, firstName: true, lastName: true, status: true, email: true, phone: true } },
          product: { select: { id: true, type: true, productName: true, company: true, renewalAt: true, nextReviewAt: true } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        take: 250,
      }),
      prisma.smartReminder.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "SNOOZED"] },
          OR: [
            { dueDate: { lte: horizonEnd } },
            { triggerDate: { lte: horizonEnd } },
          ],
        },
        include: {
          advisor: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ dueDate: "asc" }, { priorityScore: "desc" }],
        take: 160,
      }),
      prisma.document.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"] },
          OR: [
            { requiredBy: { lte: horizonEnd } },
            { expiresAt: { lte: horizonEnd } },
            { requestedAt: { lte: horizonEnd } },
          ],
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
          lead: { select: { id: true, firstName: true, lastName: true, status: true, email: true, phone: true } },
          product: { select: { id: true, type: true, productName: true, company: true } },
        },
        orderBy: [{ expiresAt: "asc" }, { requiredBy: "asc" }, { requestedAt: "asc" }],
        take: 180,
      }),
      prisma.financialProduct.findMany({
        where: {
          organizationId,
          status: { in: ["ACTIVE", "PENDING", "UNDER_REVIEW"] },
          OR: [
            { renewalAt: { lte: horizonEnd } },
            { nextReviewAt: { lte: horizonEnd } },
            { maturityAt: { lte: horizonEnd } },
          ],
        },
        include: {
          advisor: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ renewalAt: "asc" }, { nextReviewAt: "asc" }, { maturityAt: "asc" }],
        take: 180,
      }),
      prisma.client.findMany({
        where: {
          organizationId,
          status: { not: "ARCHIVED" },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          email: true,
          emailPrimary: true,
          phone: true,
          phonePrimary: true,
          advisor: { select: { id: true, name: true, email: true } },
          dateOfBirth: true,
          lastContactAt: true,
          nextReviewDate: true,
          kycCompleted: true,
          primaryGoal: true,
          financialGoals: true,
          goals: true,
          retirementGoal: true,
          protectionNeeds: true,
          products: {
            where: { status: { in: ["ACTIVE", "PENDING", "UNDER_REVIEW"] } },
            select: { id: true, type: true, productName: true, company: true },
            take: 4,
          },
          documents: {
            where: { deletedAt: null, status: { in: ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"] } },
            select: { id: true, name: true, status: true },
            take: 4,
          },
        },
        orderBy: [{ nextReviewDate: "asc" }, { lastContactAt: "asc" }],
        take: 400,
      }),
      prisma.developerMarketingCampaign.findMany({
        where: {
          organizationId,
          status: { not: "ARCHIVED" },
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
      }),
      prisma.lead.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: { notIn: ["WON", "CONVERTED", "LOST", "ARCHIVED"] },
        },
        include: {
          advisor: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
        take: 120,
      }),
      prisma.crossSellOpportunity.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "REVIEWED"] },
        },
        include: {
          advisor: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
          relatedProduct: { select: { id: true, type: true, productName: true, company: true } },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
        take: 100,
      }),
      prisma.productRecommendation.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "ADVISOR_REVIEW", "MISSING_DATA", "OPTIONS_REQUIRED", "NEEDS_UPDATE"] },
        },
        include: {
          advisor: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
          relatedProduct: { select: { id: true, type: true, productName: true, company: true } },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
        take: 100,
      }),
      prisma.complianceAlert.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "asc" }],
        take: 120,
      }),
      prisma.complianceEvent.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "IN_PROGRESS", "PENDING"] },
          createdAt: { lte: horizonEnd },
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
        take: 120,
      }),
      prisma.kycAlert.findMany({
        where: {
          organizationId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "asc" }],
        take: 120,
      }),
      prisma.clientKycProfile.findMany({
        where: {
          organizationId,
          status: { not: "ARCHIVED" },
          OR: [
            { nextKycReviewAt: { lte: horizonEnd } },
            { status: { in: ["NEEDS_UPDATE", "EXPIRED", "PENDING_REVIEW", "PENDING_DOCUMENTS"] } },
          ],
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, status: true, email: true, emailPrimary: true, phone: true, phonePrimary: true, advisor: { select: { id: true, name: true, email: true } } } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ nextKycReviewAt: "asc" }, { updatedAt: "asc" }],
        take: 120,
      }),
    ])

    const events: IntelligentCalendarEvent[] = []

    for (const task of tasks) {
      if (!task.dueDate) continue
      const person = task.client ?? task.lead
      const overdue = task.dueDate.getTime() < today.getTime()
      events.push({
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        status: overdue ? "OVERDUE" : task.status,
        priority: normalizePriority(task.priority),
        dueDate: toIso(task.dueDate),
        startDate: toIso(task.startDate),
        source: task.isAutomated ? "automation" : "task",
        sourceLabel: task.isAutomated ? "Automatisation" : "Tâche CRM",
        href: task.clientId ? `/clients/${task.clientId}` : task.leadId ? `/prospects/${task.leadId}` : "/taches",
        client: clientRef(task.client),
        lead: leadRef(task.lead),
        owner: userRef(task.assignedTo ?? task.client?.advisor),
        product: task.product ? { id: task.product.id, label: productLabel(task.product), type: task.product.type } : null,
        context: [
          person ? `Contact lié : ${contactName(person)}` : "Action interne",
          task.product ? `Produit : ${productLabel(task.product)}` : "",
          task.isAutomated ? "Créée automatiquement par une règle CRM" : "",
        ].filter(Boolean),
        alerts: overdue ? ["Action en retard"] : [],
        recommendedAction: task.type === "MEETING"
          ? "Préparer le rendez-vous et prévoir les actions post-rendez-vous."
          : "Traiter l’action puis historiser le résultat dans le CRM.",
        priorityReason: overdue ? "La date prévue est dépassée." : null,
      })
    }

    for (const reminder of reminders) {
      const dueDate = reminder.dueDate ?? reminder.triggerDate
      const overdue = dueDate.getTime() < today.getTime()
      events.push({
        id: `reminder_${reminder.id}`,
        title: reminder.title,
        description: reminder.description ?? reminder.reason,
        type: reminderType(reminder.category),
        status: overdue ? "OVERDUE" : reminder.status,
        priority: normalizePriority(reminder.priority),
        dueDate: toIso(dueDate),
        source: "smart_reminder",
        sourceLabel: "Relance intelligente",
        href: reminder.actionUrl ?? `/clients/${reminder.clientId}`,
        client: clientRef(reminder.client),
        owner: userRef(reminder.advisor ?? reminder.client.advisor),
        context: [reminder.reason],
        alerts: overdue ? ["Relance en retard"] : [],
        recommendedAction: reminder.recommendedAction,
        priorityReason: reminder.reason,
      })
    }

    for (const document of documents) {
      const dueDate = document.expiresAt ?? document.requiredBy ?? document.requestedAt ?? document.updatedAt
      if (!withinHorizon(dueDate, horizonEnd)) continue
      const status = String(document.status)
      events.push({
        id: `document_${document.id}`,
        title: `${status === "EXPIRED" ? "Document expiré" : "Document à obtenir"} · ${document.name}`,
        description: document.description,
        type: ["KYC_FORM", "RISK_PROFILE"].includes(String(document.type)) ? "KYC" : "DOCUMENT",
        status: dueDate.getTime() < today.getTime() || status === "EXPIRED" ? "OVERDUE" : status,
        priority: status === "EXPIRED" || status === "REJECTED" ? "URGENT" : "HIGH",
        dueDate: toIso(dueDate),
        source: "document",
        sourceLabel: "Dossier client",
        href: document.clientId ? `/clients/${document.clientId}` : "/documents",
        client: clientRef(document.client),
        lead: leadRef(document.lead),
        owner: userRef(document.client?.advisor),
        product: document.product ? { id: document.product.id, label: productLabel(document.product), type: document.product.type } : null,
        context: [
          document.isRequired ? "Document obligatoire" : "Document de suivi",
          document.product ? `Produit lié : ${productLabel(document.product)}` : "",
        ].filter(Boolean),
        alerts: [status === "EXPIRED" ? "Le document est expiré" : "Le dossier reste incomplet"],
        recommendedAction: "Envoyer une demande de document ou relancer le client.",
        priorityReason: "Un document manquant ou expiré bloque la qualité du dossier.",
      })
    }

    for (const product of products) {
      const common = {
        client: clientRef(product.client),
        owner: userRef(product.advisor ?? product.client.advisor),
        product: { id: product.id, label: productLabel(product), type: product.type },
        href: `/clients/${product.clientId}`,
        source: "contract",
        sourceLabel: "Contrat",
      }

      if (withinHorizon(product.renewalAt, horizonEnd)) {
        const days = daysBetween(today, product.renewalAt as Date)
        events.push({
          id: `renewal_${product.id}`,
          title: `Renouvellement à préparer · ${productLabel(product)}`,
          type: "RENEWAL",
          status: days < 0 ? "OVERDUE" : "PLANNED",
          priority: days <= 15 ? "HIGH" : "NORMAL",
          dueDate: toIso(product.renewalAt),
          ...common,
          context: [`Échéance dans ${Math.max(days, 0)} jour(s)`, `Client : ${contactName(product.client)}`],
          alerts: days < 0 ? ["Renouvellement dépassé"] : [],
          recommendedAction: "Revoir garanties, cotisation et besoin client avant l’échéance.",
          priorityReason: "Un contrat arrive à échéance.",
        })
      }

      if (withinHorizon(product.nextReviewAt, horizonEnd)) {
        const days = daysBetween(today, product.nextReviewAt as Date)
        events.push({
          id: `product_review_${product.id}`,
          title: `Revue produit · ${productLabel(product)}`,
          type: "PRODUCT_REVIEW",
          status: days < 0 ? "OVERDUE" : "PLANNED",
          priority: days <= 0 ? "HIGH" : "NORMAL",
          dueDate: toIso(product.nextReviewAt),
          ...common,
          context: [`Revue prévue dans ${Math.max(days, 0)} jour(s)`, `Statut produit : ${product.status}`],
          alerts: days < 0 ? ["Revue produit en retard"] : [],
          recommendedAction: "Planifier une revue avec le client ou mettre à jour l’analyse produit.",
          priorityReason: "Le produit nécessite un suivi périodique.",
        })
      }

      if (withinHorizon(product.maturityAt, horizonEnd)) {
        events.push({
          id: `maturity_${product.id}`,
          title: `Maturité produit · ${productLabel(product)}`,
          type: "PRODUCT_REVIEW",
          status: "PLANNED",
          priority: "HIGH",
          dueDate: toIso(product.maturityAt),
          ...common,
          context: ["Produit proche de sa maturité"],
          recommendedAction: "Préparer les options de sortie, réinvestissement ou renouvellement.",
          priorityReason: "Une décision client sera probablement nécessaire.",
        })
      }
    }

    for (const client of clients) {
      if (client.nextReviewDate && client.nextReviewDate.getTime() <= horizonEnd.getTime()) {
        const overdue = client.nextReviewDate.getTime() < today.getTime()
        const productNames = client.products.map((product) => productLabel(product))
        events.push({
          id: `annual_review_${client.id}`,
          title: `Bilan annuel à planifier · ${contactName(client)}`,
          type: "ANNUAL_REVIEW",
          status: overdue ? "OVERDUE" : "PLANNED",
          priority: overdue ? "HIGH" : "NORMAL",
          dueDate: toIso(client.nextReviewDate),
          source: "crm",
          sourceLabel: "Suivi client",
          href: `/clients/${client.id}`,
          client: clientRef(client),
          owner: userRef(client.advisor),
          context: [
            client.lastContactAt ? `Dernier contact : il y a ${Math.max(daysBetween(client.lastContactAt, today), 0)} jour(s)` : "Aucun dernier contact renseigné",
            productNames.length ? `Produits : ${productNames.join(", ")}` : "Produits à qualifier",
            client.primaryGoal || client.financialGoals || client.goals ? `Objectif : ${client.primaryGoal ?? client.financialGoals ?? client.goals}` : "",
          ].filter(Boolean),
          alerts: [
            !client.kycCompleted ? "Profil client incomplet" : "",
            client.documents.length ? `${client.documents.length} document(s) à traiter` : "",
          ].filter(Boolean),
          opportunities: [
            client.retirementGoal ? "Point retraite" : "",
            client.protectionNeeds ? "Protection familiale ou professionnelle" : "",
          ].filter(Boolean),
          recommendedAction: "Proposer un bilan annuel et préparer la mise à jour du dossier.",
          preparation: ["Relire les contrats", "Vérifier les documents manquants", "Préparer les questions de situation"],
          afterMeeting: ["Rédiger le compte-rendu", "Créer les relances", "Archiver les documents"],
          priorityReason: overdue ? "Le suivi annuel prévu est dépassé." : "Le prochain bilan client approche.",
        })
      }

      if (client.dateOfBirth) {
        const birthday = nextBirthday(client.dateOfBirth, today, horizonEnd)
        if (birthday) {
          events.push({
            id: `birthday_${client.id}`,
            title: `Anniversaire client · ${contactName(client)}`,
            type: "BIRTHDAY",
            status: "PLANNED",
            priority: "LOW",
            dueDate: toIso(birthday),
            source: "crm",
            sourceLabel: "Relation client",
            href: `/clients/${client.id}`,
            client: clientRef(client),
            owner: userRef(client.advisor),
            context: ["Message relationnel recommandé"],
            recommendedAction: "Envoyer un message simple et non commercial.",
          })
        }
      }

      const inactiveDays = client.lastContactAt ? daysBetween(client.lastContactAt, today) : null
      if (inactiveDays === null || inactiveDays >= 365) {
        events.push({
          id: `inactive_${client.id}`,
          title: `Client sans suivi récent · ${contactName(client)}`,
          type: "FOLLOW_UP",
          status: "PLANNED",
          priority: inactiveDays && inactiveDays >= 450 ? "HIGH" : "NORMAL",
          dueDate: toIso(addDays(today, 1)),
          source: "crm",
          sourceLabel: "Qualité du suivi",
          href: `/clients/${client.id}`,
          client: clientRef(client),
          owner: userRef(client.advisor),
          context: [inactiveDays === null ? "Aucun dernier contact renseigné" : `Aucun contact depuis ${inactiveDays} jour(s)`],
          alerts: ["Client à revoir"],
          recommendedAction: "Créer une tâche de bilan ou envoyer une invitation de rendez-vous.",
          priorityReason: "Le client n’a pas été revu depuis longtemps.",
        })
      }
    }

    for (const lead of leads) {
      const staleDays = lead.lastContactAt ? daysBetween(lead.lastContactAt, today) : null
      const shouldSchedule = ["URGENT", "HIGH"].includes(String(lead.priority)) || staleDays === null || staleDays >= 7
      if (!shouldSchedule) continue
      const dueDate = lead.priority === "URGENT" ? today : addDays(today, 1)
      events.push({
        id: `lead_${lead.id}`,
        title: `Prospect à relancer · ${contactName(lead)}`,
        description: lead.notes,
        type: "OPPORTUNITY",
        status: staleDays !== null && staleDays >= 14 ? "OVERDUE" : "PLANNED",
        priority: normalizePriority(lead.priority),
        dueDate: toIso(dueDate),
        source: "lead",
        sourceLabel: "Prospect",
        href: `/prospects/${lead.id}`,
        lead: leadRef(lead),
        owner: userRef(lead.advisor),
        context: [
          `Statut : ${lead.status}`,
          lead.interestType ? `Intérêt : ${lead.interestType}` : "",
          lead.estimatedValue ? `Potentiel estimé : ${new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(lead.estimatedValue)}` : "",
          staleDays === null ? "Aucun contact enregistré" : `Dernier contact : il y a ${staleDays} jour(s)`,
        ].filter(Boolean),
        opportunities: [lead.nextAction ?? "Qualifier le besoin et créer une opportunité si pertinent."],
        recommendedAction: lead.nextAction ?? "Appeler le prospect ou envoyer une relance personnalisée.",
        priorityReason: "Prospect prioritaire ou sans contact récent.",
      })
    }

    for (const opportunity of crossSellOpportunities) {
      const staleDays = opportunity.reviewedAt
        ? daysBetween(opportunity.reviewedAt, today)
        : daysBetween(opportunity.updatedAt, today)
      const dueDate = staleDays >= 14 || opportunity.priority === "CRITICAL" ? today : addDays(today, 3)
      events.push({
        id: `cross_sell_${opportunity.id}`,
        title: `Opportunité commerciale · ${opportunity.title}`,
        description: opportunity.description,
        type: "OPPORTUNITY",
        status: staleDays >= 30 ? "OVERDUE" : "PLANNED",
        priority: normalizeBusinessPriority(opportunity.priority),
        dueDate: toIso(dueDate),
        source: "cross_sell",
        sourceLabel: "Opportunité",
        href: opportunity.actionUrl ?? `/clients/${opportunity.clientId}`,
        client: clientRef(opportunity.client),
        owner: userRef(opportunity.advisor ?? opportunity.client.advisor),
        product: opportunity.relatedProduct ? { id: opportunity.relatedProduct.id, label: productLabel(opportunity.relatedProduct), type: opportunity.relatedProduct.type } : null,
        context: [
          `Catégorie : ${opportunity.category}`,
          opportunity.relatedProductType ? `Produit suggéré : ${opportunity.relatedProductType}` : "",
          opportunity.confidence ? `Confiance : ${Math.round(opportunity.confidence * 100)} %` : "",
        ].filter(Boolean),
        opportunities: [opportunity.suggestedDiscussionTopic ?? opportunity.rationale ?? "Discuter l’opportunité avec le client."],
        recommendedAction: opportunity.actionLabel ?? "Préparer un échange commercial contextualisé.",
        priorityReason: opportunity.rationale ?? "Opportunité détectée dans le portefeuille client.",
      })
    }

    for (const recommendation of recommendations) {
      const staleDays = daysBetween(recommendation.updatedAt, today)
      const dueDate = recommendation.priority === "CRITICAL" || staleDays >= 14 ? today : addDays(today, 2)
      events.push({
        id: `recommendation_${recommendation.id}`,
        title: `Recommandation à traiter · ${recommendation.title}`,
        description: recommendation.description,
        type: recommendation.type === "COMPLIANCE" ? "COMPLIANCE" : "OPPORTUNITY",
        status: staleDays >= 30 ? "OVERDUE" : "PLANNED",
        priority: normalizeBusinessPriority(recommendation.priority),
        dueDate: toIso(dueDate),
        source: "recommendation",
        sourceLabel: "Recommandation",
        href: recommendation.actionUrl ?? `/clients/${recommendation.clientId}`,
        client: clientRef(recommendation.client),
        owner: userRef(recommendation.advisor ?? recommendation.client.advisor),
        product: recommendation.relatedProduct ? { id: recommendation.relatedProduct.id, label: productLabel(recommendation.relatedProduct), type: recommendation.relatedProduct.type } : null,
        context: [
          `Statut : ${recommendation.status}`,
          `Type : ${recommendation.type}`,
          recommendation.confidence ? `Confiance : ${Math.round(recommendation.confidence * 100)} %` : "",
        ].filter(Boolean),
        alerts: recommendation.status === "MISSING_DATA" ? ["Données manquantes avant recommandation"] : [],
        recommendedAction: recommendation.actionLabel ?? "Réviser la recommandation et créer la prochaine action client.",
        priorityReason: recommendation.rationale ?? recommendation.recommendationReasoning ?? "Recommandation ouverte à traiter.",
      })
    }

    for (const alert of complianceAlerts) {
      const staleDays = daysBetween(alert.updatedAt, today)
      events.push({
        id: `compliance_alert_${alert.id}`,
        title: `Alerte conformité · ${alert.title}`,
        description: alert.description,
        type: "COMPLIANCE",
        status: staleDays >= 14 || alert.severity === "CRITICAL" ? "OVERDUE" : alert.status,
        priority: normalizeBusinessPriority(alert.severity),
        dueDate: toIso(alert.severity === "CRITICAL" ? today : addDays(today, Math.max(1, 7 - Math.min(staleDays, 7)))),
        source: "compliance_alert",
        sourceLabel: "Conformité",
        href: alert.actionUrl ?? `/clients/${alert.clientId}`,
        client: clientRef(alert.client),
        owner: userRef(alert.client.advisor),
        context: [`Type : ${alert.type}`, `Sévérité : ${alert.severity}`],
        alerts: [alert.description],
        recommendedAction: alert.actionLabel ?? "Analyser l’alerte, corriger le dossier et historiser la décision.",
        priorityReason: "Alerte conformité ouverte.",
      })
    }

    for (const event of complianceEvents) {
      const staleDays = daysBetween(event.createdAt, today)
      events.push({
        id: `compliance_event_${event.id}`,
        title: `Suivi conformité · ${event.eventTitle}`,
        description: event.description,
        type: "COMPLIANCE",
        status: staleDays >= 14 || event.severity === "CRITICAL" ? "OVERDUE" : event.status,
        priority: normalizeBusinessPriority(event.severity),
        dueDate: toIso(event.severity === "CRITICAL" ? today : addDays(today, Math.max(1, 10 - Math.min(staleDays, 10)))),
        source: "compliance_event",
        sourceLabel: "Événement conformité",
        href: event.clientId ? `/clients/${event.clientId}` : "/compliance",
        client: clientRef(event.client),
        owner: userRef(event.assignedTo ?? event.client?.advisor),
        context: [
          `Catégorie : ${event.eventCategory}`,
          event.linkedEntityType ? `Élément lié : ${event.linkedEntityType}` : "",
        ].filter(Boolean),
        alerts: event.description ? [event.description] : [],
        recommendedAction: "Traiter l’événement conformité et documenter la résolution.",
        priorityReason: "Événement conformité ouvert.",
      })
    }

    for (const alert of kycAlerts) {
      const staleDays = daysBetween(alert.updatedAt, today)
      events.push({
        id: `kyc_alert_${alert.id}`,
        title: `Alerte connaissance client · ${alert.title}`,
        description: alert.message,
        type: "KYC",
        status: staleDays >= 14 || alert.severity === "CRITICAL" ? "OVERDUE" : alert.status,
        priority: normalizeBusinessPriority(alert.severity),
        dueDate: toIso(alert.severity === "CRITICAL" ? today : addDays(today, Math.max(1, 7 - Math.min(staleDays, 7)))),
        source: "kyc_alert",
        sourceLabel: "Connaissance client",
        href: `/clients/${alert.clientId}`,
        client: clientRef(alert.client),
        owner: userRef(alert.client.advisor),
        context: [`Type : ${alert.alertType}`, `Sévérité : ${alert.severity}`],
        alerts: [alert.message],
        recommendedAction: "Mettre à jour le profil client ou résoudre l’alerte KYC.",
        priorityReason: "Alerte KYC ouverte.",
      })
    }

    for (const profile of kycProfiles) {
      const dueDate = profile.nextKycReviewAt ?? (["EXPIRED", "NEEDS_UPDATE", "PENDING_REVIEW"].includes(profile.status) ? today : addDays(today, 7))
      const overdue = dueDate.getTime() < today.getTime() || profile.status === "EXPIRED"
      events.push({
        id: `kyc_review_${profile.id}`,
        title: `Profil client à mettre à jour · ${contactName(profile.client)}`,
        description: profile.reviewNotes ?? profile.notes,
        type: "KYC",
        status: overdue ? "OVERDUE" : profile.status,
        priority: overdue || ["EXPIRED", "NEEDS_UPDATE"].includes(profile.status) ? "HIGH" : "NORMAL",
        dueDate: toIso(dueDate),
        source: "kyc_profile",
        sourceLabel: "Profil client",
        href: `/clients/${profile.clientId}`,
        client: clientRef(profile.client),
        owner: userRef(profile.reviewedBy ?? profile.client.advisor),
        context: [
          `Statut profil : ${profile.status}`,
          profile.complianceScore ? `Score conformité : ${profile.complianceScore}/100` : "",
          profile.nextKycReviewAt ? `Prochaine revue : ${profile.nextKycReviewAt.toLocaleDateString("fr-CA")}` : "",
        ].filter(Boolean),
        alerts: [
          profile.status === "EXPIRED" ? "Profil expiré" : "",
          profile.status === "PENDING_DOCUMENTS" ? "Documents requis" : "",
          profile.changesDetected ? "Changements détectés" : "",
        ].filter(Boolean),
        recommendedAction: "Mettre à jour la situation client avant toute nouvelle recommandation.",
        preparation: ["Situation familiale", "Situation professionnelle", "Objectifs", "Tolérance au risque", "Préférences et consentements"],
        priorityReason: "La connaissance client doit être revue ou complétée.",
      })
    }

    for (const campaign of campaigns) {
      const scheduledAt = parseMetadataDate(campaign.metadata)
      if (!scheduledAt || scheduledAt.getTime() > horizonEnd.getTime()) continue
      events.push({
        id: `campaign_${campaign.id}`,
        title: `Campagne programmée · ${campaign.name}`,
        description: campaign.description,
        type: "CAMPAIGN",
        status: campaign.status,
        priority: "INFO",
        dueDate: toIso(scheduledAt),
        source: "marketing",
        sourceLabel: "Marketing",
        href: "/marketing",
        context: [campaign.topic ? `Sujet : ${campaign.topic}` : "Campagne marketing"],
        recommendedAction: "Vérifier le segment, les consentements et la date d’envoi.",
      })
    }

    events.sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return left - right
    })

    return ok(events.slice(0, 700))
  } catch (error) {
    return handleApiError(error)
  }
}
