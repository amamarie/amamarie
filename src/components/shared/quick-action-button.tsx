import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function QuickActionButton({
  icon: Icon,
  label,
}: {
  icon: LucideIcon
  label: string
}) {
  return (
    <Button className="h-11 rounded-2xl bg-emerald-600 shadow-[0_14px_34px_rgba(5,150,105,0.18)] transition hover:-translate-y-0.5 hover:bg-emerald-700">
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  )
}
