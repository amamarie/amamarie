"use client"

import { useEffect, useState } from "react"

import { MobileSidebar } from "@/components/layout/MobileSidebar"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { AdvisorProfileProvider, type AdvisorProfile } from "@/lib/advisor-profile-store"
import type { ModuleKey } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type AppLayoutClientProps = {
  children: React.ReactNode
  initialAdvisorProfile?: Partial<AdvisorProfile>
  allowedModuleKeys?: ModuleKey[]
}

export function AppLayoutClient({ children, initialAdvisorProfile, allowedModuleKeys }: AppLayoutClientProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)

  useEffect(() => {
    try {
      setDesktopSidebarCollapsed(window.localStorage.getItem("finadvisor.sidebar.collapsed") === "true")
    } catch {
      setDesktopSidebarCollapsed(false)
    }
  }, [])

  function updateDesktopSidebarCollapsed(collapsed: boolean) {
    setDesktopSidebarCollapsed(collapsed)
    try {
      window.localStorage.setItem("finadvisor.sidebar.collapsed", String(collapsed))
    } catch {
      // Layout preference is optional.
    }
  }

  return (
    <AdvisorProfileProvider initialProfile={initialAdvisorProfile}>
      <div
        data-finadvisor-app-shell
        className={cn(
          "min-h-screen w-full overflow-x-hidden bg-[#F7FCEB] text-slate-950"
        )}
      >
        <MobileSidebar
          open={mobileSidebarOpen}
          allowedModuleKeys={allowedModuleKeys}
          onOpenChange={setMobileSidebarOpen}
        />

        <div
          className={cn(
            "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:h-screen lg:overflow-y-auto",
            desktopSidebarCollapsed ? "lg:w-[88px]" : "lg:w-[280px]"
          )}
        >
          <Sidebar
            collapsed={desktopSidebarCollapsed}
            allowedModuleKeys={allowedModuleKeys}
            onCollapsedChange={updateDesktopSidebarCollapsed}
          />
        </div>

        <div
          className={cn(
            "min-h-screen min-w-0 max-w-full overflow-x-hidden transition-[padding-left] duration-200",
            desktopSidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[280px]"
          )}
        >
          <Topbar
            onMenuClick={() => setMobileSidebarOpen(true)}
          />
          <main
            className={cn(
              "w-full min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-6 xl:p-8"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </AdvisorProfileProvider>
  )
}
