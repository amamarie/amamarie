import Link from "next/link"
import {
  AlertTriangle,
  Brain,
  Compass,
  Flag,
  HeartPulse,
  PiggyBank,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const goalTypeLabels: Record<string, string> = {
  RETIREMENT: "Retraite",
  PROTECTION: "Protection famille",
  TAX: "Fiscalité",
  ESTATE: "Transmission",
  EDUCATION: "Études",
  HOME: "Immobilier",
  SAVINGS: "Épargne",
  INVESTMENT: "Placement",
  INCOME: "Revenus complémentaires",
  OTHER: "Autre",
}

const analysisStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Revue conseiller",
  RECOMMENDATION_PREPARED: "Recommandation préparée",
  WAITING_CLIENT: "En attente client",
  COMPLETED: "Complétée",
  DELIVERED: "Remise au client",
  USED_FOR_SUBMISSION: "Utilisée",
  NEEDS_UPDATE: "À mettre à jour",
  ARCHIVED: "Archivée",
  NOT_STARTED: "Non commencée",
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non chiffré"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function priorityTone(priority?: string | null) {
  const value = String(priority ?? "").toUpperCase()
  if (value === "HIGH" || value === "URGENT" || value === "CRITICAL") return "rose" as const
  if (value === "MEDIUM" || value === "NORMAL") return "amber" as const
  return "slate" as const
}

