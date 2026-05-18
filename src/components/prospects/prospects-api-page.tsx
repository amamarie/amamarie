"use client"

import {
  Archive,
  CalendarClock,
  ClipboardList,
  Edit3,
  Eye,
  FilterX,
  Flame,
  KanbanSquare,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StatusTone } from "@/types"

type LeadStatusCode =
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

type LeadSourceCode =
  | "INBOUND_CALL"
  | "SMS"
  | "WEBSITE"
  | "REFERRAL"
  | "SOCIAL_MEDIA"
  | "EVENT"
  | "MANUAL"
  | "CAMPAIGN"
  | "OTHER"

type PriorityCode = "LOW" | "NORMAL" | "HIGH" | "URGENT"

type ApiLead = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string
  address: string | null
  source: LeadSourceCode
  status: LeadStatusCode
  priority: PriorityCode
  interestType: string | null
  nextAction: string | null
  notes: string | null
  createdAt: string
  lastContactAt: string | null
  convertedAt: string | null
  lostReason: string | null
  lostAt: string | null
  lostNote: string | null
  advisorId: string | null
  advisor?: { id: string; name: string } | null
  tasks?: { id: string; status: string }[]
  activities?: { id: string }[]
  noteItems?: { id: string }[]
}

type Filters = {
  q: string
  status: string
  source: string
  priority: string
  advisorId: string
  created: string
}

type LeadsMeta = {
  page: number
  pageSize: number
  total: number
}

const statusOptions: { value: LeadStatusCode; label: string; tone: StatusTone }[] = [
  { value: "NEW", label: "Nouveau", tone: "emerald" },
  { value: "TO_CONTACT", label: "À contacter", tone: "amber" },
  { value: "CONTACTED", label: "Contacté", tone: "sky" },
  { value: "QUALIFIED", label: "Qualifié", tone: "sky" },
  { value: "PROPOSAL_SENT", label: "Proposition envoyée", tone: "violet" },
  { value: "NEGOTIATION", label: "En discussion", tone: "amber" },
  { value: "WON", label: "Gagné", tone: "emerald" },
  { value: "CONVERTED", label: "Converti en client", tone: "emerald" },
  { value: "LOST", label: "Perdu", tone: "slate" },
  { value: "ARCHIVED", label: "Archivé", tone: "slate" },
]

const kanbanStatuses = statusOptions.filter((status) =>
  ["NEW", "TO_CONTACT", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(status.value)
)

const sourceOptions: { value: LeadSourceCode; label: string }[] = [
  { value: "INBOUND_CALL", label: "Appel entrant" },
  { value: "SMS", label: "SMS entrant" },
  { value: "WEBSITE", label: "Site web" },
  { value: "REFERRAL", label: "Référence" },
  { value: "SOCIAL_MEDIA", label: "Réseaux sociaux" },
  { value: "EVENT", label: "Événement" },
  { value: "MANUAL", label: "Import manuel" },
  { value: "CAMPAIGN", label: "Campagne" },
  { value: "OTHER", label: "Autre" },
]

const priorityOptions: { value: PriorityCode; label: string; tone: StatusTone }[] = [
  { value: "LOW", label: "Basse", tone: "slate" },
  { value: "NORMAL", label: "Normale", tone: "sky" },
  { value: "HIGH", label: "Haute", tone: "amber" },
  { value: "URGENT", label: "Urgente", tone: "rose" },
]

const emptyFilters: Filters = {
  q: "",
  status: "",
  source: "",
  priority: "",
  advisorId: "",
  created: "",
}

function statusMeta(status: string) {
  return statusOptions.find((item) => item.value === status) ?? statusOptions[0]
}

function sourceLabel(source: string) {
  return sourceOptions.find((item) => item.value === source)?.label ?? source
}

function priorityMeta(priority: string) {
  return priorityOptions.find((item) => item.value === priority) ?? priorityOptions[1]
}

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function buildQuery(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "25" })
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim())
  })
  return params.toString()
}

async function readJson<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string }
  if (!response.ok) {
    throw new Error(result.error ?? "Une erreur est survenue.")
  }
  return result.data as T
}

async function readListJson<T>(response: Response) {
  const result = (await response.json()) as {
    data?: T
    meta?: LeadsMeta
    error?: string
  }
  if (!response.ok) {
    throw new Error(result.error ?? "Une erreur est survenue.")
  }
  return {
    data: result.data as T,
    meta: result.meta ?? { page: 1, pageSize: 25, total: 0 },
  }
}

