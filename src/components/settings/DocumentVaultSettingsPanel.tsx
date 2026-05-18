"use client"

import { FileText, Loader2, LockKeyhole, Save, Search, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { ContentCard } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type RetentionPolicyOption = {
  value: string
  label: string
  description: string
  duration: string
}

type DocumentVaultSettings = {
  id: string
  defaultRetentionYears: number
  kycRetentionYears: number
  recommendationRetentionYears: number
  identityRetentionYears: number
  rejectedDocumentRetentionDays: number
  unclassifiedReviewDays: number
  expiryReminderDays: number
  requireConsentForSensitiveDocuments: boolean
  requireHumanValidationForExtractions: boolean
  blockRecommendationWithUnvalidatedData: boolean
  createTaskForMissingDocuments: boolean
  createTaskForExpiredDocuments: boolean
  restrictIdentityDocuments: boolean
  restrictMedicalDocuments: boolean
  restrictCriticalDocuments: boolean
  allowExternalSharing: boolean
  requireComplianceApprovalForExternalSharing: boolean
  accessLogEnabled: boolean
  clientUploadEnabled: boolean
  semanticSearchEnabled: boolean
  defaultStorageResidency: string
  deletionPolicy: string
  externalSharingPolicy: string
  retentionPolicies: RetentionPolicyOption[]
}

const retentionFields: Array<{ key: keyof DocumentVaultSettings; label: string; suffix: string }> = [
  { key: "defaultRetentionYears", label: "Documents client", suffix: "ans" },
  { key: "kycRetentionYears", label: "Profil client", suffix: "ans" },
  { key: "recommendationRetentionYears", label: "Preuves de recommandation", suffix: "ans" },
  { key: "identityRetentionYears", label: "Pièces d’identité", suffix: "ans" },
  { key: "rejectedDocumentRetentionDays", label: "Documents rejetés", suffix: "jours" },
  { key: "unclassifiedReviewDays", label: "Revue non classés", suffix: "jours" },
  { key: "expiryReminderDays", label: "Rappel avant expiration", suffix: "jours" },
]

const controlGroups: Array<{
  title: string
  icon: typeof ShieldCheck
  items: Array<{ key: keyof DocumentVaultSettings; label: string }>
}> = [
  {
    title: "Validation et blocages",
    icon: ShieldCheck,
    items: [
      { key: "requireConsentForSensitiveDocuments", label: "Consentement requis pour documents sensibles" },
      { key: "requireHumanValidationForExtractions", label: "Validation humaine obligatoire après extraction" },
      { key: "blockRecommendationWithUnvalidatedData", label: "Bloquer une recommandation si donnée documentaire non validée" },
      { key: "createTaskForMissingDocuments", label: "Créer une tâche pour document manquant" },
      { key: "createTaskForExpiredDocuments", label: "Créer une tâche pour document expiré" },
    ],
  },
  {
    title: "Accès et confidentialité",
    icon: LockKeyhole,
    items: [
      { key: "restrictIdentityDocuments", label: "Restreindre les pièces d’identité" },
      { key: "restrictMedicalDocuments", label: "Restreindre les documents santé / assurabilité" },
      { key: "restrictCriticalDocuments", label: "Restreindre les documents critiques" },
      { key: "accessLogEnabled", label: "Journaliser les accès et téléchargements" },
      { key: "clientUploadEnabled", label: "Autoriser le dépôt sécurisé par le client" },
    ],
  },
  {
    title: "Partage et recherche",
    icon: Search,
    items: [
      { key: "allowExternalSharing", label: "Autoriser le partage externe contrôlé" },
      { key: "requireComplianceApprovalForExternalSharing", label: "Approbation conformité avant partage externe" },
      { key: "semanticSearchEnabled", label: "Activer la recherche documentaire avancée / sémantique" },
    ],
  },
]

export function DocumentVaultSettingsPanel() {
  const [settings, setSettings] = useState<DocumentVaultSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch("/api/documents/settings", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message ?? "Impossible de charger les politiques.")
        if (active) setSettings(payload.data)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Impossible de charger les politiques documentaires.")
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  function updateNumber(key: keyof DocumentVaultSettings, value: string) {
    if (!settings) return
    setSettings({ ...settings, [key]: Number(value) } as DocumentVaultSettings)
  }

  function updateBoolean(key: keyof DocumentVaultSettings, value: boolean) {
    if (!settings) return
    setSettings({ ...settings, [key]: value } as DocumentVaultSettings)
  }

  function updateText(key: keyof DocumentVaultSettings, value: string) {
    if (!settings) return
    setSettings({ ...settings, [key]: value } as DocumentVaultSettings)
  }

  async function save() {
    if (!settings) return
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch("/api/documents/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? "Impossible d’enregistrer.")
      setSettings(payload.data)
      setNotice("Politiques documentaires enregistrées. Le coffre applique ces règles aux prochaines revues.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer les politiques documentaires.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ContentCard title="Politiques du coffre documentaire" description="Règles configurables par cabinet pour conservation, accès, validation humaine, partage et recherche avancée.">
      {!settings ? (
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          <Loader2 className="size-4 animate-spin" />
          Chargement des politiques documentaires...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="font-black text-slate-950">Conservation et rappels</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Durées utilisées dans la revue de rétention, les documents expirés et les actions requises.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {retentionFields.map((field) => (
                  <label key={String(field.key)} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">{field.label}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={String(settings[field.key] ?? 0)}
                        onChange={(event) => updateNumber(field.key, event.target.value)}
                        className="rounded-xl"
                      />
                      <span className="w-12 text-xs font-black text-slate-400">{field.suffix}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <p className="font-black text-slate-950">Politiques écrites</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Libellés conservés pour l’audit, la Loi 25 et les dossiers cabinet.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Résidence des données</span>
                  <Input value={settings.defaultStorageResidency} onChange={(event) => updateText("defaultStorageResidency", event.target.value)} className="rounded-xl" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Suppression / archivage</span>
                  <Input value={settings.deletionPolicy} onChange={(event) => updateText("deletionPolicy", event.target.value)} className="rounded-xl" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Partage externe</span>
                  <Input value={settings.externalSharingPolicy} onChange={(event) => updateText("externalSharingPolicy", event.target.value)} className="rounded-xl" />
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {controlGroups.map((group) => {
              const Icon = group.icon
              return (
                <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="size-4 text-slate-500" />
                    <p className="text-sm font-black text-slate-900">{group.title}</p>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <label key={String(item.key)} className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm font-semibold leading-5 text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(settings[item.key])}
                          onChange={(event) => updateBoolean(item.key, event.target.checked)}
                          className="mt-1 size-4 rounded border-slate-300"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">Politiques disponibles dans le coffre</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {settings.retentionPolicies.map((policy) => (
                <div key={policy.value} className="rounded-xl bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{policy.label}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{policy.duration}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{policy.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}
              {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
              {!notice && !error ? <p className="text-sm font-semibold text-slate-500">Les modifications sont journalisées dans l’audit trail.</p> : null}
            </div>
            <Button onClick={save} disabled={isSaving} className="rounded-xl bg-slate-950 hover:bg-slate-800">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer les politiques
            </Button>
          </div>
        </div>
      )}
    </ContentCard>
  )
}