function completionRatio(current?: number | null, target?: number | null) {
  if (!target || target <= 0 || !current || current <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function hasObjective(client: {
  primaryGoal: string | null
  goals: string | null
  financialGoals: string | null
  kycProfile: { primaryObjective: string | null; financialGoals: string | null } | null
  investmentProfile: { primaryObjective: string | null } | null
  financialGoalItems: unknown[]
}) {
  return Boolean(
    client.primaryGoal ||
      client.goals ||
      client.financialGoals ||
      client.kycProfile?.primaryObjective ||
      client.kycProfile?.financialGoals ||
      client.investmentProfile?.primaryObjective ||
      client.financialGoalItems.length
  )
}

export default async function GoalsAndNeedsPage() {
  const { organizationId } = await getTenantContext()

  const clients = await prisma.client.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      primaryGoal: true,
      goals: true,
      financialGoals: true,
      investmentHorizon: true,
      retirementGoal: true,
      protectionNeeds: true,
      nextReviewDate: true,
      advisor: { select: { name: true } },
      kycProfile: {
        select: {
          status: true,
          primaryObjective: true,
          financialGoals: true,
          investmentHorizon: true,
          riskTolerance: true,
          riskProfileResult: true,
          protectionNeeds: true,
          estatePlanningNeeds: true,
          educationFundingNeeds: true,
          homePurchaseGoal: true,
          taxOptimizationGoal: true,
          nextKycReviewAt: true,
        },
      },
      investmentProfile: {
        select: {
          primaryObjective: true,
          timeHorizon: true,
          liquidityNeeds: true,
          finalRiskProfile: true,
          finalRiskScore: true,
          riskToleranceScore: true,
          riskCapacityScore: true,
          clientConfirmedAt: true,
          advisorValidatedAt: true,
        },
      },
      financialGoalItems: {
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          goalName: true,
          goalType: true,
          priority: true,
          targetAmount: true,
          currentAmount: true,
          timeHorizonYears: true,
          liquidityNeed: true,
          riskLevelForGoal: true,
          lastReviewedAt: true,
        },
      },
      insuranceNeedsAnalyses: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          analysisType: true,
          status: true,
          objective: true,
          summary: true,
          updatedAt: true,
          reportDocumentId: true,
        },
      },
      productRecommendations: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          priority: true,
          status: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  const clientsWithObjectives = clients.filter(hasObjective)
  const clientsWithoutObjectives = clients.filter((client) => !hasObjective(client))
  const goals = clients.flatMap((client) => client.financialGoalItems.map((goal) => ({ ...goal, client })))
  const highPriorityGoals = goals.filter((goal) => ["HIGH", "URGENT", "CRITICAL"].includes(goal.priority.toUpperCase()))
  const analysesToUpdate = clients.flatMap((client) =>
    client.insuranceNeedsAnalyses
      .filter((analysis) => ["MISSING_DATA", "NEEDS_UPDATE", "DRAFT", "ADVISOR_REVIEW"].includes(analysis.status))
      .map((analysis) => ({ ...analysis, client }))
  )
  const recommendationsOpen = clients.flatMap((client) =>
    client.productRecommendations
      .filter((recommendation) => !["COMPLETED", "SIGNED", "DISMISSED", "ARCHIVED"].includes(recommendation.status))
      .map((recommendation) => ({ ...recommendation, client }))
  )

  const nextActionRows = clients
    .map((client) => {
      const missingObjective = !hasObjective(client)
      const noRiskProfile = !client.investmentProfile?.finalRiskProfile && !client.kycProfile?.riskProfileResult
      const needsAnalysis = client.insuranceNeedsAnalyses.some((analysis) => ["MISSING_DATA", "NEEDS_UPDATE", "DRAFT"].includes(analysis.status))
      const openRecommendation = client.productRecommendations.some((recommendation) => !["COMPLETED", "SIGNED", "DISMISSED", "ARCHIVED"].includes(recommendation.status))
      const score = (missingObjective ? 35 : 0) + (noRiskProfile ? 25 : 0) + (needsAnalysis ? 25 : 0) + (openRecommendation ? 15 : 0)
      let action = "Mettre à jour les objectifs"
      if (missingObjective) action = "Formaliser les objectifs client"
      else if (noRiskProfile) action = "Compléter le profil investisseur"
      else if (needsAnalysis) action = "Finaliser l’analyse des besoins"
      else if (openRecommendation) action = "Traiter la recommandation ouverte"

      return { client, score, action, missingObjective, noRiskProfile, needsAnalysis, openRecommendation }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)

  return (
    <AppShell moduleKey="client-profile">
      <PageShell
        eyebrow="CRM métier"
        title="Objectifs & besoins"
        description="Vue consolidée des objectifs clients, profils investisseurs, analyses des besoins et recommandations à traiter."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Target} label="Clients avec objectifs" value={String(clientsWithObjectives.length)} detail={`${clients.length} client(s) actifs suivis`} />
          <Metric icon={AlertTriangle} label="Objectifs manquants" value={String(clientsWithoutObjectives.length)} detail="À formaliser avant recommandation" />
          <Metric icon={Flag} label="Objectifs prioritaires" value={String(highPriorityGoals.length)} detail="Priorité haute ou critique" />
          <Metric icon={HeartPulse} label="Analyses à reprendre" value={String(analysesToUpdate.length)} detail="Brouillon, manque ou mise à jour" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <ContentCard title="Objectifs financiers" description="Objectifs structurés issus du profil client / KYC.">
            {goals.length === 0 ? (
              <EmptyState text="Aucun objectif financier structuré n’est encore enregistré." />
            ) : (
              <div className="grid gap-3">
                {goals.slice(0, 25).map((goal) => {
                  const ratio = completionRatio(goal.currentAmount, goal.targetAmount)
                  return (
                    <article key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={priorityTone(goal.priority)}>{goal.priority.toLowerCase()}</StatusBadge>
                            <StatusBadge tone="sky">{goalTypeLabels[goal.goalType] ?? goal.goalType}</StatusBadge>
                          </div>
                          <h2 className="mt-3 text-lg font-black text-slate-950">{goal.goalName}</h2>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            <Link href={`/clients/${goal.client.id}?tab=kyc`} className="font-black text-emerald-700 hover:underline">
                              {clientName(goal.client)}
                            </Link>
                            {" "}· {goal.client.advisor?.name ?? "Conseiller non assigné"}
                          </p>
                        </div>
                        <div className="shrink-0 text-left lg:text-right">
                          <p className="text-sm font-black text-slate-950">{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{ratio} % atteint · horizon {goal.timeHorizonYears ?? "?"} an(s)</p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio}%` }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge tone="slate">Liquidité : {goal.liquidityNeed ?? "à préciser"}</StatusBadge>
                        <StatusBadge tone="slate">Risque : {goal.riskLevelForGoal ?? "à préciser"}</StatusBadge>
                        <StatusBadge tone="slate">Revu le {formatDate(goal.lastReviewedAt)}</StatusBadge>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Objectifs à formaliser" description="Clients actifs sans objectif exploitable.">
              {clientsWithoutObjectives.length === 0 ? (
                <EmptyState text="Tous les clients suivis ont au moins un objectif renseigné." />
              ) : (
                <div className="grid gap-2">
                  {clientsWithoutObjectives.slice(0, 10).map((client) => (
                    <Link key={client.id} href={`/clients/${client.id}?tab=kyc`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-200 hover:bg-amber-50">
                      <p className="font-black text-slate-950">{clientName(client)}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{client.advisor?.name ?? "Conseiller non assigné"}</p>
                    </Link>
                  ))}
                </div>
              )}
            </ContentCard>

            <ContentCard title="Répartition des objectifs" description="Types d’objectifs structurés.">
              <GoalBreakdown goals={goals} />
            </ContentCard>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ContentCard title="Prochaines actions utiles" description="Score simple basé sur objectifs, profil risque, analyses et recommandations.">
            {nextActionRows.length === 0 ? (
              <EmptyState text="Aucune action objectif/besoin prioritaire." />
            ) : (
              <div className="grid gap-3">
                {nextActionRows.map((row) => (
                  <Link key={row.client.id} href={`/clients/${row.client.id}?tab=kyc`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-black text-slate-950">{clientName(row.client)}</h2>
                      <StatusBadge tone={row.score >= 60 ? "rose" : "amber"}>Priorité {row.score} / 100</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{row.action}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.missingObjective ? <StatusBadge tone="rose">Objectif absent</StatusBadge> : null}
                      {row.noRiskProfile ? <StatusBadge tone="amber">Profil risque à compléter</StatusBadge> : null}
                      {row.needsAnalysis ? <StatusBadge tone="amber">Analyse à reprendre</StatusBadge> : null}
                      {row.openRecommendation ? <StatusBadge tone="violet">Recommandation ouverte</StatusBadge> : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Analyses et recommandations" description="Besoins exprimés qui doivent devenir une action documentée.">
            <div className="grid gap-4">
              <div>
                <p className="mb-2 text-xs font-black uppercase text-slate-500">Analyses à reprendre</p>
                {analysesToUpdate.length === 0 ? (
                  <EmptyState text="Aucune analyse ouverte à reprendre." />
                ) : (
                  <div className="grid gap-2">
                    {analysesToUpdate.slice(0, 8).map((analysis) => (
                      <Link key={analysis.id} href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-200 hover:bg-amber-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{clientName(analysis.client)}</p>
                          <StatusBadge tone="amber">{analysisStatusLabels[analysis.status] ?? analysis.status}</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{analysis.objective ?? analysis.summary ?? "Objectif à préciser"}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase text-slate-500">Recommandations ouvertes</p>
                {recommendationsOpen.length === 0 ? (
                  <EmptyState text="Aucune recommandation ouverte." />
                ) : (
                  <div className="grid gap-2">
                    {recommendationsOpen.slice(0, 8).map((recommendation) => (
                      <Link key={recommendation.id} href={`/clients/${recommendation.client.id}?tab=recommendations`} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:bg-violet-50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{recommendation.title}</p>
                          <StatusBadge tone={priorityTone(recommendation.priority)}>{recommendation.priority.toLowerCase()}</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{clientName(recommendation.client)} · {recommendation.status.toLowerCase()}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ContentCard>
        </div>

        <ContentCard title="Lecture métier" description="Cette page sert à préparer les rendez-vous et éviter les recommandations sans besoin formalisé.">
          <div className="grid gap-3 md:grid-cols-4">
            <Advice icon={Compass} label="Clarifier" text="Objectif, horizon, priorité et montant cible." />
            <Advice icon={Brain} label="Qualifier" text="Profil investisseur, tolérance au risque et liquidité." />
            <Advice icon={HeartPulse} label="Analyser" text="Besoins de protection, retraite, fiscalité ou transmission." />
            <Advice icon={PiggyBank} label="Transformer" text="Recommandation, tâche ou opportunité commerciale documentée." />
          </div>
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-[0_6px_0_#bbf7d0]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function GoalBreakdown({ goals }: { goals: Array<{ goalType: string }> }) {
  if (goals.length === 0) return <EmptyState text="Aucun objectif à répartir." />

  const counts = new Map<string, number>()
  for (const goal of goals) counts.set(goal.goalType, (counts.get(goal.goalType) ?? 0) + 1)

  return (
    <div className="grid gap-2">
      {Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([goalType, count]) => (
          <div key={goalType} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-950">{goalTypeLabels[goalType] ?? goalType}</p>
            <StatusBadge tone="sky">{count}</StatusBadge>
          </div>
        ))}
    </div>
  )
}

function Advice({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="size-5 text-emerald-700" />
      <p className="mt-3 font-black text-slate-950">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
