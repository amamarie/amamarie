"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileText,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react"

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
    upcomingRenewals: number
    criticalAlerts: number
    productsToReview: number
    averageComplianceScore: number | null
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
  description: string
  items: NavigationItem[]
}

const sidebarOpenSectionsStorageKey = "finadvisor.sidebar.openSections"

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
    title: "Pilotage",
    description: "Priorités et journée",
    hrefs: ["/dashboard", "/priorities", "/rappels-intelligents", "/notifications"],
  },
  {
    title: "Portefeuille",
    description: "Prospects, clients et tâches",
    hrefs: ["/prospects", "/pipeline", "/clients", "/taches", "/calendrier"],
  },
  {
    title: "Dossier client",
    description: "Preuves, conformité et conseil",
    hrefs: ["/documents", "/compliance", "/recommendations", "/cross-sell"],
  },
  {
    title: "Outils",
    description: "Canaux, automatisations et réglages",
    hrefs: ["/communications", "/marketing", "/formulaires", "/automatisations", "/rapports", "/settings/communications", "/parametres"],
  },
]

function buildSections(allowedModuleKeys?: ModuleKey[]): NavigationSection[] {
  const allowedSet = allowedModuleKeys ? new Set(allowedModuleKeys) : null

  return sectionDefinitions.map((section) => ({
    title: section.title,
    description: section.description,
    items: section.hrefs
      .map((href) => navigationItems.find((item) => item.href === href))
      .filter((item): item is NavigationItem => Boolean(item))
      .filter((item) => !allowedSet || allowedSet.has(item.moduleKey))
  }))
    .filter((section) => section.items.length > 0)
}

