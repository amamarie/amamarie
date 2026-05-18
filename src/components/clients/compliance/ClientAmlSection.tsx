"use client"

import { FileText, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type AmlProfileData = {
  id: string
  status: string
  riskScore: number
  riskLevel: string
  riskRationale: string | null
  identityStatus: string
  sourceOfFundsStatus: string
  sourceOfWealthStatus: string
  thirdPartyStatus: string
  beneficialOwnershipStatus: string
  pepStatus: string
  sanctionsStatus: string
  enhancedMonitoring: boolean
  seniorReviewRequired: boolean
  nextReviewAt: string | null
  alerts: Array<{ id: string; alertType: string; severity: string; message: string; blocking: boolean }>
  scoreComponents: Array<{ id: string; componentType: string; label: string; score: number; rationale: string | null }>
  monitoringEvents: Array<{ id: string; eventType: string; eventTitle: string; riskImpact: number; status: string; createdAt: string }>
  sanctionsScreenings: Array<{ id: string; result: string; decision: string; matchedList: string | null; matchedName: string | null; createdAt: string }>
  pepScreenings: Array<{ id: string; result: string; pepType: string | null; reviewedAt: string | null; seniorManagementReviewRequired: boolean; createdAt: string }>
  reviews: Array<{ id: string; reviewType: string; decision: string; riskLevelBefore: string | null; riskLevelAfter: string | null; reviewedAt: string | null }>
  internalReports: Array<{ id: string; reportType: string; status: string; decision: string; createdAt: string }>
}

type IdvProviderStatusData = {
  name: string
  configured: boolean
  hasApiKey: boolean
  hasBaseUrl: boolean
  hasWorkflowId: boolean
  hasWebhookSecret: boolean
  callbackUrlConfigured: boolean
  startPath: string
  webhookPath: string
  missing: string[]
}

type ApiResponse = { ok: true; data: { profile: AmlProfileData } } | { ok: false; error: { message: string } }
type IdvStatusResponse = { ok: true; data: { status: IdvProviderStatusData } } | { ok: false; error: { message: string } }
type PostPayload = { ok?: boolean; data?: { report?: { id: string } }; error?: { message: string } } | null

const riskLevelLabels: Record<string, string> = {
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  CRITICAL: "Critique",
}

const amlStatusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING_REVIEW: "À réviser",
  BLOCKED: "Bloqué",
  ARCHIVED: "Archivé",
  VERIFIED: "Vérifiée",
  VALIDATED: "Validée",
  NOT_REQUIRED: "Non requis",
  NOT_APPLICABLE: "Non applicable",
  TO_VERIFY: "À vérifier",
  UNKNOWN: "À confirmer",
  FAILED: "Échec",
  NO_THIRD_PARTY: "Aucun tiers",
  THIRD_PARTY_INVOLVED: "Tiers impliqué",
  NO_MATCH: "Aucun match",
  POTENTIAL_MATCH: "Match potentiel",
  CONFIRMED_MATCH: "Match confirmé",
  NOT_SCREENED: "À vérifier",
  COMPLETED: "Complété",
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  FALSE_POSITIVE: "Faux positif",
  CONFIRMED: "Confirmé",
  POSITIVE: "Positif",
  MANUAL_REVIEW: "Revue manuelle",
  COMPLIANCE_REVIEW: "Revue conformité",
  SUSPICIOUS_TRANSACTION_REVIEW: "Analyse d’opération douteuse",
}

const amlStepDescriptions: Record<string, string> = {
  identityStatus: "Confirmer l’identité lorsque la règle AML l’exige.",
  sourceOfFundsStatus: "Documenter l’origine de l’argent utilisé pour l’opération.",
  sourceOfWealthStatus: "Documenter comment le client a constitué son patrimoine.",
  thirdPartyStatus: "Vérifier si une autre personne paie, donne les instructions ou bénéficie de l’opération.",
  beneficialOwnershipStatus: "Identifier les personnes physiques qui contrôlent une entité, si applicable.",
  pepStatus: "Vérifier PPV / DOI et les personnes liées.",
  sanctionsStatus: "Faire le filtrage sanctions avant une opération sensible.",
}

