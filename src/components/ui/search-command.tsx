import { Loader2, Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"

import { Input } from "@/components/ui/input"

const searchTypes = [
  "client",
  "prospect",
  "téléphone",
  "document",
  "tâche",
  "note",
]

type SearchResult = {
  id: string
  type: string
  title: string
  context: string | null
  href: string
}

type SearchCommandProps = {
  placeholder?: string
}

export function SearchCommand({ placeholder = "Rechercher client, prospect, document, tâche..." }: SearchCommandProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen || debouncedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal,
        })
        const result = (await response.json()) as { data?: SearchResult[] }
        setResults(Array.isArray(result.data) ? result.data : [])
      } catch {
        if (!controller.signal.aborted) setResults([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [debouncedQuery, isOpen])

  return (
    <div className="relative w-full max-w-xl">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        aria-label="Recherche globale"
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        className="pl-10 pr-16 text-sm transition placeholder:text-slate-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500 sm:pr-24"
      />
      <div
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-xl border-2 border-slate-200 bg-lime-50 px-2 py-1 text-[11px] font-black text-slate-500 shadow-[0_2px_0_#e2e8f0] sm:flex"
        aria-hidden="true"
      >
        <span>Cmd</span>
        <span>K</span>
      </div>
      <span className="sr-only">
        Recherche disponible pour {searchTypes.join(", ")}
      </span>
      {isOpen ? (
        <div className="absolute left-0 right-0 top-13 z-50 overflow-hidden rounded-[1.75rem] border-2 border-emerald-200 bg-white shadow-[0_10px_0_#d9f99d]">
          <div className="flex items-center justify-between border-b-2 border-emerald-100 px-4 py-3">
            <p className="text-sm font-black text-slate-950">Recherche globale</p>
            <button
              type="button"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-lime-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer la recherche"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm font-semibold text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Recherche en cours...
              </div>
            ) : debouncedQuery.length < 2 ? (
              <p className="px-3 py-4 text-sm font-semibold text-slate-500">Tapez au moins 2 caractères pour chercher dans le CRM.</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm font-semibold text-slate-500">Aucun résultat trouvé.</p>
            ) : (
              <div className="space-y-1">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="block rounded-2xl border-2 border-transparent px-3 py-3 transition hover:border-lime-200 hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.context ?? "Aucun contexte"}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-2 ring-emerald-200">
                        {item.type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
