"use client"

import { Calculator, Loader2, Save } from "lucide-react"
import { useEffect, useState } from "react"

import { ContentCard } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type InsuranceNeedsSettings = {
  life: {
    incomeReplacementYears: number
    finalExpenses: number
    educationPerChild: number
    emergencyMonths: number
    familyCoverageGapRatio: number
    highMortgageThreshold: number
  }
  disability: {
    minimumEmergencyMonths: number
    highIncomeThreshold: number
    groupCoverageRatioWarning: number
  }
  criticalIllness: {
    mortgageProtectionPortion: number
    medicalLiquidity: number
    incomeReplacementMonths: number
    familyReserve: number
    minimumEmergencyMonths: number
  }
  business: {
    continuityMonths: number
  }
}

const settingGroups: Array<{
  title: string
  description: string
  fields: Array<{ path: string; label: string; suffix?: string }>
}> = [
  {
    title: "Assurance vie",
    description: "Hypothèses utilisées pour revenu, frais finaux, études, urgence et alertes.",
    fields: [
      { path: "life.incomeReplacementYears", label: "Années de revenu", suffix: "ans" },
      { path: "life.finalExpenses", label: "Frais finaux", suffix: "$" },
      { path: "life.educationPerChild", label: "Études par enfant", suffix: "$" },
      { path: "life.emergencyMonths", label: "Fonds d’urgence", suffix: "mois" },
      { path: "life.familyCoverageGapRatio", label: "Seuil écart familial", suffix: "0-1" },
      { path: "life.highMortgageThreshold", label: "Hypothèque élevée", suffix: "$" },
    ],
  },
  {
    title: "Invalidité",
    description: "Seuils utilisés pour liquidités, revenu élevé et plafonds collectifs.",
    fields: [
      { path: "disability.minimumEmergencyMonths", label: "Fonds d’urgence minimum", suffix: "mois" },
      { path: "disability.highIncomeThreshold", label: "Revenu élevé", suffix: "$" },
      { path: "disability.groupCoverageRatioWarning", label: "Seuil collectif insuffisant", suffix: "0-1" },
    ],
  },
  {
    title: "Maladies graves",
    description: "Hypothèses de liquidités, hypothèque, revenu temporaire et réserve familiale.",
    fields: [
      { path: "criticalIllness.mortgageProtectionPortion", label: "Portion hypothèque", suffix: "$" },
      { path: "criticalIllness.medicalLiquidity", label: "Liquidités médicales", suffix: "$" },
      { path: "criticalIllness.incomeReplacementMonths", label: "Revenu temporaire", suffix: "mois" },
      { path: "criticalIllness.familyReserve", label: "Réserve familiale", suffix: "$" },
      { path: "criticalIllness.minimumEmergencyMonths", label: "Fonds d’urgence minimum", suffix: "mois" },
    ],
  },
  {
    title: "Entreprise",
    description: "Hypothèse de continuité utilisée pour personne clé, dette et rachat de parts.",
    fields: [
      { path: "business.continuityMonths", label: "Continuité d’exploitation", suffix: "mois" },
    ],
  },
]

function getPath(settings: InsuranceNeedsSettings, path: string) {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, settings)
}

function setPath(settings: InsuranceNeedsSettings, path: string, value: number): InsuranceNeedsSettings {
  const [group, field] = path.split(".") as [keyof InsuranceNeedsSettings, string]
  return {
    ...settings,
    [group]: {
      ...settings[group],
      [field]: value,
    },
  }
}

export function InsuranceNeedsSettingsPanel() {
  const [settings, setSettings] = useState<InsuranceNeedsSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch("/api/insurance-analyses/settings", { cache: "no-store" })
        const payload = await response.json()
        if (active) setSettings(payload.data)
      } catch {
        if (active) setError("Impossible de charger les hypothèses.")
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  async function save() {
    if (!settings) return
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch("/api/insurance-analyses/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer.")
      setSettings(payload.data)
      setNotice("Hypothèses enregistrées. Les prochaines analyses utiliseront ces paramètres.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer les hypothèses.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ContentCard title="Hypothèses d’analyse des besoins" description="Paramètres cabinet utilisés par les calculateurs et les signaux intelligents. Les analyses déjà signées restent verrouillées.">
      {!settings ? (
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          <Loader2 className="size-4 animate-spin" />
          Chargement des hypothèses...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {settingGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Calculator className="size-5" />
                  </span>
                  <div>
                    <p className="font-black text-slate-950">{group.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{group.description}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.path} className="space-y-1">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{field.label}</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={String(getPath(settings, field.path) ?? 0)}
                          onChange={(event) => setSettings(setPath(settings, field.path, Number(event.target.value)))}
                          className="rounded-xl"
                        />
                        {field.suffix ? <span className="w-10 text-xs font-black text-slate-400">{field.suffix}</span> : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}
              {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
              {!notice && !error ? <p className="text-sm font-semibold text-slate-500">Toute modification est journalisée pour audit.</p> : null}
            </div>
            <Button onClick={save} disabled={isSaving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer les hypothèses
            </Button>
          </div>
        </div>
      )}
    </ContentCard>
  )
}
