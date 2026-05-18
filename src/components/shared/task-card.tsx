import { CalendarClock } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import type { CrmTask, StatusTone } from "@/types"

const priorityTone: Record<CrmTask["priority"], StatusTone> = {
  Basse: "slate",
  Normale: "sky",
  Haute: "amber",
  Urgente: "rose",
}

export function TaskCard({ task }: { task: CrmTask }) {
  return (
    <article className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-[0_8px_0_#d9f99d]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-slate-950">{task.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {task.relationType} - {task.relatedTo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-black text-slate-600">
            <CalendarClock className="size-4" aria-hidden="true" />
            {task.dueDate}
          </span>
          <StatusBadge tone={priorityTone[task.priority]}>
            {task.priority}
          </StatusBadge>
        </div>
      </div>
    </article>
  )
}
