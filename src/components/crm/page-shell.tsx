import type { LucideIcon } from "lucide-react"
import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PageShellProps = {
  eyebrow: string
  title: string
  description: string
  actionLabel?: string
  showIntro?: boolean
  children: React.ReactNode
}

export function PageShell({
  eyebrow,
  title,
  description,
  actionLabel,
  showIntro = true,
  children,
}: PageShellProps) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-hidden">
      {showIntro ? (
        <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white p-5 shadow-[0_12px_0_#d9f99d] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border-2 border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                {description}
              </p>
            </div>
            {actionLabel ? (
              <Button className="h-11 px-5">
                {actionLabel}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      {children}
    </div>
  )
}

type Metric = {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: "emerald" | "sky" | "violet" | "amber" | "rose"
}

const metricTone = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
}

export function MetricGrid({ metrics, columns = 4, compact = false }: { metrics: Metric[]; columns?: 4 | 5; compact?: boolean }) {
  return (
    <section className={cn("grid gap-4 sm:grid-cols-2", columns === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
      {metrics.map((metric) => {
        const Icon = metric.icon
        const tone = metric.tone ?? "emerald"

        return (
          <Card
            key={metric.label}
            className="rounded-[1.5rem] border-2 border-slate-200 bg-white shadow-[0_7px_0_#e2e8f0] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_9px_0_#bbf7d0]"
          >
            <CardContent className={compact ? "p-4" : "p-5 sm:p-6"}>
              <div className={cn("flex items-start justify-between", compact ? "gap-2" : "gap-4")}>
                <div>
                  <p className={cn("font-black uppercase text-slate-500", compact ? "text-xs leading-5" : "text-sm")}>
                    {metric.label}
                  </p>
                  <p className={cn("font-black tracking-tight text-slate-950", compact ? "mt-2 text-2xl" : "mt-3 text-3xl")}>
                    {metric.value}
                  </p>
                </div>
                <div className={cn("rounded-2xl border-2 border-white bg-white/75 ring-2", compact ? "p-2" : "p-3", metricTone[tone])}>
                  <Icon className={compact ? "size-4" : "size-5"} aria-hidden="true" />
                </div>
              </div>
              <p className={cn("font-bold text-slate-600", compact ? "mt-3 text-xs leading-5" : "mt-4 text-sm")}>
                {metric.detail}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

export function ContentCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        "rounded-[1.75rem] border-2 border-slate-200 bg-white shadow-[0_8px_0_#e2e8f0]",
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-black text-slate-950">{title}</CardTitle>
        {description ? (
          <CardDescription className="mt-1 font-semibold">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function StatusBadge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode
  tone?: "emerald" | "sky" | "violet" | "amber" | "rose" | "slate"
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-300",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-2",
        tones[tone]
      )}
    >
      {children}
    </span>
  )
}
