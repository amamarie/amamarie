"use client"

import { useState } from "react"

import { subscriptionPricingModes, type SubscriptionPricingModeKey } from "@/lib/billing/plans"

type PublicPricingModeFormProps = {
  initialMode: SubscriptionPricingModeKey
  updateAction: (formData: FormData) => void | Promise<void>
}

export function PublicPricingModeForm({ initialMode, updateAction }: PublicPricingModeFormProps) {
  const [mode, setMode] = useState<SubscriptionPricingModeKey>(initialMode)
  const isBeta = mode === "beta"

  function toggleMode() {
    setMode((current) => current === "beta" ? "standard" : "beta")
  }

  return (
    <form action={updateAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="publicPricingMode" value={mode} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-700">Forfaits publics</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Page visible par les clients</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Les visiteurs ne voient qu’une seule page `/forfaits`. Le mode bêta reste contrôlé ici.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isBeta}
          onClick={toggleMode}
          className="relative h-10 w-20 rounded-full border border-slate-200 bg-slate-100 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 data-[active=true]:bg-amber-100"
          data-active={isBeta}
        >
          <span className={`block size-8 rounded-full bg-white shadow-sm transition ${isBeta ? "translate-x-10" : "translate-x-0"}`} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-semibold text-slate-950">Mode actif : </span>
          <span className={isBeta ? "font-semibold text-amber-700" : "font-semibold text-slate-700"}>{subscriptionPricingModes[mode]}</span>
        </div>
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
          Publier ce mode
        </button>
      </div>
    </form>
  )
}
