import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  children: ReactNode
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

export function StatusBadge({ children, tone = "slate" }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border-2 px-2.5 py-1 text-xs font-black", tones[tone])}>
      {children}
    </span>
  )
}
