"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { CheckCircle2, LockKeyhole } from "lucide-react"

import {
  getSubscriptionPriceSummary,
  moduleCatalog,
  offerableSubscriptionPlanKeys,
  organizationTypeForSubscriptionPlan,
  organizationTypes,
  subscriptionCurrencies,
  subscriptionPricingModes,
  subscriptionPlans,
  subscriptionStatuses,
  type ModuleKey,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
  type SubscriptionStatusKey,
} from "@/lib/billing/plans"

type OrganizationAccessFormProps = {
  organizationId: string
  initialPlan: SubscriptionPlanKey
  initialStatus: SubscriptionStatusKey
  initialPricingMode: SubscriptionPricingModeKey
  initialCurrency: SubscriptionCurrencyKey
  initialSeatLimit: number
  initialModules: ModuleKey[]
  updateAction: (formData: FormData) => void | Promise<void>
}

export function OrganizationAccessForm({
  organizationId,
  initialPlan,
  initialStatus,
  initialPricingMode,
  initialCurrency,
  initialSeatLimit,
  initialModules,
  updateAction,
}: OrganizationAccessFormProps) {
  const initialSelectablePlan = initialPlan === "RESEAU" ? "CABINET" : initialPlan
  const [plan, setPlan] = useState<SubscriptionPlanKey>(initialSelectablePlan)
  const [status, setStatus] = useState<SubscriptionStatusKey>(initialStatus)
  const [pricingMode, setPricingMode] = useState<SubscriptionPricingModeKey>(initialPricingMode)
  const [currency, setCurrency] = useState<SubscriptionCurrencyKey>(initialCurrency)
  const [seatLimit, setSeatLimit] = useState(initialSeatLimit)
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(initialModules)
  const organizationType = organizationTypeForSubscriptionPlan(plan)
  const planEntries = offerableSubscriptionPlanKeys.map((key) => [key, subscriptionPlans[key]] as const)
  const selectedPlanSummary = getSubscriptionPriceSummary(plan, pricingMode, currency)

  const planModules = useMemo(() => subscriptionPlans[plan].modules, [plan])
  const hasCustomModules = useMemo(() => {
    const planSet = new Set(planModules)
    return selectedModules.length !== planModules.length || selectedModules.some((module) => !planSet.has(module))
  }, [planModules, selectedModules])

  function selectPlan(nextPlan: SubscriptionPlanKey) {
    setPlan(nextPlan)
    setSeatLimit(subscriptionPlans[nextPlan].defaultSeatLimit)
    setSelectedModules([...subscriptionPlans[nextPlan].modules])
  }

  function toggleModule(moduleKey: ModuleKey) {
    setSelectedModules((current) => {
      if (current.includes(moduleKey)) return current.filter((module) => module !== moduleKey)
      return [...current, moduleKey]
    })
  }

  function resetToPlan() {
    setSeatLimit(subscriptionPlans[plan].defaultSeatLimit)
    setSelectedModules([...subscriptionPlans[plan].modules])
  }

  return (
    <form action={updateAction} className="rounded-xl border-2 border-violet-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="subscriptionPlan" value={plan} />

      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase text-violet-700">Forfait du cabinet</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Changer le forfait conseiller</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Choisis le forfait attribué à ce cabinet. Le type d’organisation et les modules conseillers se synchronisent automatiquement.
        </p>
        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-slate-950">Sélection actuelle : </span>
          <span className="font-semibold text-violet-700">{subscriptionPlans[plan].label}</span>
          <span className="text-slate-500"> · {selectedPlanSummary}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {planEntries.map(([key, value]) => {
          const selected = plan === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectPlan(key)}
              aria-pressed={selected}
              className={`rounded-xl border-2 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                selected
                  ? "border-violet-500 bg-violet-50 shadow-[0_4px_0_#ddd6fe]"
                  : "border-slate-200 bg-slate-50 hover:border-violet-200 hover:bg-white"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-950">{value.label}</span>
                {selected ? <CheckCircle2 className="size-4 text-violet-700" aria-hidden="true" /> : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{value.description}</span>
              <span className="mt-2 block text-xs font-semibold text-slate-700">
                {getSubscriptionPriceSummary(key, pricingMode, currency)} · {value.defaultSeatLimit} siège(s)
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
        <p className="font-semibold text-emerald-950">Type d’organisation synchronisé</p>
        <p className="mt-1 text-emerald-800">
          {organizationTypes[organizationType].label} · {organizationTypes[organizationType].description}
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Offre
          <select
            name="subscriptionPricingMode"
            value={pricingMode}
            onChange={(event) => setPricingMode(event.target.value as SubscriptionPricingModeKey)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {Object.entries(subscriptionPricingModes).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Statut
          <select
            name="subscriptionStatus"
            value={status}
            onChange={(event) => setStatus(event.target.value as SubscriptionStatusKey)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {Object.entries(subscriptionStatuses).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Devise
          <select
            name="subscriptionCurrency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as SubscriptionCurrencyKey)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {Object.entries(subscriptionCurrencies).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Sièges
          <input
            name="advisorSeatLimit"
            type="number"
            min={1}
            value={seatLimit}
            onChange={(event) => setSeatLimit(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Modules conseillers</p>
          {hasCustomModules ? <span className="text-xs font-semibold text-violet-700">Accès personnalisé</span> : <span className="text-xs font-semibold text-slate-500">Défaut du forfait</span>}
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subscriptionPlans[plan].description}</p>
        <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {moduleCatalog.map((module) => (
            <label key={module.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                name="modules"
                value={module.key}
                type="checkbox"
                checked={selectedModules.includes(module.key)}
                onChange={() => toggleModule(module.key)}
                className="size-4 rounded border-slate-300 text-violet-700"
              />
              {module.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
        <span className="font-semibold text-slate-900">Enregistrer</span> conserve les modules cochés.{" "}
        <span className="font-semibold text-slate-900">Appliquer le forfait</span> sauvegarde le forfait choisi avec ses sièges et modules par défaut.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SubmitButton actionValue="save" className="bg-slate-950 text-white hover:bg-slate-800">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Enregistrer
        </SubmitButton>
        <SubmitButton actionValue="applyPlan" className="border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100">
          <LockKeyhole className="size-4" aria-hidden="true" />
          Appliquer le forfait
        </SubmitButton>
        <button
          type="button"
          onClick={resetToPlan}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Revenir au défaut du forfait
        </button>
      </div>
    </form>
  )
}

function SubmitButton({
  actionValue,
  className,
  children,
}: {
  actionValue: string
  className: string
  children: ReactNode
}) {
  const { pending } = useFormStatus()

  return (
    <button
      name="action"
      value={actionValue}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}
