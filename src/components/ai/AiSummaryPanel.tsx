"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useState } from "react"

import { StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type AiResult = {
  summary?: string
  keyPoints?: string[]
  risks?: string[]
  missingData?: string[]
  suggestedNextSteps?: string[]
  actions?: { label: string; priority: string; rationale?: string }[]
  disclaimer?: string
}

async function readJson(response: Response) {
  const payload = (await response.json()) as { data?: AiResult; error?: string }
  if (!response.ok) throw new Error(payload.error ?? "Action IA impossible.")
  return payload.data ?? {}
}

export function AiSummaryPanel({
  entityType,
  entityId,
}: {
  entityType: "client" | "lead"
  entityId: string
}) {
  const [result, setResult] = useState<AiResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function runSummary() {
    setIsLoading(true)
    setError(null)
    try {
      const response =
        entityType === "client"
          ? await fetch("/api/ai/summarize-client", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: entityId }),
            })
          : await fetch("/api/ai/suggest-actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entityType, entityId }),
            })
      setResult(await readJson(response))
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Action IA impossible.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-black text-slate-950">Assistant IA</p>
              <p className="text-xs font-medium text-slate-500">Résumé et actions administratives.</p>
            </div>
          </div>
        </div>
        <Button type="button" size="sm" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={runSummary} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Résumer
        </Button>
      </div>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-4">
          {result.summary ? <p className="text-sm leading-6 text-slate-700">{result.summary}</p> : null}
          <AiList title="Points clés" items={result.keyPoints ?? []} />
          <AiList title="À valider" items={[...(result.missingData ?? []), ...(result.risks ?? [])]} />
          <AiList title="Prochaines étapes" items={result.suggestedNextSteps ?? []} />
          {result.actions?.length ? (
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Actions suggérées</p>
              <div className="mt-2 space-y-2">
                {result.actions.map((action) => (
                  <div key={action.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-800">{action.label}</p>
                      <StatusBadge tone={action.priority === "URGENT" ? "rose" : action.priority === "HIGH" ? "amber" : "slate"}>{action.priority}</StatusBadge>
                    </div>
                    {action.rationale ? <p className="mt-1 text-xs text-slate-500">{action.rationale}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="rounded-2xl bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-500">
            {result.disclaimer ?? "Aide interne seulement. Validation humaine obligatoire."}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
          Lance un résumé 1-clic pour comprendre rapidement ce dossier sans générer de conseil financier.
        </p>
      )}
    </section>
  )
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="text-sm leading-5 text-slate-700">- {item}</li>
        ))}
      </ul>
    </div>
  )
}
