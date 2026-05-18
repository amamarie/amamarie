import { SlidersHorizontal } from "lucide-react"

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_#e2e8f0]">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
        <SlidersHorizontal className="size-4 text-emerald-600" aria-hidden="true" />
        Filtres et recherche
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{children}</div>
    </section>
  )
}
