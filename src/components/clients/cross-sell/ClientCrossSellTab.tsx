"use client"

import { CheckCircle2, ClipboardList, Loader2, RefreshCw, ShieldCheck, ThumbsDown, Trophy, XCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { complianceNotice } from "@/lib/cross-sell/copy"
import { relevanceLabel } from "@/lib/cross-sell/scoring"

type CrossSellOpportunity = {
  id: string
  category: string
  priority: string
  status: string
  title: string
  description: string
  rationale: string | null
  actionLabel: string | null
  suggestedDiscussionTopic: string | null
  relatedProductType: string | null
  confidence: number | null
  metadata: unknown
  createdAt: string
  relatedProduct?: { id: string; type: string; company: string | null } | null
}

const categoryLabels: Record<string, string> = {
  PROTECTION: "Protection",
  INVESTMENT: "Placement",
  FAMILY_NEEDS: "Famille",
  RETIREMENT: "Retraite",
  TAX_EFFICIENCY: "Fiscalité",
  BUSINESS_OWNER: "Entrepreneur",
  REVIEW_OPPORTUNITY: "Révision",
}

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

const statusLabels: Record<string, string> = {
  OPEN: "Ouverte",
  REVIEWED: "Consultée",
  DISMISSED: "Ignorée",
  CONVERTED_TO_TASK: "Convertie en tâche",
  DISCUSSED: "Discutée",
  WON: "Gagnée",
  LOST: "Perdue",
  ARCHIVED: "Archivée",
}

const toneByPriority: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  LOW: "emerald",
  MEDIUM: "sky",
  HIGH: "amber",
  CRITICAL: "rose",
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function scoreFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("score" in metadata)) return null
  const score = Number((metadata as { score?: unknown }).score)
  return Number.isFinite(score) ? score : null
}

export function ClientCrossSellTab({ clientId }: { clientId: string }) {
  const [opportunities, setOpportunities] = useState<CrossSellOpportunity[]>([])
  const [statusFilter, setStatusFilter] = useState("OPEN")
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadOpportunities = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ""
      const response = await fetch(`/api/clients/${clientId}/cross-sell${params}`, { cache: "no-store" })
      setOpportunities(await readData<CrossSellOpportunity[]>(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de récupérer les opportunités.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOpportunities()
  }, [loadOpportunities])

  const summary = useMemo(() => {
    return {
      open: opportunities.filter((item) => item.status === "OPEN").length,
      high: opportunities.filter((item) => ["HIGH", "CRITICAL"].includes(item.priority)).length,
      tasks: opportunities.filter((item) => item.status === "CONVERTED_TO_TASK").length,
      won: opportunities.filter((item) => item.status === "WON").length,
      dismissed: opportunities.filter((item) => item.status === "DISMISSED").length,
    }
  }, [opportunities])

  async function generate() {
    setIsGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/cross-sell/generate`, { method: "POST" })
      await readData<CrossSellOpportunity[]>(response)
      setNotice("Opportunités recalculées.")
      await loadOpportunities()
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Impossible de recalculer les opportunités.")
    } finally {
      setIsGenerating(false)
    }
  }

  async function runAction(id: string, action: "reviewed" | "dismiss" | "discussed" | "won" | "lost" | "convert-to-task") {
    setActionId(id)
    setError(null)
    setNotice(null)
    try {
      const method = action === "convert-to-task" ? "POST" : "PATCH"
      const body =
        action === "lost"
          ? JSON.stringify({ reason: "Non pertinent pour le moment." })
          : action === "dismiss"
            ? JSON.stringify({ reason: "À revoir plus tard." })
            : "{}"
      const response = await fetch(`/api/cross-sell/${id}/${action}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })
      await readData<unknown>(response)
      setNotice("Action enregistrée.")
      await loadOpportunities()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "L’action n’a pas pu être effectuée.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="space-y-6">
      <ContentCard title="Opportunités de discussion">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm leading-6 text-slate-600">{complianceNotice}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Ouvertes" value={summary.open} />
              <Metric label="Prioritaires" value={summary.high} />
              <Metric label="Tâches" value={summary.tasks} />
              <Metric label="Gagnées" value={summary.won} />
              <Metric label="Ignorées" value={summary.dismissed} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Filtrer les opportunités"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={generate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recalculer
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </ContentCard>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-52 animate-pulse rounded-[1.5rem] border border-slate-100 bg-white shadow-sm" />)}
        </div>
      ) : opportunities.length === 0 ? (
        <ContentCard title="Aucune opportunité active">
          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <ShieldCheck className="size-5 shrink-0" />
            <p>Aucune opportunité active selon les règles actuelles.</p>
          </div>
        </ContentCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map((opportunity) => {
            const score = scoreFromMetadata(opportunity.metadata)
            return (
              <article key={opportunity.id} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="violet">{categoryLabels[opportunity.category] ?? opportunity.category}</StatusBadge>
                  <StatusBadge tone={toneByPriority[opportunity.priority] ?? "slate"}>{priorityLabels[opportunity.priority] ?? opportunity.priority}</StatusBadge>
                  <StatusBadge tone="slate">{statusLabels[opportunity.status] ?? opportunity.status}</StatusBadge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{opportunity.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.description}</p>
                {opportunity.rationale ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{opportunity.rationale}</p> : null}
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                  <span>Pertinence estimée: {relevanceLabel(score)}</span>
                  {opportunity.relatedProductType ? <span>Produit lié: {opportunity.relatedProductType}</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-2xl" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "reviewed")}><CheckCircle2 className="size-4" />Vue</Button>
                  <Button variant="outline" className="rounded-2xl" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "convert-to-task")}><ClipboardList className="size-4" />Créer tâche</Button>
                  <Button variant="outline" className="rounded-2xl" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "discussed")}>Discutée</Button>
                  <Button variant="outline" className="rounded-2xl" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "won")}><Trophy className="size-4" />Gagnée</Button>
                  <Button variant="ghost" className="rounded-2xl text-slate-500" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "lost")}><ThumbsDown className="size-4" />Perdue</Button>
                  <Button variant="ghost" className="rounded-2xl text-slate-500" disabled={actionId === opportunity.id} onClick={() => runAction(opportunity.id, "dismiss")}><XCircle className="size-4" />Ignorer</Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}
