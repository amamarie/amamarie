import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Circle, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

export type ProgressStep = {
  label: string
  description?: string
  status: "complete" | "current" | "blocked" | "upcoming"
  icon?: LucideIcon
}

export function ProgressSteps({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step) => {
        const FallbackIcon =
          step.status === "complete" ? CheckCircle2 : step.status === "blocked" ? Lock : Circle
        const Icon = step.icon ?? FallbackIcon
        return (
          <div
            key={step.label}
            className={cn(
              "rounded-2xl border p-4",
              step.status === "complete" && "border-emerald-200 bg-emerald-50",
              step.status === "current" && "border-sky-200 bg-sky-50",
              step.status === "blocked" && "border-amber-200 bg-amber-50",
              step.status === "upcoming" && "border-slate-200 bg-slate-50"
            )}
          >
            <Icon className="size-5 text-slate-700" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-slate-950">{step.label}</p>
            {step.description ? (
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
