"use client"

import { AlertTriangle, CheckCircle2, ClipboardList, FileCheck2, Loader2, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type Recommendation = {
  id: string
  type: string
  priority: string
  status: string
  title: string
  description: string
  rationale: string | null
  actionLabel: string | null
  confidence: number | null
  recommendationVersion: number
  clientDecision: string
  currentSituation?: Record<string, unknown> | null
  objectives?: Record<string, unknown> | null
  gaps?: Record<string, unknown> | null
  recommendedSolution?: Record<string, unknown> | null
  recommendationReasoning: string | null
  finalText: string | null
  complianceFlags?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  advisorApprovedAt: string | null
  complianceApprovedAt: string | null
  presentedToClientAt: string | null
  clientSignedAt: string | null
  lockedAt: string | null
  reportDocumentId: string | null
  createdAt: string
  client?: { id: string; firstName: string; lastName: string } | null
  relatedProduct?: { id: string; type: string; company: string | null; policyNumber: string | null } | null
  sourceKycVersion?: { id: string; versionNumber: number; lockedAt: string | null } | null
  options?: Array<{ id: string; optionName: string; isSelected: boolean; reasonNotSelected: string | null; notes: string | null }>
  risks?: Array<{ id: string; riskType: string; description: string; explainedToClient: boolean; clientAcknowledged: boolean }>
  documents?: Array<{ id: string; documentType: string; deliveredToClient: boolean; deliveredAt: string | null; document?: { id: string; name: string; status?: string | null; fileUrl?: string | null; url?: string | null } | null }>
  versions?: Array<{ id: string; versionNumber: number; createdAt: string }>
}

type Consent = {
  id: string
  type: string
  status: string
  purpose?: { id: string; code: string; name: string } | null
}

type ConsentPurposeCode = "kyc_use" | "insurance_needs_analysis" | "document_vault" | "insurer_disclosure"
type RecommendationAction = "reviewed" | "dismiss" | "complete" | "convert-to-task" | "suitability-report" | "generate-draft" | "validate" | "advisor-approval" | "compliance-approval" | "generate-report" | "pandadoc-signature" | "client-accept" | "client-decline" | "lock"

const consentPurposeLabels: Record<ConsentPurposeCode, string> = {
  kyc_use: "Utilisation du profil client",
  insurance_needs_analysis: "Analyse des besoins",
  document_vault: "Conservation documentaire",
  insurer_disclosure: "Communication / remise sécurisée",
}

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

const typeLabels: Record<string, string> = {
  PROTECTION: "Protection",
  INVESTMENT_REVIEW: "Révision placement",
  COMPLIANCE: "Conformité",
  FOLLOW_UP: "Suivi",
  CROSS_SELL_OPPORTUNITY: "Discussion potentielle",
  DATA_QUALITY: "Qualité des données",
  LIFE_INSURANCE: "Assurance vie",
  DISABILITY_INSURANCE: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS_INSURANCE: "Assurance entreprise",
  REPLACEMENT: "Remplacement",
  INVESTMENT: "Placement",
  MAINTAIN: "Maintien",
  NO_ACTION: "Aucune action",
  CLIENT_DECLINED: "Refus client",
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Non commencée",
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  OPTIONS_REQUIRED: "Options à compléter",
  OPEN: "Ouverte",
  ADVISOR_REVIEW: "En révision conseiller",
  REVIEWED: "Consultée",
  COMPLIANCE_REVIEW_REQUIRED: "Révision conformité requise",
  ADVISOR_APPROVED: "Approuvée conseiller",
  COMPLIANCE_APPROVED: "Approuvée conformité",
  PRESENTED_TO_CLIENT: "Présentée au client",
  CLIENT_ACCEPTED: "Acceptée par le client",
  CLIENT_DECLINED: "Refusée par le client",
  SIGNED: "Signée",
  USED_FOR_PROPOSAL: "Utilisée pour proposition",
  LOCKED: "Verrouillée",
  NEEDS_UPDATE: "À mettre à jour",
  DISMISSED: "Ignorée",
  CONVERTED_TO_TASK: "Convertie en tâche",
  COMPLETED: "Complétée",
  ARCHIVED: "Archivée",
}

const priorityTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  LOW: "emerald",
  MEDIUM: "sky",
  HIGH: "amber",
  CRITICAL: "rose",
}

const statusTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  OPEN: "amber",
  DRAFT: "sky",
  MISSING_DATA: "rose",
  OPTIONS_REQUIRED: "amber",
  ADVISOR_REVIEW: "violet",
  REVIEWED: "sky",
  COMPLIANCE_REVIEW_REQUIRED: "rose",
  ADVISOR_APPROVED: "emerald",
  COMPLIANCE_APPROVED: "emerald",
  PRESENTED_TO_CLIENT: "sky",
  CLIENT_ACCEPTED: "emerald",
  CLIENT_DECLINED: "rose",
  SIGNED: "emerald",
  USED_FOR_PROPOSAL: "violet",
  LOCKED: "slate",
  NEEDS_UPDATE: "amber",
  DISMISSED: "slate",
  CONVERTED_TO_TASK: "violet",
  COMPLETED: "emerald",
  ARCHIVED: "slate",
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { ok?: boolean; data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function pandaDocStatusLabel(status?: unknown) {
  const value = String(status ?? "").toLowerCase()
  if (!value) return "Non envoyée"
  if (value.includes("completed")) return "Signée"
  if (value.includes("sent") || value.includes("viewed") || value.includes("waiting")) return "En attente client"
  if (value.includes("declined") || value.includes("expired") || value.includes("failed") || value.includes("voided") || value.includes("deleted")) return "À relancer"
  return String(status)
}

function requiredPurposesForAction(action: RecommendationAction): ConsentPurposeCode[] {
  if (["generate-report", "suitability-report"].includes(action)) return ["kyc_use", "insurance_needs_analysis", "document_vault"]
  if (action === "pandadoc-signature") return ["kyc_use", "insurance_needs_analysis", "document_vault", "insurer_disclosure"]
  if (["generate-draft", "validate", "advisor-approval", "compliance-approval", "client-accept", "client-decline", "lock"].includes(action)) return ["kyc_use", "insurance_needs_analysis"]
  return []
}

export function ClientRecommendationsTab({ clientId }: { clientId: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("")

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true)
      setError(null)
      try {
        const params = statusFilter ? `?status=${statusFilter}` : ""
      const [recommendationsResponse, consentsResponse] = await Promise.all([
        fetch(`/api/clients/${clientId}/recommendations${params}`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/consents`, { cache: "no-store" }),
      ])
      setRecommendations(await readData<Recommendation[]>(recommendationsResponse))
      setConsents(await readData<Consent[]>(consentsResponse))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de récupérer les recommandations.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecommendations()
  }, [loadRecommendations])

  const summary = useMemo(() => {
    return {
      open: recommendations.filter((recommendation) => recommendation.status === "OPEN").length,
      critical: recommendations.filter((recommendation) => recommendation.priority === "CRITICAL").length,
      high: recommendations.filter((recommendation) => recommendation.priority === "HIGH").length,
      advisorReview: recommendations.filter((recommendation) => ["ADVISOR_REVIEW", "COMPLIANCE_REVIEW_REQUIRED"].includes(recommendation.status)).length,
      reports: recommendations.filter((recommendation) => recommendation.reportDocumentId).length,
      signatures: recommendations.filter((recommendation) => recommendation.clientSignedAt || recommendation.status === "SIGNED").length,
    }
  }, [recommendations])

  const activePurposeCodes = useMemo(() => {
    return new Set(
      consents
        .filter((consent) => consent.status === "GIVEN")
        .map((consent) => consent.purpose?.code)
        .filter((code): code is ConsentPurposeCode => Boolean(code && code in consentPurposeLabels))
    )
  }, [consents])

  const missingBasePurposes = useMemo(() => {
    return requiredPurposesForAction("generate-draft").filter((code) => !activePurposeCodes.has(code))
  }, [activePurposeCodes])

  function missingPurposesFor(action: RecommendationAction) {
    return requiredPurposesForAction(action).filter((code) => !activePurposeCodes.has(code))
  }

  function isActionBlocked(action: RecommendationAction) {
    return missingPurposesFor(action).length > 0
  }

  async function generate() {
    setIsGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/recommendations/generate`, { method: "POST" })
      await readData<Recommendation[]>(response)
      setNotice("Recommandations recalculées.")
      await loadRecommendations()
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Impossible de recalculer les recommandations.")
    } finally {
      setIsGenerating(false)
    }
  }

  async function runAction(id: string, action: "reviewed" | "dismiss" | "complete" | "convert-to-task" | "suitability-report" | "generate-draft" | "validate" | "advisor-approval" | "compliance-approval" | "generate-report" | "pandadoc-signature" | "client-accept" | "client-decline" | "lock") {
    setActionId(id)
    setError(null)
    setNotice(null)
    try {
      const endpoint = action === "client-accept" || action === "client-decline" ? "client-decision" : action === "pandadoc-signature" ? "signature/pandadoc" : action
      const method = ["reviewed", "dismiss", "complete"].includes(action) ? "PATCH" : "POST"
      const response = await fetch(`/api/recommendations/${id}/${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: action === "dismiss"
          ? JSON.stringify({ reason: "Non pertinent pour le moment." })
          : action === "client-accept"
            ? JSON.stringify({ decision: "ACCEPTED", note: "Acceptation documentée depuis le CRM." })
            : action === "client-decline"
              ? JSON.stringify({ decision: "DECLINED", note: "Refus client à discuter et détailler dans les notes conseiller." })
              : "{}",
      })
      await readData<unknown>(response)
      setNotice(
        action === "generate-draft"
          ? "Brouillon documenté généré."
          : action === "validate"
            ? "Contrôles de recommandation exécutés."
            : action === "advisor-approval"
              ? "Recommandation approuvée par le conseiller."
              : action === "compliance-approval"
                ? "Recommandation approuvée conformité."
                : action === "generate-report"
                  ? "Rapport de recommandation généré."
                  : action === "pandadoc-signature"
                    ? "Recommandation envoyée au client pour signature électronique."
                    : action === "client-accept"
                      ? "Acceptation client documentée."
                      : action === "client-decline"
                        ? "Refus client documenté."
                        : action === "lock"
                          ? "Recommandation verrouillée."
                          : action === "suitability-report"
          ? "Rapport de convenance généré dans Documents."
          : action === "convert-to-task"
          ? "Tâche créée depuis la recommandation."
          : action === "dismiss"
            ? "Recommandation ignorée."
            : action === "complete"
              ? "Recommandation complétée."
              : "Recommandation marquée comme consultée."
      )
      await loadRecommendations()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "L'action n'a pas pu être effectuée.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="space-y-6">
      <ContentCard title="Recommandations internes">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm leading-6 text-slate-600">
              Ces recommandations sont des pistes de suivi internes. Elles ne remplacent pas l’analyse professionnelle du conseiller.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Ouvertes" value={summary.open} />
              <Metric label="Critiques" value={summary.critical} />
              <Metric label="Priorité haute" value={summary.high} />
              <Metric label="À approuver" value={summary.advisorReview} />
              <Metric label="Rapports" value={summary.reports} />
              <Metric label="Signées" value={summary.signatures} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Filtrer les recommandations"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={generate} disabled={isGenerating || missingBasePurposes.length > 0}>
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recalculer
            </Button>
          </div>
        </div>
        {missingBasePurposes.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-950">Consentements requis avant recommandation</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                  {missingBasePurposes.map((code) => consentPurposeLabels[code]).join(", ")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </ContentCard>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-[1.5rem] border border-slate-100 bg-white shadow-sm" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <ContentCard title="Aucune recommandation active">
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <p>Le dossier semble à jour selon les règles internes actuelles.</p>
          </div>
        </ContentCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((recommendation) => (
            <article
              key={recommendation.id}
              className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={priorityTone[recommendation.priority] ?? "slate"}>
                  {priorityLabels[recommendation.priority] ?? recommendation.priority}
                </StatusBadge>
                <StatusBadge tone="violet">{typeLabels[recommendation.type] ?? recommendation.type}</StatusBadge>
                <StatusBadge tone={statusTone[recommendation.status] ?? "slate"}>
                  {statusLabels[recommendation.status] ?? recommendation.status}
                </StatusBadge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{recommendation.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.description}</p>
              {recommendation.finalText ?? recommendation.recommendationReasoning ?? recommendation.rationale ? (
                <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{recommendation.finalText ?? recommendation.recommendationReasoning ?? recommendation.rationale}</p>
              ) : null}
              <div className="mt-4 grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950 sm:grid-cols-2">
                <span>Version: v{recommendation.recommendationVersion}</span>
                <span>Profil client: {recommendation.sourceKycVersion ? `v${recommendation.sourceKycVersion.versionNumber}` : "À lier"}</span>
                <span>Décision client: {recommendation.clientDecision}</span>
                <span>Rapport: {recommendation.reportDocumentId ? "Généré" : "À générer"}</span>
              </div>
              <SignatureProof recommendation={recommendation} />
              {recommendation.options?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Options analysées</p>
                  <div className="mt-2 space-y-2">
                    {recommendation.options.slice(0, 4).map((option) => (
                      <p key={option.id} className="rounded-xl bg-white p-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-100">
                        {option.isSelected ? "[Retenue] " : "[Non retenue] "}{option.optionName}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {recommendation.risks?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Risques et limites</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{recommendation.risks.slice(0, 2).map((risk) => risk.description).join(" ")}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>{formatDate(recommendation.createdAt)}</span>
                {recommendation.confidence ? <span>Indice interne: {Math.round(recommendation.confidence * 100)} %</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id} onClick={() => runAction(recommendation.id, "reviewed")}>
                  <CheckCircle2 className="size-4" />
                  Consultée
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("generate-draft")} onClick={() => runAction(recommendation.id, "generate-draft")}>
                  <FileCheck2 className="size-4" />
                  Générer brouillon
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("advisor-approval")} onClick={() => runAction(recommendation.id, "advisor-approval")}>
                  <ShieldCheck className="size-4" />
                  Approuver
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("compliance-approval")} onClick={() => runAction(recommendation.id, "compliance-approval")}>
                  <AlertTriangle className="size-4" />
                  Conformité
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id} onClick={() => runAction(recommendation.id, "convert-to-task")}>
                  <ClipboardList className="size-4" />
                  Créer tâche
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("suitability-report")} onClick={() => runAction(recommendation.id, "suitability-report")}>
                  <FileCheck2 className="size-4" />
                  Rapport convenance
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("generate-report")} onClick={() => runAction(recommendation.id, "generate-report")}>
                  <FileCheck2 className="size-4" />
                  Rapport reco
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || !recommendation.reportDocumentId || Boolean(recommendation.clientSignedAt) || isActionBlocked("pandadoc-signature")} onClick={() => runAction(recommendation.id, "pandadoc-signature")}>
                  <Send className="size-4" />
                  {asRecord(asRecord(recommendation.metadata).pandaDoc).status ? "Relancer signature" : "Envoyer signature"}
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("client-accept")} onClick={() => runAction(recommendation.id, "client-accept")}>
                  <CheckCircle2 className="size-4" />
                  Client accepte
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("client-decline")} onClick={() => runAction(recommendation.id, "client-decline")}>
                  <XCircle className="size-4" />
                  Client refuse
                </Button>
                <Button variant="outline" className="rounded-2xl" disabled={actionId === recommendation.id || isActionBlocked("lock")} onClick={() => runAction(recommendation.id, "lock")}>
                  <ShieldCheck className="size-4" />
                  Verrouiller
                </Button>
                <Button variant="ghost" className="rounded-2xl text-slate-500" disabled={actionId === recommendation.id} onClick={() => runAction(recommendation.id, "dismiss")}>
                  <XCircle className="size-4" />
                  Ignorer
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function SignatureProof({ recommendation }: { recommendation: Recommendation }) {
  const pandaDoc = asRecord(asRecord(recommendation.metadata).pandaDoc)
  const signatureDocument = recommendation.documents?.find((document) => document.documentType === "SIGNATURE" || document.document?.status === "VALIDATED")
  const status = recommendation.clientSignedAt ? "document.completed" : pandaDoc.status
  const sentAt = typeof pandaDoc.sentAt === "string" ? pandaDoc.sentAt : null
  const completedAt = typeof pandaDoc.completedAt === "string" ? pandaDoc.completedAt : recommendation.clientSignedAt

  if (!recommendation.reportDocumentId && !status && !signatureDocument) return null

  const statusText = String(status ?? "").toLowerCase()
  const tone = recommendation.clientSignedAt
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : /declined|expired|failed|voided|deleted/.test(statusText)
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : "border-sky-200 bg-sky-50 text-sky-950"

  return (
    <div className={`mt-4 rounded-2xl border p-3 text-xs font-semibold ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Preuve signature</span>
        <span>{pandaDocStatusLabel(status)}</span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <span>Rapport remis : {sentAt ? formatDate(sentAt) : recommendation.presentedToClientAt ? formatDate(recommendation.presentedToClientAt) : "Non remis"}</span>
        <span>Signature reçue : {completedAt ? formatDate(completedAt) : "Non reçue"}</span>
        <span>Document signé : {signatureDocument?.document ? "Archivé" : "Non disponible"}</span>
        <span>Décision : {recommendation.clientDecision}</span>
      </div>
      {signatureDocument?.document ? (
        <a className="mt-2 inline-flex text-xs font-black text-emerald-700 underline-offset-4 hover:underline" href={`/documents/${signatureDocument.document.id}`}>
          Ouvrir le document signé
        </a>
      ) : null}
    </div>
  )
}
