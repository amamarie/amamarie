"use client"

import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileText, Filter, Grid3X3, List, Loader2, Mail, MessageSquare, Phone, Plus, RefreshCw, RotateCcw, Sparkles, TimerReset, Trash2, UserRound } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PersonRef = { id: string; firstName: string; lastName: string }
type SelectOption = { id: string; label: string }
type TaskDisplayMode = "grid" | "list"
type TaskSummary = { todayCount: number; overdueCount: number; urgentCount: number; upcomingCount: number; assignedToMeCount: number; automatedCount: number; completedThisWeek: number; completionRate: number }
type ApiTask = {
  id: string
  type: string
  title: string
  description: string | null
  outcome: string | null
  status: string
  priority: string
  dueDate: string | null
  reminderAt: string | null
  snoozedUntil: string | null
  isAutomated: boolean
  leadId: string | null
  clientId: string | null
  assignedTo?: { name: string } | null
  lead?: PersonRef | null
  client?: PersonRef | null
  product?: { type: string; company: string | null; productName: string | null } | null
}

const taskTypeLabels: Record<string, string> = {
  CALL: "Appel",
  SMS: "SMS",
  EMAIL: "Courriel",
  MEETING: "Rencontre",
  DOCUMENT: "Document",
  KYC: "Profil client",
  FOLLOW_UP: "Suivi",
  PRODUCT_REVIEW: "Révision produit",
  RENEWAL: "Renouvellement",
  COMPLIANCE: "Conformité",
  INTERNAL: "Interne",
  OTHER: "Autre",
}

const statusLabels: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  WAITING: "En attente",
  DONE: "Terminée",
  CANCELLED: "Annulée",
  OVERDUE: "En retard",
  SNOOZED: "Reportée",
  ARCHIVED: "Archivée",
}

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
}

const statusTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  TODO: "sky",
  IN_PROGRESS: "violet",
  WAITING: "amber",
  DONE: "emerald",
  CANCELLED: "slate",
  OVERDUE: "rose",
  SNOOZED: "amber",
  ARCHIVED: "slate",
}

const priorityTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  LOW: "slate",
  NORMAL: "sky",
  HIGH: "amber",
  URGENT: "rose",
}

const taskViews = ["today", "overdue", "upcoming", "automated", "all", "done", "snoozed"] as const

const viewLabels: Record<string, string> = {
  today: "Aujourd'hui",
  overdue: "En retard",
  upcoming: "À venir",
  automated: "Automatisées",
  all: "Toutes les tâches",
  done: "Terminées",
  snoozed: "Reportées",
}

