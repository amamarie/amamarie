import { cn } from "@/lib/utils"

const priorityClasses: Record<string, string> = {
  LOW: "border-slate-200 bg-slate-100 text-slate-700",
  NORMAL: "border-sky-200 bg-sky-50 text-sky-700",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  URGENT: "border-rose-200 bg-rose-50 text-rose-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
}

const labels: Record<string, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
  CRITICAL: "Critique",
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex rounded-full border-2 px-2.5 py-1 text-xs font-black", priorityClasses[priority] ?? priorityClasses.NORMAL)}>
      {labels[priority] ?? priority}
    </span>
  )
}
