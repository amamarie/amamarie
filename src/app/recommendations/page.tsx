"use client"

import {
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  Loader2,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type Recommendation = {
  id: string
  type: string
  priority: string
  status: string
  title: string
  description: string
  createdAt: string
  client: { id: string; firstName: string; lastName: string }
}

type InsuranceAnalysis = {
  id: string
  analysisType: string
  status: string
  summary: string | null
  reportDocumentId: string | null
  updatedAt: string
  client: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null }
  advisor: { id: string; name: string | null; email: string | null } | null
  reportDocument: { id: string; name: string; status: string } | null
  results: Array<{ gapAmount: number | null; netNeed: number | null; grossNeed: number | null }>
  recommendations: Array<{
    recommendedProductType: string
    recommendedAmount: number | null
    recommendedTerm: string | null
    reasoning: string
  }>
}

type ViewMode = "recommendations" | "analyses"

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

const typeLabels: Record<string, string> = {
  PROTECTION: "Protection",
  INVESTMENT_REVIEW: "Révision placement",
  COMPLIANCE: "Conformité",
  FOLLOW_UP: "Suivi",
  CROSS_SELL_OPPORTUNITY: "Discussion potentielle",
  DATA_QUALITY: "Qualité des données",
}

const statusLabels: Record<string, string> = {
  OPEN: "Ouverte",
  REVIEWED: "Consultée",
  DISMISSED: "Ignorée",
  CONVERTED_TO_TASK: "Convertie en tâche",
  COMPLETED: "Complétée",
  ARCHIVED: "Archivée",
}

const analysisTypeLabels: Record<string, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Entreprise",
  REPLACEMENT: "Remplacement",
}

const analysisStatusLabels: Record<string, string> = {
  NOT_STARTED: "Non commencée",
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Révision conseiller",
  RECOMMENDATION_PREPARED: "Recommandation préparée",
  WAITING_CLIENT: "En attente client",
  COMPLETED: "Complétée",
  DELIVERED: "Remise au client",
  USED_FOR_SUBMISSION: "Utilisée pour soumission",
  ARCHIVED: "Archivée",
  NEEDS_UPDATE: "À mettre à jour",
}

const priorityTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  LOW: "emerald",
  MEDIUM: "sky",
  HIGH: "amber",
  CRITICAL: "rose",
}

const analysisStatusTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  DRAFT: "sky",
  MISSING_DATA: "amber",
  IN_ANALYSIS: "sky",
  ADVISOR_REVIEW: "amber",
  RECOMMENDATION_PREPARED: "violet",
  WAITING_CLIENT: "amber",
  COMPLETED: "emerald",
  DELIVERED: "emerald",
  USED_FOR_SUBMISSION: "emerald",
  NEEDS_UPDATE: "rose",
  ARCHIVED: "slate",
  NOT_STARTED: "slate",
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non calculé"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [analyses, setAnalyses] = useState<InsuranceAnalysis[]>([])
  const [status, setStatus] = useState("OPEN")
  const [viewMode, setViewMode] = useState<ViewMode>("recommendations")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setIsLoading(true)
    setError(null)
    try {
      const recommendationParams = status ? `?status=${status}` : ""
      const [recommendationData, analysisData] = await Promise.all([
        readData<Recommendation[]>(await fetch(`/api/recommendations${recommendationParams}`, { cache: "no-store" })),
        readData<InsuranceAnalysis[]>(await fetch("/api/insurance-analyses?scope=open", { cache: "no-store" })),
      ])
      setRecommendations(recommendationData)
      setAnalyses(analysisData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de récupérer les recommandations.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const summary = useMemo(() => {
    return {
      open: recommendations.filter((recommendation) => recommendation.status === "OPEN").length,
      critical: recommendations.filter((recommendation) => recommendation.priority === "CRITICAL").length,
      high: recommendations.filter((recommendation) => recommendation.priority === "HIGH").length,
      analyses: analyses.length,
      reportsMissing: analyses.filter((analysis) => !analysis.reportDocumentId).length,
    }
  }, [analyses, recommendations])

  return (
    <PageShell
      eyebrow="Moteur conseil"
      title="Recommandations et analyses"
      description="Une recommandation professionnelle doit être liée à une analyse, aux données du profil client, aux documents et à la preuve conservée au dossier."
    >
      <section className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Centre recommandation</p>
            <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-tight">Valider le besoin avant de recommander</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
              Les pistes internes restent séparées du conseil final. L’analyse d’assurance sert à documenter les écarts, les hypothèses, le rapport et la justification du conseiller.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void loadData()}>
              <RefreshCw className="size-4" />
              Rafraîchir
            </Button>
            <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" asChild>
              <Link href="/compliance?view=needs_analysis">Analyses à finaliser</Link>
            </Button>
          </div>
        </div>
      </section>

      <ContentCard title="Résumé opérationnel" description="Indicateurs réels issus des recommandations et analyses ouvertes.">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <ViewButton active={viewMode === "recommendations"} onClick={() => setViewMode("recommendations")}>
              Recommandations internes
            </ViewButton>
            <ViewButton active={viewMode === "analyses"} onClick={() => setViewMode("analyses")}>
              Analyses d’assurance
            </ViewButton>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Filtrer les recommandations par statut"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Ouvertes" value={summary.open} detail="Recommandations internes" />
          <Metric label="Critiques" value={summary.critical} detail="À valider rapidement" tone="rose" />
          <Metric label="Haute priorité" value={summary.high} detail="Suivi conseiller" tone="amber" />
          <Metric label="Analyses" value={summary.analyses} detail="À compléter ou verrouiller" tone="sky" />
          <Metric label="Rapports manquants" value={summary.reportsMissing} detail="Preuve à générer" tone={summary.reportsMissing > 0 ? "amber" : "emerald"} />
        </div>
      </ContentCard>

      {isLoading ? (
        <ContentCard title="Chargement">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Loader2 className="size-4 animate-spin" />
            Chargement des recommandations et analyses...
          </div>
        </ContentCard>
      ) : error ? (
        <ContentCard title="Erreur">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </ContentCard>
      ) : viewMode === "analyses" ? (
        <AnalysesList analyses={analyses} />
      ) : (
        <RecommendationsList recommendations={recommendations} />
      )}
    </PageShell>
  )
}

function ViewButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "shrink-0 rounded-full border-2 border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white"
        : "shrink-0 rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"}
    >
      {children}
    </button>
  )
}

function RecommendationsList({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <ContentCard title="Aucune recommandation">
        <p className="text-sm font-semibold text-slate-600">Aucune recommandation ne correspond au filtre sélectionné.</p>
      </ContentCard>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {recommendations.map((recommendation) => (
        <article key={recommendation.id} className="rounded-[1.5rem] border-2 border-slate-100 bg-white p-5 shadow-[0_6px_0_#f1f5f9]">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={priorityTone[recommendation.priority] ?? "slate"}>
              {priorityLabels[recommendation.priority] ?? recommendation.priority}
            </StatusBadge>
            <StatusBadge tone="violet">{typeLabels[recommendation.type] ?? recommendation.type}</StatusBadge>
            <StatusBadge tone="slate">{statusLabels[recommendation.status] ?? recommendation.status}</StatusBadge>
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-950">{recommendation.title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{recommendation.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-700">{clientName(recommendation.client)}</p>
            <Button asChild variant="outline" className="rounded-full border-2 font-black">
              <Link href={`/clients/${recommendation.client.id}?tab=opportunities`}>
                <ClipboardList className="size-4" />
                Voir recommandation
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function AnalysesList({ analyses }: { analyses: InsuranceAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <ContentCard title="Aucune analyse à finaliser">
        <p className="text-sm font-semibold text-slate-600">Les analyses ouvertes apparaîtront ici dès qu’un conseiller les crée dans une fiche client.</p>
      </ContentCard>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {analyses.map((analysis) => {
        const result = analysis.results[0]
        const recommendation = analysis.recommendations[0]

        return (
          <article key={analysis.id} className="rounded-[1.5rem] border-2 border-slate-100 bg-white p-5 shadow-[0_6px_0_#f1f5f9]">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="violet">{analysisTypeLabels[analysis.analysisType] ?? analysis.analysisType}</StatusBadge>
              <StatusBadge tone={analysisStatusTone[analysis.status] ?? "slate"}>{analysisStatusLabels[analysis.status] ?? analysis.status}</StatusBadge>
              <StatusBadge tone={analysis.reportDocumentId ? "emerald" : "amber"}>
                {analysis.reportDocumentId ? "Rapport généré" : "Rapport requis"}
              </StatusBadge>
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">{clientName(analysis.client)}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {analysis.summary ?? recommendation?.reasoning ?? "Analyse à compléter avant de soutenir une recommandation."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SmallFact label="Besoin net" value={formatMoney(result?.netNeed)} />
              <SmallFact label="Écart" value={formatMoney(result?.gapAmount)} />
              <SmallFact label="Recommandé" value={formatMoney(recommendation?.recommendedAmount)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800">
                <Link href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`}>
                  <HeartPulse className="size-4" />
                  Ouvrir l’analyse
                </Link>
              </Button>
              {analysis.reportDocument ? (
                <Button asChild variant="outline" className="rounded-full border-2 font-black">
                  <Link href={`/documents/${analysis.reportDocument.id}`}>
                    <FileCheck2 className="size-4" />
                    Voir rapport
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="rounded-full border-2 font-black">
                  <Link href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`}>
                    <ClipboardCheck className="size-4" />
                    Générer rapport
                  </Link>
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Metric({ label, value, detail, tone = "slate" }: { label: string; value: number; detail: string; tone?: "slate" | "emerald" | "sky" | "amber" | "rose" }) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-800 shadow-[0_6px_0_#e2e8f0]",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_6px_0_#bbf7d0]",
    sky: "border-sky-200 bg-sky-50 text-sky-900 shadow-[0_6px_0_#bae6fd]",
    amber: "border-amber-200 bg-amber-50 text-amber-900 shadow-[0_6px_0_#fde68a]",
    rose: "border-rose-200 bg-rose-50 text-rose-900 shadow-[0_6px_0_#fecdd3]",
  }[tone]

  return (
    <div className={`rounded-2xl border-2 p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </div>
  )
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  )
}