export function ProspectsApiPage() {
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<ApiLead[]>([])
  const [filters, setFilters] = useState<Filters>({
    ...emptyFilters,
    status: searchParams.get("status") ?? "",
    source: searchParams.get("source") ?? "",
    priority: searchParams.get("priority") ?? "",
    advisorId: searchParams.get("advisorId") ?? "",
    created: searchParams.get("created") ?? "",
  })
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<LeadsMeta>({ page: 1, pageSize: 25, total: 0 })
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [formLead, setFormLead] = useState<ApiLead | null | "new">(null)
  const [noteLead, setNoteLead] = useState<ApiLead | null>(null)
  const [taskLead, setTaskLead] = useState<ApiLead | null>(null)
  const [smsLead, setSmsLead] = useState<ApiLead | null>(null)
  const [detailLead, setDetailLead] = useState<ApiLead | null>(null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set())
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => Promise<void>
  } | null>(null)

  const loadLeads = useCallback(async (nextFilters = filters, nextPage = page) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/leads?${buildQuery(nextFilters, nextPage)}`, {
        cache: "no-store",
      })
      const { data, meta: nextMeta } = await readListJson<ApiLead[]>(response)
      const visibleIds = new Set(data.map((lead) => lead.id))
      setLeads(data)
      setSelectedLeadIds((current) => new Set([...current].filter((id) => visibleIds.has(id))))
      setMeta(nextMeta)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les prospects."
      )
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLeads(filters, page)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [filters, page, loadLeads])

  const advisors = useMemo(() => {
    const unique = new Map<string, string>()
    leads.forEach((lead) => {
      if (lead.advisor?.id) unique.set(lead.advisor.id, lead.advisor.name)
    })
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }))
  }, [leads])

  const activeLeads = leads.filter((lead) => lead.status !== "ARCHIVED")
  const selectedLeads = useMemo(() => activeLeads.filter((lead) => selectedLeadIds.has(lead.id)), [activeLeads, selectedLeadIds])
  const allVisibleSelected = activeLeads.length > 0 && activeLeads.every((lead) => selectedLeadIds.has(lead.id))
  const hotLeads = activeLeads.filter((lead) => ["HIGH", "URGENT"].includes(lead.priority))
  const followUpTasks = activeLeads.reduce(
    (count, lead) =>
      count + (lead.tasks ?? []).filter((task) => task.status !== "DONE").length,
    0
  )
  const conversionRate =
    activeLeads.length === 0
      ? 0
      : Math.round(
          (activeLeads.filter((lead) => lead.status === "CONVERTED").length /
            activeLeads.length) *
            100
        )
  const monthlyNewLeads = activeLeads.filter((lead) => {
    const createdAt = new Date(lead.createdAt)
    const now = new Date()
    return (
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getFullYear() === now.getFullYear()
    )
  }).length
  const wonOrConverted = activeLeads.filter((lead) =>
    ["WON", "CONVERTED"].includes(lead.status)
  ).length

  const metrics = [
    {
      label: "Prospects actifs",
      value: String(activeLeads.length),
      detail: "Pipeline hors archivés",
      icon: UserPlus,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_6px_0_#86efac]",
    },
    {
      label: "Nouveaux ce mois",
      value: String(monthlyNewLeads),
      detail: "Contacts récemment ajoutés",
      icon: Sparkles,
      tone: "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_6px_0_#bae6fd]",
    },
    {
      label: "Prospects chauds",
      value: String(hotLeads.length),
      detail: "Priorité haute ou urgente",
      icon: Flame,
      tone: "border-rose-200 bg-rose-50 text-rose-700 shadow-[0_6px_0_#fecdd3]",
    },
    {
      label: "Tâches ouvertes",
      value: String(followUpTasks),
      detail: "Suivis encore actifs",
      icon: ClipboardList,
      tone: "border-amber-200 bg-amber-50 text-amber-700 shadow-[0_6px_0_#fde68a]",
    },
    {
      label: "Conversion",
      value: `${conversionRate}%`,
      detail: `${wonOrConverted} gagnés ou convertis`,
      icon: UserCheck,
      tone: "border-violet-200 bg-violet-50 text-violet-700 shadow-[0_6px_0_#ddd6fe]",
    },
  ]

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function resetFilters() {
    setPage(1)
    setFilters(emptyFilters)
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((current) => {
      const next = new Set(current)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  function toggleAllVisibleLeads() {
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(current)
      for (const lead of activeLeads) next.add(lead.id)
      return next
    })
  }

  async function saveLead(payload: Record<string, string>, lead?: ApiLead) {
    setIsSaving(true)
    setNotice(null)

    try {
      const response = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", {
        method: lead ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      await readJson<ApiLead>(response)
      setFormLead(null)
      setNotice({
        type: "success",
        message: lead
          ? "Prospect modifié avec succès."
          : "Prospect créé avec succès. La fenêtre a été fermée.",
      })
      await loadLeads(filters, page)
    } catch (saveError) {
      setNotice({
        type: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Impossible de sauvegarder le prospect.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function changeStatus(lead: ApiLead, status: LeadStatusCode) {
    try {
      const payload: { status: LeadStatusCode; lostReason?: string; lostNote?: string } = { status }

      if (status === "LOST") {
        const lostReason = window.prompt(
          "Pourquoi ce prospect est-il perdu? Exemple: trop cher, déjà servi ailleurs, impossible à joindre."
        )

        if (!lostReason?.trim()) {
          setNotice({
            type: "error",
            message: "La raison de perte est obligatoire pour passer un prospect à Perdu.",
          })
          return
        }

        payload.lostReason = lostReason.trim()
        payload.lostNote = window.prompt("Note de perte optionnelle")?.trim() ?? ""
      }

      const response = await fetch(`/api/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<ApiLead>(response)
      setNotice({
        type: "success",
        message:
          status === "WON"
            ? "Prospect gagné. La conversion en client est maintenant recommandée."
            : "Statut du prospect mis à jour.",
      })
      await loadLeads(filters, page)
    } catch (statusError) {
      setNotice({
        type: "error",
        message:
          statusError instanceof Error
            ? statusError.message
            : "Impossible de modifiér le statut.",
      })
    }
  }

  async function archiveLead(lead: ApiLead) {
    setConfirmAction({
      title: "Archiver le prospect",
      description: `${lead.firstName} ${lead.lastName} sera retiré du pipeline actif, sans suppression définitive.`,
      confirmLabel: "Archiver",
      onConfirm: async () => {
        await archiveLeadConfirmed(lead)
      },
    })
  }

  async function archiveLeadConfirmed(lead: ApiLead) {
    try {
      const response = await fetch(`/api/leads/${lead.id}/archive`, {
        method: "PATCH",
      })
      await readJson<ApiLead>(response)
      setNotice({ type: "success", message: "Prospect archivé." })
      await loadLeads(filters, page)
    } catch (archiveError) {
      setNotice({
        type: "error",
        message:
          archiveError instanceof Error
            ? archiveError.message
            : "Impossible d'archiver le prospect.",
      })
    }
  }

  async function deleteLead(lead: ApiLead) {
    setConfirmAction({
      title: "Supprimer le prospect",
      description: `${lead.firstName} ${lead.lastName} sera supprimé de la liste. Les tâches, notes et activités liées resteront conservées dans l'historique sans être attachées au prospect.`,
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        await deleteLeadConfirmed(lead)
      },
    })
  }

  async function deleteLeadConfirmed(lead: ApiLead) {
    try {
      const response = await fetch(`/api/leads/${lead.id}/delete`, {
        method: "DELETE",
      })
      await readJson<{ id: string }>(response)
      setNotice({ type: "success", message: "Prospect supprimé." })
      await loadLeads(filters, page)
    } catch (deleteError) {
      setNotice({
        type: "error",
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "Impossible de supprimer le prospect.",
      })
    }
  }

  async function deleteSelectedLeads() {
    if (selectedLeads.length === 0) return
    setConfirmAction({
      title: "Supprimer les prospects sélectionnés",
      description: `${selectedLeads.length} prospect(s) seront supprimés de la liste. Les tâches, notes et activités liées resteront conservées dans l'historique sans être attachées aux prospects.`,
      confirmLabel: "Supprimer la sélection",
      onConfirm: async () => {
        setIsSaving(true)
        try {
          const response = await fetch("/api/leads/bulk-delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedLeads.map((lead) => lead.id) }),
          })
          const result = await readJson<{ deleted: number }>(response)
          setSelectedLeadIds(new Set())
          setNotice({ type: "success", message: `${result.deleted} prospect(s) supprimé(s).` })
          await loadLeads(filters, page)
        } catch (deleteError) {
          setNotice({
            type: "error",
            message: deleteError instanceof Error ? deleteError.message : "Impossible de supprimer les prospects sélectionnés.",
          })
        } finally {
          setIsSaving(false)
        }
      },
    })
  }

  async function convertLead(lead: ApiLead) {
    setConfirmAction({
      title: "Convertir en client",
      description: `Une fiche client sera créée pour ${lead.firstName} ${lead.lastName}.`,
      confirmLabel: "Convertir",
      onConfirm: async () => {
        await convertLeadConfirmed(lead)
      },
    })
  }

  async function convertLeadConfirmed(lead: ApiLead) {
    try {
      const response = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
      })
      await readJson<{ id: string }>(response)
      setNotice({ type: "success", message: "Prospect converti en client." })
      await loadLeads(filters, page)
    } catch (convertError) {
      setNotice({
        type: "error",
        message:
          convertError instanceof Error
            ? convertError.message
            : "Impossible de convertir le prospect.",
      })
    }
  }

  async function sendLeadSms(lead: ApiLead, payload: { body: string }) {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<{ id: string }>(response)
      setSmsLead(null)
      setNotice({ type: "success", message: "SMS envoyé à Twilio." })
      await loadLeads(filters, page)
    } catch (smsError) {
      setNotice({
        type: "error",
        message:
          smsError instanceof Error
            ? smsError.message
            : "Impossible d'envoyer le SMS.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function createNote(lead: ApiLead, payload: { title: string; content: string }) {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<{ id: string }>(response)
      setNoteLead(null)
      setNotice({ type: "success", message: "Note ajoutee au prospect." })
      await loadLeads(filters, page)
    } catch (noteError) {
      setNotice({
        type: "error",
        message:
          noteError instanceof Error ? noteError.message : "Impossible d'ajouter la note.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function createTask(lead: ApiLead, payload: Record<string, string>) {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<{ id: string }>(response)
      setTaskLead(null)
      setNotice({ type: "success", message: "Tâche liee créee." })
      await loadLeads(filters, page)
    } catch (taskError) {
      setNotice({
        type: "error",
        message:
          taskError instanceof Error ? taskError.message : "Impossible de créer la tâche.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell
      eyebrow="CRM prospects"
      title="Prospects"
      description="Pilotez chaque nouveau contact du premier suivi jusqu'à la conversion client."
      showIntro={false}
    >
      {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}

      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
          <ProspectsHero
            activeCount={activeLeads.length}
            hotCount={hotLeads.length}
            followUpTasks={followUpTasks}
            conversionRate={conversionRate}
            onCreate={() => setFormLead("new")}
            onRefresh={() => void loadLeads()}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div
                  key={metric.label}
                  className={`rounded-[1.35rem] border-2 p-4 ${metric.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase text-slate-500">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {metric.value}
                      </p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/85">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-600">{metric.detail}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="min-h-[640px] p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-700">
                Espace prospects
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Pipeline conseiller
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
                Recherche, qualification, statut, SMS, notes, tâches et conversion
                client dans une seule vue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-2 border-slate-200 px-4 font-black"
                onClick={() => void loadLeads()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Rafraîchir
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full bg-emerald-500 px-4 font-black text-white shadow-[0_4px_0_#16a34a] hover:bg-emerald-600"
                onClick={() => setFormLead("new")}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Nouveau prospect
              </Button>
            </div>
          </div>

          <LeadFilters
            filters={filters}
            advisors={advisors}
            viewMode={viewMode}
            onChange={updateFilter}
            onReset={resetFilters}
            onViewModeChange={setViewMode}
            onCreate={() => setFormLead("new")}
          />

          {!isLoading && activeLeads.length > 0 ? (
            <BulkLeadActions
              allVisibleSelected={allVisibleSelected}
              isSaving={isSaving}
              selectedCount={selectedLeads.length}
              totalCount={activeLeads.length}
              onClear={() => setSelectedLeadIds(new Set())}
              onDelete={() => void deleteSelectedLeads()}
              onToggleAll={toggleAllVisibleLeads}
            />
          ) : null}

          {isLoading ? (
            <LoadingState label="Chargement des prospects..." />
          ) : error ? (
            <StatePanel
              title={error}
              description="Vérifiez la connexion puis relancez le chargement."
              actionLabel="Réessayer"
              onAction={() => void loadLeads()}
            />
          ) : leads.length === 0 ? (
            <StatePanel
              title="Aucun prospect"
              description="Ajoutez votre premier prospect pour commencer le pipeline."
              actionLabel="Nouveau prospect"
              onAction={() => setFormLead("new")}
            />
          ) : activeLeads.length === 0 ? (
            <StatePanel
              title="Aucun résultat actif"
              description="Les filtres ne retournent aucun prospect actif. Essayez de les réinitialiser."
              actionLabel="Réinitialiser"
              onAction={resetFilters}
            />
          ) : viewMode === "table" ? (
            <>
              <LeadTable
                leads={activeLeads}
                selectedIds={selectedLeadIds}
                onPreview={(lead) => setDetailLead(lead)}
                onEdit={(lead) => setFormLead(lead)}
                onStatusChange={changeStatus}
                onNote={(lead) => setNoteLead(lead)}
                onTask={(lead) => setTaskLead(lead)}
                onConvert={convertLead}
                onArchive={archiveLead}
                onDelete={deleteLead}
                onSms={(lead) => setSmsLead(lead)}
                onToggleSelect={toggleLeadSelection}
              />
              <PaginationControls
                meta={meta}
                onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
                onNext={() =>
                  setPage((current) =>
                    Math.min(current + 1, Math.max(Math.ceil(meta.total / meta.pageSize), 1))
                  )
                }
              />
            </>
          ) : (
            <>
              <LeadKanban
                leads={activeLeads}
                selectedIds={selectedLeadIds}
                onPreview={(lead) => setDetailLead(lead)}
                onStatusChange={changeStatus}
                onEdit={(lead) => setFormLead(lead)}
                onTask={(lead) => setTaskLead(lead)}
                onNote={(lead) => setNoteLead(lead)}
                onToggleSelect={toggleLeadSelection}
              />
              <PaginationControls
                meta={meta}
                onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
                onNext={() =>
                  setPage((current) =>
                    Math.min(current + 1, Math.max(Math.ceil(meta.total / meta.pageSize), 1))
                  )
                }
              />
            </>
          )}
        </div>
      </section>

      {formLead ? (
        <LeadFormModal
          lead={formLead === "new" ? null : formLead}
          isSaving={isSaving}
          onClose={() => setFormLead(null)}
          onSave={saveLead}
        />
      ) : null}

      {noteLead ? (
        <AddLeadNoteModal
          lead={noteLead}
          isSaving={isSaving}
          onClose={() => setNoteLead(null)}
          onSave={createNote}
        />
      ) : null}

      {taskLead ? (
        <CreateLeadTaskModal
          lead={taskLead}
          isSaving={isSaving}
          onClose={() => setTaskLead(null)}
          onSave={createTask}
        />
      ) : null}

      {smsLead ? (
        <SendLeadSmsModal
          lead={smsLead}
          isSaving={isSaving}
          onClose={() => setSmsLead(null)}
          onSave={sendLeadSms}
        />
      ) : null}

      {detailLead ? (
        <LeadDetailPanel
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onEdit={(lead) => {
            setDetailLead(null)
            setFormLead(lead)
          }}
          onTask={(lead) => {
            setDetailLead(null)
            setTaskLead(lead)
          }}
          onNote={(lead) => {
            setDetailLead(null)
            setNoteLead(lead)
          }}
          onSms={(lead) => {
            setDetailLead(null)
            setSmsLead(lead)
          }}
          onConvert={(lead) => {
            setDetailLead(null)
            void convertLead(lead)
          }}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          isSaving={isSaving}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            setIsSaving(true)
            try {
              await confirmAction.onConfirm()
              setConfirmAction(null)
            } finally {
              setIsSaving(false)
            }
          }}
        />
      ) : null}
    </PageShell>
  )
}

function ProspectsHero({
  activeCount,
  hotCount,
  followUpTasks,
  conversionRate,
  onCreate,
  onRefresh,
}: {
  activeCount: number
  hotCount: number
  followUpTasks: number
  conversionRate: number
  onCreate: () => void
  onRefresh: () => void
}) {
  const stages = ["Nouveau", "Contact", "Qualif.", "Proposition", "Gagné", "Client"]

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-stretch">
      <div className="rounded-[1.75rem] border-2 border-emerald-300 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-emerald-100">Space prospects</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-black leading-tight">
              Tout qualifier au bon moment
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-emerald-50">
              Chaque prospect relie appels, SMS, tâches, notes, source d&apos;acquisition et
              conversion client pour garder le suivi clair.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-2 border-white/60 bg-white/10 px-4 font-black text-white hover:bg-white/20"
              onClick={onRefresh}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Rafraîchir
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-white px-4 font-black text-emerald-700 shadow-[0_4px_0_#bbf7d0] hover:bg-emerald-50"
              onClick={onCreate}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Nouveau
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {stages.map((stage, index) => (
            <span
              key={stage}
              className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-black text-white"
            >
              {index + 1}. {stage}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
        <p className="text-xs font-black uppercase text-slate-500">Santé pipeline</p>
        <div className="mt-3 flex items-end gap-2">
          <p className="text-4xl font-black text-slate-950">{conversionRate}%</p>
          <p className="pb-1 text-xs font-bold text-slate-500">conversion</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min(conversionRate, 100)}%` }}
          />
        </div>
        <div className="mt-5 grid gap-2 text-sm font-bold text-slate-700">
          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
            <span>Actifs</span>
            <span>{activeCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
            <span>Chauds</span>
            <span>{hotCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
            <span>Suivis</span>
            <span>{followUpTasks}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadFilters({
  filters,
  advisors,
  viewMode,
  onChange,
  onReset,
  onViewModeChange,
  onCreate,
}: {
  filters: Filters
  advisors: { id: string; name: string }[]
  viewMode: "table" | "kanban"
  onChange: (key: keyof Filters, value: string) => void
  onReset: () => void
  onViewModeChange: (mode: "table" | "kanban") => void
  onCreate: () => void
}) {
  const quickFilters: {
    label: string
    key: keyof Filters
    value: string
  }[] = [
    { label: "Créés ce mois", key: "created", value: "this-month" },
    { label: "À contacter", key: "status", value: "TO_CONTACT" },
    { label: "Chauds", key: "priority", value: "HIGH" },
    { label: "Urgents", key: "priority", value: "URGENT" },
    { label: "Proposition", key: "status", value: "PROPOSAL_SENT" },
    { label: "Site web", key: "source", value: "WEBSITE" },
    { label: "SMS entrant", key: "source", value: "SMS" },
  ]

  return (
    <div className="mb-5 space-y-4 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 p-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={filters.q}
            onChange={(event) => onChange("q", event.target.value)}
            placeholder="Rechercher un nom, un téléphone ou un courriel..."
            aria-label="Rechercher un prospect"
            className="h-12 rounded-full border-2 border-slate-200 bg-white pl-11 text-sm font-semibold shadow-inner"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-12 rounded-full bg-emerald-500 px-4 font-black text-white shadow-[0_4px_0_#16a34a] hover:bg-emerald-600"
            onClick={onCreate}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Nouveau prospect
          </Button>
          <Button
            type="button"
            variant="outline"
            className={
              viewMode === "table"
                ? "h-12 rounded-full border-2 border-slate-950 bg-slate-950 px-4 font-black text-white hover:bg-slate-800"
                : "h-12 rounded-full border-2 border-slate-200 bg-white px-4 font-black"
            }
            onClick={() => onViewModeChange("table")}
            aria-label="Afficher la vue tableau"
          >
            <List className="size-4" aria-hidden="true" />
            Tableau
          </Button>
          <Button
            type="button"
            variant="outline"
            className={
              viewMode === "kanban"
                ? "h-12 rounded-full border-2 border-slate-950 bg-slate-950 px-4 font-black text-white hover:bg-slate-800"
                : "h-12 rounded-full border-2 border-slate-200 bg-white px-4 font-black"
            }
            onClick={() => onViewModeChange("kanban")}
            aria-label="Afficher la vue kanban"
          >
            <KanbanSquare className="size-4" aria-hidden="true" />
            Kanban
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => {
          const active = filters[filter.key] === filter.value
          return (
            <button
              key={`${filter.key}-${filter.value}`}
              type="button"
              className={
                active
                  ? "rounded-full border-2 border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"
                  : "rounded-full border-2 border-white bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-200"
              }
              onClick={() => onChange(filter.key, active ? "" : filter.value)}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-6">
        <SelectFilter
          label="Période"
          value={filters.created}
          onChange={(value) => onChange("created", value)}
          options={[{ value: "this-month", label: "Créés ce mois" }]}
        />
        <SelectFilter
          label="Statut"
          value={filters.status}
          onChange={(value) => onChange("status", value)}
          options={statusOptions.map((item) => ({ value: item.value, label: item.label }))}
        />
        <SelectFilter
          label="Source"
          value={filters.source}
          onChange={(value) => onChange("source", value)}
          options={sourceOptions}
        />
        <SelectFilter
          label="Priorité"
          value={filters.priority}
          onChange={(value) => onChange("priority", value)}
          options={priorityOptions.map((item) => ({ value: item.value, label: item.label }))}
        />
        <SelectFilter
          label="Conseiller"
          value={filters.advisorId}
          onChange={(value) => onChange("advisorId", value)}
          options={advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full border-2 border-slate-200 bg-white font-black"
          onClick={onReset}
        >
          <FilterX className="size-4" aria-hidden="true" />
          Réinitialiser
        </Button>
      </div>
    </div>
  )
}

function PaginationControls({
  meta,
  onPrevious,
  onNext,
}: {
  meta: LeadsMeta
  onPrevious: () => void
  onNext: () => void
}) {
  const totalPages = Math.max(Math.ceil(meta.total / meta.pageSize), 1)
  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1
  const lastItem = Math.min(meta.page * meta.pageSize, meta.total)

  return (
    <div className="mt-5 flex flex-col gap-3 border-t-2 border-slate-100 pt-4 text-sm font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p className="rounded-full bg-slate-50 px-3 py-1.5">
        {firstItem}-{lastItem} sur {meta.total} prospects
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-2 border-slate-200 font-black"
          onClick={onPrevious}
          disabled={meta.page <= 1}
        >
          Précédent
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-2 border-slate-200 font-black"
          onClick={onNext}
          disabled={meta.page >= totalPages}
        >
          Suivant
        </Button>
      </div>
    </div>
  )
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-bold normal-case text-slate-700 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <option value="">Tous</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function LeadTable({
  leads,
  selectedIds,
  onPreview,
  onEdit,
  onStatusChange,
  onNote,
  onTask,
  onConvert,
  onArchive,
  onDelete,
  onSms,
  onToggleSelect,
}: {
  leads: ApiLead[]
  selectedIds: Set<string>
  onPreview: (lead: ApiLead) => void
  onEdit: (lead: ApiLead) => void
  onStatusChange: (lead: ApiLead, status: LeadStatusCode) => void
  onNote: (lead: ApiLead) => void
  onTask: (lead: ApiLead) => void
  onConvert: (lead: ApiLead) => void
  onArchive: (lead: ApiLead) => void
  onDelete: (lead: ApiLead) => void
  onSms: (lead: ApiLead) => void
  onToggleSelect: (leadId: string) => void
}) {
  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <article
          key={lead.id}
          className={selectedIds.has(lead.id) ? "rounded-[1.35rem] border-2 border-emerald-300 bg-emerald-50 p-4 shadow-[0_6px_0_#bbf7d0] transition hover:-translate-y-0.5" : "rounded-[1.35rem] border-2 border-slate-100 bg-white p-4 shadow-[0_6px_0_#f1f5f9] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_8px_0_#bbf7d0]"}
        >
          <div className="grid gap-4 xl:grid-cols-[auto_minmax(220px,1.2fr)_minmax(360px,1.8fr)_auto] xl:items-center">
            <LeadSelectCheckbox checked={selectedIds.has(lead.id)} lead={lead} onChange={() => onToggleSelect(lead.id)} />
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-[0_4px_0_#cbd5e1]">
                  {lead.firstName.slice(0, 1)}
                  {lead.lastName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/prospects/${lead.id}`}
                      className="truncate text-base font-black text-slate-950 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {lead.firstName} {lead.lastName}
                    </Link>
                    <LeadPriorityBadge priority={lead.priority} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="truncate">{lead.phone}</span>
                    <span className="truncate">{lead.email ?? "Courriel non défini"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Statut">
                <LeadStatusBadge status={lead.status} />
              </InfoItem>
              <InfoItem label="Source">{sourceLabel(lead.source)}</InfoItem>
              <InfoItem label="Intérêt">{lead.interestType ?? "À définir"}</InfoItem>
              <InfoItem label="Conseiller">{lead.advisor?.name ?? "Non assigné"}</InfoItem>
              <InfoItem label="Prochaine action" className="sm:col-span-2">
                {lead.nextAction ?? "À définir"}
              </InfoItem>
              <InfoItem label="Dernier contact">{formatDate(lead.lastContactAt)}</InfoItem>
              <InfoItem label="Créé le">{formatDate(lead.createdAt)}</InfoItem>
            </div>

            <div className="min-w-0 xl:max-w-[420px]">
              <LeadActionsMenu
                lead={lead}
                onPreview={onPreview}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onNote={onNote}
                onTask={onTask}
                onConvert={onConvert}
                onArchive={onArchive}
                onDelete={onDelete}
                onSms={onSms}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function BulkLeadActions({
  allVisibleSelected,
  isSaving,
  selectedCount,
  totalCount,
  onClear,
  onDelete,
  onToggleAll,
}: {
  allVisibleSelected: boolean
  isSaving: boolean
  selectedCount: number
  totalCount: number
  onClear: () => void
  onDelete: () => void
  onToggleAll: () => void
}) {
  return (
    <div className="mb-5 mt-5 flex flex-col gap-3 rounded-[1.35rem] border-2 border-slate-200 bg-white p-3 shadow-[0_5px_0_#e2e8f0] md:flex-row md:items-center md:justify-between">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={onToggleAll}
          className="size-5 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
          aria-label="Sélectionner tous les prospects visibles"
        />
        <span className="text-sm font-black text-slate-800">
          {selectedCount > 0 ? `${selectedCount} prospect(s) sélectionné(s)` : `Sélectionner les ${totalCount} prospect(s) visibles`}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full border-2 font-black" onClick={onClear} disabled={selectedCount === 0 || isSaving}>
          Désélectionner
        </Button>
        <Button type="button" variant="outline" className="rounded-full border-2 border-rose-200 font-black text-rose-700 hover:bg-rose-50" onClick={onDelete} disabled={selectedCount === 0 || isSaving}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Supprimer la sélection
        </Button>
      </div>
    </div>
  )
}

function LeadSelectCheckbox({ checked, lead, onChange }: { checked: boolean; lead: ApiLead; onChange: () => void }) {
  return (
    <label className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
        aria-label={`Sélectionner le prospect ${lead.firstName} ${lead.lastName}`}
      />
    </label>
  )
}

function InfoItem({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <div className="mt-1 truncate text-sm font-bold text-slate-700">{children}</div>
    </div>
  )
}

function LeadKanban({
  leads,
  selectedIds,
  onPreview,
  onStatusChange,
  onEdit,
  onTask,
  onNote,
  onToggleSelect,
}: {
  leads: ApiLead[]
  selectedIds: Set<string>
  onPreview: (lead: ApiLead) => void
  onStatusChange: (lead: ApiLead, status: LeadStatusCode) => void
  onEdit: (lead: ApiLead) => void
  onTask: (lead: ApiLead) => void
  onNote: (lead: ApiLead) => void
  onToggleSelect: (leadId: string) => void
}) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-[1200px] gap-4 px-1">
        {kanbanStatuses.map((status) => {
          const columnLeads = leads.filter((lead) => lead.status === status.value)
          return (
            <div
              key={status.value}
              className="w-[285px] shrink-0 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 p-3 shadow-[0_6px_0_#e2e8f0]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="truncate text-sm font-black text-slate-700">
                  {status.label}
                </h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">
                  {columnLeads.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnLeads.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
                    Aucun prospect
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isSelected={selectedIds.has(lead.id)}
                      onPreview={onPreview}
                      onStatusChange={onStatusChange}
                      onEdit={onEdit}
                      onTask={onTask}
                      onNote={onNote}
                      onToggleSelect={onToggleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeadCard({
  lead,
  isSelected,
  onPreview,
  onStatusChange,
  onEdit,
  onTask,
  onNote,
  onToggleSelect,
}: {
  lead: ApiLead
  isSelected: boolean
  onPreview: (lead: ApiLead) => void
  onStatusChange: (lead: ApiLead, status: LeadStatusCode) => void
  onEdit: (lead: ApiLead) => void
  onTask: (lead: ApiLead) => void
  onNote: (lead: ApiLead) => void
  onToggleSelect: (leadId: string) => void
}) {
  return (
    <article className={isSelected ? "overflow-hidden rounded-[1.25rem] border-2 border-emerald-300 bg-emerald-50 p-4 shadow-[0_5px_0_#bbf7d0] transition hover:-translate-y-0.5" : "overflow-hidden rounded-[1.25rem] border-2 border-white bg-white p-4 shadow-[0_5px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-emerald-200"}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <LeadSelectCheckbox checked={isSelected} lead={lead} onChange={() => onToggleSelect(lead.id)} />
        <div className="min-w-0">
          <Link
            href={`/prospects/${lead.id}`}
            className="block truncate text-sm font-black text-slate-950 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {lead.firstName} {lead.lastName}
          </Link>
        </div>
        <LeadPriorityBadge priority={lead.priority} />
      </div>
      <p className="truncate text-xs text-slate-500">{lead.phone}</p>
      <p className="mt-1 truncate text-xs text-slate-400">
        {lead.interestType ?? "Intérêt à définir"}
      </p>
      <p className="mt-3 line-clamp-2 text-xs text-slate-600">
        {lead.nextAction ?? "Prochaine action à définir"}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span className="truncate">{sourceLabel(lead.source)}</span>
        <span className="shrink-0">{formatDate(lead.lastContactAt)}</span>
      </div>
      <div className="mt-4 grid gap-2">
        <select
          value={lead.status}
          onChange={(event) => onStatusChange(lead, event.target.value as LeadStatusCode)}
          className="h-10 w-full rounded-full border-2 border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Changer le statut"
        >
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" size="sm" variant="outline" className="rounded-full border-2 px-2" onClick={() => onEdit(lead)}>
            <Edit3 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Modifier</span>
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full border-2 px-2" onClick={() => onTask(lead)}>
            <ClipboardList className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Créer tâche</span>
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full border-2 px-2" onClick={() => onNote(lead)}>
            <StickyNote className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Ajouter note</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

function LeadActionsMenu({
  lead,
  onPreview,
  onEdit,
  onStatusChange,
  onNote,
  onTask,
  onConvert,
  onArchive,
  onDelete,
  onSms,
}: {
  lead: ApiLead
  onPreview: (lead: ApiLead) => void
  onEdit: (lead: ApiLead) => void
  onStatusChange: (lead: ApiLead, status: LeadStatusCode) => void
  onNote: (lead: ApiLead) => void
  onTask: (lead: ApiLead) => void
  onConvert: (lead: ApiLead) => void
  onArchive: (lead: ApiLead) => void
  onDelete: (lead: ApiLead) => void
  onSms: (lead: ApiLead) => void
}) {
  const actionButtonClass =
    "h-9 justify-start rounded-full border-2 border-slate-200 bg-white px-2.5 text-xs font-black hover:border-emerald-200 hover:bg-emerald-50"

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onPreview(lead)}>
        <Eye className="size-3.5 text-slate-500" aria-hidden="true" />
        Fiche
      </Button>
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onEdit(lead)}>
        <Edit3 className="size-3.5 text-sky-600" aria-hidden="true" />
        Modifier
      </Button>
      <select
        value={lead.status}
        onChange={(event) => onStatusChange(lead, event.target.value as LeadStatusCode)}
        className="col-span-2 h-9 rounded-full border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:col-span-2 xl:col-span-2 2xl:col-span-2"
        aria-label={`Changer le statut de ${lead.firstName} ${lead.lastName}`}
      >
        {statusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onTask(lead)}>
        <ClipboardList className="size-3.5 text-amber-600" aria-hidden="true" />
        Tâche
      </Button>
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onNote(lead)}>
        <StickyNote className="size-3.5 text-violet-600" aria-hidden="true" />
        Note
      </Button>
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onSms(lead)}>
        <MessageSquare className="size-3.5 text-emerald-600" aria-hidden="true" />
        SMS
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={actionButtonClass}
        onClick={() => onConvert(lead)}
        disabled={lead.status === "CONVERTED"}
      >
        <UserCheck className="size-3.5 text-emerald-700" aria-hidden="true" />
        Convertir
      </Button>
      <Button type="button" size="sm" variant="outline" className={actionButtonClass} onClick={() => onArchive(lead)}>
        <Archive className="size-3.5 text-slate-500" aria-hidden="true" />
        Archiver
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-9 justify-start rounded-full border-2 border-rose-200 bg-white px-2.5 text-xs font-black text-rose-700 hover:bg-rose-50" onClick={() => onDelete(lead)}>
        <Trash2 className="size-3.5" aria-hidden="true" />
        Supprimer
      </Button>
    </div>
  )
}

function LeadStatusBadge({ status }: { status: LeadStatusCode }) {
  const meta = statusMeta(status)
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

function LeadPriorityBadge({ priority }: { priority: PriorityCode }) {
  const meta = priorityMeta(priority)
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

function LeadDetailPanel({
  lead,
  onClose,
  onEdit,
  onTask,
  onNote,
  onSms,
  onConvert,
}: {
  lead: ApiLead
  onClose: () => void
  onEdit: (lead: ApiLead) => void
  onTask: (lead: ApiLead) => void
  onNote: (lead: ApiLead) => void
  onSms: (lead: ApiLead) => void
  onConvert: (lead: ApiLead) => void
}) {
  const openTasks = (lead.tasks ?? []).filter((task) => task.status !== "DONE").length
  const readinessItems = [
    {
      label: "Coordonnées",
      ready: Boolean(lead.phone && lead.email),
      detail: lead.email ? "Téléphone et courriel disponibles" : "Courriel à compléter",
    },
    {
      label: "Besoin",
      ready: Boolean(lead.interestType),
      detail: lead.interestType ?? "Type d'intérêt à préciser",
    },
    {
      label: "Prochaine action",
      ready: Boolean(lead.nextAction),
      detail: lead.nextAction ?? "Aucune action définie",
    },
    {
      label: "Suivi",
      ready: Boolean(lead.lastContactAt || openTasks > 0),
      detail: openTasks > 0 ? `${openTasks} tâche(s) ouverte(s)` : "Dernier contact à planifier",
    },
  ]
  const readyCount = readinessItems.filter((item) => item.ready).length
  const readinessPercent = Math.round((readyCount / readinessItems.length) * 100)

  return (
    <Modal title={`Fiche prospect - ${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 p-6 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-[1.25rem] bg-slate-950 text-xl font-black text-white shadow-[0_6px_0_#cbd5e1]">
              {lead.firstName.slice(0, 1)}
              {lead.lastName.slice(0, 1)}
            </div>
            <p className="mt-4 text-sm font-black text-slate-700">
              {sourceLabel(lead.source)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Créé le {formatDate(lead.createdAt)}
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-2xl font-black text-slate-950">
                  {lead.firstName} {lead.lastName}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LeadStatusBadge status={lead.status} />
                  <LeadPriorityBadge priority={lead.priority} />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {lead.advisor?.name ?? "Non assigné"}
                  </span>
                </div>
              </div>
              <Button type="button" variant="outline" className="rounded-full border-2 font-black" onClick={() => onEdit(lead)}>
                <Edit3 className="size-4" />
                Modifier
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:border-emerald-200"
              >
                <Phone className="size-4 text-emerald-700" />
                {lead.phone}
              </a>
              <a
                href={lead.email ? `mailto:${lead.email}` : undefined}
                className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:border-emerald-200"
              >
                <Mail className="size-4 text-sky-700" />
                {lead.email ?? "Courriel à compléter"}
              </a>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-[1.5rem] border-2 border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Eye className="size-4 text-emerald-700" />
                Aperçu du suivi
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Vue rapide pour décider si le conseiller doit appeler, qualifier, convertir ou compléter le dossier.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full bg-emerald-600 font-black text-white hover:bg-emerald-700" onClick={() => onSms(lead)}>
                <MessageSquare className="size-4" />
                SMS
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white font-black" onClick={() => onTask(lead)}>
                <ClipboardList className="size-4" />
                Tâche
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white font-black" onClick={() => onNote(lead)}>
                <StickyNote className="size-4" />
                Note
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            <ProspectFact icon={CalendarClock} label="Dernier contact" value={formatDate(lead.lastContactAt)} />
            <ProspectFact icon={ClipboardList} label="Tâches ouvertes" value={String(openTasks)} />
            <ProspectFact icon={MessageSquare} label="Activités" value={String(lead.activities?.length ?? 0)} />
          </div>
        </section>

        <section className="rounded-[1.5rem] border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-emerald-950">
                <ShieldCheck className="size-4 text-emerald-700" />
                Qualification conseiller
              </p>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-emerald-900">
                Contrôlez les informations utiles avant de convertir le prospect en client.
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-800">
              {readinessPercent}% prêt
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {readinessItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-emerald-100 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{item.label}</p>
                  <span
                    className={
                      item.ready
                        ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700"
                        : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800"
                    }
                  >
                    {item.ready ? "OK" : "À compléter"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" onClick={() => onEdit(lead)}>
              <Edit3 className="size-4" />
              Modifier la fiche
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 bg-white font-black" onClick={() => onConvert(lead)} disabled={lead.status === "CONVERTED"}>
              <UserCheck className="size-4" />
              Convertir
            </Button>
          </div>
        </section>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <ProspectInfoRow label="Intérêt principal" value={lead.interestType ?? "À définir"} />
          <ProspectInfoRow label="Prochaine action" value={lead.nextAction ?? "À définir"} />
          <ProspectInfoRow label="Source" value={sourceLabel(lead.source)} />
          <ProspectInfoRow label="Conseiller" value={lead.advisor?.name ?? "Non assigné"} />
          <ProspectInfoRow label="Adresse" value={lead.address ?? "Non renseignée"} />
          <ProspectInfoRow label="Notes" value={lead.notes ?? "Aucune note"} />
        </div>
      </div>
    </Modal>
  )
}

function ProspectFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.25rem] border-2 border-slate-100 bg-slate-50 p-4">
      <Icon className="size-5 text-emerald-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-950">{value}</p>
    </div>
  )
}

function ProspectInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">{value}</p>
    </div>
  )
}

function LeadFormModal({
  lead,
  isSaving,
  onClose,
  onSave,
}: {
  lead: ApiLead | null
  isSaving: boolean
  onClose: () => void
  onSave: (payload: Record<string, string>, lead?: ApiLead) => Promise<void>
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
    ) as Record<string, string>
    const nextErrors: Record<string, string> = {}

    if (!payload.firstName.trim()) nextErrors.firstName = "Le prenom est requis."
    if (!payload.lastName.trim()) nextErrors.lastName = "Le nom est requis."
    if (!payload.phone.trim()) nextErrors.phone = "Le téléphone est requis."
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      nextErrors.email = "Courriel invalidé."
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    await onSave(payload, lead ?? undefined)
  }

  return (
    <Modal title={lead ? "Modifier le prospect" : "Nouveau prospect"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="firstName" label="Prenom" defaultValue={lead?.firstName} error={errors.firstName} required />
          <Field name="lastName" label="Nom" defaultValue={lead?.lastName} error={errors.lastName} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="phone" label="Téléphone" defaultValue={lead?.phone} error={errors.phone} required />
          <Field name="email" label="Courriel" type="email" defaultValue={lead?.email ?? ""} error={errors.email} />
        </div>
        <Field name="address" label="Adresse" defaultValue={lead?.address ?? ""} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            name="status"
            label="Statut"
            defaultValue={lead?.status ?? "NEW"}
            options={statusOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
          <SelectField
            name="source"
            label="Source"
            defaultValue={lead?.source ?? "MANUAL"}
            options={sourceOptions}
          />
          <SelectField
            name="priority"
            label="Priorité"
            defaultValue={lead?.priority ?? "NORMAL"}
            options={priorityOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="interestType"
            label="Intérêt principal"
            defaultValue={lead?.interestType ?? ""}
            options={[
              { value: "", label: "À définir" },
              { value: "Assurance vie", label: "Assurance vie" },
              { value: "Assurance invalidité", label: "Assurance invalidité" },
              { value: "Maladie grave", label: "Maladie grave" },
              { value: "REER", label: "REER" },
              { value: "CELI", label: "CELI" },
              { value: "Placements", label: "Placements" },
              { value: "Protection familiale", label: "Protection familiale" },
            ]}
            help="Le besoin financier principal identifié chez le prospect."
          />
          <SelectField
            name="nextAction"
            label="Prochaine action"
            defaultValue={lead?.nextAction ?? ""}
            options={[
              { value: "", label: "À définir" },
              { value: "Contacter aujourd’hui", label: "Contacter aujourd’hui" },
              { value: "Rappeler demain", label: "Rappeler demain" },
              { value: "Qualifier le besoin", label: "Qualifier le besoin" },
              { value: "Préparer proposition", label: "Préparer proposition" },
              { value: "Suivi dans 48h", label: "Suivi dans 48h" },
              { value: "Planifier rendez-vous", label: "Planifier rendez-vous" },
              { value: "Convertir en client", label: "Convertir en client" },
            ]}
            help="La prochaine étape concrète à faire dans le suivi."
          />
        </div>
        <Field
          name="lastContactAt"
          label="Date du dernier contact"
          type="date"
          defaultValue={lead?.lastContactAt ? lead.lastContactAt.slice(0, 10) : ""}
        />
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Notes
          <textarea
            name="notes"
            defaultValue={lead?.notes ?? ""}
            rows={4}
            className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
        <ModalActions
          isSaving={isSaving}
          onClose={onClose}
          submitLabel={lead ? "Modifier" : "Créer"}
        />
      </form>
    </Modal>
  )
}

function AddLeadNoteModal({
  lead,
  isSaving,
  onClose,
  onSave,
}: {
  lead: ApiLead
  isSaving: boolean
  onClose: () => void
  onSave: (lead: ApiLead, payload: { title: string; content: string }) => Promise<void>
}) {
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
    }
    if (!payload.content.trim()) {
      setError("La note est requise.")
      return
    }
    await onSave(lead, payload)
  }

  return (
    <Modal title={`Ajouter une note - ${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <Field name="title" label="Titre" />
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Note
          <textarea
            name="content"
            rows={5}
            className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
          {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
        </label>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Ajouter note" />
      </form>
    </Modal>
  )
}

function CreateLeadTaskModal({
  lead,
  isSaving,
  onClose,
  onSave,
}: {
  lead: ApiLead
  isSaving: boolean
  onClose: () => void
  onSave: (lead: ApiLead, payload: Record<string, string>) => Promise<void>
}) {
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
    ) as Record<string, string>
    if (!payload.title.trim()) {
      setError("Le titre est requis.")
      return
    }
    await onSave(lead, payload)
  }

  return (
    <Modal title={`Créer une tâche - ${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <Field name="title" label="Titre" error={error} required />
        <Field name="description" label="Description" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="dueDate" label="Échéance" type="date" />
          <SelectField
            name="priority"
            label="Priorité"
            defaultValue="NORMAL"
            options={priorityOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
          <SelectField
            name="status"
            label="Statut"
            defaultValue="TODO"
            options={[
              { value: "TODO", label: "À faire" },
              { value: "IN_PROGRESS", label: "En cours" },
              { value: "DONE", label: "Terminee" },
              { value: "OVERDUE", label: "En retard" },
            ]}
          />
        </div>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Créer tâche" />
      </form>
    </Modal>
  )
}

function SendLeadSmsModal({
  lead,
  isSaving,
  onClose,
  onSave,
}: {
  lead: ApiLead
  isSaving: boolean
  onClose: () => void
  onSave: (lead: ApiLead, payload: { body: string }) => Promise<void>
}) {
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const body = String(formData.get("body") ?? "").trim()
    if (!body) {
      setError("Le message est requis.")
      return
    }
    await onSave(lead, { body })
  }

  return (
    <Modal title={`Envoyer un SMS - ${lead.firstName} ${lead.lastName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          Destinataire : <span className="font-black text-slate-900">{lead.phone}</span>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Message
          <textarea
            name="body"
            rows={5}
            maxLength={1000}
            defaultValue={`Bonjour ${lead.firstName}, merci pour votre intérêt. Je vous recontacte sous peu.`}
            className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
          {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
        </label>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Envoyer le SMS" />
      </form>
    </Modal>
  )
}

function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  error,
  required,
}: {
  name: string
  label: string
  type?: string
  defaultValue?: string | null
  error?: string
  required?: boolean
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="h-11 rounded-2xl"
      />
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
  help,
}: {
  name: string
  label: string
  defaultValue: string
  options: { value: string; label: string }[]
  help?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help ? <span className="text-xs font-normal text-slate-500">{help}</span> : null}
    </label>
  )
}

function ModalActions({
  isSaving,
  onClose,
  submitLabel,
}: {
  isSaving: boolean
  onClose: () => void
  submitLabel: string
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-2 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
      <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
        Annuler
      </Button>
      <Button
        type="submit"
        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
        disabled={isSaving}
      >
        {isSaving ? "Sauvegarde..." : submitLabel}
      </Button>
    </div>
  )
}

function Notice({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={
        type === "success"
          ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
      }
    >
      {children}
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Loader2 className="size-4 animate-spin text-emerald-600" aria-hidden="true" />
        {label}
      </div>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
        />
      ))}
    </div>
  )
}

function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
        <Sparkles className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : null}
      {actionLabel ? (
        <Button className="mt-5 rounded-2xl" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-2xl"
            onClick={onClose}
            aria-label="Fermer la modale"
          >
            Fermer
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  isSaving,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  isSaving: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-[1.5rem] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={onClose}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void onConfirm()}
            disabled={isSaving}
          >
            {isSaving ? "Traitement..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
