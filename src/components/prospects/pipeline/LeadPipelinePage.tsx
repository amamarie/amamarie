"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  StickyNote,
  UserRoundPlus,
  XCircle,
} from "lucide-react"

import { leadStatusLabels } from "@/lib/lead-status"
import { pipelineStatuses } from "@/lib/pipeline"

type LeadStatus =
  | "NEW"
  | "TO_CONTACT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "CONVERTED"
  | "LOST"
  | "ARCHIVED"

type LeadPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"

type LeadSource =
  | "INBOUND_CALL"
  | "SMS"
  | "WEBSITE"
  | "REFERRAL"
  | "SOCIAL_MEDIA"
  | "EVENT"
  | "MANUAL"
  | "CAMPAIGN"
  | "OTHER"

type PipelineLead = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  status: LeadStatus
  source: LeadSource
  priority: LeadPriority
  interestType: string | null
  nextAction: string | null
  lastContactAt: string | null
  createdAt: string
  estimatedValue: number | null
  lostReason: string | null
  advisor: { id: string; name: string } | null
  tasks: { id: string; title: string; priority: LeadPriority; dueDate: string | null; status: string }[]
}

type PipelineColumn = {
  status: LeadStatus
  title: string
  description: string
  count: number
  urgentCount: number
  potentialTotal: number
  leads: PipelineLead[]
}

type PipelineData = {
  columns: PipelineColumn[]
  summary: {
    totalActive: number
    urgentCount: number
    proposalsSent: number
    wonCount: number
    potentialTotal: number
    archivedCount: number
  }
}

const priorityLabels: Record<LeadPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
}

const sourceLabels: Record<LeadSource, string> = {
  INBOUND_CALL: "Appel entrant",
  SMS: "SMS entrant",
  WEBSITE: "Site web",
  REFERRAL: "Référence",
  SOCIAL_MEDIA: "Réseaux sociaux",
  EVENT: "Événement",
  MANUAL: "Manuel",
  CAMPAIGN: "Campagne",
  OTHER: "Autre",
}

const activeStatuses = pipelineStatuses as LeadStatus[]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "Non renseigné"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value))
}

function priorityClass(priority: LeadPriority) {
  const classes: Record<LeadPriority, string> = {
    LOW: "border-slate-200 bg-slate-50 text-slate-600",
    NORMAL: "border-sky-100 bg-sky-50 text-sky-700",
    HIGH: "border-orange-100 bg-orange-50 text-orange-700",
    URGENT: "border-rose-100 bg-rose-50 text-rose-700",
  }
  return classes[priority]
}

function statusClass(status: LeadStatus) {
  const classes: Record<LeadStatus, string> = {
    NEW: "bg-emerald-500",
    TO_CONTACT: "bg-amber-500",
    CONTACTED: "bg-sky-500",
    QUALIFIED: "bg-blue-500",
    PROPOSAL_SENT: "bg-violet-500",
    NEGOTIATION: "bg-orange-500",
    WON: "bg-emerald-600",
    CONVERTED: "bg-emerald-700",
    LOST: "bg-slate-500",
    ARCHIVED: "bg-slate-400",
  }
  return classes[status]
}

async function readResponse(response: Response) {
  const json = await response.json()
  if (!response.ok) {
    const message = json?.error?.message ?? json?.error ?? "L’action n’a pas pu être complétée."
    throw new Error(message)
  }
  return json?.data ?? json
}