function readBadge(item: NavigationItem, summary: DashboardSummary | null) {
  if (!summary) return item.badge

  const kpis = summary.kpis
  const badges: Record<string, number | undefined> = {
    "/prospects": kpis.newLeadsThisMonth,
    "/taches": kpis.overdueTasks + kpis.tasksToday,
    "/priorities": summary.priorities?.length,
    "/notifications": kpis.unreadNotifications,
    "/documents": kpis.requiredDocuments,
    "/compliance": kpis.criticalAlerts,
    "/clients": kpis.activeClients,
    "/recommendations": kpis.productsToReview,
  }

  const value = badges[item.href]
  return value && value > 0 ? String(value) : undefined
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ collapsed = false, allowedModuleKeys, onCollapsedChange, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<"loading" | "ready" | "error">("loading")
  const sections = useMemo(() => buildSections(allowedModuleKeys), [allowedModuleKeys])
  const activeSectionTitle = sections.find((section) => section.items.some((item) => isActivePath(pathname, item.href)))?.title

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: "nearest" })
  }, [pathname])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(sidebarOpenSectionsStorageKey)
      const parsed = stored ? JSON.parse(stored) as Record<string, boolean> : {}
      setOpenSections(Object.fromEntries(sections.map((section) => [section.title, parsed[section.title] ?? true])))
    } catch {
      setOpenSections(Object.fromEntries(sections.map((section) => [section.title, true])))
    }
  }, [sections])

  useEffect(() => {
    if (!activeSectionTitle) return
    setOpenSections((current) => {
      if (current[activeSectionTitle]) return current
      const next = { ...current, [activeSectionTitle]: true }
      persistOpenSections(next)
      return next
    })
  }, [activeSectionTitle])

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

  const filteredNavigationItems = useMemo(() => {
    if (!allowedModuleKeys) return navigationItems
    const allowedSet = new Set(allowedModuleKeys)
    return navigationItems.filter((item) => allowedSet.has(item.moduleKey))
  }, [allowedModuleKeys])
  const activeItem = filteredNavigationItems.find((item) => isActivePath(pathname, item.href)) ?? filteredNavigationItems[0] ?? navigationItems[0]
  const hasUrgentWork = Boolean(summary && (summary.kpis.overdueTasks > 0 || summary.kpis.criticalAlerts > 0))
  const complianceScore = summary?.kpis.averageComplianceScore
  const statusLabel = summaryStatus === "loading" ? "Synchronisation..." : hasUrgentWork ? "Attention requise" : "Opérationnel"

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r-2 border-emerald-100 bg-white transition-[max-width,width] duration-200",
        collapsed ? "max-w-[88px]" : "max-w-[280px]"
      )}
    >
      <div className="shrink-0 border-b-2 border-emerald-100 px-3 py-3">
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            title="FinAdvisor CRM"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-[1.35rem] border-2 border-emerald-200 bg-white p-2.5 text-slate-950 shadow-[0_5px_0_#d9f99d] transition hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
              collapsed && "w-full flex-none justify-center p-2"
            )}
          >
            <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_4px_0_#16a34a]">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-emerald-400" />
            </span>
            <span className={cn("min-w-0", collapsed && "sr-only")}>
              <span className="block truncate text-[15px] font-black">FinAdvisor</span>
              <span className="block truncate text-xs font-bold text-slate-500">CRM conseiller</span>
            </span>
          </Link>
          {onCollapsedChange ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-slate-200 bg-white text-slate-500 shadow-[0_4px_0_#e2e8f0] transition hover:bg-lime-50 hover:text-slate-950 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                collapsed && "w-full"
              )}
              aria-label={collapsed ? "Développer la navigation" : "Réduire la navigation"}
              title={collapsed ? "Développer" : "Réduire"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        {!collapsed ? <div className="mt-2 grid grid-cols-2 gap-2">
          <HeaderMetric icon={UsersRound} label="Clients" value={formatNumber(summary?.kpis.activeClients)} loading={summaryStatus === "loading"} />
          <HeaderMetric
            icon={ShieldCheck}
            label="Conformité"
            value={complianceScore === null || complianceScore === undefined ? "N/D" : `${complianceScore}/100`}
            loading={summaryStatus === "loading"}
            tone={complianceScore !== null && complianceScore !== undefined && complianceScore < 70 ? "amber" : "emerald"}
          />
        </div> : null}

        {!collapsed ? <div className="mt-2 rounded-[1.35rem] border-2 border-lime-200 bg-lime-50 p-3 shadow-[0_4px_0_#d9f99d]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{statusLabel}</p>
              <p className="mt-0.5 truncate text-sm font-black text-slate-950">{activeItem.label}</p>
            </div>
            <span
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-2xl ring-2",
                hasUrgentWork ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              )}
            >
              {hasUrgentWork ? <AlertTriangle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{activeItem.message}</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {filteredNavigationItems.some((item) => item.href === "/prospects") ? <QuickLink href="/prospects" label="Prospect" icon={UserPlus} onNavigate={onNavigate} /> : null}
            {filteredNavigationItems.some((item) => item.href === "/clients") ? <QuickLink href="/clients" label="Client" icon={UsersRound} onNavigate={onNavigate} /> : null}
            {filteredNavigationItems.some((item) => item.href === "/documents") ? <QuickLink href="/documents" label="Doc" icon={FileText} onNavigate={onNavigate} /> : null}
          </div>
        </div> : <CompactStatus summary={summary} loading={summaryStatus === "loading"} hasUrgentWork={hasUrgentWork} />}

      </div>

      <nav className={cn("min-h-0 flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-2.5")} aria-label="Navigation principale">
        <div className={cn(collapsed ? "space-y-2" : "space-y-3")}>
          {sections.map((section) => {
            const sectionIsOpen = collapsed ? true : openSections[section.title] ?? true
            const sectionHasActiveItem = section.items.some((item) => isActivePath(pathname, item.href))
            const sectionCount = section.items.reduce((total, item) => total + parseBadgeCount(readBadge(item, summary)), 0)
            const sectionHasImportantCount = section.items.some((item) => importantBadge(item.href) && parseBadgeCount(readBadge(item, summary)) > 0)

            return (
            <div key={section.title}>
              {!collapsed ? <button
                type="button"
                onClick={() => {
                  if (sectionHasActiveItem) return
                  setOpenSections((current) => {
                    const next = { ...current, [section.title]: !sectionIsOpen }
                    persistOpenSections(next)
                    return next
                  })
                }}
                className={cn(
                  "mb-1.5 flex w-full items-center justify-between gap-2 rounded-2xl px-2 py-1.5 text-left transition hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  sectionHasActiveItem && "cursor-default hover:bg-transparent"
                )}
                aria-expanded={sectionIsOpen}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{section.title}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-400">{section.description}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  {sectionCount > 0 ? (
                    <span
                      className={cn(
                        "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ring-1",
                        sectionHasImportantCount ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-slate-100 text-slate-600 ring-slate-200"
                      )}
                    >
                      {sectionCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn("size-4 text-slate-400 transition-transform", sectionIsOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </span>
              </button> : (
                <div className="mx-auto h-px w-8 rounded-full bg-slate-200" title={section.title} aria-hidden="true" />
              )}

              {sectionIsOpen ? <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = isActivePath(pathname, item.href)
                  const badge = readBadge(item, summary)

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        ref={isActive ? activeLinkRef : undefined}
                        onClick={onNavigate}
                        title={collapsed ? `${item.label}${badge ? ` (${badge})` : ""}` : undefined}
                        className={cn(
                          "group relative flex min-h-10 items-center gap-2.5 rounded-2xl border-2 border-transparent px-2.5 py-2 text-sm font-black text-slate-600 transition hover:border-lime-200 hover:bg-lime-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                          collapsed && "justify-center px-2",
                          isActive && "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_4px_0_#bbf7d0]"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-2 ring-slate-200 transition group-hover:text-slate-950",
                            isActive && "bg-emerald-500 text-white ring-emerald-500 group-hover:text-white"
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                        {isActive ? (
                          <span className="sr-only">Page active: {item.message}</span>
                        ) : null}
                        {badge ? (
                          <span
                            className={cn(
                              "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ring-1",
                              collapsed && "absolute -right-1 -top-1 grid size-5 min-w-0 place-items-center rounded-full p-0 text-[10px]",
                              importantBadge(item.href)
                                ? "bg-rose-50 text-rose-700 ring-rose-100"
                                : "bg-slate-100 text-slate-600 ring-slate-200",
                              isActive && !importantBadge(item.href) && "bg-white text-emerald-700 ring-emerald-100"
                            )}
                          >
                            {badge}
                          </span>
                        ) : !collapsed ? (
                          <Circle className="size-2 shrink-0 text-slate-200 transition group-hover:text-slate-300" aria-hidden="true" />
                        ) : null}
                      </Link>
                      {isActive && !collapsed ? (
                        <p className="-mt-0.5 mb-1 ml-[43px] line-clamp-2 pr-3 text-[11px] leading-4 text-slate-500">
                          {item.message}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div> : null}
            </div>
          )})}
        </div>
      </nav>

      <div className={cn("shrink-0 space-y-2 border-t-2 border-emerald-100", collapsed ? "p-2" : "p-3")}>
        {!collapsed ? <Link
          href={summary?.kpis.criticalAlerts ? "/compliance" : summary?.kpis.requiredDocuments ? "/documents" : "/priorities"}
          onClick={onNavigate}
          className="block rounded-[1.35rem] border-2 border-slate-200 bg-white p-3 shadow-[0_4px_0_#e2e8f0] transition hover:border-emerald-200 hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Attention requise</p>
              <p className="mt-1 text-sm font-black text-slate-950">{sidebarActionTitle(summary, summaryStatus)}</p>
            </div>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <MiniMetric icon={Clock3} label="Tâches" value={summary?.kpis.tasksToday ?? 0} loading={summaryStatus === "loading"} />
            <MiniMetric icon={FolderOpen} label="Docs" value={summary?.kpis.requiredDocuments ?? 0} loading={summaryStatus === "loading"} />
            <MiniMetric icon={BellRing} label="Risque" value={summary?.kpis.criticalAlerts ?? 0} loading={summaryStatus === "loading"} />
          </div>
        </Link> : null}

        <div className={cn("rounded-[1.35rem] border-2 border-slate-200 bg-white shadow-[0_4px_0_#e2e8f0]", collapsed ? "p-2" : "p-2.5")}>
          <ClerkUserMenu
            avatarClassName="size-10"
            subtitle="Cabinet sécurisé"
            textClassName={collapsed ? "sr-only" : "min-w-0 flex-1"}
          />
        </div>
      </div>
    </aside>
  )
}

function sidebarActionTitle(summary: DashboardSummary | null, status: "loading" | "ready" | "error") {
  if (status === "loading") return "Chargement des priorités..."
  if (status === "error" || !summary) return "Résumé indisponible"
  if (summary.kpis.criticalAlerts > 0) return `${summary.kpis.criticalAlerts} alerte(s) conformité`
  if (summary.kpis.overdueTasks > 0) return `${summary.kpis.overdueTasks} tâche(s) en retard`
  if (summary.kpis.requiredDocuments > 0) return `${summary.kpis.requiredDocuments} document(s) requis`
  if (summary.kpis.tasksToday > 0) return `${summary.kpis.tasksToday} action(s) aujourd’hui`
  return "Aucune urgence détectée"
}

function importantBadge(href: string) {
  return href === "/compliance" || href === "/taches"
}

function parseBadgeCount(value?: string) {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value?: number) {
  if (value === undefined) return "..."
  return new Intl.NumberFormat("fr-CA").format(value)
}

function persistOpenSections(value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(sidebarOpenSectionsStorageKey, JSON.stringify(value))
  } catch {
    // The sidebar still works without persisted preferences.
  }
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
  loading,
  tone = "slate",
}: {
  icon: typeof ShieldCheck
  label: string
  value: string
  loading: boolean
  tone?: "slate" | "emerald" | "amber"
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-2.5 shadow-[0_3px_0_#e2e8f0]">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-xl ring-2",
            tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
            tone === "amber" && "bg-amber-50 text-amber-700 ring-amber-200",
            tone === "slate" && "bg-slate-50 text-slate-500 ring-slate-200"
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <p className="truncate text-[10px] font-black uppercase text-slate-400">{label}</p>
      </div>
      <p className="mt-1 text-sm font-black text-slate-950">{loading ? "..." : value}</p>
    </div>
  )
}

function CompactStatus({
  summary,
  loading,
  hasUrgentWork,
}: {
  summary: DashboardSummary | null
  loading: boolean
  hasUrgentWork: boolean
}) {
  const value = loading ? "..." : summary?.kpis.criticalAlerts || summary?.kpis.overdueTasks || summary?.kpis.requiredDocuments || 0
  const Icon = hasUrgentWork ? AlertTriangle : CheckCircle2

  return (
    <Link
      href={hasUrgentWork ? "/compliance" : "/priorities"}
      className={cn(
        "mt-2 grid min-h-14 place-items-center rounded-2xl border-2 text-center shadow-[0_4px_0_#e2e8f0] transition active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        hasUrgentWork
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      )}
      title={hasUrgentWork ? "Attention requise" : "Opérationnel"}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="text-xs font-black">{value}</span>
    </Link>
  )
}

function QuickLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof ShieldCheck
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="grid min-h-14 place-items-center rounded-2xl border-2 border-slate-200 bg-white px-1.5 py-2 text-center text-[11px] font-black text-slate-600 shadow-[0_3px_0_#e2e8f0] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <Icon className="mb-1 size-4" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Clock3
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white px-2 py-2 text-center shadow-[0_3px_0_#e2e8f0]">
      <Icon className="mx-auto size-3.5 text-slate-400" aria-hidden="true" />
      <p className="mt-1 text-sm font-black text-slate-950">{loading ? "..." : value}</p>
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
    </div>
  )
}
