import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type Action = {
  label: string
  icon?: LucideIcon
  onClick?: () => void
}

export function ActionToolbar({ actions }: { actions: Action[] }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[1.5rem] border-2 border-emerald-200 bg-white p-2 shadow-[0_6px_0_#d9f99d]">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            className="h-10 px-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={action.onClick}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}
