import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type KpiCardProps = {
  label: string
  value: string | number
  detail?: string
  icon?: LucideIcon
  href?: string
  tone?: "emerald" | "sky" | "amber" | "rose" | "slate" | "violet"
}

const tones = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "emerald",
}: KpiCardProps) {
  return (
    <article className="rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-[0_8px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-[0_10px_0_#d9f99d]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        {Icon ? (
          <div className={cn("rounded-2xl border-2 p-3 shadow-[0_4px_0_#e2e8f0]", tones[tone])}>
            <Icon className="size-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-4 text-sm font-semibold text-slate-600">{detail}</p> : null}
    </article>
  )
}
