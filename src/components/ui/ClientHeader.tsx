import type { LucideIcon } from "lucide-react"
import { ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"

import { StatusBadge } from "@/components/ui/StatusBadge"

type ClientHeaderProps = {
  name: string
  description?: string
  badges?: { label: string; tone?: "emerald" | "sky" | "amber" | "rose" | "slate" | "violet" }[]
  actions?: ReactNode
  icon?: LucideIcon
}

export function ClientHeader({
  name,
  description,
  badges = [],
  actions,
  icon: Icon = ShieldCheck,
}: ClientHeaderProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">{name}</h1>
              {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
            </div>
          </div>
          {badges.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <StatusBadge key={badge.label} tone={badge.tone}>
                  {badge.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  )
}