export function LeadPipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState("")
  const [source, setSource] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeLost, setIncludeLost] = useState(false)

  const fetchPipeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (priority) params.set("priority", priority)
      if (source) params.set("source", source)
      if (includeArchived) params.set("includeArchived", "true")
      if (includeLost) params.set("includeLost", "true")
      const nextData = await readResponse(await fetch(`/api/leads/pipeline?${params.toString()}`))
      setData(nextData)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger le pipeline.")
    } finally {
      setLoading(false)
    }
  }, [includeArchived, includeLost, priority, search, source])

  useEffect(() => {
    const timeout = window.setTimeout(fetchPipeline, 250)
    return () => window.clearTimeout(timeout)
  }, [fetchPipeline])

  const changeStatus = async (lead: PipelineLead, status: LeadStatus) => {
    if (status === "CONVERTED") {
      await convertLead(lead)
      return
    }

    let lostReason: string | undefined
    let lostNote: string | undefined
    if (status === "LOST") {
      const reason = window.prompt("Raison de la perte")
      if (!reason?.trim()) return
      lostReason = reason.trim()
      lostNote = window.prompt("Note optionnelle")?.trim() || undefined
    }

    setActionLoading(`${lead.id}:${status}`)
    setNotice(null)
    setError(null)
    try {
      await readResponse(
        await fetch(`/api/leads/${lead.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, lostReason, lostNote }),
        })
      )
      setNotice(`Statut mis à jour: ${leadStatusLabels[status]}.`)
      await fetchPipeline()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Impossible de modifier le statut.")
    } finally {
      setActionLoading(null)
    }
  }

  const convertLead = async (lead: PipelineLead) => {
    if (!window.confirm(`Convertir ${lead.firstName} ${lead.lastName} en client?`)) return
    setActionLoading(`${lead.id}:CONVERTED`)
    setNotice(null)
    setError(null)
    try {
      await readResponse(await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" }))
      setNotice("Prospect converti en client.")
      await fetchPipeline()
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Impossible de convertir le prospect.")
    } finally {
      setActionLoading(null)
    }
  }

  const columns = useMemo(() => data?.columns ?? [], [data])

  return (
    <div className="space-y-5">
      <LeadPipelineHeader onRefresh={fetchPipeline} loading={loading} />

      <PipelineSummaryCards data={data} />

      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.6fr_0.6fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Rechercher un prospect, téléphone, intérêt..."
            />
          </label>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
            <option value="">Toutes priorités</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
            <option value="">Toutes sources</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeLost} onChange={(event) => setIncludeLost(event.target.checked)} />
            Perdus
          </label>
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            Archives
          </label>
        </div>
        {notice ? <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </section>

      {loading && !data ? (
        <div className="flex min-h-80 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white/70 text-slate-500">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Chargement du pipeline...
        </div>
      ) : columns.length === 0 ? (
        <PipelineEmptyState />
      ) : (
        <LeadPipelineBoard columns={columns} onStatusChange={changeStatus} actionLoading={actionLoading} />
      )}
    </div>
  )
}

function LeadPipelineHeader({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <header className="flex flex-col gap-4 rounded-[1.75rem] border border-white/60 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Prospects</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pipeline commercial</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Suivez chaque prospect, priorisez les relances et convertissez les dossiers gagnés au bon moment.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/prospects" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">
          Vue tableau
        </Link>
        <Link href="/prospects" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50">
          <Plus className="size-4" />
          Nouveau prospect
        </Link>
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60">
          <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </button>
      </div>
    </header>
  )
}

function PipelineSummaryCards({ data }: { data: PipelineData | null }) {
  const summary = data?.summary
  const cards = [
    { label: "Prospects actifs", value: String(summary?.totalActive ?? 0), icon: UserRoundPlus },
    { label: "Prioritaires", value: String(summary?.urgentCount ?? 0), icon: CheckCircle2 },
    { label: "Propositions", value: String(summary?.proposalsSent ?? 0), icon: FileText },
    { label: "Gagnés", value: String(summary?.wonCount ?? 0), icon: BadgeDollarSign },
    { label: "Potentiel estimé", value: formatCurrency(summary?.potentialTotal ?? 0), icon: BadgeDollarSign },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-[1.35rem] border border-white/70 bg-white/90 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
              </div>
              <span className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-700 ring-1 ring-emerald-100">
                <Icon className="size-4" />
              </span>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function LeadPipelineBoard({ columns, onStatusChange, actionLoading }: { columns: PipelineColumn[]; onStatusChange: (lead: PipelineLead, status: LeadStatus) => void; actionLoading: string | null }) {
  return (
    <section className="w-full overflow-x-auto pb-4">
      <div className="flex min-w-max gap-5">
        {columns.map((column) => (
          <LeadPipelineColumn key={column.status} column={column} onStatusChange={onStatusChange} actionLoading={actionLoading} />
        ))}
      </div>
    </section>
  )
}

function LeadPipelineColumn({ column, onStatusChange, actionLoading }: { column: PipelineColumn; onStatusChange: (lead: PipelineLead, status: LeadStatus) => void; actionLoading: string | null }) {
  return (
    <section className="w-[280px] shrink-0 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 sm:w-[320px]">
      <div className="sticky top-0 z-10 rounded-[1.15rem] bg-slate-50 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${statusClass(column.status)}`} />
              <h2 className="truncate font-semibold text-slate-950">{column.title}</h2>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{column.description}</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{column.count}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-500">Potentiel</p>
            <p className="mt-1 truncate font-bold text-slate-900">{formatCurrency(column.potentialTotal)}</p>
          </div>
          <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-500">Prioritaires</p>
            <p className="mt-1 font-bold text-orange-700">{column.urgentCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {column.leads.length === 0 ? (
          <PipelineEmptyColumn />
        ) : (
          column.leads.map((lead) => (
            <LeadPipelineCard key={lead.id} lead={lead} onStatusChange={onStatusChange} actionLoading={actionLoading} />
          ))
        )}
      </div>
    </section>
  )
}

function LeadPipelineCard({ lead, onStatusChange, actionLoading }: { lead: PipelineLead; onStatusChange: (lead: PipelineLead, status: LeadStatus) => void; actionLoading: string | null }) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const fullName = `${lead.firstName} ${lead.lastName}`

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/prospects/${lead.id}`} className="block truncate font-semibold text-slate-950 hover:text-emerald-700">
            {fullName}
          </Link>
          <p className="mt-1 truncate text-sm text-slate-500">{lead.interestType ?? "Intérêt non précisé"}</p>
        </div>
        <button type="button" onClick={() => setActionsOpen((value) => !value)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Actions prospect">
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(lead.priority)}`}>{priorityLabels[lead.priority]}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{sourceLabels[lead.source]}</span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p className="flex min-w-0 items-center gap-2">
          <Phone className="size-4 shrink-0 text-slate-400" />
          <span className="truncate">{lead.phone}</span>
        </p>
        {lead.email ? (
          <p className="truncate text-xs text-slate-500">{lead.email}</p>
        ) : null}
        <p className="line-clamp-2 text-sm">
          <span className="font-semibold text-slate-800">Prochaine action: </span>
          {lead.nextAction ?? "Aucune action définie"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-semibold text-slate-700">Dernier contact</p>
          <p className="mt-1 truncate">{formatDate(lead.lastContactAt)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="font-semibold text-slate-700">Créé le</p>
          <p className="mt-1 truncate">{formatDate(lead.createdAt)}</p>
        </div>
      </div>

      {lead.tasks.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
          <p className="font-semibold">Suivi ouvert</p>
          <p className="mt-1 line-clamp-2">{lead.tasks[0].title}</p>
        </div>
      ) : null}

      {actionsOpen ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <Link href={`/prospects/${lead.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
            <ArrowRight className="size-4" />
            Voir détail
          </Link>
          <Link href={`/prospects/${lead.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
            <StickyNote className="size-4" />
            Ajouter note
          </Link>
          <Link href={`/prospects/${lead.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
            <MessageSquare className="size-4" />
            SMS fictif
          </Link>
          <select
            value=""
            onChange={(event) => {
              const status = event.target.value as LeadStatus
              if (status) onStatusChange(lead, status)
            }}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            disabled={Boolean(actionLoading?.startsWith(lead.id))}
          >
            <option value="">Changer statut</option>
            {activeStatuses.filter((status) => status !== lead.status).map((status) => (
              <option key={status} value={status}>{leadStatusLabels[status]}</option>
            ))}
          </select>
          {lead.status === "WON" ? (
            <button type="button" onClick={() => onStatusChange(lead, "CONVERTED")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-white">
              <CheckCircle2 className="size-4" />
              Convertir en client
            </button>
          ) : null}
          <button type="button" onClick={() => onStatusChange(lead, "LOST")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-white">
            <XCircle className="size-4" />
            Marquer perdu
          </button>
          <button type="button" onClick={() => onStatusChange(lead, "ARCHIVED")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white">
            <Archive className="size-4" />
            Archiver
          </button>
        </div>
      ) : null}

      {actionLoading?.startsWith(lead.id) ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Loader2 className="size-3.5 animate-spin" />
          Mise à jour...
        </p>
      ) : null}
    </article>
  )
}

function PipelineEmptyColumn() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">
      Aucun prospect à cette étape.
    </div>
  )
}

function PipelineEmptyState() {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/80 p-8 text-center">
      <UserRoundPlus className="mx-auto size-10 text-slate-400" />
      <h2 className="mt-4 text-lg font-semibold text-slate-950">Aucun prospect actif dans le pipeline.</h2>
      <p className="mt-2 text-sm text-slate-500">Créez un prospect ou ajustez les filtres pour afficher les dossiers.</p>
      <Link href="/prospects" className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700">
        Créer un prospect
      </Link>
    </div>
  )
}
