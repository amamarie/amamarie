"use client"

import { Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { ContentCard } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

import { PriorityLevelBadge } from "./PriorityLevelBadge"
import { PriorityScoreIndicator } from "./PriorityScoreIndicator"

type ClientPriority = {
  id: string
  level: string
  score: number
  title: string
  reason: string | null
  suggestedAction: string | null
  actionUrl: string | null
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: { message?: string } | string }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export function ClientPrioritiesTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<ClientPriority[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPriorities = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await readData<{ items: ClientPriority[] }>(await fetch(`/api/priorities?status=ACTIVE&clientId=${clientId}&limit=25`, { cache: "no-store" }))
      setItems(data.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les priorités client.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPriorities()
  }, [loadPriorities])

  async function generateClientPriorities() {
    setIsSaving(true)
    setError(null)
    try {
      await readData<unknown>(await fetch(`/api/clients/${clientId}/priorities/generate`, { method: "POST" }))
      await loadPriorities()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible de recalculer les priorités client.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ContentCard title="Priorités client">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">Priorités ouvertes liées à ce dossier: tâches, alertes, produits, recommandations et documents.</p>
        <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={generateClientPriorities}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Recalculer
        </Button>
      </div>
      {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement...</p> : null}
      {!isLoading && items.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucune priorité active pour ce client.</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityLevelBadge level={item.level} />
              <PriorityScoreIndicator score={item.score} />
            </div>
            <p className="mt-3 font-semibold text-slate-950">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
            <p className="mt-2 text-sm font-medium text-emerald-700">{item.suggestedAction}</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={item.actionUrl ?? `/clients/${clientId}`}>Ouvrir</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ContentCard>
  )
}
