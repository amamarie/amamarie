import { CheckCircle2, CircleAlert } from "lucide-react"

import { StatusBadge } from "@/components/ui/StatusBadge"

type ComplianceItem = {
  title: string
  description?: string
  status: "done" | "missing" | "review"
}

export function ComplianceChecklist({ items }: { items: ComplianceItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const done = item.status === "done"
        return (
          <div key={item.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {done ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <StatusBadge tone={done ? "emerald" : item.status === "review" ? "sky" : "amber"}>
                  {done ? "Complété" : item.status === "review" ? "À réviser" : "À compléter"}
                </StatusBadge>
              </div>
              {item.description ? (
                <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
