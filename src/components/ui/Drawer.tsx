"use client"

import { X } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type DrawerProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

export function Drawer({ open, title, children, onClose }: DrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onClose} aria-label="Fermer">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
