import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

export function SearchBar({
  placeholder = "Rechercher...",
}: {
  placeholder?: string
}) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-10 text-sm focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
      />
    </div>
  )
}
