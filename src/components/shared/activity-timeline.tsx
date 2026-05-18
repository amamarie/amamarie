import { Activity } from "lucide-react"

import type { Activity as ActivityItem } from "@/types"

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50/80 p-3">
          <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <Activity className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{item.type}</p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.dateTime} - {item.user}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
