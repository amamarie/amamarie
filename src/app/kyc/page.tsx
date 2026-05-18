"use client"

import { AlertTriangle, BarChart3, CheckCircle2, FileClock, LockKeyhole, Settings2, ShieldCheck, UserRoundCheck } from "lucide-react"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StatusTone } from "@/types"

type KycDashboardRow = {
  id: string
  clientName: string
  advisorName: string
  completionScore: number
  freshnessScore: number
  coherenceScore: number
  recommendationReady: boolean
  finalRiskProfile: string
  status: string
  reviewStatus: string | null
  nextReviewAt: string | null
  alertCount: number
  highAlertCount: number
  goalCount: number
  latestVersion: { id: string; versionNumber: number; lockedAt: string | null; usedForRecommendationAt: string | null } | null
  href: string
}

type KycSettings = {
  reviewCadenceMonths: number
  completionThreshold: number
  freshnessThreshold: number
  coherenceThreshold: number
  blockRecommendations: boolean
  blockExpiredKyc: boolean
  requireClientConfirmation: boolean
  requireAdvisorAttestation: boolean
  retentionYears: number
  maskingEnabled: boolean
  accessLogEnabled: boolean
  clientExportEnabled: boolean
  deletionPolicy: string
  residencyPolicy: string
}

type DashboardData = {
  settings: KycSettings
  metrics: {
    total: number
    toUpdate: number
    awaitingClient: number
    advisorReview: number
    inconsistencies: number
    blockedRecommendations: number
    goals: number
    versions: number
    accessLogs: number
  }
  rows: KycDashboardRow[]
  generatedAt: string
}

