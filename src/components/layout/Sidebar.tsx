"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react"

import { navigationItems, type NavigationItem } from "@/components/layout/navigation"
import type { ModuleKey } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type DashboardSummary = {
  kpis: {
    newLeadsThisMonth: number
    tasksToday: number
    overdueTasks: number
    activeClients: number
    unreadNotifications: number
    requiredDocuments: number
    criticalAlerts: number
  }
  priorities?: { id: string }[]
}

type SidebarProps = {
  collapsed?: boolean
  allowedModuleKeys?: ModuleKey[]
  onCollapsedChange?: (collapsed: boolean) => void
  onNavigate?: () => void
}

type NavigationSection = {
  title: string
  items: NavigationItem[]
}

const ClerkUserMenu = dynamic(
  () => import("@/components/layout/ClerkUserMenu").then((mod) => mod.ClerkUserMenu),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="size-10 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">Conseiller</p>
          <p className="truncate text-xs text-slate-500">Cabinet sécurisé</p>
        </div>
      </>
    ),
  }
)

const sectionDefinitions = [
  {
    title: "Principal",
    hrefs: ["/dashboard", "/prospects", "/clients", "/pipeline", "/taches", "/calendrier"],
  },
  {
    title: "Dossiers",
    hrefs: ["/documents", "/compliance", "/recommendations"],
  },
  {
    title: "Croissance",
    hrefs: ["/communications", "/marketing", "/formulaires"],
  },
  {
    title: "Gestion",
    hrefs: ["/rapports", "/settings/communications", "/parametres"],
  },
]

function buildSections(allowedModuleKeys?: ModuleKey[]): NavigationSection[] {
  const allowedSet = allowedModuleKeys ? new Set(allowedModuleKeys) : null

  return sectionDefinitions
    .map((section) => ({
      title: section.title,
      items: section.hrefs
        .map((href) => navigationItems.find((item) => item.href === href))
        .filter((item): item is NavigationItem => Boolean(item))
        .filter((item) => !allowedSet || allowedSet.has(item.moduleKey)),
    }))
    .filter((section) => section.items.length > 0)
}

function readBadge(item: NavigationItem, summary: DashboardSummary | null) {
  if (!summary) return item.badge

  const kpis = summary.kpis
  const badges: Record<string, number | undefined> = {
    "/prospects": kpis.newLeadsThisMonth,
    "/taches": kpis.overdueTasks + kpis.tasksToday,
    "/notifications": kpis.unreadNotifications,
    "/documents": kpis.requiredDocuments,
    "/compliance": kpis.criticalAlerts,
    "/clients": kpis.activeClients,
  }

  const value = badges[item.href]
  return value && value > 0 ? String(value) : undefined
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function importantBadge(href: string) {
  return href === "/compliance" || href === "/taches"
}

export function Sidebar({ collapsed = false, allowedModuleKeys, onCollapsedChange, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<"loading" | "ready" | "error">("loading")
  const sections = useMemo(() => buildSections(allowedModuleKeys), [allowedModuleKeys])

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: "nearest" })
  }, [pathname])

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

  const hasUrgentWork = Boolean(summary && (summary.kpis.overdueTasks > 0 || summary.kpis.criticalAlerts > 0))
  const statusCount = summary ? summary.kpis.overdueTasks + summary.kpis.criticalAlerts : 0

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r border-slate-200 bg-white transition-[max-width,width] duration-200",
        collapsed ? "max-w-[76px]" : "max-w-[248px]"
      )}
    >
      <div className="shrink-0 border-b border-slate-200 px-3 py-3">
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            title="FinAssuro"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-slate-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              collapsed && "w-full flex-none justify-center p-2"
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <span className={cn("min-w-0", collapsed && "sr-only")}>
              <span className="block truncate text-sm font-black">FinAssuro</span>
              <span className="block truncate text-xs font-semibold text-slate-500">Conseiller</span>
            </span>
          </Link>
          {onCollapsedChange ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                collapsed && "w-full"
              )}
              aria-label={collapsed ? "Développer la navigation" : "Réduire la navigation"}
              title={collapsed ? "Développer" : "Réduire"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <Link
            href={hasUrgentWork ? "/taches?view=overdue" : "/dashboard"}
            onClick={onNavigate}
            className={cn(
              "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              hasUrgentWork
                ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            )}
          >
            {hasUrgentWork ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 truncate">
              {summaryStatus === "loading" ? "Chargement..." : hasUrgentWork ? `${statusCount} point(s) à traiter` : "Journée sous contrôle"}
            </span>
          </Link>
        ) : null}
      </div>

      <nav className={cn("min-h-0 flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")} aria-label="Navigation principale">
        <div className={cn(collapsed ? "space-y-3" : "space-y-5")}>
          {sections.map((section) => (
            <div key={section.title}>
              {!collapsed ? <p className="mb-1.5 px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">{section.title}</p> : null}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = isActivePath(pathname, item.href)
                  const badge = readBadge(item, summary)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      ref={isActive ? activeLinkRef : undefined}
                      onClick={onNavigate}
                      title={collapsed ? `${item.label}${badge ? ` (${badge})` : ""}` : undefined}
                      className={cn(
                        "group relative flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        collapsed && "justify-center px-2",
                        isActive && "bg-emerald-50 text-emerald-800"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition group-hover:text-slate-800",
                          isActive && "bg-emerald-600 text-white group-hover:text-white"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                      {badge ? (
                        <span
                          className={cn(
                            "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-black",
                            collapsed && "absolute -right-1 -top-1 grid size-5 min-w-0 place-items-center p-0 text-[10px]",
                            importantBadge(item.href) ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                            isActive && !importantBadge(item.href) && "bg-white text-emerald-700"
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className={cn("shrink-0 border-t border-slate-200", collapsed ? "p-2" : "p-3")}>
        <div className={cn("rounded-xl border border-slate-200 bg-white", collapsed ? "p-2" : "p-2.5")}>
          <ClerkUserMenu avatarClassName="size-10" subtitle="Cabinet sécurisé" textClassName={collapsed ? "sr-only" : "min-w-0 flex-1"} />
        </div>
      </div>
    </aside>
  )
}
