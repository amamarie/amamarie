import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
}: {
  eyebrow: string
  title: string
  description: string
  actionLabel?: string
}) {
  return (
    <section className="rounded-[2rem] border-2 border-emerald-200 bg-white p-5 shadow-[0_12px_0_#d9f99d] sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border-2 border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {actionLabel ? (
          <Button className="h-11">
            {actionLabel}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </section>
  )
}
