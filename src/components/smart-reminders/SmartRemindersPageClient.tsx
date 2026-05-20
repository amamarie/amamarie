"use client"

import { AlertTriangle, BellRing, CheckCircle2, Clock3, Loader2, RefreshCw, TimerReset } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type SmartReminder = {
  id: string
  title: string
  reason: string
  category: string
  priority: string
  status: string
  dueDate: string | null
  priorityScore: number
  recommendedAction: string | null
  actionUrl: string | null
  client: { id: string; firstName: string; lastName: string }
  advisor: { id: string; name: string } | null
  task: { id: string; status: string; title?: string } | null
}

type DashboardData = {
  summary: { open: number; today: number; thisWeek: number; overdue: number; critical: number; important: number }
  byCategory: Array<{ category: string; _count: { _all: number } }>
  reminders: SmartReminder[]
}

async function readData<T>(response: Response) {
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || result?.ok === false) throw new Error(result?.error?.message ?? "Action impossible.")
  return result?.data as T
}

function tone(value: string) {
  if (["CRITICAL", "URGENT", "OVERDUE", "OPEN"].includes(value)) return "rose"
  if (["HIGH", "IMPORTANT", "IN_PROGRESS", "SNOOZED"].includes(value)) return "amber"
  if (["NORMAL", "COMPLETED", "RESOLVED"].includes(value)) return "emerald"
  return "slate"
}

function formatDate(value?: string | null) {
  if (!value) return "Aucune échéance"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value))
}

export function SmartRemindersPageClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [category, setCategory] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await readData<DashboardData>(await fetch("/api/reminders/dashboard/cabinet", { cache: "no-store" }))
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les rappels.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const reminders = useMemo(() => {
    const list = data?.reminders ?? []
    return category ? list.filter((item) => item.category === category) : list
  }, [category, data?.reminders])

  async function runEngine() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readData<{ created: number; updated: number; resolved: number; clients: number }>(await fetch("/api/reminders/engine/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }))
      setNotice(`${result.clients} client(s) évalué(s), ${result.created} rappel(s) créé(s), ${result.updated} mis à jour.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Recalcul impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function loadReport() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const report = await readData<{ byStatus: unknown[]; byPriority: unknown[]; byCategory: unknown[] }>(await fetch("/api/reminders/reports", { cache: "no-store" }))
      setNotice(`Rapport généré: ${report.byStatus.length} statut(s), ${report.byPriority.length} priorité(s), ${report.byCategory.length} catégorie(s).`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Rapport impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function installRules() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readData<{ count: number }>(await fetch("/api/reminders/rules/defaults/install", { method: "POST" }))
      setNotice(`${result.count} règle(s) natives installées.`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Installation impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function sendDigest() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readData<{ advisors: number; deliveries: unknown[] }>(await fetch("/api/reminders/notifications/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }))
      setNotice(`Digest créé pour ${result.deliveries.length} conseiller(s) avec rappels ouverts.`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Digest impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function extractNoteEvents() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readData<{ extracted: number; created: number; updated: number }>(await fetch("/api/reminders/ai/extract-note-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }))
      setNotice(`Notes analysées: ${result.extracted} événement(s), ${result.created} rappel(s) créé(s), ${result.updated} mis à jour.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Analyse des notes impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function reminderAction(id: string, action: "complete" | "snooze" | "create-task" | "create-opportunity" | "send-client-message" | "create-calendar-event" | "notify-channels") {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now()
      const body = action === "snooze"
        ? { reason: "Reporté depuis le dashboard.", snoozedUntil: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() }
        : action === "send-client-message"
          ? { kind: "SERVICE" }
          : action === "create-calendar-event"
            ? { startAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 30 }
          : {}
      await readData<unknown>(await fetch(`/api/reminders/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      setNotice(action === "create-opportunity" ? "Opportunité créée." : action === "send-client-message" ? "Message client préparé." : action === "create-calendar-event" ? "Événement calendrier créé." : action === "notify-channels" ? "Canaux externes notifiés." : "Rappel mis à jour.")
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Moteur proactif</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Rappels intelligents</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Échéances de polices, KYC, consentements, AML, documents, âges clés, bénéficiaires et absence de rencontre transformés en actions conseiller.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={installRules}>Installer règles</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={loadReport}>Rapport</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={sendDigest}>Digest</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={extractNoteEvents}>Analyser notes IA</Button>
            <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving} onClick={runEngine}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recalculer rappels
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={BellRing} label="Ouverts" value={data?.summary.open ?? 0} />
        <Metric icon={Clock3} label="Aujourd’hui" value={data?.summary.today ?? 0} />
        <Metric icon={TimerReset} label="Cette semaine" value={data?.summary.thisWeek ?? 0} />
        <Metric icon={AlertTriangle} label="En retard" value={data?.summary.overdue ?? 0} />
        <Metric icon={AlertTriangle} label="Critiques" value={data?.summary.critical ?? 0} />
        <Metric icon={CheckCircle2} label="Importants" value={data?.summary.important ?? 0} />
      </section>

      <ContentCard title="Catégories">
        <div className="flex flex-wrap gap-2">
          <Button variant={category ? "outline" : "default"} className="rounded-xl" onClick={() => setCategory("")}>Toutes</Button>
          {(data?.byCategory ?? []).map((item) => (
            <Button key={item.category} variant={category === item.category ? "default" : "outline"} className="rounded-xl" onClick={() => setCategory(item.category)}>
              {item.category} ({item._count._all})
            </Button>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Rappels ouverts">
        {isLoading ? <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement...</p> : null}
        {!isLoading && reminders.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucun rappel ouvert dans cette vue.</p> : null}
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={tone(reminder.priority)}>{reminder.priority}</StatusBadge>
                    <StatusBadge tone={tone(reminder.status)}>{reminder.status}</StatusBadge>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{reminder.category}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">Score {reminder.priorityScore}</span>
                  </div>
                  <p className="mt-3 text-base font-black text-slate-950">{reminder.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{reminder.client.firstName} {reminder.client.lastName} · {formatDate(reminder.dueDate)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{reminder.reason}</p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">{reminder.recommendedAction}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={reminder.actionUrl ?? `/clients/${reminder.client.id}`}>Ouvrir</Link></Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving || Boolean(reminder.task)} onClick={() => reminderAction(reminder.id, "create-task")}>Créer tâche</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => reminderAction(reminder.id, "create-opportunity")}>Créer opportunité</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => reminderAction(reminder.id, "send-client-message")}>Message client</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => reminderAction(reminder.id, "create-calendar-event")}>Calendrier</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => reminderAction(reminder.id, "notify-channels")}>Slack/Teams</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => reminderAction(reminder.id, "snooze")}>Reporter</Button>
                  <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving} onClick={() => reminderAction(reminder.id, "complete")}>Compléter</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ContentCard>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof BellRing; label: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="size-4" />
        <span className="text-xs font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  )
}
