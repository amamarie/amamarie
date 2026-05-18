import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type AssistantCardProps = {
  title?: string
  description?: string
  actionLabel?: string
  children?: ReactNode
  onAction?: () => void
}

export function AssistantCard({
  title = "Assistant dossier",
  description = "Synthèse, risques et prochaines actions. Aucun conseil financier n’est généré automatiquement.",
  actionLabel = "Résumer le dossier",
  children,
  onAction,
}: AssistantCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      <Button type="button" className="mt-4 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={onAction}>
        {actionLabel}
      </Button>
    </section>
  )
}