function tone(value: string) {
  if (["CRITICAL", "HIGH", "BLOCKED", "CONFIRMED_MATCH", "FAILED"].includes(value)) return "rose"
  if (["IMPORTANT", "MEDIUM", "TO_REVIEW", "POTENTIAL_MATCH", "COMPLIANCE_REVIEW", "TO_VERIFY", "UNKNOWN", "NOT_SCREENED"].includes(value)) return "amber"
  if (["LOW", "ACTIVE", "VERIFIED", "VALIDATED", "NO_MATCH", "NO_THIRD_PARTY", "COMPLETED", "NOT_APPLICABLE", "NOT_REQUIRED"].includes(value)) return "emerald"
  return "slate"
}

function labelStatus(value: string) {
  return amlStatusLabels[value] ?? riskLevelLabels[value] ?? value.replaceAll("_", " ").toLowerCase()
}

function statusState(value: string) {
  if (["VERIFIED", "VALIDATED", "NO_MATCH", "NO_THIRD_PARTY", "COMPLETED", "NOT_APPLICABLE", "NOT_REQUIRED"].includes(value)) return "ok"
  if (["FAILED", "BLOCKED", "CONFIRMED_MATCH"].includes(value)) return "blocked"
  return "todo"
}

function statusStateLabel(value: string) {
  const state = statusState(value)
  if (state === "ok") return "OK"
  if (state === "blocked") return "Bloquant"
  return "À faire"
}

function statusStateTone(value: string) {
  const state = statusState(value)
  if (state === "ok") return "emerald"
  if (state === "blocked") return "rose"
  return "amber"
}

function uniqueScoreComponents(components: AmlProfileData["scoreComponents"]) {
  return Array.from(
    new Map(components.map((component) => [`${component.label}-${component.score}-${component.rationale ?? ""}`, component])).values()
  )
}

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

async function parseResponse(response: Response): Promise<ApiResponse> {
  const payload = await response.json().catch(() => null)
  return payload as ApiResponse
}

