import type { LucideIcon } from "lucide-react"
import { CircleDot } from "lucide-react"

import { StatusBadge } from "@/components/ui/StatusBadge"

export type TimelineItem = {
  id: string
  title: string
  description?: string
  meta?: string
  status?: string
  icon?: LucideIcon
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border-2 border-dashed border-emerald-200 bg-lime-50 p-5 text-sm font-semibold text-slate-600 shadow-[0_6px_0_#d9f99d]">
        Aucun événement récent. Les notes, tâches et documents apparaîtront ici.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const Icon = item.icon ?? CircleDot
        return (
          <article key={item.id} className="relative pl-7">
            <span className="absolute left-2 top-7 h-[calc(100%+1rem)] w-0.5 bg-emerald-100 last:hidden" aria-hidden="true" />
            <span className="absolute left-0 top-1 grid size-5 place-items-center rounded-full border-2 border-emerald-200 bg-white text-emerald-600 shadow-[0_2px_0_#d9f99d]">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-3 shadow-[0_4px_0_#e2e8f0]">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-slate-950">{item.title}</h3>
                {item.status ? <StatusBadge tone="slate">{item.status}</StatusBadge> : null}
              </div>
              {item.description ? (
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{item.description}</p>
              ) : null}
              {item.meta ? <p className="mt-2 text-xs font-black uppercase tracking-[0.08em] text-slate-500">{item.meta}</p> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
