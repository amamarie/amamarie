import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  FileCheck2,
  Gauge,
  Lightbulb,
  MessageSquareText,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { calculatePortfolioHealthScore } from "@/lib/portfolio/calculations"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { AppShell } from "@/components/layout/AppShell"

const closedLeadStatuses = new Set(["WON", "CONVERTED", "LOST", "ARCHIVED"])
const activeTaskStatuses = new Set(["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"])
const positiveLeadStatuses = new Set(["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "CONVERTED"])

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function daysSince(value?: Date | null) {
  if (!value) return null
  return Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24))
}

function scoreTone(score: number) {
  if (score >= 80) return "emerald" as const
  if (score >= 55) return "amber" as const
  return "rose" as const
}

function scoreLabel(score: number) {
  if (score >= 80) return "Solide"
  if (score >= 55) return "À renforcer"
  return "Prioritaire"
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function relationScore(client: {
  lastContactAt: Date | null
  totalInteractions: number
  tasks: Array<{ status: string }>
  activities: Array<{ id: string }>
}) {
  let score = 0
  const actions: string[] = []
  const lastContactDays = daysSince(client.lastContactAt)

  if (lastContactDays !== null && lastContactDays <= 30) score += 35
  else if (lastContactDays !== null && lastContactDays <= 90) score += 25
  else if (lastContactDays !== null && lastContactDays <= 180) score += 15
  else actions.push("Planifier un contact client")

  if (client.totalInteractions >= 5 || client.activities.length >= 5) score += 25
  else if (client.totalInteractions >= 2 || client.activities.length >= 2) score += 15
  else actions.push("Documenter davantage les échanges")

  const overdueTasks = client.tasks.filter((task) => task.status === "OVERDUE").length
  const openTasks = client.tasks.filter((task) => activeTaskStatuses.has(task.status)).length
  if (overdueTasks === 0 && openTasks <= 3) score += 25
  else if (overdueTasks === 0) score += 15
  else actions.push("Traiter les tâches en retard")

  if (client.activities.length > 0) score += 15
  else actions.push("Créer une note ou activité de suivi")

  return { score: clampScore(score), actions }
}

function opportunityScore(client: {
  retirementGoal: boolean
  protectionNeeds: boolean
  consentGiven: boolean
  products: Array<{ status: string; category: string }>
  productRecommendations: Array<{ status: string; priority: string }>
  crossSellOpportunities: Array<{ status: string; priority: string; confidence: number | null }>
}) {
  let score = 0
  const actions: string[] = []
  const activeProducts = client.products.filter((product) => ["ACTIVE", "PENDING", "UNDER_REVIEW"].includes(product.status))
  const hasInvestment = activeProducts.some((product) => product.category === "INVESTMENT")
  const hasInsurance = activeProducts.some((product) => product.category === "INSURANCE")
  const openRecommendations = client.productRecommendations.filter((recommendation) => !["COMPLETED", "SIGNED", "DISMISSED", "ARCHIVED"].includes(recommendation.status))
  const openCrossSell = client.crossSellOpportunities.filter((opportunity) => !["WON", "LOST", "DISMISSED", "ARCHIVED"].includes(opportunity.status))

  if (openRecommendations.length > 0) score += 30
  if (openCrossSell.length > 0) score += 30
  if ((client.retirementGoal && !hasInvestment) || (client.protectionNeeds && !hasInsurance)) score += 20
  if (client.consentGiven) score += 10
  if (activeProducts.length >= 2) score += 10

  if (openRecommendations.length === 0 && openCrossSell.length === 0) actions.push("Générer ou qualifier les opportunités")
  if (client.retirementGoal && !hasInvestment) actions.push("Qualifier une solution retraite ou placement")
  if (client.protectionNeeds && !hasInsurance) actions.push("Qualifier une protection famille ou prévoyance")
  if (!client.consentGiven) actions.push("Vérifier le consentement marketing avant campagne")

  return { score: clampScore(score), actions }
}

function prospectScore(lead: {
  status: string
  priority: string
  estimatedValue: number | null
  lastContactAt: Date | null
  tasks: Array<{ status: string }>
  activities: Array<{ id: string }>
}) {
  let score = 0
  const actions: string[] = []
  if (positiveLeadStatuses.has(lead.status)) score += 25
  if (lead.priority === "HIGH" || lead.priority === "URGENT") score += 20
  if ((lead.estimatedValue ?? 0) > 0) score += lead.estimatedValue && lead.estimatedValue >= 5000 ? 20 : 10
  if (lead.lastContactAt && daysSince(lead.lastContactAt)! <= 14) score += 20
  else actions.push("Relancer le prospect")
  if (lead.tasks.some((task) => activeTaskStatuses.has(task.status))) score += 10
  else actions.push("Créer une tâche de suivi")
  if (lead.activities.length > 0) score += 5

  return { score: clampScore(score), actions }
}

export default async function CrmScoresPage() {
  const { organizationId } = await getTenantContext()

  const [clients, leads, priorityItems] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        riskProfile: true,
        financialGoals: true,
        goals: true,
        lastContactAt: true,
        totalInteractions: true,
        kycCompleted: true,
        identityVerified: true,
        consentGiven: true,
        retirementGoal: true,
        protectionNeeds: true,
        advisor: { select: { name: true } },
        documents: { select: { status: true } },
        products: {
          select: {
            id: true,
            category: true,
            type: true,
            status: true,
            primaryBeneficiary: true,
            documentStatus: true,
            nextReviewAt: true,
            lastReviewAt: true,
          },
        },
        tasks: { select: { status: true } },
        activities: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 12 },
        productRecommendations: {
          select: { status: true, priority: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        },
        crossSellOpportunities: {
          select: { status: true, priority: true, confidence: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 120,
    }),
    prisma.lead.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        priority: true,
        estimatedValue: true,
        lastContactAt: true,
        advisor: { select: { name: true } },
        tasks: { select: { status: true } },
        activities: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 8 },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.priorityItem.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { name: true } },
      },
      orderBy: [{ score: "desc" }, { dueAt: "asc" }],
      take: 30,
    }),
  ])

  const clientScores = clients.map((client) => {
    const dossier = calculatePortfolioHealthScore(client, client.products, client.documents, client.tasks)
    const relation = relationScore(client)
    const opportunity = opportunityScore(client)
    const global = clampScore(dossier.score * 0.4 + relation.score * 0.3 + opportunity.score * 0.3)
    const actions = [...dossier.actions, ...relation.actions, ...opportunity.actions]

    return { client, dossier, relation, opportunity, global, actions: Array.from(new Set(actions)).slice(0, 4) }
  }).sort((a, b) => a.global - b.global)

  const prospectScores = leads
    .filter((lead) => !closedLeadStatuses.has(lead.status))
    .map((lead) => ({ lead, result: prospectScore(lead) }))
    .sort((a, b) => b.result.score - a.result.score)

  const averageGlobal = clientScores.length > 0
    ? Math.round(clientScores.reduce((sum, row) => sum + row.global, 0) / clientScores.length)
    : 0
  const priorityClients = clientScores.filter((row) => row.global < 55).length
  const strongClients = clientScores.filter((row) => row.global >= 80).length
  const hotProspects = prospectScores.filter((row) => row.result.score >= 70).length

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Scores CRM"
        description="Scores relation, dossier, opportunité et prospects chauds calculés depuis les données réelles du CRM."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Gauge} label="Score moyen client" value={`${averageGlobal}/100`} detail="Relation, dossier et opportunité" />
          <Metric icon={AlertTriangle} label="Clients prioritaires" value={String(priorityClients)} detail="Score global inférieur à 55" />
          <Metric icon={FileCheck2} label="Dossiers solides" value={String(strongClients)} detail="Score global supérieur à 80" />
          <Metric icon={Target} label="Prospects chauds" value={String(hotProspects)} detail="Score prospect supérieur à 70" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
          <ContentCard title="Scores clients" description="Classement du plus prioritaire au plus solide.">
            {clientScores.length === 0 ? (
              <EmptyState text="Aucun client à scorer." />
            ) : (
              <div className="grid gap-3">
                {clientScores.slice(0, 40).map(({ client, dossier, relation, opportunity, global, actions }) => (
                  <Link key={client.id} href={`/clients/${client.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={scoreTone(global)}>{scoreLabel(global)} · {global}/100</StatusBadge>
                          <StatusBadge tone="slate">{client.advisor?.name ?? "Conseiller non assigné"}</StatusBadge>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-slate-950">{clientName(client)}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Prochaine action : {actions[0] ?? "Maintenir le suivi actuel"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      <ScoreBlock label="Dossier" score={dossier.score} icon={FileCheck2} />
                      <ScoreBlock label="Relation" score={relation.score} icon={MessageSquareText} />
                      <ScoreBlock label="Opportunité" score={opportunity.score} icon={TrendingUp} />
                    </div>

                    {actions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {actions.map((action) => <StatusBadge key={action} tone="amber">{action}</StatusBadge>)}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Prospects chauds" description="Score basé sur statut, priorité, valeur, relance et activité.">
              {prospectScores.length === 0 ? (
                <EmptyState text="Aucun prospect ouvert." />
              ) : (
                <div className="grid gap-2">
                  {prospectScores.slice(0, 10).map(({ lead, result }) => (
                    <Link key={lead.id} href={`/prospects/${lead.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{clientName(lead)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{lead.advisor?.name ?? "Conseiller non assigné"}</p>
                        </div>
                        <StatusBadge tone={scoreTone(result.score)}>{result.score}/100</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">{result.actions[0] ?? "Continuer la conversion"}</p>
                    </Link>
                  ))}
                </div>
              )}
            </ContentCard>

            <ContentCard title="Priorités existantes" description="Scores déjà calculés par le moteur de priorités.">
              {priorityItems.length === 0 ? (
                <EmptyState text="Aucune priorité active calculée." />
              ) : (
                <div className="grid gap-2">
                  {priorityItems.slice(0, 10).map((item) => (
                    <Link key={item.id} href={item.actionUrl ?? item.clientId ? `/clients/${item.clientId}` : "/priorities"} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:bg-violet-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{item.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {item.client ? clientName(item.client) : item.lead ? clientName(item.lead) : "Dossier"} · {item.advisor?.name ?? "Non assigné"}
                          </p>
                        </div>
                        <StatusBadge tone={scoreTone(item.score)}>{item.score}/100</StatusBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ContentCard>
          </div>
        </div>

        <ContentCard title="Méthode de calcul" description="Les scores sont volontairement lisibles et auditables.">
          <div className="grid gap-3 md:grid-cols-4">
            <Advice icon={FileCheck2} label="Dossier" text="KYC, identité, consentement, documents, objectifs et bénéficiaires." />
            <Advice icon={Activity} label="Relation" text="Dernier contact, interactions, tâches ouvertes et activité récente." />
            <Advice icon={Lightbulb} label="Opportunité" text="Recommandations, cross-sell, besoins déclarés et consentement." />
            <Advice icon={UserRound} label="Prospect" text="Statut, priorité, valeur estimée, relance et activité commerciale." />
          </div>
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-[0_6px_0_#bae6fd]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-sky-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function ScoreBlock({ icon: Icon, label, score }: { icon: LucideIcon; label: string; score: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Icon className="size-4 text-slate-500" />
          {label}
        </p>
        <StatusBadge tone={scoreTone(score)}>{score}/100</StatusBadge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function Advice({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="size-5 text-sky-700" />
      <p className="mt-3 font-black text-slate-950">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
