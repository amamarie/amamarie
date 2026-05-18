"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CheckSquare,
  Clock3,
  FileText,
  Flame,
  FolderKanban,
  Gauge,
  HeartPulse,
  History,
  LayoutDashboard,
  Loader2,
  MailCheck,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  UsersRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"

type DashboardSummary = {
  scope: "my" | "organization"
  kpis: {
    newLeadsThisMonth: number
    newLeadsPreviousMonth: number
    tasksToday: number
    overdueTasks: number
    activeClients: number
    unreadNotifications: number
    requiredDocuments: number
    upcomingRenewals: number
    criticalAlerts: number
    productsToReview: number
    averageComplianceScore: number | null
    estimatedCommissions: number
    needsAnalysesToReview: number
  }
  leadPipeline: { status: string; count: number }[]
  recentActivities: { id: string; title: string; description: string | null; createdAt: string; user?: { name: string | null } | null }[]
  todayTasks: TaskItem[]
  overdueTasksList: TaskItem[]
  importantAlerts: { id: string; title: string; description: string; severity: string; actionUrl: string | null; createdAt: string; client: Person | null }[]
  upcomingRenewalsList: { id: string; productName: string | null; company: string | null; type: string; renewalAt: string | null; client: Person }[]
  requiredDocumentsList: { id: string; name: string; type: string; status: string; requiredBy: string | null; expiresAt: string | null; client: Person | null; lead: Person | null }[]
  hotLeads: { id: string; firstName: string; lastName: string; phone: string; status: string; source: string; priority: string; nextAction: string | null; estimatedValue: number | null }[]
  priorities: { id: string; level: string; score: number; title: string; reason: string | null; suggestedAction: string | null; actionUrl: string | null; dueAt: string | null; entityType: string }[]
  productsToReview: { id: string; productName: string | null; company: string | null; type: string; nextReviewAt: string | null; lastReviewAt: string | null; client: Person }[]
  needsAnalysesList: { id: string; analysisType: string; status: string; summary: string | null; reportDocumentId: string | null; updatedAt: string; client: Person; results: { gapAmount: number }[] }[]
  generatedAt: string
}

type Person = { id: string; firstName: string; lastName: string }
type TaskItem = { id: string; title: string; priority: string; status: string; dueDate: string | null; client: Person | null; lead: Person | null }
type ActionNotice = { type: "success" | "error"; message: string } | null
type JsonEnvelope<T> = { ok?: boolean; data?: T; error?: { message?: string } }
type GmailSyncResult = { checked?: number; imported?: number; skipped?: number }
type PriorityGenerationResult = { generated?: number; created?: number; count?: number; priorities?: unknown[] }

const leadStatusLabels: Record<string, string> = {
  NEW: "Nouveau",
  TO_CONTACT: "À contacter",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Proposition",
  NEGOTIATION: "Discussion",
  WON: "Gagné",
  CONVERTED: "Converti",
}

const insuranceAnalysisTypeLabels: Record<string, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Assurance entreprise",
  REPLACEMENT: "Remplacement",
}

const insuranceAnalysisStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Révision conseiller",
  RECOMMENDATION_PREPARED: "Rapport requis",
  NEEDS_UPDATE: "À mettre à jour",
}

async function readResponse(response: Response) {
  const json = await response.json()
  if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Impossible de charger le dashboard.")
  return json.data as DashboardSummary
}

async function postAction<T>(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await response.json().catch(() => null)) as JsonEnvelope<T> | null
  if (!response.ok || !json?.ok) throw new Error(json?.error?.message ?? "Action impossible pour le moment.")
  return json.data as T
}

function formatDate(value: string | null) {
  if (!value) return "Aucune date"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function relativeDate(value: string) {
  const date = new Date(value)
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000)
  const formatter = new Intl.RelativeTimeFormat("fr-CA", { numeric: "auto" })
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute")
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour")
  return formatter.format(Math.round(diffHours / 24), "day")
}

function personName(person?: Person | null) {
  if (!person) return "Aucun dossier lié"
  return `${person.firstName} ${person.lastName}`
}

