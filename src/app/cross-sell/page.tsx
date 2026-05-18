"use client"

import { ClipboardList, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { complianceNotice } from "@/lib/cross-sell/copy"

type Opportunity = {
  id: string
  category: string
  priority: string
  status: string
  title: string
  description: string
  client: { id: string; firstName: string; lastName: string }
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

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

const priorityTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
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

export default function CrossSellPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [status, setStatus] = useState("OPEN")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadOpportunities() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cross-sell${status ? `?status=${status}` : ""}`, { cache: "no-store" })
      setOpportunities(await readData<Opportunity[]>(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de récupérer les opportunités.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOpportunities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const summary = useMemo(() => {
    return {
      open: opportunities.filter((item) => item.status === "OPEN").length,
      high: opportunities.filter((item) => ["HIGH", "CRITICAL"].includes(item.priority)).length,
      tasks: opportunities.filter((item) => item.status === "CONVERTED_TO_TASK").length,
      won: opportunities.filter((item) => item.status === "WON").length,
      lost: opportunities.filter((item) => item.status === "LOST").length,
    }
  }, [opportunities])

  return (
    <PageShell
      eyebrow="Développement commercial"
      title="Cross-Sell intelligent"
      description="Vue globale des opportunités de discussion à valider pour le cabinet."
    >
      <ContentCard title="Résumé">
        <div className="mb-5 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Filtrer les opportunités"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button variant="outline" className="rounded-2xl" onClick={loadOpportunities}>
            <RefreshCw className="size-4" />
            Rafraîchir
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Ouvertes" value={summary.open} />
          <Metric label="Prioritaires" value={summary.high} />
          <Metric label="Converties" value={summary.tasks} />
          <Metric label="Gagnées" value={summary.won} />
          <Metric label="Perdues" value={summary.lost} />
        </div>
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{complianceNotice}</p>
      </ContentCard>

      {isLoading ? (
        <ContentCard title="Chargement">
          <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement...</div>
        </ContentCard>
      ) : error ? (
        <ContentCard title="Erreur"><p className="text-sm text-rose-700">{error}</p></ContentCard>
      ) : opportunities.length === 0 ? (
        <ContentCard title="Aucune opportunité"><p className="text-sm text-slate-600">Aucune opportunité ne correspond au filtre sélectionné.</p></ContentCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="violet">{categoryLabels[opportunity.category] ?? opportunity.category}</StatusBadge>
                <StatusBadge tone={priorityTone[opportunity.priority] ?? "slate"}>{priorityLabels[opportunity.priority] ?? opportunity.priority}</StatusBadge>
                <StatusBadge tone="slate">{statusLabels[opportunity.status] ?? opportunity.status}</StatusBadge>
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">{opportunity.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.description}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">{opportunity.client.firstName} {opportunity.client.lastName}</p>
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href={`/clients/${opportunity.client.id}`}><ClipboardList className="size-4" />Voir dossier</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
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
