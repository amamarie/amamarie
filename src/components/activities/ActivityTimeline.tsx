"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock,
  FileUp,
  Mail,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react"

import {
  activitySourceLabels,
  getActivityCategory,
  getActivityTypeLabel,
  type ActivityCategory,
} from "@/lib/activities/labels"

type ActivityUser = {
  id: string
  name: string
  email?: string | null
  role?: string | null
}

export type ActivityTimelineItemData = {
  id: string
  type: string
  title: string
  description?: string | null
  source?: string | null
  entityType?: string | null
  entityId?: string | null
  metadata?: unknown
  createdAt: string
  user?: ActivityUser | null
  client?: { id: string; firstName: string; lastName: string } | null
  lead?: { id: string; firstName: string; lastName: string } | null
}

type ApiResponse = {
  ok: true
  data: {
    items: ActivityTimelineItemData[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

type ActivityTimelineProps = {
  title?: string
  description?: string
  endpoint: string
  limit?: number
  defaultOpen?: boolean
  compact?: boolean
}

const categoryLabels: Record<ActivityCategory | "all", string> = {
  all: "Tous",
  prospect: "Prospects",
  client: "Clients",
  task: "Tâches",
  note: "Notes",
  document: "Documents",
  product: "Produits",
  communication: "Communications",
  automation: "Automatisations",
  alert: "Alertes",
  compliance: "Conformité",
  ai: "IA",
  other: "Autres",
}

function buildUrl(endpoint: string, params: Record<string, string>) {
  const url = new URL(endpoint, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  return url.toString()
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const activityTextReplacements: Record<string, string> = {
  DOCUMENT_VALIDATED: "Document validé",
  DOCUMENT_RECEIVED: "Document reçu",
  DOCUMENT_REJECTED: "Document rejeté",
  DOCUMENT_UPLOADED: "Document téléversé",
  DOCUMENT_STATUS_CHANGED: "Statut document modifié",
  VALIDATED: "Validé",
  RECEIVED: "Reçu",
  REJECTED: "Rejeté",
  REQUIRED: "Requis",
  ARCHIVED: "Archivé",
  CREATED: "Créé",
  UPDATED: "Mis à jour",
  DONE: "Terminé",
  TODO: "À faire",
  OPEN: "Ouvert",
}

function titleCaseTechnical(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}

function humanizeActivityText(value: string | null | undefined, fallbackType: string) {
  if (!value?.trim()) return getActivityTypeLabel(fallbackType)

  const trimmed = value.trim()
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return activityTextReplacements[trimmed] ?? getActivityTypeLabel(trimmed)
  }

  return trimmed
    .replace(/\s*(→|->)\s*/g, " vers ")
    .replace(/\b[A-Z0-9_]{2,}\b/g, (match) => activityTextReplacements[match] ?? titleCaseTechnical(match))
}

function groupLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Aujourd’hui"
  if (date.toDateString() === yesterday.toDateString()) return "Hier"

  return new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

function ActivityIcon({ type }: { type: string }) {
  const category = getActivityCategory(type)
  const className = "h-4 w-4"
  const icons: Partial<Record<ActivityCategory, ReactNode>> = {
    prospect: <UserPlus className={className} />,
    client: <Users className={className} />,
    task: <CheckSquare className={className} />,
    note: <StickyNote className={className} />,
    document: <FileUp className={className} />,
    product: <BriefcaseBusiness className={className} />,
    communication: type.startsWith("CALL_") ? <Phone className={className} /> : type.startsWith("EMAIL_") ? <Mail className={className} /> : <MessageSquare className={className} />,
    automation: <Bot className={className} />,
    alert: <AlertTriangle className={className} />,
    compliance: <ShieldCheck className={className} />,
    ai: <Sparkles className={className} />,
  }

  return icons[category] ?? <Clock className={className} />
}

function badgeClass(category: ActivityCategory) {
  const classes: Record<ActivityCategory, string> = {
    prospect: "border-emerald-100 bg-emerald-50 text-emerald-700",
    client: "border-blue-100 bg-blue-50 text-blue-700",
    task: "border-violet-100 bg-violet-50 text-violet-700",
    note: "border-amber-100 bg-amber-50 text-amber-700",
    document: "border-sky-100 bg-sky-50 text-sky-700",
    product: "border-indigo-100 bg-indigo-50 text-indigo-700",
    communication: "border-cyan-100 bg-cyan-50 text-cyan-700",
    automation: "border-slate-200 bg-slate-50 text-slate-700",
    alert: "border-orange-100 bg-orange-50 text-orange-700",
    compliance: "border-rose-100 bg-rose-50 text-rose-700",
    ai: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700",
    other: "border-slate-200 bg-slate-50 text-slate-700",
  }

  return classes[category]
}

function ActivityTimelineItem({ activity }: { activity: ActivityTimelineItemData }) {
  const category = getActivityCategory(activity.type)
  const actor = activity.user?.name ?? (activity.source === "AUTOMATION" ? "Automatisation" : "Système")
  const title = humanizeActivityText(activity.title, activity.type)
  const description = activity.description ? humanizeActivityText(activity.description, activity.type) : null
  const linkedName = activity.client
    ? `${activity.client.firstName} ${activity.client.lastName}`
    : activity.lead
      ? `${activity.lead.firstName} ${activity.lead.lastName}`
      : null

  return (
    <li className="relative flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${badgeClass(category)}`}>
        <ActivityIcon type={activity.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950">{title}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(category)}`}>
            {getActivityTypeLabel(activity.type)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {activitySourceLabels[activity.source ?? "USER"] ?? activity.source ?? "Manuel"}
          </span>
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
          <span>{actor}</span>
          {linkedName ? <span>{linkedName}</span> : null}
          <span className="inline-flex items-center gap-1 text-slate-700" title={formatDateTime(activity.createdAt)}>
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateTime(activity.createdAt)}
          </span>
        </div>
      </div>
    </li>
  )
}

export function ActivityTimeline({
  title = "Historique d’activités",
  description = "Actions importantes du dossier, classées par date.",
  endpoint,
  limit = 25,
  defaultOpen = false,
  compact = false,
}: ActivityTimelineProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [items, setItems] = useState<ActivityTimelineItemData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<ActivityCategory | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          buildUrl(endpoint, {
            limit: String(limit),
            page: String(page),
            search,
            dateFrom,
            dateTo,
          }),
          { signal: controller.signal }
        )
        const json = (await response.json()) as ApiResponse | { ok: false; error?: { message?: string } }
        if (!response.ok || !json.ok) {
          throw new Error(!json.ok ? json.error?.message : "Impossible de récupérer l’historique.")
        }

        setItems(json.data.items)
        setTotalPages(json.data.totalPages)
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : "Impossible de récupérer l’historique.")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, endpoint, limit, page, search, dateFrom, dateTo])

  const filteredItems = useMemo(() => {
    const userReadableItems = items.filter((item) => !item.type.startsWith("AUDIT_LOG"))
    if (category === "all") return userReadableItems
    return userReadableItems.filter((item) => getActivityCategory(item.type) === category)
  }, [items, category])

  const groups = useMemo(() => {
    return filteredItems.reduce<Record<string, ActivityTimelineItemData[]>>((acc, item) => {
      const label = groupLabel(item.createdAt)
      acc[label] = acc[label] ?? []
      acc[label].push(item)
      return acc
    }, {})
  }, [filteredItems])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="border-t border-slate-200 p-5">
          {!compact ? (
            <div className="mb-5 grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Rechercher dans l’historique"
                />
              </label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ActivityCategory | "all")}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                aria-label="Date de début"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                aria-label="Date de fin"
              />
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="font-semibold text-slate-900">Aucune activité trouvée.</p>
              <p className="mt-1 text-sm text-slate-500">Les prochaines actions importantes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groups).map(([label, groupItems]) => (
                <div key={label}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <ul className="space-y-3">
                    {groupItems.map((activity) => (
                      <ActivityTimelineItem key={activity.id} activity={activity} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
              <span>
                Page {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function DashboardRecentActivity() {
  return (
    <ActivityTimeline
      title="Activité récente"
      description="Dernières actions importantes dans le CRM."
      endpoint="/api/activities"
      limit={10}
      defaultOpen
      compact
    />
  )
}
