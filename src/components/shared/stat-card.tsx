import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { StatusTone } from "@/types"

const tones: Record<StatusTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-300",
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "emerald",
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: StatusTone
}) {
  return (
    <Card className="rounded-[1.5rem] border-2 border-slate-200 bg-white shadow-[0_7px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_9px_0_#bbf7d0]">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {value}
            </p>
          </div>
          <div className={cn("rounded-2xl border-2 border-white bg-white/75 p-3 ring-2", tones[tone])}>
            <Icon className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-600">{detail}</p>
      </CardContent>
    </Card>
  )
}
