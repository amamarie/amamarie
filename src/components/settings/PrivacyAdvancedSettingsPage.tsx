"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ShieldCheck, ServerCog, EyeOff, AlertTriangle } from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type PrivacySettings = Record<string, boolean | number | string | null>
type PrivacyVendor = {
  id: string
  name: string
  serviceType: string
  status: string
  dataLocation: string | null
  outsideQuebec: boolean
  contractSigned: boolean
  piaCompleted: boolean
  riskLevel: string
  nextReviewAt: string | null
}
type MaskingRule = {
  id: string
  dataCategory: string
  fieldPattern: string
  maskingMode: string
  active: boolean
}
type AccessRiskEvent = {
  id: string
  eventType: string
  riskScore: number
  riskLevel: string
  reason: string | null
  status: string
  createdAt: string
  user: { id: string; name: string | null; role: string } | null
}
type PrivacyDataMap = {
  summary: {
    vendors: number
    highRiskVendors: number
    outsideQuebecFlows: number
    consentTotals: number
    activeConsentTotals: number
    outsideQuebecDisclosures: number
    openIncidents: number
    openHighRiskAccessEvents: number
    retentionReviewsDue: number
  }
  inventory: {
    documentSensitivity: Array<{ sensitivityLevel: string; count: number }>
    disclosures: Array<{ recipientType: string; outsideQuebec: boolean; count: number }>
  }
  vendorFlows: Array<{
    id: string
    name: string
    serviceType: string
    dataCategories: string[]
    dataLocation: string | null
    outsideQuebec: boolean
    contractSigned: boolean
    piaCompleted: boolean
    riskLevel: string
    riskFlags: string[]
  }>
  riskFindings: Array<{ id: string; title: string; detail: string; severity: string }>
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Action impossible.")
  }
  return result.data as T
}

const toggles = [
  ["defaultPrivacyMode", "Mode confidentialité par défaut"],
  ["screenShareMaskingDefault", "Masquage en partage d’écran"],
  ["shareWithSpouseDefault", "Partage conjoint désactivé par défaut"],
  ["externalDocumentSharingDefault", "Partage externe désactivé par défaut"],
  ["marketingDefault", "Marketing désactivé par défaut"],
  ["aiAssistanceDefault", "IA désactivée par défaut"],
  ["assistantSensitiveDocsDefault", "Documents sensibles masqués aux assistants"],
  ["massExportDefault", "Exports massifs désactivés"],
  ["publicLinksAllowed", "Liens publics autorisés"],
  ["indefiniteRetentionAllowed", "Conservation indéfinie autorisée"],
  ["requireMfaForPortal", "MFA portail recommandé/requis"],
  ["requireApprovalExternalSharing", "Approbation avant partage externe"],
  ["requireApprovalMassExport", "Approbation avant export massif"],
  ["anomalyDetectionEnabled", "Détection d’accès anormal"],
] as const

const maskingToggles = [
  ["maskPhone", "Téléphones"],
  ["maskEmail", "Courriels"],
  ["maskAddress", "Adresses"],
  ["maskFinancialValues", "Valeurs financières"],
  ["maskDateOfBirth", "Dates de naissance"],
  ["maskTaxIdentifiers", "Identifiants fiscaux"],
  ["maskHealthData", "Données santé"],
] as const

