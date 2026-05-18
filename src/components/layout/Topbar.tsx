"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"

import { getActiveNavigationItem } from "@/components/layout/navigation"
import { NotificationBell } from "@/components/notifications/notifications-ui"
import { SearchCommand } from "@/components/ui/search-command"
import { cn } from "@/lib/utils"

type DashboardSummary = {
  kpis: {
    overdueTasks: number
    criticalAlerts: number
  }
}

type TopbarProps = {
  onMenuClick: () => void
}

const ClerkUserMenu = dynamic(
  () => import("@/components/layout/ClerkUserMenu").then((mod) => mod.ClerkUserMenu),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="size-9 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block truncate text-sm font-semibold text-slate-950">Conseiller</span>
          <span className="block truncate text-xs text-slate-500">Espace sécurisé</span>
        </span>
      </>
    ),
  }
)

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const activeItem = getActiveNavigationItem(pathname)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      try {
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" })
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Résumé indisponible")
        if (!cancelled) {
          setSummary(json.data as DashboardSummary)
          setSummaryStatus("ready")
        }
      } catch {
        if (!cancelled) setSummaryStatus("error")
      }
    }

    void loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  const hasRisk = Boolean(summary && (summary.kpis.criticalAlerts > 0 || summary.kpis.overdueTasks > 0))

  return (
    <header
      className="sticky top-0 z-40 border-b-2 border-emerald-100 bg-white/95 shadow-[0_6px_0_#d9f99d] backdrop-blur-xl"
    >
      <div className="flex min-h-[68px] w-full min-w-0 max-w-full items-center gap-3 overflow-hidden px-4 py-2 sm:px-6 lg:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-2xl border-2 border-slate-200 bg-white p-3 text-slate-600 shadow-[0_4px_0_#e2e8f0] transition hover:bg-lime-50 hover:text-slate-950 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-[1_1_240px]">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">
              {activeItem.label}
            </h1>
            {summaryStatus === "loading" || !hasRisk ? (
              <span
                className={cn(
                  "hidden rounded-full px-2.5 py-1 text-xs font-black ring-2 sm:inline-flex",
                  "bg-emerald-50 text-emerald-700 ring-emerald-200"
                )}
              >
                {summaryStatus === "loading" ? "Synchronisation" : "Opérationnel"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 hidden max-w-2xl truncate text-sm font-semibold text-slate-500 md:block">
            {activeItem.message}
          </p>
        </div>

        <div className="hidden min-w-0 max-w-2xl flex-[1_1_420px] justify-center lg:flex">
          <SearchCommand placeholder="Rechercher client, prospect, document, tâche..." />
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
          <NotificationBell />

          <div className="flex min-h-11 items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-1.5 pr-2.5 shadow-[0_4px_0_#e2e8f0]">
            <ClerkUserMenu avatarClassName="size-9" subtitle="Espace sécurisé" showChevron textClassName="hidden min-w-0 text-left lg:block" />
          </div>
        </div>
      </div>

    </header>
  )
}