const typeIcon = {
  CALL: Phone,
  SMS: MessageSquare,
  EMAIL: Mail,
  DOCUMENT: FileText,
  KYC: FileText,
  MEETING: CalendarDays,
  FOLLOW_UP: RotateCcw,
  PRODUCT_REVIEW: RefreshCw,
  RENEWAL: TimerReset,
  COMPLIANCE: AlertTriangle,
  INTERNAL: UserRound,
  OTHER: Clock3,
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { ok?: boolean; data?: T; error?: { message?: string } | string }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function formatDate(value?: string | null) {
  if (!value) return "À définir"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function TasksApiPage() {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get("view")
  const initialView = taskViews.includes(requestedView as (typeof taskViews)[number]) ? requestedView as string : "all"
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [summary, setSummary] = useState<TaskSummary | null>(null)
  const [leads, setLeads] = useState<SelectOption[]>([])
  const [clients, setClients] = useState<SelectOption[]>([])
  const [view, setView] = useState(initialView)
  const [viewMode, setViewMode] = useState<TaskDisplayMode>("grid")
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState("")
  const [type, setType] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set())

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view, limit: "75" })
      if (search) params.set("search", search)
      if (priority) params.set("priority", priority)
      if (type) params.set("type", type)
      const [tasksResponse, summaryResponse] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/tasks/summary", { cache: "no-store" }),
      ])
      const nextTasks = await readData<ApiTask[]>(tasksResponse)
      const visibleIds = new Set(nextTasks.map((task) => task.id))
      setTasks(nextTasks)
      setSelectedTaskIds((previous) => new Set([...previous].filter((id) => visibleIds.has(id))))
      setSummary(await readData<TaskSummary>(summaryResponse))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les tâches.")
    } finally {
      setIsLoading(false)
    }
  }, [priority, search, type, view])

  useEffect(() => {
    let isMounted = true
    async function loadInitialData() {
      try {
        const [leadsResponse, clientsResponse] = await Promise.all([
          fetch("/api/leads", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ])
        const leadsData = await readData<PersonRef[]>(leadsResponse)
        const clientsData = await readData<{ items?: PersonRef[] } | PersonRef[]>(clientsResponse)
        if (!isMounted) return
        setLeads(leadsData.map((lead) => ({ id: lead.id, label: `${lead.firstName} ${lead.lastName}` })))
        const clientList = Array.isArray(clientsData) ? clientsData : clientsData.items ?? []
        setClients(clientList.map((client) => ({ id: client.id, label: `${client.firstName} ${client.lastName}` })))
      } catch {
        if (isMounted) setError("Impossible de charger les dossiers liés.")
      }
    }
    void loadInitialData()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks()
  }, [loadTasks])

  const metrics = useMemo(() => [
    { label: "Aujourd'hui", value: `${summary?.todayCount ?? 0}`, detail: "À traiter", icon: CalendarDays, tone: "amber" as const },
    { label: "En retard", value: `${summary?.overdueCount ?? 0}`, detail: "Suivi requis", icon: AlertTriangle, tone: "rose" as const },
    { label: "Urgentes", value: `${summary?.urgentCount ?? 0}`, detail: "À prioriser", icon: Clock3, tone: "violet" as const },
    { label: "Automatisées", value: `${summary?.automatedCount ?? 0}`, detail: "Créées par règles", icon: Sparkles, tone: "sky" as const },
    { label: "Complétées", value: `${summary?.completedThisWeek ?? 0}`, detail: `${summary?.completionRate ?? 0}% cette semaine`, icon: CheckCircle2, tone: "emerald" as const },
  ], [summary])

  const activeWorkload = (summary?.todayCount ?? 0) + (summary?.overdueCount ?? 0) + (summary?.urgentCount ?? 0)
  const completionRate = summary?.completionRate ?? 0
  const selectedTasks = useMemo(() => tasks.filter((task) => selectedTaskIds.has(task.id)), [selectedTaskIds, tasks])
  const allVisibleSelected = tasks.length > 0 && tasks.every((task) => selectedTaskIds.has(task.id))

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function toggleAllVisibleTasks() {
    setSelectedTaskIds((previous) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(previous)
      for (const task of tasks) next.add(task.id)
      return next
    })
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const relatedType = String(formData.get("relatedType") ?? "")
    const relatedId = String(formData.get("relatedId") ?? "")
    const dueDate = String(formData.get("dueDate") ?? "")
    const reminderAt = String(formData.get("reminderAt") ?? "")
    const payload = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      type: String(formData.get("type") ?? "FOLLOW_UP"),
      priority: String(formData.get("priority") ?? "NORMAL"),
      status: String(formData.get("status") ?? "TODO"),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      reminderAt: reminderAt ? new Date(reminderAt).toISOString() : undefined,
      leadId: relatedType === "lead" && relatedId ? relatedId : undefined,
      clientId: relatedType === "client" && relatedId ? relatedId : undefined,
    }

    try {
      await readData<ApiTask>(await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }))
      form.reset()
      setIsModalOpen(false)
      setSuccess("Tâche créée avec succès.")
      await loadTasks()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Vérifiez les champs du formulaire.")
    } finally {
      setIsSaving(false)
    }
  }

  async function taskAction(taskId: string, action: "complete" | "snooze" | "cancel" | "reopen") {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const snoozedUntil = new Date()
      snoozedUntil.setDate(snoozedUntil.getDate() + 3)
      const body =
        action === "cancel" ? { cancelReason: "Annulée par le conseiller." } :
        action === "snooze" ? { snoozedUntil: snoozedUntil.toISOString(), snoozeReason: "Report de suivi." } :
        action === "complete" ? { outcome: "Suivi complété." } : {}
      await readData<ApiTask>(await fetch(`/api/tasks/${taskId}/${action}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      setSuccess("Tâche mise à jour.")
      await loadTasks()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteTask(task: ApiTask) {
    const confirmed = window.confirm(`Supprimer la tâche « ${task.title} » de la liste active? Elle sera archivée pour conserver l'historique.`)
    if (!confirmed) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await readData<ApiTask>(await fetch(`/api/tasks/${task.id}`, { method: "DELETE" }))
      setSuccess("Tâche supprimée de la liste active.")
      await loadTasks()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteSelectedTasks() {
    if (selectedTasks.length === 0) return
    const confirmed = window.confirm(`Supprimer ${selectedTasks.length} tâche(s) de la liste active? Elles seront archivées pour conserver l’historique.`)
    if (!confirmed) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await readData<{ archived: number }>(await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTasks.map((task) => task.id) }),
      }))
      setSelectedTaskIds(new Set())
      setSuccess(`${result.archived} tâche(s) supprimée(s) de la liste active.`)
      await loadTasks()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression en lot impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell eyebrow="Tâches et suivis" title="Centre d’action quotidien" description="Organisez les appels, courriels, documents, profils client, renouvellements et suivis clients au même endroit." showIntro={false}>
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-5">
        {success ? <Notice tone="emerald">{success}</Notice> : null}
        {error ? <Notice tone="rose">{error}</Notice> : null}

      <section className="max-w-full overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-stretch">
            <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Centre d'action conseiller</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight">Tâches reliées aux dossiers clients</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
                Priorisez les appels, documents, profils client, renouvellements et suivis générés par les règles d'automatisation.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Client", "Prospect", "Profil client", "Document", "Conformité"].map((step) => (
                  <span key={step} className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-black text-white">
                    {step}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void loadTasks()} disabled={isLoading}>
                  <RefreshCw className="size-4" />Rafraîchir
                </Button>
                <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={() => setIsModalOpen(true)}>
                  <Plus className="size-4" />Nouvelle tâche
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Charge active</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{activeWorkload}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">tâche(s) à surveiller aujourd'hui, en retard ou urgente(s).</p>
              <div className="mt-4 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(completionRate, 100)}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">{completionRate}% complétées cette semaine.</p>
            </div>
          </div>

          <TaskMetricStrip metrics={metrics} />
        </div>

        <div className="min-h-[640px] min-w-0 p-5">
          <section className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-4 shadow-[0_6px_0_#e2e8f0]">
            <div className="grid gap-4 2xl:grid-cols-[minmax(220px,320px)_1fr] 2xl:items-start">
              <div className="min-w-0 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vue actuelle</p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-xl font-black text-slate-950">{viewLabels[view] ?? "Tâches"}</p>
                  <span className="rounded-full border-2 border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{tasks.length} résultat(s)</span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Cette vue contrôle la liste ci-dessous. Les filtres affinent les tâches sans changer le statut CRM.
                </p>
                <div className="mt-4 inline-flex rounded-full border-2 border-slate-200 bg-slate-50 p-1">
                  <TaskModeButton active={viewMode === "grid"} label="Grille" icon={Grid3X3} onClick={() => setViewMode("grid")} />
                  <TaskModeButton active={viewMode === "list"} label="Ligne" icon={List} onClick={() => setViewMode("list")} />
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(150px,180px)_minmax(150px,180px)_auto]">
                  <label className="relative min-w-0">
                    <Filter className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une tâche..." className="h-11 rounded-full border-2 bg-white pl-11 font-semibold" />
                  </label>
                  <Select value={priority} onChange={setPriority} options={[["", "Toutes priorités"], ["LOW", "Basse"], ["NORMAL", "Normale"], ["HIGH", "Haute"], ["URGENT", "Urgente"]]} />
                  <Select value={type} onChange={setType} options={[["", "Tous types"], ...Object.entries(taskTypeLabels)]} />
                  <Button variant="outline" className="h-11 rounded-full border-2 bg-white px-4 font-black" onClick={() => { setSearch(""); setPriority(""); setType("") }}>
                    <RefreshCw className="size-4" />Réinitialiser
                  </Button>
                </div>

                <div className="max-w-full overflow-x-auto rounded-full border-2 border-slate-200 bg-white p-1">
                  <div className="flex min-w-max gap-1">
                    {[
                      ["today", "Aujourd'hui"],
                      ["overdue", "En retard"],
                      ["upcoming", "À venir"],
                      ["automated", "Automatisées"],
                      ["all", "Toutes"],
                      ["done", "Terminées"],
                      ["snoozed", "Reportées"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={
                          view === id
                            ? "h-10 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-[0_4px_0_#020617]"
                            : "h-10 rounded-full px-4 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                        }
                        onClick={() => setView(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {isLoading ? <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-8 text-sm font-bold text-slate-500">Chargement des tâches...</div> : null}

          {!isLoading && tasks.length === 0 ? (
            <StatePanel title="Aucune tâche à afficher" description="Créez une tâche de suivi ou changez les filtres." actionLabel="Nouvelle tâche" onAction={() => setIsModalOpen(true)} />
          ) : null}

          {!isLoading && tasks.length > 0 ? (
            <BulkTaskActions
              allVisibleSelected={allVisibleSelected}
              isSaving={isSaving}
              selectedCount={selectedTasks.length}
              totalCount={tasks.length}
              onClear={() => setSelectedTaskIds(new Set())}
              onDelete={() => void deleteSelectedTasks()}
              onToggleAll={toggleAllVisibleTasks}
            />
          ) : null}

          {!isLoading && tasks.length > 0 ? (
            <div className={viewMode === "grid" ? "mt-6 grid min-w-0 gap-3 xl:grid-cols-2" : "mt-6 max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  displayMode={viewMode}
                  isSaving={isSaving}
                  isSelected={selectedTaskIds.has(task.id)}
                  onAction={taskAction}
                  onDelete={deleteTask}
                  onToggleSelect={toggleTaskSelection}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
      </div>

      {isModalOpen ? (
        <Modal title="Nouvelle tâche" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={createTask} className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1">
            <Input name="title" placeholder="Titre de la tâche" required className="rounded-2xl" />
            <Input name="description" placeholder="Description ou contexte de suivi" className="rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select name="type" options={Object.entries(taskTypeLabels)} defaultValue="FOLLOW_UP" />
              <Select name="priority" options={[["LOW", "Basse"], ["NORMAL", "Normale"], ["HIGH", "Haute"], ["URGENT", "Urgente"]]} defaultValue="NORMAL" />
              <Select name="status" options={[["TODO", "À faire"], ["IN_PROGRESS", "En cours"], ["WAITING", "En attente"]]} defaultValue="TODO" />
              <Input name="dueDate" type="datetime-local" className="rounded-2xl" />
              <Input name="reminderAt" type="datetime-local" className="rounded-2xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select name="relatedType" options={[["", "Sans lien"], ["lead", "Prospect"], ["client", "Client"]]} defaultValue="" />
              <select name="relatedId" defaultValue="" className="h-10 rounded-2xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="">Sélectionner un dossier</option>
                {leads.map((lead) => <option key={`lead-${lead.id}`} value={lead.id}>Prospect - {lead.label}</option>)}
                {clients.map((client) => <option key={`client-${client.id}`} value={client.id}>Client - {client.label}</option>)}
              </select>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 bg-white pt-3">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsModalOpen(false)}>Annuler</Button>
              <Button type="submit" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>{isSaving ? "Création..." : "Créer la tâche"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </PageShell>
  )
}

function TaskModeButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-black text-emerald-700 shadow-sm"
          : "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-black text-slate-500 transition hover:text-slate-950"
      }
      aria-pressed={active}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

function TaskMetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; detail: string; icon: LucideIcon; tone?: "emerald" | "sky" | "violet" | "amber" | "rose" }> }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-[0_6px_0_#86efac]",
    sky: "bg-sky-50 text-sky-800 border-sky-200 shadow-[0_6px_0_#bae6fd]",
    violet: "bg-violet-50 text-violet-800 border-violet-200 shadow-[0_6px_0_#ddd6fe]",
    amber: "bg-amber-50 text-amber-800 border-amber-200 shadow-[0_6px_0_#fde68a]",
    rose: "bg-rose-50 text-rose-800 border-rose-200 shadow-[0_6px_0_#fecdd3]",
  }

  return (
    <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <div key={metric.label} className={`rounded-[1.5rem] border-2 p-4 ${tones[metric.tone ?? "emerald"]}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-black">{metric.label}</p>
              <Icon className="size-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="mt-3 text-3xl font-black">{metric.value}</p>
              <p className="mt-1 truncate text-xs font-bold opacity-80">{metric.detail}</p>
            </div>
            <span className="sr-only">Indicateur {index + 1}</span>
          </div>
        )
      })}
    </section>
  )
}

function BulkTaskActions({
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
    <div className="mt-5 flex flex-col gap-3 rounded-[1.35rem] border-2 border-slate-200 bg-white p-3 shadow-[0_5px_0_#e2e8f0] md:flex-row md:items-center md:justify-between">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={onToggleAll}
          className="size-5 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
          aria-label="Sélectionner toutes les tâches visibles"
        />
        <span className="text-sm font-black text-slate-800">
          {selectedCount > 0 ? `${selectedCount} tâche(s) sélectionnée(s)` : `Sélectionner les ${totalCount} tâche(s) visibles`}
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

function TaskRow({
  task,
  displayMode,
  isSaving,
  isSelected,
  onAction,
  onDelete,
  onToggleSelect,
}: {
  task: ApiTask
  displayMode: TaskDisplayMode
  isSaving: boolean
  isSelected: boolean
  onAction: (taskId: string, action: "complete" | "snooze" | "cancel" | "reopen") => void
  onDelete: (task: ApiTask) => void
  onToggleSelect: (taskId: string) => void
}) {
  const Icon = typeIcon[task.type as keyof typeof typeIcon] ?? Clock3
  const related = task.client ? `${task.client.firstName} ${task.client.lastName}` : task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : "Sans dossier lié"
  const isDone = task.status === "DONE"
  const isCancelled = task.status === "CANCELLED"

  if (displayMode === "list") {
    return (
      <article className={isSelected ? "grid min-w-0 gap-3 border-b border-emerald-100 bg-emerald-50/60 p-4 transition last:border-b-0 hover:bg-emerald-50 xl:grid-cols-[auto_minmax(260px,1fr)_minmax(150px,200px)_minmax(190px,240px)] xl:items-center 2xl:grid-cols-[auto_minmax(300px,1fr)_180px_240px_auto]" : "grid min-w-0 gap-3 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50 xl:grid-cols-[auto_minmax(260px,1fr)_minmax(150px,200px)_minmax(190px,240px)] xl:items-center 2xl:grid-cols-[auto_minmax(300px,1fr)_180px_240px_auto]"}>
        <TaskSelectCheckbox checked={isSelected} taskTitle={task.title} onChange={() => onToggleSelect(task.id)} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
              <Icon className="size-3.5" aria-hidden="true" />
              {taskTypeLabels[task.type] ?? task.type}
            </span>
            {task.isAutomated ? <StatusBadge tone="violet">Automatisée</StatusBadge> : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-black text-slate-950">{task.title}</h3>
          {task.description ? <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{task.description}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={priorityTone[task.priority] ?? "slate"}>{priorityLabels[task.priority] ?? task.priority}</StatusBadge>
          <StatusBadge tone={statusTone[task.status] ?? "slate"}>{statusLabels[task.status] ?? task.status}</StatusBadge>
        </div>

        <div className="min-w-0 text-xs font-semibold leading-5 text-slate-500">
          <p className="truncate">Dossier: {related}</p>
          <p className="truncate">Échéance: {formatDate(task.dueDate)}</p>
          <p className="truncate">Assignée à: {task.assignedTo?.name ?? "Non assignée"}</p>
        </div>

        <div className="xl:col-span-3 2xl:col-span-1">
          <TaskActions task={task} isDone={isDone} isCancelled={isCancelled} isSaving={isSaving} onAction={onAction} onDelete={onDelete} compact />
        </div>
      </article>
    )
  }

  return (
    <article className={isSelected ? "rounded-[1.5rem] border-2 border-emerald-300 bg-emerald-50 p-4 shadow-[0_6px_0_#bbf7d0] transition hover:-translate-y-0.5" : "rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"}>
      <div className="flex min-h-full flex-col gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TaskSelectCheckbox checked={isSelected} taskTitle={task.title} onChange={() => onToggleSelect(task.id)} />
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"><Icon className="size-3.5" />{taskTypeLabels[task.type] ?? task.type}</span>
            <StatusBadge tone={priorityTone[task.priority] ?? "slate"}>{priorityLabels[task.priority] ?? task.priority}</StatusBadge>
            <StatusBadge tone={statusTone[task.status] ?? "slate"}>{statusLabels[task.status] ?? task.status}</StatusBadge>
            {task.isAutomated ? <StatusBadge tone="violet">Automatisée</StatusBadge> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-black leading-5 text-slate-950">{task.title}</h3>
          {task.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{task.description}</p> : null}
          <div className="mt-4 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500 sm:grid-cols-2">
            <span className="truncate">Dossier: {related}</span>
            <span className="truncate">Assignée à: {task.assignedTo?.name ?? "Non assignée"}</span>
            <span className="truncate">Échéance: {formatDate(task.dueDate)}</span>
            {task.reminderAt ? <span className="truncate">Rappel: {formatDate(task.reminderAt)}</span> : null}
          </div>
        </div>
        <TaskActions task={task} isDone={isDone} isCancelled={isCancelled} isSaving={isSaving} onAction={onAction} onDelete={onDelete} />
      </div>
    </article>
  )
}

function TaskSelectCheckbox({ checked, taskTitle, onChange }: { checked: boolean; taskTitle: string; onChange: () => void }) {
  return (
    <label className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
        aria-label={`Sélectionner la tâche ${taskTitle}`}
      />
    </label>
  )
}

function TaskActions({
  task,
  isDone,
  isCancelled,
  isSaving,
  compact = false,
  onAction,
  onDelete,
}: {
  task: ApiTask
  isDone: boolean
  isCancelled: boolean
  isSaving: boolean
  compact?: boolean
  onAction: (taskId: string, action: "complete" | "snooze" | "cancel" | "reopen") => void
  onDelete: (task: ApiTask) => void
}) {
  const buttonClass = compact ? "h-8 rounded-xl px-2 text-xs" : "rounded-xl"

  return (
    <div className="flex flex-wrap gap-2 xl:justify-end">
      {!isDone && !isCancelled ? <Button size="sm" variant="outline" className={buttonClass} disabled={isSaving} onClick={() => onAction(task.id, "complete")}>Terminer</Button> : null}
      {isDone || isCancelled ? <Button size="sm" variant="outline" className={buttonClass} disabled={isSaving} onClick={() => onAction(task.id, "reopen")}>Réouvrir</Button> : null}
      {!isDone && !isCancelled ? <Button size="sm" variant="outline" className={buttonClass} disabled={isSaving} onClick={() => onAction(task.id, "snooze")}>Reporter</Button> : null}
      {!isDone && !isCancelled ? <Button size="sm" variant="ghost" className={buttonClass} disabled={isSaving} onClick={() => onAction(task.id, "cancel")}>Annuler</Button> : null}
      <Button size="sm" variant="outline" className={`${buttonClass} border-rose-200 text-rose-700 hover:bg-rose-50`} disabled={isSaving} onClick={() => onDelete(task)}>
        <Trash2 className="size-4" />Supprimer
      </Button>
    </div>
  )
}

function Select({ options, value, onChange, name, defaultValue }: { options: [string, string][]; value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string }) {
  return (
    <select name={name} value={value} defaultValue={defaultValue} onChange={(event) => onChange?.(event.target.value)} className="h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
    </select>
  )
}

function Notice({ tone, children }: { tone: "emerald" | "rose"; children: React.ReactNode }) {
  return <div className={tone === "emerald" ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"}>{children}</div>
}

function LoadingState() {
  return <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Loader2 className="size-4 animate-spin text-emerald-600" />Chargement...</div>{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />)}</div>
}

function StatePanel({ title, description, actionLabel, onAction }: { title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100"><Clock3 className="size-5" /></div><h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>{description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p> : null}{actionLabel ? <Button className="mt-5 rounded-2xl" variant="outline" onClick={onAction}>{actionLabel}</Button> : null}</div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-2xl rounded-[1.5rem] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={onClose} aria-label="Fermer la modale">Fermer</Button></div>{children}</div></div>
}