export function PrivacyAdvancedSettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [vendors, setVendors] = useState<PrivacyVendor[]>([])
  const [rules, setRules] = useState<MaskingRule[]>([])
  const [riskEvents, setRiskEvents] = useState<AccessRiskEvent[]>([])
  const [dataMap, setDataMap] = useState<PrivacyDataMap | null>(null)
  const [vendorForm, setVendorForm] = useState({
    name: "",
    serviceType: "Stockage documentaire",
    dataLocation: "Canada",
    riskLevel: "MEDIUM",
    outsideQuebec: false,
    contractSigned: false,
    piaCompleted: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [settingsResponse, vendorsResponse, rulesResponse, riskResponse, dataMapResponse] = await Promise.all([
        fetch("/api/privacy/settings", { cache: "no-store" }),
        fetch("/api/privacy/vendors", { cache: "no-store" }),
        fetch("/api/privacy/masking-rules", { cache: "no-store" }),
        fetch("/api/privacy/access-risk?status=OPEN", { cache: "no-store" }),
        fetch("/api/privacy/data-map", { cache: "no-store" }),
      ])
      setSettings(await readData<PrivacySettings>(settingsResponse))
      setVendors(await readData<PrivacyVendor[]>(vendorsResponse))
      setRules(await readData<MaskingRule[]>(rulesResponse))
      setRiskEvents(await readData<AccessRiskEvent[]>(riskResponse))
      setDataMap(await readData<PrivacyDataMap>(dataMapResponse))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  async function patchSettings(payload: Record<string, boolean | number>) {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const next = await readData<PrivacySettings>(await fetch("/api/privacy/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }))
      setSettings(next)
      setNotice("Paramètres confidentialité sauvegardés.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function createMaskingRule() {
    setIsSaving(true)
    try {
      await readData(await fetch("/api/privacy/masking-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataCategory: "FINANCIAL", fieldPattern: "annualIncome|netWorth|premium", maskingMode: "PARTIAL", rolesAllowed: ["OWNER", "COMPLIANCE", "ADVISOR"] }) }))
      await load()
      setNotice("Règle de masquage ajoutée.")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function createVendor() {
    if (!vendorForm.name.trim()) {
      setError("Le nom du fournisseur est requis.")
      return
    }
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      await readData(await fetch("/api/privacy/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorForm),
      }))
      setVendorForm({ name: "", serviceType: "Stockage documentaire", dataLocation: "Canada", riskLevel: "MEDIUM", outsideQuebec: false, contractSigned: false, piaCompleted: false })
      await load()
      setNotice("Fournisseur ajouté au registre.")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible d’ajouter le fournisseur.")
    } finally {
      setIsSaving(false)
    }
  }

  async function reviewVendor(vendor: PrivacyVendor) {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const nextReviewAt = new Date()
      nextReviewAt.setFullYear(nextReviewAt.getFullYear() + 1)
      await readData(await fetch(`/api/privacy/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReviewed: true, lastReviewedAt: new Date().toISOString(), nextReviewAt: nextReviewAt.toISOString(), status: "ACTIVE" }),
      }))
      await load()
      setNotice("Fournisseur marqué comme revu.")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible de revoir le fournisseur.")
    } finally {
      setIsSaving(false)
    }
  }

  async function reviewRiskEvent(event: AccessRiskEvent, status = "REVIEWED") {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      await readData(await fetch("/api/privacy/access-risk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, status }),
      }))
      await load()
      setNotice("Événement d’accès révisé.")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible de réviser l’accès.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell
      eyebrow="Paramètres cabinet"
      title="Confidentialité par défaut"
      description="Paramètres cabinet pour consentements, masquage, fournisseurs, export massif et détection d’accès anormal."
    >
      <div className="flex justify-end">
        <Button className="rounded-2xl" disabled={isSaving} onClick={() => void load()}>Actualiser</Button>
      </div>
      {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <ContentCard title="Privacy-by-default" description="Les options sensibles sont fermées par défaut et doivent être activées explicitement.">
          <div className="grid gap-2">
            {toggles.map(([key, label]) => (
              <ToggleRow key={key} label={label} checked={Boolean(settings?.[key])} disabled={isSaving || !settings} onChange={(checked) => patchSettings({ [key]: checked })} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <label className="text-xs font-black uppercase text-slate-500">Seuil de risque d’accès</label>
            <input
              type="number"
              min={1}
              max={100}
              value={Number(settings?.anomalyRiskThreshold ?? 70)}
              onChange={(event) => void patchSettings({ anomalyRiskThreshold: Number(event.target.value) })}
              className="mt-2 h-11 w-full rounded-2xl border-2 border-slate-100 px-3 text-sm font-black"
            />
          </div>
        </ContentCard>

        <ContentCard title="Masquage avancé" description="Champs masqués automatiquement selon rôle, contexte et sensibilité.">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600"><EyeOff className="size-4" />Champs couverts</div>
          <div className="grid gap-2">
            {maskingToggles.map(([key, label]) => (
              <ToggleRow key={key} label={label} checked={Boolean(settings?.[key])} disabled={isSaving || !settings} onChange={(checked) => patchSettings({ [key]: checked })} />
            ))}
          </div>
          <Button variant="outline" className="mt-4 rounded-2xl" disabled={isSaving} onClick={() => void createMaskingRule()}>Ajouter règle financière</Button>
          <div className="mt-3 grid gap-2">
            {rules.slice(0, 5).map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-950">{rule.dataCategory}</p>
                <p className="text-xs font-semibold text-slate-500">{rule.fieldPattern} · {rule.maskingMode} · {rule.active ? "active" : "inactive"}</p>
              </div>
            ))}
          </div>
        </ContentCard>

        <ContentCard title="Fournisseurs" description="Registre séparé des EFVP pour suivre contrats, localisation, risques et revues.">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600"><ServerCog className="size-4" />{vendors.length} fournisseur(s)</div>
          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <input
              value={vendorForm.name}
              onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nom du fournisseur"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={vendorForm.serviceType}
                onChange={(event) => setVendorForm((current) => ({ ...current, serviceType: event.target.value }))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
              >
                <option>Stockage documentaire</option>
                <option>IA / extraction</option>
                <option>Signature électronique</option>
                <option>Courriel / communication</option>
                <option>Hébergement cloud</option>
              </select>
              <select
                value={vendorForm.riskLevel}
                onChange={(event) => setVendorForm((current) => ({ ...current, riskLevel: event.target.value }))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
            </div>
            <input
              value={vendorForm.dataLocation}
              onChange={(event) => setVendorForm((current) => ({ ...current, dataLocation: event.target.value }))}
              placeholder="Localisation des données"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            />
            <div className="grid gap-2 text-xs font-black text-slate-600 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2"><input type="checkbox" checked={vendorForm.outsideQuebec} onChange={(event) => setVendorForm((current) => ({ ...current, outsideQuebec: event.target.checked }))} />Hors Québec</label>
              <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2"><input type="checkbox" checked={vendorForm.contractSigned} onChange={(event) => setVendorForm((current) => ({ ...current, contractSigned: event.target.checked }))} />Contrat signé</label>
              <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2"><input type="checkbox" checked={vendorForm.piaCompleted} onChange={(event) => setVendorForm((current) => ({ ...current, piaCompleted: event.target.checked }))} />EFVP complétée</label>
            </div>
            <Button variant="outline" className="rounded-2xl bg-white" disabled={isSaving} onClick={() => void createVendor()}>Ajouter fournisseur</Button>
          </div>
          <div className="grid gap-2">
            {vendors.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Aucun fournisseur enregistré.</p> : null}
            {vendors.slice(0, 8).map((vendor) => (
              <div key={vendor.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-950">{vendor.name}</p>
                  <StatusBadge tone={vendor.riskLevel === "HIGH" || vendor.riskLevel === "CRITICAL" ? "rose" : vendor.riskLevel === "MEDIUM" ? "amber" : "slate"}>{vendor.riskLevel}</StatusBadge>
                  {vendor.outsideQuebec ? <StatusBadge tone="amber">Hors Québec</StatusBadge> : null}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{vendor.serviceType} · {vendor.dataLocation ?? "localisation à préciser"} · contrat {vendor.contractSigned ? "signé" : "manquant"} · EFVP {vendor.piaCompleted ? "complétée" : "à faire"}</p>
                <Button variant="outline" size="sm" className="mt-2 rounded-xl bg-white" disabled={isSaving} onClick={() => void reviewVendor(vendor)}>Marquer revu</Button>
              </div>
            ))}
          </div>
        </ContentCard>
      </section>

      <ContentCard title="Cartographie des données" description="Vue synthèse des catégories traitées, flux fournisseurs, divulgations et risques vie privée.">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <DataMapMetric label="Fournisseurs" value={dataMap?.summary.vendors ?? 0} />
          <DataMapMetric label="À risque" value={dataMap?.summary.highRiskVendors ?? 0} tone={(dataMap?.summary.highRiskVendors ?? 0) > 0 ? "rose" : "slate"} />
          <DataMapMetric label="Hors Québec" value={dataMap?.summary.outsideQuebecFlows ?? 0} tone={(dataMap?.summary.outsideQuebecFlows ?? 0) > 0 ? "amber" : "slate"} />
          <DataMapMetric label="Consentements actifs" value={dataMap?.summary.activeConsentTotals ?? 0} />
          <DataMapMetric label="Accès à risque" value={dataMap?.summary.openHighRiskAccessEvents ?? 0} tone={(dataMap?.summary.openHighRiskAccessEvents ?? 0) > 0 ? "rose" : "slate"} />
          <DataMapMetric label="Conservation due" value={dataMap?.summary.retentionReviewsDue ?? 0} tone={(dataMap?.summary.retentionReviewsDue ?? 0) > 0 ? "amber" : "slate"} />
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <DataMapPanel title="Documents par sensibilité" empty="Aucun document classé.">
            {(dataMap?.inventory.documentSensitivity ?? []).map((item) => (
              <DataMapLine key={item.sensitivityLevel} label={item.sensitivityLevel} value={item.count} />
            ))}
          </DataMapPanel>
          <DataMapPanel title="Flux vers tiers" empty="Aucune divulgation.">
            {(dataMap?.inventory.disclosures ?? []).map((item) => (
              <DataMapLine key={`${item.recipientType}-${item.outsideQuebec}`} label={`${item.recipientType}${item.outsideQuebec ? " · hors Québec" : ""}`} value={item.count} />
            ))}
          </DataMapPanel>
          <DataMapPanel title="Risques à corriger" empty="Aucun risque cartographique ouvert.">
            {(dataMap?.riskFindings ?? []).slice(0, 6).map((finding) => (
              <div key={finding.id} className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-950">{finding.title}</p>
                  <StatusBadge tone={finding.severity === "CRITICAL" || finding.severity === "HIGH" ? "rose" : "amber"}>{finding.severity}</StatusBadge>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{finding.detail}</p>
              </div>
            ))}
          </DataMapPanel>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {(dataMap?.vendorFlows ?? []).slice(0, 8).map((vendor) => (
            <div key={vendor.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-950">{vendor.name}</p>
                <StatusBadge tone={vendor.riskLevel === "HIGH" || vendor.riskLevel === "CRITICAL" ? "rose" : vendor.riskLevel === "MEDIUM" ? "amber" : "slate"}>{vendor.riskLevel}</StatusBadge>
                {vendor.outsideQuebec ? <StatusBadge tone="amber">Hors Québec</StatusBadge> : null}
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {vendor.serviceType} · {vendor.dataLocation ?? "localisation à préciser"} · {vendor.dataCategories.length > 0 ? vendor.dataCategories.join(", ") : "catégories à préciser"}
              </p>
              {vendor.riskFlags.length > 0 ? <p className="mt-2 text-xs font-black text-rose-700">{vendor.riskFlags.join(" · ")}</p> : null}
            </div>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Accès à risque" description="Événements générés par les téléchargements, exports, volumes inhabituels ou accès hors heures normales.">
        <div className="grid gap-2 lg:grid-cols-2">
          {riskEvents.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Aucun accès à risque ouvert.</p> : null}
          {riskEvents.slice(0, 10).map((event) => (
            <div key={event.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-950">{event.eventType}</p>
                <StatusBadge tone={event.riskLevel === "CRITICAL" ? "rose" : event.riskLevel === "HIGH" ? "amber" : "slate"}>{event.riskScore}/100</StatusBadge>
                <StatusBadge tone="slate">{event.status}</StatusBadge>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{event.reason ?? "Raison non précisée"} · {event.user?.name ?? "Utilisateur inconnu"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => void reviewRiskEvent(event, "REVIEWED")}>Marquer revu</Button>
                <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => void reviewRiskEvent(event, "FALSE_POSITIVE")}>Faux positif</Button>
              </div>
            </div>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Contrôles appliqués" description="Résumé des protections opérationnelles actives dans le CRM.">
        <div className="grid gap-3 md:grid-cols-3">
          <ControlItem icon={<ShieldCheck className="size-5" />} title="Blocages" text="Profil, analyse, coffre, IA, marketing et partage assureur vérifient les consentements actifs." />
          <ControlItem icon={<AlertTriangle className="size-5" />} title="Risque d’accès" text="Téléchargements, exports et volumes inhabituels créent des événements de risque à réviser." />
          <ControlItem icon={<EyeOff className="size-5" />} title="Masquage" text="Les champs sensibles sont masqués selon les paramètres cabinet et le rôle utilisateur." />
        </div>
      </ContentCard>
    </PageShell>
  )
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-emerald-600" />
    </label>
  )
}

function DataMapMetric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" | "rose" }) {
  const toneClass = {
    slate: "border-slate-100 bg-slate-50 text-slate-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    rose: "border-rose-100 bg-rose-50 text-rose-900",
  }[tone]

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-xs font-black uppercase text-current opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function DataMapPanel({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{title}</p>
      <div className="mt-3 grid gap-2">
        {isEmpty ? <p className="rounded-xl bg-white p-3 text-sm font-semibold text-slate-500">{empty}</p> : items}
      </div>
    </div>
  )
}

function DataMapLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
      <span className="font-bold text-slate-600">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  )
}

function ControlItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-950">
        {icon}
        <p className="font-black">{title}</p>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
    </div>
  )
}