const riskLabels: Record<string, string> = {
  CONSERVATIVE: "Conservateur",
  MODERATE_LOW: "Modéré-faible",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  GROWTH: "Croissance",
  AGGRESSIVE: "Agressif",
  UNKNOWN: "À déterminer",
}

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export default function KycPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activeView, setActiveView] = useState<"all" | "update" | "client" | "advisor" | "blocked">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    setIsLoading(true)
    setError(null)
    try {
      setData(await readData<DashboardData>(await fetch("/api/kyc/dashboard", { cache: "no-store" })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le module Profil client.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const rows = useMemo(() => {
    const all = data?.rows ?? []
    if (activeView === "update") return all.filter((row) => row.freshnessScore < (data?.settings.freshnessThreshold ?? 60))
    if (activeView === "client") return all.filter((row) => !row.recommendationReady && row.completionScore >= (data?.settings.completionThreshold ?? 85))
    if (activeView === "advisor") return all.filter((row) => row.reviewStatus === "READY_FOR_ADVISOR_REVIEW" || row.status === "PENDING_REVIEW")
    if (activeView === "blocked") return all.filter((row) => !row.recommendationReady || row.highAlertCount > 0)
    return all
  }, [activeView, data])

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setNotice(null)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      await readData<KycSettings>(await fetch("/api/kyc/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }))
      setNotice("Règles de connaissance client mises à jour.")
      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer les règles.")
    } finally {
      setIsSaving(false)
    }
  }

  async function runBackfill() {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const result = await readData<{ scanned: number; synced: number; errors: Array<{ message: string }> }>(await fetch("/api/kyc/backfill", { method: "POST" }))
      setNotice(`${result.synced}/${result.scanned} profil(s) client synchronisé(s) vers les objets avancés.`)
      await loadDashboard()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Synchronisation des profils client impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell
      eyebrow="Module Profil client"
      title="Connaissance client, convenance et recommandations"
      description="Vue dédiée pour piloter les profils investisseurs, objectifs, versions figées, alertes, règles cabinet et preuves Loi 25."
    >
      {notice ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-black text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-black text-rose-700">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={UserRoundCheck} label="Profils suivis" value={data?.metrics.total ?? 0} detail="Dossiers actifs" tone="sky" />
        <Metric icon={FileClock} label="À mettre à jour" value={data?.metrics.toUpdate ?? 0} detail="Fraîcheur / échéance" tone={(data?.metrics.toUpdate ?? 0) > 0 ? "amber" : "emerald"} />
        <Metric icon={ShieldCheck} label="Révision conseiller" value={data?.metrics.advisorReview ?? 0} detail="Validation requise" tone="violet" />
        <Metric icon={AlertTriangle} label="Incohérences" value={data?.metrics.inconsistencies ?? 0} detail="Risque, liquidité, levier" tone={(data?.metrics.inconsistencies ?? 0) > 0 ? "rose" : "emerald"} />
        <Metric icon={LockKeyhole} label="Reco bloquées" value={data?.metrics.blockedRecommendations ?? 0} detail="Profil non prêt" tone="amber" />
        <Metric icon={BarChart3} label="Versions profil" value={data?.metrics.versions ?? 0} detail={`${data?.metrics.goals ?? 0} objectifs`} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ContentCard title="Dossiers Profil client" description={isLoading ? "Chargement..." : `${rows.length} dossier(s) affiché(s).`}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ["all", "Tous"],
              ["update", "À mettre à jour"],
              ["client", "En attente client"],
              ["advisor", "Révision conseiller"],
              ["blocked", "Reco bloquées"],
            ].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setActiveView(id as typeof activeView)} className={activeView === id ? "shrink-0 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white" : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"}>
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm font-black text-slate-600">Chargement du tableau profil client...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <CheckCircle2 className="size-6 text-emerald-700" />
              <p className="mt-2 font-black text-emerald-950">Aucun dossier dans cette vue.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rows.map((row) => <KycRow key={row.id} row={row} />)}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Règles cabinet" description="Seuils, blocages, conservation et politique Loi 25.">
          <form className="grid gap-3" onSubmit={saveSettings}>
            <SettingsInput label="Révision profil générale" name="reviewCadenceMonths" defaultValue={data?.settings.reviewCadenceMonths ?? 36} suffix="mois" />
            <SettingsInput label="Seuil complétude" name="completionThreshold" defaultValue={data?.settings.completionThreshold ?? 85} suffix="%" />
            <SettingsInput label="Seuil fraîcheur" name="freshnessThreshold" defaultValue={data?.settings.freshnessThreshold ?? 60} suffix="/100" />
            <SettingsInput label="Seuil cohérence" name="coherenceThreshold" defaultValue={data?.settings.coherenceThreshold ?? 70} suffix="/100" />
            <SettingsInput label="Conservation" name="retentionYears" defaultValue={data?.settings.retentionYears ?? 7} suffix="ans" />
            <SelectSetting label="Blocage recommandations" name="blockRecommendations" defaultValue={String(data?.settings.blockRecommendations ?? true)} />
            <SelectSetting label="Journal d’accès Loi 25" name="accessLogEnabled" defaultValue={String(data?.settings.accessLogEnabled ?? true)} />
            <SelectSetting label="Masquage données sensibles" name="maskingEnabled" defaultValue={String(data?.settings.maskingEnabled ?? true)} />
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Résidence des données
              <Input name="residencyPolicy" defaultValue={data?.settings.residencyPolicy ?? "CANADA_PREFERRED"} />
            </label>
            <Button className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" disabled={isSaving}>
              <Settings2 className="size-4" />
              Enregistrer les règles
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 font-black" disabled={isSaving} onClick={() => void runBackfill()}>
              Synchroniser anciens profils
            </Button>
          </form>
        </ContentCard>
      </section>
    </PageShell>
  )
}

function KycRow({ row }: { row: KycDashboardRow }) {
  return (
    <article className="rounded-[1.2rem] border-2 border-slate-100 bg-white p-4 shadow-[0_5px_0_#f1f5f9]">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={row.recommendationReady ? "emerald" : "amber"}>{row.recommendationReady ? "Prêt recommandation" : "Non prêt"}</StatusBadge>
            <StatusBadge tone={row.highAlertCount > 0 ? "rose" : "slate"}>{row.alertCount} alerte(s)</StatusBadge>
            <StatusBadge tone="sky">Profil v{row.latestVersion?.versionNumber ?? "n/a"}</StatusBadge>
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">{row.clientName}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Conseiller: {row.advisorName} · Profil final: {riskLabels[row.finalRiskProfile] ?? row.finalRiskProfile} · Prochaine révision: {formatDate(row.nextReviewAt)}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <MiniScore label="Complétude" value={row.completionScore} />
          <MiniScore label="Fraîcheur" value={row.freshnessScore} />
          <MiniScore label="Cohérence" value={row.coherenceScore} />
          <Button className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" asChild>
            <Link href={row.href}>Ouvrir le profil</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof UserRoundCheck; label: string; value: number; detail: string; tone: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }
  return (
    <div className={`rounded-[1.25rem] border-2 p-4 shadow-[0_6px_0_#f1f5f9] ${toneClass[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </div>
  )
}

function SettingsInput({ label, name, defaultValue, suffix }: { label: string; name: string; defaultValue: number; suffix: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-slate-700">
      {label}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Input name={name} type="number" min="0" defaultValue={defaultValue} />
        <span className="text-xs font-black text-slate-400">{suffix}</span>
      </div>
    </label>
  )
}

function SelectSetting({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-sm font-black text-slate-700">
      {label}
      <select name={name} defaultValue={defaultValue} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
        <option value="true">Activé</option>
        <option value="false">Désactivé</option>
      </select>
    </label>
  )
}
