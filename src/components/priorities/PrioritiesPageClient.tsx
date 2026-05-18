"use client"

import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, TimerReset } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { PriorityLevelBadge } from "./PriorityLevelBadge"
import { PriorityScoreIndicator } from "./PriorityScoreIndicator"

type ApiPriority = {
  id: string
  entityType: string
  level: string
  status: string
  score: number
  title: string
  description: string | null
  reason: string | null
  suggestedAction: string | null
  actionUrl: string | null
  dueAt: string | null
  client: { firstName: string; lastName: string } | null
  lead: { firstName: string; lastName: string } | null
}

type PriorityResponse = { items: ApiPriority[]; total: number }

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: { message?: string } | string }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function formatDate(value: string | null) {
  if (!value) return "Aucune échéance"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value))
}

export function PrioritiesPageClient() {
  const [items, setItems] = useState<ApiPriority[]>([])
  const [level, setLevel] = useState("")
  const [entityType, setEntityType] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadPriorities = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status: "ACTIVE", limit: "75" })
      if (level) params.set("level", level)
      if (entityType) params.set("entityType", entityType)
      const data = await readData<PriorityResponse>(await fetch(`/api/priorities?${params.toString()}`, { cache: "no-store" }))
      setItems(data.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les priorités.")
    } finally {
      setIsLoading(false)
    }
  }, [entityType, level])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPriorities()
  }, [loadPriorities])

  const summary = useMemo(() => ({
    critical: items.filter((item) => item.level === "CRITICAL").length,
    high: items.filter((item) => item.level === "HIGH").length,
    overdue: items.filter((item) => item.dueAt && new Date(item.dueAt) < new Date()).length,
    snoozed: 0,
  }), [items])

  async function generatePriorities() {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      await readData<unknown>(await fetch("/api/priorities/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }))
      setNotice("Priorités recalculées.")
      await loadPriorities()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible de recalculer les priorités.")
    } finally {
      setIsSaving(false)
    }
  }

  async function patchPriority(id: string, action: "complete" | "dismiss" | "snooze") {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const snoozedUntil = new Date()
      snoozedUntil.setDate(snoozedUntil.getDate() + 3)
      const body =
        action === "dismiss"
          ? { dismissedReason: "Non prioritaire pour le moment." }
          : action === "snooze"
            ? { snoozedUntil: snoozedUntil.toISOString() }
            : {}
      await readData<unknown>(await fetch(`/api/priorities/${id}/${action}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      setNotice("Priorité mise à jour.")
      await loadPriorities()
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Journée conseiller</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Priorités</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Liste automatique des dossiers à traiter en premier selon les échéances, alertes, suivis et opportunités internes.</p>
          </div>
          <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving} onClick={generatePriorities}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recalculer
          </Button>
        </div>
        {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={AlertTriangle} label="Critiques" value={`${summary.critical}`} />
        <Metric icon={Clock3} label="Hautes priorités" value={`${summary.high}`} />
        <Metric icon={TimerReset} label="En retard" value={`${summary.overdue}`} />
        <Metric icon={CheckCircle2} label="Actives" value={`${items.length}`} />
      </section>

      <section className="flex flex-col gap-3 rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm sm:flex-row">
        <select value={level} onChange={(event) => setLevel(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="">Tous les niveaux</option>
          <option value="CRITICAL">Critique</option>
          <option value="HIGH">Priorité élevée</option>
          <option value="MEDIUM">À planifier</option>
          <option value="LOW">Peut attendre</option>
          <option value="BACKLOG">Suivi secondaire</option>
        </select>
        <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="">Tous les types</option>
          <option value="TASK">Tâches</option>
          <option value="COMPLIANCE_ALERT">Alertes conformité</option>
          <option value="LEAD">Prospects</option>
          <option value="CLIENT">Clients</option>
          <option value="FINANCIAL_PRODUCT">Produits financiers</option>
          <option value="RECOMMENDATION">Recommandations</option>
          <option value="CROSS_SELL">Opportunités</option>
          <option value="DOCUMENT">Documents</option>
        </select>
        <Button variant="outline" className="rounded-2xl" onClick={() => { setLevel(""); setEntityType("") }}>Réinitialiser</Button>
      </section>

      {isLoading ? <Card className="rounded-[1.5rem] border-white/70 bg-white/90"><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement des priorités...</CardContent></Card> : null}
      {!isLoading && items.length === 0 ? <EmptyState icon={CheckCircle2} title="Aucune priorité active" description="Recalculez les priorités pour préparer la journée du conseiller." /> : null}

      <section className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="rounded-[1.5rem] border-white/70 bg-white/90 shadow-[0_16px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.09)]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityLevelBadge level={item.level} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.entityType}</span>
                    <PriorityScoreIndicator score={item.score} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.reason}</p>
                  <p className="mt-2 text-sm font-medium text-emerald-700">{item.suggestedAction}</p>
                  <p className="mt-2 text-xs text-slate-500">Échéance: {formatDate(item.dueAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {item.actionUrl ? <Button variant="outline" className="rounded-2xl" asChild><Link href={item.actionUrl}>Ouvrir</Link></Button> : null}
                  <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => patchPriority(item.id, "snooze")}>Reporter</Button>
                  <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => patchPriority(item.id, "complete")}>Traité</Button>
                  <Button variant="ghost" className="rounded-2xl" disabled={isSaving} onClick={() => patchPriority(item.id, "dismiss")}>Ignorer</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: string }) {
  return (
    <Card className="rounded-[1.5rem] border-white/70 bg-white/90 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 ring-1 ring-emerald-100"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  )
}
