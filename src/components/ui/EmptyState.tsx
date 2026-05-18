import type { LucideIcon } from "lucide-react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  icon?: LucideIcon
  onAction?: () => void
}

export function EmptyState({
  title,
  description,
  actionLabel,
  icon: Icon = Sparkles,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-lime-50/70 p-8 text-center shadow-[0_8px_0_#d9f99d]">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl border-2 border-emerald-200 bg-white text-emerald-700 shadow-[0_4px_0_#d9f99d]">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">{description}</p>
      ) : null}
      {actionLabel ? (
        <Button type="button" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