function currency(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function analysisTypeLabel(value: string) {
  return insuranceAnalysisTypeLabels[value] ?? value
}

function analysisStatusLabel(value: string) {
  return insuranceAnalysisStatusLabels[value] ?? value
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-80 animate-pulse rounded-[2rem] bg-emerald-100" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[1.5rem] bg-slate-100" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-80 animate-pulse rounded-[1.75rem] bg-slate-100" />
        <div className="h-80 animate-pulse rounded-[1.75rem] bg-slate-100" />
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-500">
      {message}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  detail: string
  href: string
  icon: typeof UserPlus
  tone: string
}) {
  return (
    <Link href={href} className={`group rounded-[1.5rem] border-2 p-4 transition hover:-translate-y-0.5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
        </div>
        <span className="rounded-2xl bg-white/70 p-2.5 ring-1 ring-black/5">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-xs font-bold leading-5 opacity-80">{detail}</p>
    </Link>
  )
}

function MetricGrid({ metrics }: { metrics: Array<Parameters<typeof MetricCard>[0]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  )
}

function AdvisoryHealthCards({ data }: { data: DashboardSummary }) {
  const complianceScore = data.kpis.averageComplianceScore
  const complianceTone =
    complianceScore == null
      ? "border-slate-200 bg-slate-50 text-slate-800 shadow-[0_7px_0_#e2e8f0]"
      : complianceScore < 70
        ? "border-rose-200 bg-rose-50 text-rose-800 shadow-[0_7px_0_#fecdd3]"
        : complianceScore < 85
          ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_7px_0_#fde68a]"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_7px_0_#bbf7d0]"

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Link href="/compliance" className={`group rounded-[1.5rem] border-2 p-4 transition hover:-translate-y-0.5 ${complianceTone}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide opacity-70">Santé conformité</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{complianceScore ?? "N/D"}</p>
            <p className="mt-1 text-sm font-bold opacity-80">Score moyen des profils client disponibles</p>
          </div>
          <span className="rounded-2xl bg-white/75 p-2.5 ring-1 ring-black/5">
            <ShieldCheck className="size-5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="rounded-[1rem] bg-white/70 px-3 py-2 text-xs font-black ring-1 ring-black/5">{data.kpis.criticalAlerts} alerte(s)</span>
          <span className="rounded-[1rem] bg-white/70 px-3 py-2 text-xs font-black ring-1 ring-black/5">{data.kpis.requiredDocuments} doc(s) requis</span>
        </div>
      </Link>

      <Link href="/clients" className="group rounded-[1.5rem] border-2 border-sky-200 bg-sky-50 p-4 text-sky-900 shadow-[0_7px_0_#bae6fd] transition hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide opacity-70">Revenus suivis</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{currency(data.kpis.estimatedCommissions)}</p>
            <p className="mt-1 text-sm font-bold opacity-80">Commissions estimées à partir des produits actifs</p>
          </div>
          <span className="rounded-2xl bg-white/75 p-2.5 ring-1 ring-black/5">
            <TrendingUp className="size-5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="rounded-[1rem] bg-white/70 px-3 py-2 text-xs font-black ring-1 ring-black/5">{data.kpis.productsToReview} produit(s) à réviser</span>
          <span className="rounded-[1rem] bg-white/70 px-3 py-2 text-xs font-black ring-1 ring-black/5">{data.kpis.upcomingRenewals} renouv. 30 jours</span>
        </div>
      </Link>
    </div>
  )
}

function Panel({ title, description, href, icon: Icon, children }: { title: string; description: string; href?: string; icon: typeof LayoutDashboard; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-[0_8px_0_#e2e8f0]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-700">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        {href ? (
          <Link href={href} className="rounded-full border-2 border-slate-200 bg-white p-2 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" aria-label={`Ouvrir ${title}`}>
            <ArrowUpRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function PriorityPill({ value }: { value: string }) {
  const tone = value === "URGENT" ? "bg-rose-100 text-rose-800 border-rose-200" : value === "HIGH" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-slate-100 text-slate-700 border-slate-200"
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}>{value}</span>
}

function TaskList({ items, empty }: { items: TaskItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState message={empty} />
  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((task) => (
        <Link key={task.id} href="/taches" className="block rounded-[1.25rem] border-2 border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{task.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{personName(task.client ?? task.lead)}</p>
            </div>
            <PriorityPill value={task.priority} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(task.dueDate)}</p>
        </Link>
      ))}
    </div>
  )
}

function CompactLinkRow({
  href,
  title,
  detail,
  right,
  tone = "slate",
}: {
  href: string
  title: string
  detail: string
  right?: string
  tone?: "slate" | "rose" | "orange" | "emerald"
}) {
  const marker = {
    slate: "bg-slate-300",
    rose: "bg-rose-400",
    orange: "bg-orange-400",
    emerald: "bg-emerald-500",
  }[tone]
  return (
    <Link href={href} className="flex items-start gap-3 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
      <span className={`mt-1 size-2.5 shrink-0 rounded-full ${marker}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
      </div>
      {right ? <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">{right}</span> : null}
    </Link>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionNotice>(null)
  const [syncingGmail, setSyncingGmail] = useState(false)
  const [generatingPriorities, setGeneratingPriorities] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await readResponse(await fetch("/api/dashboard/summary")))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  const syncGmail = useCallback(async () => {
    setSyncingGmail(true)
    setNotice(null)
    try {
      const result = (await postAction<GmailSyncResult>("/api/integrations/google/gmail/sync", { maxResults: 15 })) ?? {}
      setNotice({
        type: "success",
        message: `Gmail synchronisé: ${result.imported ?? 0} nouveau(x) prospect(s), ${result.skipped ?? 0} ignoré(s), ${result.checked ?? 0} message(s) vérifié(s).`,
      })
      await load()
    } catch (actionError) {
      setNotice({ type: "error", message: actionError instanceof Error ? actionError.message : "Synchronisation Gmail impossible." })
    } finally {
      setSyncingGmail(false)
    }
  }, [load])

  const generatePriorities = useCallback(async () => {
    setGeneratingPriorities(true)
    setNotice(null)
    try {
      const result = (await postAction<PriorityGenerationResult>("/api/priorities/generate", {})) ?? {}
      const generated = result.generated ?? result.created ?? result.count ?? result.priorities?.length
      setNotice({
        type: "success",
        message: typeof generated === "number" ? `${generated} priorité(s) conseiller recalculée(s).` : "Priorités conseiller recalculées.",
      })
      await load()
    } catch (actionError) {
      setNotice({ type: "error", message: actionError instanceof Error ? actionError.message : "Recalcul des priorités impossible." })
    } finally {
      setGeneratingPriorities(false)
    }
  }, [load])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const focus = useMemo(() => {
    if (!data) return { label: "Dossier clair", detail: "Aucune donnée chargée." }
    if (data.kpis.criticalAlerts > 0) return { label: "Conformité à traiter", detail: `${data.kpis.criticalAlerts} alerte(s) importante(s) ouvertes.` }
    if (data.kpis.overdueTasks > 0) return { label: "Suivis en retard", detail: `${data.kpis.overdueTasks} tâche(s) à reprendre.` }
    if (data.kpis.requiredDocuments > 0) return { label: "Documents à compléter", detail: `${data.kpis.requiredDocuments} document(s) requis ou expirés.` }
    return { label: "Dossiers sous contrôle", detail: "Aucun blocage majeur détecté pour l’instant." }
  }, [data])

  if (loading) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <div className="rounded-[1.75rem] border-2 border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-[0_8px_0_#fecdd3]">
        <p className="text-lg font-black">Dashboard indisponible</p>
        <p className="mt-2 text-sm font-semibold">{error}</p>
        <Button type="button" onClick={() => void load()} className="mt-5 rounded-full bg-white font-black text-rose-700 shadow-[0_4px_0_#fecdd3] hover:bg-rose-50">
          <RefreshCcw className="size-4" />
          Réessayer
        </Button>
      </div>
    )
  }

  const maxPipelineCount = Math.max(1, ...data.leadPipeline.map((item) => item.count))
  const operatingLoad = data.kpis.tasksToday + data.kpis.overdueTasks + data.kpis.criticalAlerts + data.kpis.requiredDocuments
  const metrics = [
    { label: "Prospects ce mois", value: data.kpis.newLeadsThisMonth, detail: `${data.kpis.newLeadsPreviousMonth} le mois précédent`, href: "/prospects?created=this-month", icon: UserPlus, tone: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_7px_0_#bbf7d0]" },
    { label: "Tâches aujourd’hui", value: data.kpis.tasksToday, detail: "Actions planifiées", href: "/taches?view=today", icon: CheckSquare, tone: "border-sky-200 bg-sky-50 text-sky-800 shadow-[0_7px_0_#bae6fd]" },
    { label: "En retard", value: data.kpis.overdueTasks, detail: "Suivis à reprendre", href: "/taches?view=overdue", icon: Clock3, tone: data.kpis.overdueTasks > 0 ? "border-rose-200 bg-rose-50 text-rose-800 shadow-[0_7px_0_#fecdd3]" : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_7px_0_#e2e8f0]" },
    { label: "Clients actifs", value: data.kpis.activeClients, detail: "Dossiers suivis", href: "/clients", icon: UsersRound, tone: "border-violet-200 bg-violet-50 text-violet-800 shadow-[0_7px_0_#ddd6fe]" },
    { label: "Notifications", value: data.kpis.unreadNotifications, detail: "Non lues", href: "/notifications?filter=UNREAD", icon: Bell, tone: "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_7px_0_#fde68a]" },
    { label: "Documents requis", value: data.kpis.requiredDocuments, detail: "Demandés ou expirés", href: "/documents?statusGroup=required", icon: FileText, tone: "border-orange-200 bg-orange-50 text-orange-800 shadow-[0_7px_0_#fed7aa]" },
    { label: "Analyses", value: data.kpis.needsAnalysesToReview, detail: "À finaliser", href: "/compliance?view=needs_analysis", icon: HeartPulse, tone: data.kpis.needsAnalysesToReview > 0 ? "border-amber-200 bg-amber-50 text-amber-800 shadow-[0_7px_0_#fde68a]" : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_7px_0_#e2e8f0]" },
    { label: "Renouvellements", value: data.kpis.upcomingRenewals, detail: "Sous 30 jours", href: "/clients", icon: BriefcaseBusiness, tone: "border-cyan-200 bg-cyan-50 text-cyan-800 shadow-[0_7px_0_#a5f3fc]" },
    { label: "Alertes", value: data.kpis.criticalAlerts, detail: "Conformité importante", href: "/compliance", icon: AlertTriangle, tone: data.kpis.criticalAlerts > 0 ? "border-rose-200 bg-rose-50 text-rose-800 shadow-[0_7px_0_#fecdd3]" : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_7px_0_#e2e8f0]" },
  ]

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_300px] xl:items-stretch">
            <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Centre de pilotage FinAdvisor</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Priorités, prospects, tâches et conformité au même endroit</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
                Le dashboard relie les prospects, clients, documents, alertes et suivis pour guider la journée du conseiller sans disperser l’information.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void load()} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                  Rafraîchir
                </Button>
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void generatePriorities()} disabled={generatingPriorities}>
                  {generatingPriorities ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Recalculer priorités
                </Button>
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void syncGmail()} disabled={syncingGmail}>
                  {syncingGmail ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
                  Synchroniser Gmail
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">État opérationnel</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{operatingLoad}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">éléments actifs à surveiller</p>
              <div className="mt-4 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
                <div className={operatingLoad > 0 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-slate-300"} style={{ width: `${Math.min(100, Math.max(8, operatingLoad * 8))}%` }} />
              </div>
              <div className="mt-4 rounded-[1.25rem] border-2 border-white bg-white p-3">
                <p className="text-sm font-black text-slate-950">{focus.label}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{focus.detail}</p>
              </div>
            </div>
          </div>

          {notice ? (
            <div className={notice.type === "success" ? "mt-5 rounded-[1.25rem] border-2 border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800" : "mt-5 rounded-[1.25rem] border-2 border-rose-200 bg-rose-50 p-3 text-sm font-black text-rose-800"}>
              {notice.message}
            </div>
          ) : null}

          <div className="mt-5">
            <AdvisoryHealthCards data={data} />
          </div>
        </div>

        <div className="p-5">
          <MetricGrid metrics={metrics} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel title="Priorités conseiller" description="Les dossiers à traiter avant le reste." href="/priorities" icon={Sparkles}>
          {data.priorities.length === 0 ? <EmptyState message="Aucune priorité active. Lancez un recalcul depuis la page Priorités." /> : (
            <div className="space-y-3">
              {data.priorities.slice(0, 6).map((priority) => (
                <CompactLinkRow
                  key={priority.id}
                  href={priority.actionUrl ?? "/priorities"}
                  title={priority.title}
                  detail={priority.reason ?? priority.suggestedAction ?? "Action à vérifier."}
                  right={`${priority.score}/100`}
                  tone={priority.level === "CRITICAL" || priority.level === "HIGH" ? "rose" : "emerald"}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Plan du jour" description="Tâches dues aujourd’hui et suivis immédiats." href="/taches?view=today" icon={CheckCircle2}>
          <TaskList items={data.todayTasks} empty="Aucune tâche due aujourd’hui." />
        </Panel>
      </section>

      {data.overdueTasksList.length > 0 ? (
        <Panel title="Rattrapage urgent" description="Tâches en retard à reprendre rapidement." href="/taches?view=overdue" icon={Clock3}>
          <TaskList items={data.overdueTasksList} empty="Aucune tâche en retard." />
        </Panel>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Pipeline prospects" description="Progression commerciale actuelle." href="/pipeline" icon={FolderKanban}>
          <div className="space-y-4">
            {data.leadPipeline.map((item) => (
              <div key={item.status} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-black text-slate-800">{leadStatusLabels[item.status] ?? item.status}</span>
                  <span className="text-xs font-black text-slate-500">{item.count}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border-2 border-slate-100 bg-slate-50">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(7, (item.count / maxPipelineCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Prospects chauds" description="Prospects qualifiés, urgents ou à forte priorité." href="/prospects" icon={Flame}>
          {data.hotLeads.length === 0 ? <EmptyState message="Aucun prospect chaud selon les règles actuelles." /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.hotLeads.slice(0, 6).map((lead) => (
                <CompactLinkRow
                  key={lead.id}
                  href={`/prospects/${lead.id}`}
                  title={`${lead.firstName} ${lead.lastName}`}
                  detail={lead.nextAction ?? `${lead.source} · ${lead.status}`}
                  right={lead.priority}
                  tone="orange"
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Alertes conformité" description="Éléments ouverts qui peuvent bloquer un dossier." href="/compliance" icon={ShieldCheck}>
          {data.importantAlerts.length === 0 ? <EmptyState message="Aucune alerte critique active." /> : (
            <div className="space-y-3">
              {data.importantAlerts.slice(0, 5).map((alert) => (
                <CompactLinkRow
                  key={alert.id}
                  href={alert.actionUrl ?? (alert.client ? `/clients/${alert.client.id}` : "/compliance")}
                  title={alert.title}
                  detail={`${personName(alert.client)} · ${alert.description}`}
                  right={alert.severity}
                  tone="rose"
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Documents requis" description="Pièces manquantes, demandées ou expirées." href="/documents?statusGroup=required" icon={FileText}>
          {data.requiredDocumentsList.length === 0 ? <EmptyState message="Aucun document requis pour le moment." /> : (
            <div className="space-y-3">
              {data.requiredDocumentsList.slice(0, 5).map((document) => (
                <CompactLinkRow
                  key={document.id}
                  href="/documents"
                  title={document.name}
                  detail={`${document.status} · ${personName(document.client ?? document.lead)}`}
                  right={document.type}
                  tone="orange"
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Analyses des besoins" description="Analyses à calculer, rapporter ou verrouiller." href="/compliance?view=needs_analysis" icon={HeartPulse}>
          {data.needsAnalysesList.length === 0 ? <EmptyState message="Aucune analyse d’assurance à finaliser." /> : (
            <div className="space-y-3">
              {data.needsAnalysesList.map((analysis) => (
                <Link key={analysis.id} href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{personName(analysis.client)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{analysisTypeLabel(analysis.analysisType)} · {analysisStatusLabel(analysis.status)}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      {currency(analysis.results[0]?.gapAmount ?? 0)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{analysis.summary ?? "Valider les données et générer le rapport avant recommandation."}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Renouvellements" description="Produits et suivis proches d’une échéance." href="/clients" icon={BriefcaseBusiness}>
          {data.upcomingRenewalsList.length === 0 ? <EmptyState message="Aucun renouvellement dans les 30 prochains jours." /> : (
            <div className="space-y-3">
              {data.upcomingRenewalsList.slice(0, 5).map((product) => (
                <CompactLinkRow
                  key={product.id}
                  href={`/clients/${product.client.id}`}
                  title={product.productName ?? product.type}
                  detail={`${personName(product.client)} · ${formatDate(product.renewalAt)}`}
                  right={product.company ?? product.type}
                  tone="emerald"
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Produits à réviser" description="Révisions nécessaires pour maintenir les dossiers à jour." href="/clients" icon={Gauge}>
          {data.productsToReview.length === 0 ? <EmptyState message="Aucun produit à réviser selon les dates disponibles." /> : (
            <div className="space-y-3">
              {data.productsToReview.slice(0, 6).map((product) => (
                <CompactLinkRow
                  key={product.id}
                  href={`/clients/${product.client.id}`}
                  title={product.productName ?? product.type}
                  detail={`${personName(product.client)} · prochaine révision: ${formatDate(product.nextReviewAt)}`}
                  right={product.company ?? product.type}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Activité récente" description="Historique court des derniers événements du cabinet." href="/notifications" icon={History}>
          {data.recentActivities.length === 0 ? <EmptyState message="Aucune activité récente." /> : (
            <div className="space-y-3">
              {data.recentActivities.slice(0, 7).map((activity) => (
                <div key={activity.id} className="rounded-[1.25rem] border-2 border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">{activity.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{activity.description}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{relativeDate(activity.createdAt)}{activity.user?.name ? ` · ${activity.user.name}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

    </div>
  )
}
