"use client"

import { useState, type FormEvent } from "react"
import { Download, FileSpreadsheet, Upload } from "lucide-react"

type ImportResult = {
  createdClients: number
  updatedClients: number
  createdProducts: number
  skippedRows: number
  errors: string[]
}

export function CrmImportExportClient() {
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData(event.currentTarget)
      const response = await fetch("/api/crm/import/clients", {
        method: "POST",
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Import impossible.")
      setResult(payload.data)
      event.currentTarget.reset()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Import impossible.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={submitImport} className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-[0_8px_0_#bbf7d0]">
        <div className="flex items-center gap-2">
          <Upload className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-black text-slate-950">Importer clients et contrats</h2>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Import CSV réel. Les doublons sont détectés par email ou téléphone. Si une ligne contient un contrat, il est rattaché au client créé ou retrouvé.
        </p>

        <label className="mt-4 grid gap-2 text-sm font-black text-slate-700">
          Fichier CSV
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
          />
        </label>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">Colonnes reconnues</p>
          <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">
            firstName, lastName, email, phone, status, advisorEmail, productName, productType, company, contractNumber,
            effectiveDate, renewalAt, accountValue, premium, commissionAmount, commissionType.
          </p>
        </div>

        <button disabled={isUploading} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_#020617] transition hover:bg-slate-800 disabled:opacity-60">
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          {isUploading ? "Import en cours..." : "Importer le fichier"}
        </button>

        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
        {result ? (
          <div className="mt-4 grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 sm:grid-cols-4">
            <p>{result.createdClients} client(s) créé(s)</p>
            <p>{result.updatedClients} doublon(s) retrouvé(s)</p>
            <p>{result.createdProducts} contrat(s) créé(s)</p>
            <p>{result.skippedRows} ligne(s) ignorée(s)</p>
            {result.errors.length > 0 ? <p className="sm:col-span-4 text-amber-800">{result.errors.join(" · ")}</p> : null}
          </div>
        ) : null}
      </form>

      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-[0_8px_0_#e2e8f0]">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-violet-700" aria-hidden="true" />
          <h2 className="text-lg font-black text-slate-950">Exporter le portefeuille</h2>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Export CSV des clients, contrats, valeurs, échéances et commissions pour contrôle ou migration.
        </p>
        <a
          href="/api/crm/export/clients"
          className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-800 transition hover:bg-violet-100"
        >
          <Download className="size-4" aria-hidden="true" />
          Télécharger le CSV
        </a>
      </div>
    </div>
  )
}