export function ClientAmlSection({ clientId }: { clientId: string }) {
  const [profile, setProfile] = useState<AmlProfileData | null>(null)
  const [idvStatus, setIdvStatus] = useState<IdvProviderStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const [response, idvResponse] = await Promise.all([
      fetch(`/api/clients/${clientId}/aml`, { cache: "no-store" }),
      fetch("/api/aml/idv/status", { cache: "no-store" }),
    ])
    const payload = await parseResponse(response)
    if (!payload.ok) {
      setError(payload.error.message)
    } else {
      setProfile(payload.data.profile)
    }
    const idvPayload = await idvResponse.json().catch(() => null) as IdvStatusResponse | null
    if (idvPayload?.ok) setIdvStatus(idvPayload.data.status)
    setIsLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  async function action(path: string, body?: Record<string, unknown>, label = "Action AML inscrite.") {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    })
    const payload = await response.json().catch(() => null) as PostPayload
    if (!response.ok || payload?.ok === false) {
      setError(payload?.error?.message ?? "Action AML impossible.")
    } else {
      if (payload?.data?.report?.id) setReportId(payload.data.report.id)
      setNotice(label)
      await load()
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <ContentCard title="AML / LBA-FAT">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement AML...</div>
      </ContentCard>
    )
  }

  return (
    <ContentCard title="AML / LBA-FAT & sanctions" description="Parcours de vérification contre le blanchiment d’argent, le financement d’activités terroristes et les sanctions.">
      {profile ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={tone(profile.riskLevel)}>Risque {riskLevelLabels[profile.riskLevel] ?? profile.riskLevel}</StatusBadge>
                  <StatusBadge tone={tone(profile.status)}>{labelStatus(profile.status)}</StatusBadge>
                  {profile.alerts.length > 0 ? <StatusBadge tone="rose">{profile.alerts.length} alerte{profile.alerts.length > 1 ? "s" : ""}</StatusBadge> : <StatusBadge tone="emerald">Aucune alerte ouverte</StatusBadge>}
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-950">Résumé AML du dossier</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Le score AML indique le niveau de vigilance requis. Les vérifications ci-dessous indiquent clairement ce qui est complété, ce qui reste à faire et ce qui pourrait bloquer une opération.
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Score AML</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-4xl font-black text-slate-950">{profile.riskScore}</p>
                  <StatusBadge tone={tone(profile.riskLevel)}>{riskLevelLabels[profile.riskLevel] ?? profile.riskLevel}</StatusBadge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Prochaine revue : {formatDate(profile.nextReviewAt)}</p>
              </div>
            </div>
          </div>

          {(() => {
            const latestSanctions = profile.sanctionsScreenings[0]
            const latestPep = profile.pepScreenings[0]
            return (
              <>
                {latestSanctions && (latestSanctions.result === "POTENTIAL_MATCH" || latestSanctions.decision === "PENDING") ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-black text-amber-950">Décision sanctions requise</p>
                        <p className="mt-1 text-sm font-semibold text-amber-800">
                          {latestSanctions.matchedName ?? "Match potentiel"} · {latestSanctions.matchedList ?? "liste non précisée"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => action(`/api/aml/sanctions-screenings/${latestSanctions.id}/decision`, { decision: "FALSE_POSITIVE", decisionReason: "Faux positif confirmé après revue conformité." }, "Décision sanctions faux positif inscrite.")}>
                          Faux positif
                        </Button>
                        <Button variant="outline" className="rounded-xl border-rose-200 bg-white text-rose-700" disabled={isSaving} onClick={() => action(`/api/aml/sanctions-screenings/${latestSanctions.id}/decision`, { decision: "CONFIRMED", decisionReason: "Match sanctions confirmé après revue conformité." }, "Match sanctions confirmé.")}>
                          Confirmer
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {latestPep && latestPep.result === "POSITIVE" && !latestPep.reviewedAt ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-black text-sky-950">Revue PPV / DOI requise</p>
                        <p className="mt-1 text-sm font-semibold text-sky-800">{latestPep.pepType ?? "PPV / DOI positif"} · revue haute direction {latestPep.seniorManagementReviewRequired ? "requise" : "à confirmer"}</p>
                      </div>
                      <Button variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => action(`/api/aml/pep-screenings/${latestPep.id}/review`, { notes: "Revue PPV/DOI complétée.", sourceOfFundsRequired: true, sourceOfWealthRequired: true, seniorManagementReviewRequired: true }, "Revue PPV/DOI inscrite.")}>
                        Marquer revu
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )
          })()}

          {idvStatus ? (
            <details className={`rounded-2xl border p-4 ${idvStatus.configured ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className={`text-sm font-black ${idvStatus.configured ? "text-emerald-950" : "text-slate-950"}`}>
                      Vérification d’identité externe
                    </p>
                    <p className={`mt-1 text-sm leading-6 ${idvStatus.configured ? "text-emerald-800" : "text-slate-600"}`}>
                      {idvStatus.configured
                        ? "Le fournisseur IDV est prêt pour créer un lien unique de vérification client."
                        : "La vérification externe n’est pas encore activée. Le conseiller peut quand même documenter l’identité manuellement."}
                    </p>
                  </div>
                  <StatusBadge tone={idvStatus.configured ? "emerald" : "amber"}>{idvStatus.configured ? "Connecté" : "À configurer"}</StatusBadge>
                </div>
              </summary>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnostic technique</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{idvStatus.name} · endpoint {idvStatus.startPath} · webhook {idvStatus.webhookPath}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone={idvStatus.hasApiKey ? "emerald" : "amber"}>Clé API {idvStatus.hasApiKey ? "présente" : "manquante"}</StatusBadge>
                  <StatusBadge tone={idvStatus.hasBaseUrl ? "emerald" : "amber"}>URL {idvStatus.hasBaseUrl ? "présente" : "manquante"}</StatusBadge>
                  <StatusBadge tone={idvStatus.hasWorkflowId ? "emerald" : "amber"}>Workflow {idvStatus.hasWorkflowId ? "présent" : "manquant"}</StatusBadge>
                  <StatusBadge tone={idvStatus.callbackUrlConfigured ? "emerald" : "amber"}>Callback {idvStatus.callbackUrlConfigured ? "configuré" : "à définir"}</StatusBadge>
                  <StatusBadge tone={idvStatus.hasWebhookSecret ? "emerald" : "slate"}>Signature webhook {idvStatus.hasWebhookSecret ? "active" : "optionnelle"}</StatusBadge>
                </div>
                {!idvStatus.configured ? (
                  <p className="mt-3 text-xs font-semibold text-slate-600">
                    Variables à ajouter côté serveur : {idvStatus.missing.join(", ")}. La clé doit rester dans `.env.local`, jamais dans le code.
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">Vérifications AML</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Chaque ligne indique le rôle de la vérification et l’état actuel du dossier.</p>
              </div>
              <StatusBadge tone={profile.sanctionsStatus === "NOT_SCREENED" ? "amber" : "emerald"}>
                {profile.sanctionsStatus === "NOT_SCREENED" ? "Sanctions à vérifier" : "Contrôles à jour"}
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <AmlCheckItem label="Identité du client" value={profile.identityStatus} description={amlStepDescriptions.identityStatus} />
              <AmlCheckItem label="Source des fonds" value={profile.sourceOfFundsStatus} description={amlStepDescriptions.sourceOfFundsStatus} />
              <AmlCheckItem label="Source de la richesse" value={profile.sourceOfWealthStatus} description={amlStepDescriptions.sourceOfWealthStatus} />
              <AmlCheckItem label="Tiers ou payeur différent" value={profile.thirdPartyStatus} description={amlStepDescriptions.thirdPartyStatus} />
              <AmlCheckItem label="Bénéficiaires effectifs" value={profile.beneficialOwnershipStatus} description={amlStepDescriptions.beneficialOwnershipStatus} />
              <AmlCheckItem label="PPV / DOI" value={profile.pepStatus} description={amlStepDescriptions.pepStatus} />
              <AmlCheckItem label="Sanctions" value={profile.sanctionsStatus} description={amlStepDescriptions.sanctionsStatus} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-black text-slate-950">Pourquoi ce score ?</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {profile.riskRationale ?? "Aucun facteur défavorable détecté."}
              {profile.sanctionsStatus === "NOT_SCREENED" ? " Le filtrage sanctions reste à compléter, ce qui ajoute du risque tant qu’il n’est pas documenté." : ""}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {uniqueScoreComponents(profile.scoreComponents).map((component) => (
                <div key={component.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{component.label}</p>
                    <StatusBadge tone={component.score > 0 ? "amber" : "emerald"}>+{component.score}</StatusBadge>
                  </div>
                  {component.rationale ? <p className="mt-1 text-xs leading-5 text-slate-500">{component.rationale}</p> : null}
                </div>
              ))}
            </div>
          </div>

          {profile.alerts.length > 0 ? (
            <div className="space-y-2">
              {profile.alerts.map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-rose-950">{alert.message}</p>
                    <p className="mt-1 text-xs font-semibold text-rose-700">{alert.alertType}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={tone(alert.severity)}>{alert.severity}</StatusBadge>
                    {alert.blocking ? <StatusBadge tone="rose">Bloquant</StatusBadge> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {profile.monitoringEvents.length > 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Surveillance continue</p>
              <div className="mt-3 grid gap-2">
                {profile.monitoringEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{event.eventTitle}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{event.eventType} · impact +{event.riskImpact}</p>
                    </div>
                    <StatusBadge tone={tone(event.status)}>{labelStatus(event.status)}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(profile.reviews.length > 0 || profile.internalReports.length > 0) ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-black text-slate-950">Revues AML</p>
                <div className="mt-3 grid gap-2">
                  {profile.reviews.slice(0, 4).map((review) => (
                    <div key={review.id} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-bold text-slate-900">{labelStatus(review.reviewType)} · {labelStatus(review.decision)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{labelStatus(review.riskLevelBefore ?? "-")} → {labelStatus(review.riskLevelAfter ?? "-")}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-black text-slate-950">Déclarations internes</p>
                <div className="mt-3 grid gap-2">
                  {profile.internalReports.slice(0, 4).map((report) => (
                    <div key={report.id} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-bold text-slate-900">{labelStatus(report.reportType)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{labelStatus(report.status)} · {labelStatus(report.decision)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">Actions guidées</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Utilise ces actions dans l’ordre naturel du dossier : identité, contrôles AML, puis revue conformité.
                </p>
              </div>
              <Button variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/aml/recalculate`, {}, "Score AML recalculé.")}>
                <RefreshCw className="mr-2 size-4" /> Recalculer le score
              </Button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <AmlActionGroup
                title="1. Vérifier l’identité"
                description="À faire lorsque l’identité est requise par la règle AML ou lorsqu’une opération sensible est en cours."
              >
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/identity-verifications`, { result: "PASSED", method: "DOCUMENT_REVIEW" }, "Identité AML documentée.")}>
                  <ShieldCheck className="mr-2 size-4" /> Documenter l’identité vérifiée
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/identity-verifications/provider/start`, {}, "Session IDV fournisseur démarrée.")}>
                  <ShieldCheck className="mr-2 size-4" /> Démarrer une vérification externe
                </Button>
              </AmlActionGroup>

              <AmlActionGroup
                title="2. Compléter les contrôles"
                description="Ces contrôles expliquent pourquoi le dossier peut avancer ou pourquoi une revue conformité est nécessaire."
              >
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/aml/didit-screening`, { includeAdverseMedia: true }, "Screening AML Didit complété.")}>
                  <ShieldCheck className="mr-2 size-4" /> Lancer le screening Didit AML
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/sanctions-screening`, { result: "NO_MATCH" }, "Screening sanctions inscrit.")}>
                  <ShieldCheck className="mr-2 size-4" /> Confirmer sanctions : aucun match
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/pep-screening`, { result: "NO_MATCH" }, "Questionnaire PPV inscrit.")}>
                  <ShieldCheck className="mr-2 size-4" /> Confirmer PPV / DOI négatif
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/source-of-funds`, { sourceType: "SAVINGS", amount: 0, validated: true }, "Source des fonds inscrite.")}>
                  <ShieldCheck className="mr-2 size-4" /> Documenter la source des fonds
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/source-of-wealth`, { wealthSourceType: "EMPLOYMENT", description: "Patrimoine cohérent avec le profil client.", validated: true }, "Source de richesse inscrite.")}>
                  <ShieldCheck className="mr-2 size-4" /> Documenter la source de richesse
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/third-party-determinations`, { thirdPartyInvolved: false, identityVerified: false }, "Détermination tiers inscrite.")}>
                  <ShieldCheck className="mr-2 size-4" /> Confirmer aucun tiers
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/beneficial-owners`, { ultimateBeneficialOwnerName: "À confirmer", directOwnershipPercentage: 100, identityVerified: true }, "Bénéficiaire effectif inscrit.")}>
                  <ShieldCheck className="mr-2 size-4" /> Ajouter un bénéficiaire effectif
                </Button>
              </AmlActionGroup>

              <AmlActionGroup
                title="3. Revue conformité"
                description="À utiliser si le dossier est à risque, incomplet ou s’il faut conserver une décision formelle."
              >
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/aml/monitoring-events`, { clientId, eventType: "MANUAL_REVIEW", eventTitle: "Revue de surveillance continue AML", riskImpact: 3 }, "Événement de surveillance inscrit.")}>
                  <RefreshCw className="mr-2 size-4" /> Ajouter une surveillance continue
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/aml/reviews`, { reviewType: "COMPLIANCE_REVIEW", decision: "APPROVED", notes: "Revue AML conformité complétée." }, "Revue AML conformité inscrite.")}>
                  <ShieldCheck className="mr-2 size-4" /> Marquer la revue AML complétée
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/aml/internal-reports`, { clientId, reportType: "SUSPICIOUS_TRANSACTION_REVIEW", facts: "Dossier interne AML ouvert pour analyse conformité.", decision: "PENDING" }, "Déclaration interne AML ouverte.")}>
                  <ShieldAlert className="mr-2 size-4" /> Ouvrir un dossier interne
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" disabled={isSaving} onClick={() => action(`/api/aml/reports/client/${clientId}`, {}, "Rapport AML client signé généré.")}>
                  <FileText className="mr-2 size-4" /> Générer le rapport AML
                </Button>
                <details className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <summary className="cursor-pointer text-sm font-black text-amber-900">Outils de test</summary>
                  <Button variant="outline" className="mt-3 w-full justify-start rounded-xl border-amber-200 bg-white text-amber-800" disabled={isSaving} onClick={() => action(`/api/clients/${clientId}/sanctions-screening`, { result: "POTENTIAL_MATCH", matchScore: 87, matchedList: "CANADA_CONSOLIDATED" }, "Match sanctions potentiel créé.")}>
                    <ShieldAlert className="mr-2 size-4" /> Simuler un blocage sanctions
                  </Button>
                </details>
              </AmlActionGroup>
            </div>
          </div>
          {reportId ? (
            <a href={`/api/audit-reports/${reportId}/inspection-zip`} className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-100">
              Ouvrir l’export d’inspection AML signé
            </a>
          ) : null}
        </div>
      ) : null}
      {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </ContentCard>
  )
}

function AmlCheckItem({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <StatusBadge tone={statusStateTone(value)}>{statusStateLabel(value)}</StatusBadge>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{labelStatus(value)}</p>
    </div>
  )
}

function AmlActionGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4 grid gap-2">
        {children}
      </div>
    </div>
  )
}
