import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
}) {
  return (
    <div className="rounded-[1.75rem] border-2 border-dashed border-emerald-200 bg-lime-50 p-8 text-center shadow-[0_8px_0_#d9f99d]">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white text-emerald-700 shadow-[0_4px_0_#bbf7d0]">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      {actionLabel ? (
        <Button className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
