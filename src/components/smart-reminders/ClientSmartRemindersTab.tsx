"use client"

import { Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

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
  recommendedAction: string | null
  actionUrl: string | null
  task: { id: string; status: string; title?: string } | null
}

async function readData<T>(response: Response) {
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: { message?: string } } | null
  if (!response.ok || result?.ok === false) throw new Error(result?.error?.message ?? "Action impossible.")
  return result?.data as T
}

function tone(value: string) {
  if (["CRITICAL", "OPEN"].includes(value)) return "rose"
  if (["HIGH", "IN_PROGRESS", "SNOOZED"].includes(value)) return "amber"
  if (["NORMAL", "COMPLETED", "RESOLVED"].includes(value)) return "emerald"
  return "slate"
}

function formatDate(value?: string | null) {
  if (!value) return "Aucune échéance"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value))
}

export function ClientSmartRemindersTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<SmartReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await readData<{ reminders: SmartReminder[] }>(await fetch(`/api/clients/${clientId}/reminders`, { cache: "no-store" }))
      setItems(payload.reminders)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les rappels.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function action(path: string, body?: Record<string, unknown>, message = "Rappel mis à jour.") {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      await readData<unknown>(await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }))
      setNotice(message)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ContentCard title="Rappels intelligents" description="Actions proactives détectées à partir des polices, KYC, consentements, AML, documents, notes et âges clés.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">Chaque rappel conserve la raison, les données utilisées et l’action recommandée.</p>
        <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => action(`/api/reminders/engine/evaluate-client/${clientId}`, {}, "Rappels client recalculés.")}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Recalculer
        </Button>
      </div>
      {notice ? <p className="mb-3 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {isLoading ? <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement...</p> : null}
      {!isLoading && items.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucun rappel intelligent ouvert pour ce client.</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={tone(item.priority)}>{item.priority}</StatusBadge>
                  <StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{item.category}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{formatDate(item.dueDate)}</span>
                </div>
                <p className="mt-3 font-black text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p>
                <p className="mt-2 text-sm font-bold text-emerald-700">{item.recommendedAction}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" asChild><Link href={item.actionUrl ?? `/clients/${clientId}`}>Ouvrir</Link></Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving || Boolean(item.task)} onClick={() => action(`/api/reminders/${item.id}/create-task`, {}, "Tâche créée depuis le rappel.")}>Créer tâche</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/create-opportunity`, {}, "Opportunité créée depuis le rappel.")}>Créer opportunité</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/send-client-message`, { kind: "SERVICE" }, "Message client préparé.")}>Message client</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/create-calendar-event`, { startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), durationMinutes: 30 }, "Événement calendrier créé.")}>Calendrier</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/notify-channels`, {}, "Canaux externes notifiés.")}>Slack/Teams</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/snooze`, { reason: "Reporté depuis la fiche client.", snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }, "Rappel reporté.")}>Reporter</Button>
                <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving} onClick={() => action(`/api/reminders/${item.id}/complete`, {}, "Rappel complété.")}>Compléter</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ContentCard>
  )
}
