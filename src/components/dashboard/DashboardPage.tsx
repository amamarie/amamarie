"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CheckSquare,
  Clock3,
  FileText,
  Flame,
  FolderKanban,
  History,
  LayoutDashboard,
  Loader2,
  MailCheck,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
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

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
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
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </Link>
  )
}

function Panel({ title, description, href, icon: Icon, children }: { title: string; description: string; href?: string; icon: typeof LayoutDashboard; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        {href ? (
          <Link href={href} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-50 hover:text-emerald-700" aria-label={`Ouvrir ${title}`}>
            <ArrowUpRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PriorityPill({ value }: { value: string }) {
  const tone = value === "URGENT" ? "bg-rose-100 text-rose-800" : value === "HIGH" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>{value}</span>
}

function TaskList({ items, empty, limit = 5 }: { items: TaskItem[]; empty: string; limit?: number }) {
  if (items.length === 0) return <EmptyState message={empty} />
  return (
    <div className="space-y-2.5">
      {items.slice(0, limit).map((task) => (
        <Link key={task.id} href="/taches" className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{task.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{personName(task.client ?? task.lead)}</p>
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
    <Link href={href} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${marker}`} />
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
    if (!data) return { label: "Vue synthèse", detail: "Aucune donnée chargée." }
    if (data.kpis.criticalAlerts > 0) return { label: "Conformité", detail: `${data.kpis.criticalAlerts} alerte(s) importante(s) à traiter.` }
    if (data.kpis.overdueTasks > 0) return { label: "Rattrapage", detail: `${data.kpis.overdueTasks} tâche(s) en retard.` }
    if (data.kpis.requiredDocuments > 0) return { label: "Documents", detail: `${data.kpis.requiredDocuments} document(s) à compléter.` }
    return { label: "Sous contrôle", detail: "Aucun blocage majeur détecté." }
  }, [data])

  if (loading) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
        <p className="text-lg font-black">Dashboard indisponible</p>
        <p className="mt-2 text-sm font-semibold">{error}</p>
        <Button type="button" onClick={() => void load()} className="mt-5 rounded-full bg-white font-black text-rose-700 hover:bg-rose-50">
          <RefreshCcw className="size-4" />
          Réessayer
        </Button>
      </div>
    )
  }

  const maxPipelineCount = Math.max(1, ...data.leadPipeline.map((item) => item.count))
  const operatingLoad = data.kpis.tasksToday + data.kpis.overdueTasks + data.kpis.criticalAlerts + data.kpis.requiredDocuments
  const deadlineItems = [
    ...data.requiredDocumentsList.slice(0, 3).map((document) => ({
      id: `doc-${document.id}`,
      href: "/documents?statusGroup=required",
      title: document.name,
      detail: `${document.status} · ${personName(document.client ?? document.lead)}`,
      right: document.type,
      tone: "orange" as const,
    })),
    ...data.upcomingRenewalsList.slice(0, 3).map((product) => ({
      id: `renewal-${product.id}`,
      href: `/clients/${product.client.id}`,
      title: product.productName ?? product.type,
      detail: `${personName(product.client)} · ${formatDate(product.renewalAt)}`,
      right: product.company ?? product.type,
      tone: "emerald" as const,
    })),
  ].slice(0, 5)

  const metrics = [
    { label: "Prospects", value: data.kpis.newLeadsThisMonth, detail: `${data.kpis.newLeadsPreviousMonth} le mois précédent`, href: "/prospects?created=this-month", icon: UserPlus, tone: "bg-emerald-50 text-emerald-700" },
    { label: "À faire", value: data.kpis.tasksToday, detail: `${data.kpis.overdueTasks} en retard`, href: "/taches?view=today", icon: CheckSquare, tone: "bg-sky-50 text-sky-700" },
    { label: "Clients", value: data.kpis.activeClients, detail: `${data.kpis.upcomingRenewals} renouvellement(s) à venir`, href: "/clients", icon: UsersRound, tone: "bg-violet-50 text-violet-700" },
    { label: "Risques", value: data.kpis.criticalAlerts + data.kpis.requiredDocuments, detail: "Alertes et documents requis", href: "/compliance", icon: ShieldCheck, tone: "bg-rose-50 text-rose-700" },
  ]

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Tableau de bord conseiller</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">L’essentiel pour piloter la journée</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Priorités, tâches, prospects et points de conformité sont regroupés ici. Les détails restent accessibles dans chaque module.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full font-black" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              Rafraîchir
            </Button>
            <Button variant="outline" className="rounded-full font-black" onClick={() => void generatePriorities()} disabled={generatingPriorities}>
              {generatingPriorities ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Priorités
            </Button>
            <Button variant="outline" className="rounded-full font-black" onClick={() => void syncGmail()} disabled={syncingGmail}>
              {syncingGmail ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
              Gmail
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{focus.label}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{focus.detail}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-black text-emerald-900">{operatingLoad} élément(s) actifs</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700">Charge opérationnelle à surveiller aujourd’hui.</p>
          </div>
        </div>

        {notice ? (
          <div className={notice.type === "success" ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800" : "mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"}>
            {notice.message}
          </div>
        ) : null}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel title="À traiter maintenant" description="Les dossiers qui méritent l’attention avant le reste." href="/priorities" icon={Sparkles}>
          {data.priorities.length === 0 && data.importantAlerts.length === 0 && data.overdueTasksList.length === 0 ? (
            <EmptyState message="Aucune priorité active. Lancez un recalcul si vous voulez actualiser la liste." />
          ) : (
            <div className="space-y-2.5">
              {data.priorities.slice(0, 4).map((priority) => (
                <CompactLinkRow
                  key={priority.id}
                  href={priority.actionUrl ?? "/priorities"}
                  title={priority.title}
                  detail={priority.reason ?? priority.suggestedAction ?? "Action à vérifier."}
                  right={`${priority.score}/100`}
                  tone={priority.level === "CRITICAL" || priority.level === "HIGH" ? "rose" : "emerald"}
                />
              ))}
              {data.importantAlerts.slice(0, 2).map((alert) => (
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

        <Panel title="Plan du jour" description="Tâches dues aujourd’hui, sans bruit autour." href="/taches?view=today" icon={CheckCircle2}>
          <TaskList items={data.todayTasks} empty="Aucune tâche due aujourd’hui." />
        </Panel>
      </section>

      {data.overdueTasksList.length > 0 ? (
        <Panel title="Rattrapage" description="Tâches en retard à reprendre rapidement." href="/taches?view=overdue" icon={Clock3}>
          <TaskList items={data.overdueTasksList} empty="Aucune tâche en retard." limit={4} />
        </Panel>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Pipeline" description="Progression commerciale en un coup d’œil." href="/pipeline" icon={FolderKanban}>
          <div className="space-y-3">
            {data.leadPipeline.map((item) => (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-black text-slate-800">{leadStatusLabels[item.status] ?? item.status}</span>
                  <span className="text-xs font-black text-slate-500">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(7, (item.count / maxPipelineCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Prospects chauds" description="À contacter ou convertir rapidement." href="/prospects" icon={Flame}>
          {data.hotLeads.length === 0 ? <EmptyState message="Aucun prospect chaud selon les règles actuelles." /> : (
            <div className="space-y-2.5">
              {data.hotLeads.slice(0, 5).map((lead) => (
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

        <Panel title="Documents et échéances" description="Pièces manquantes et renouvellements proches." href="/documents?statusGroup=required" icon={FileText}>
          {deadlineItems.length === 0 ? <EmptyState message="Aucun document ou renouvellement urgent." /> : (
            <div className="space-y-2.5">
              {deadlineItems.map((item) => <CompactLinkRow key={item.id} {...item} />)}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Santé cabinet" description="Indicateurs de fond, gardés en bas pour ne pas gêner l’action." href="/clients" icon={BriefcaseBusiness}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Conformité moyenne</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{data.kpis.averageComplianceScore ?? "N/D"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Commissions suivies</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{currency(data.kpis.estimatedCommissions)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Produits à réviser</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{data.kpis.productsToReview}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Analyses à finaliser</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{data.kpis.needsAnalysesToReview}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Activité récente" description="Derniers événements utiles du cabinet." href="/notifications" icon={History}>
          {data.recentActivities.length === 0 ? <EmptyState message="Aucune activité récente." /> : (
            <div className="space-y-2.5">
              {data.recentActivities.slice(0, 6).map((activity) => (
                <div key={activity.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
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
