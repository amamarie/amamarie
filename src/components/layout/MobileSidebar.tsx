"use client"

import { X } from "lucide-react"

import { Sidebar } from "@/components/layout/Sidebar"
import type { ModuleKey } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type MobileSidebarProps = {
  open: boolean
  allowedModuleKeys?: ModuleKey[]
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, allowedModuleKeys, onOpenChange }: MobileSidebarProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-emerald-950/35 opacity-0 backdrop-blur-sm transition-opacity duration-300",
          open && "opacity-100"
        )}
        onClick={() => onOpenChange(false)}
        aria-label="Fermer le menu"
        tabIndex={open ? 0 : -1}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[min(90vw,352px)] translate-x-[-100%] transition-transform duration-300 ease-out",
          open && "translate-x-0"
        )}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 z-10 rounded-2xl border-2 border-slate-200 bg-white p-2.5 text-slate-500 shadow-[0_4px_0_#e2e8f0] transition hover:bg-lime-50 hover:text-slate-900 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Fermer la sidebar"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <Sidebar allowedModuleKeys={allowedModuleKeys} onNavigate={() => onOpenChange(false)} />
        </div>
      </div>
    </div>
  )
}
