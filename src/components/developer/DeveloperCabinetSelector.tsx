"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

type CabinetOption = {
  id: string
  name: string
  detail: string
  searchText: string
}

export function DeveloperCabinetSelector({
  options,
  selectedId,
}: {
  options: CabinetOption[]
  selectedId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(selectedId ?? options[0]?.id ?? "")
  const [open, setOpen] = useState(false)
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return options

    return options.filter((option) =>
      `${option.name} ${option.detail} ${option.searchText}`.toLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

  const visibleSelected = filteredOptions.some((option) => option.id === selected)
    ? selected
    : filteredOptions[0]?.id ?? ""
  const selectedOption = options.find((option) => option.id === selected) ?? options[0]

  function navigateToCabinet(cabinetId: string) {
    if (!cabinetId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("cabinetId", cabinetId)
    router.push(`${pathname}?${params.toString()}`)
  }

  function selectCabinet(cabinetId: string) {
    setSelected(cabinetId)
    setOpen(false)
    navigateToCabinet(cabinetId)
  }

  return (
    <div className="relative mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,0.55fr)_minmax(260px,1fr)_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Rechercher un cabinet
          <span className="flex h-12 items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-3 shadow-[0_3px_0_#e2e8f0] focus-within:border-violet-300">
            <Search className="size-4 text-violet-600" aria-hidden="true" />
            <input
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              placeholder="Nom, forfait, ville, conseiller..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setOpen(true)
                }}
                className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Effacer la recherche"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        </label>

        <div className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Cabinet sélectionné
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-12 min-w-0 items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 text-left shadow-[0_3px_0_#e2e8f0] transition hover:border-violet-200 hover:bg-violet-50"
            aria-expanded={open}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-950">{selectedOption?.name ?? "Aucun cabinet"}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{selectedOption?.detail ?? "Aucun résultat"}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-violet-700" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => navigateToCabinet(selected)}
          className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-[0_3px_0_#0f172a] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Afficher
        </button>
      </div>

      {open ? (
        <div className="absolute left-3 right-3 top-[calc(100%-10px)] z-20 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xl">
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const active = option.id === visibleSelected
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectCabinet(option.id)}
                    className={`grid w-full gap-1 rounded-xl px-3 py-3 text-left transition ${
                      active ? "bg-violet-50 text-violet-950" : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-black">{option.name}</span>
                      {active ? <Check className="size-4 shrink-0 text-violet-700" aria-hidden="true" /> : null}
                    </span>
                    <span className="truncate text-xs font-semibold text-slate-500">{option.detail}</span>
                  </button>
                )
              })
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm font-semibold text-slate-500">
                Aucun cabinet ne correspond à cette recherche.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
