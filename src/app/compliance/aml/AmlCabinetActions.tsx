"use client"

import { FileText, Settings2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function AmlCabinetActions() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)

  async function post(path: string, success: string) {
    setIsSaving(true)
    setMessage(null)
    setError(null)
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" } })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.ok === false) {
      setError(payload?.error?.message ?? "Action AML impossible.")
    } else {
      if (payload?.data?.report?.id) setReportId(payload.data.report.id)
      setMessage(success)
    }
    setIsSaving(false)
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Actions cabinet AML</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Installer les règles standards et générer un rapport AML cabinet signé pour inspection.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => post("/api/aml/rules/defaults/install", "Règles AML standards installées.")}>
            <Settings2 className="mr-2 size-4" /> Installer règles
          </Button>
          <Button className="rounded-xl" disabled={isSaving} onClick={() => post("/api/aml/reports/cabinet", "Rapport AML cabinet signé généré.")}>
            <FileText className="mr-2 size-4" /> Rapport cabinet
          </Button>
        </div>
      </div>
      {message ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {reportId ? (
        <a href={`/api/audit-reports/${reportId}/inspection-zip`} className="mt-3 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-100">
          Ouvrir l’export d’inspection AML signé
        </a>
      ) : null}
      {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  )
}
