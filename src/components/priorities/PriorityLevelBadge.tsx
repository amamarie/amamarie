import { cn } from "@/lib/utils"

const toneByLevel: Record<string, string> = {
  CRITICAL: "bg-rose-50 text-rose-700 ring-rose-100",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-100",
  MEDIUM: "bg-violet-50 text-violet-700 ring-violet-100",
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  BACKLOG: "bg-slate-100 text-slate-700 ring-slate-200",
}

const labels: Record<string, string> = {
  CRITICAL: "Critique",
  HIGH: "Priorité élevée",
  MEDIUM: "À planifier",
  LOW: "Peut attendre",
  BACKLOG: "Suivi secondaire",
}

export function PriorityLevelBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", toneByLevel[level] ?? toneByLevel.BACKLOG, className)}>
      {labels[level] ?? level}
    </span>
  )
}
