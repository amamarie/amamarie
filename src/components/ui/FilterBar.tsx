import { Search } from "lucide-react"
import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"

type FilterBarProps = {
  value: string
  placeholder?: string
  children?: ReactNode
  onChange: (value: string) => void
}

export function FilterBar({
  value,
  placeholder = "Rechercher...",
  children,
  onChange,
}: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-11 rounded-xl bg-slate-50 pl-9"
          />
        </label>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </div>
  )
}
