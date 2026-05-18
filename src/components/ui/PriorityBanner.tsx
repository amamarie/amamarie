import type { LucideIcon } from "lucide-react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PriorityBannerProps = {
  title: string
  description: string
  actionLabel?: string
  icon?: LucideIcon
  tone?: "amber" | "sky" | "emerald" | "rose"
  onAction?: () => void
}

const tones = {
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  sky: "border-sky-200 bg-sky-50 text-sky-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
}

export function PriorityBanner({
  title,
  description,
  actionLabel,
  icon: Icon = AlertTriangle,
  tone = "amber",
  onAction,
}: PriorityBannerProps) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between", tones[tone])}>
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
        </div>
      </div>
      {actionLabel ? (
        <Button type="button" className="shrink-0 rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}
