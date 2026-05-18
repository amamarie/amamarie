"use client"

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileWarning,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import type { StatusTone } from "@/types"

type ComplianceView =
  | "all"
  | "kyc_incomplete"
  | "aml_review"
  | "documents"
  | "consents"
  | "identity"
  | "critical_alert"
  | "annual_review"
  | "needs_analysis"
  | "recommendation_signature"
  | "risk_profile"

type ComplianceIssue = {
  id: string
  sourceId: string
  clientId: string
  clientName: string
  advisorName: string
  type: ComplianceView
  title: string
  description: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  score: number
  status: string
  createdAt: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
}

type WorkbenchData = {
  metrics: {
    openAlerts: number
    blockedClients: number
    expiredKyc: number
    requiredDocuments: number
    unclassifiedDocuments: number
    sensitiveDocumentsWithoutConsent: number
    documentExtractionsToValidate: number
    externallySharedDocuments: number
    lockedProofDocuments: number
    expiredVaultDocuments: number
    retentionReviewsDue: number
    missingConsents: number
    recommendationsNotReady: number
    needsAnalysesToReview: number
    analysesToComplete: number
    replacementsToValidate: number
    reportsToDeliver: number
    signaturesToFollow: number
    recommendationSignaturesToFollow: number
    recommendationSignatureFailures: number
    recommendationsSignedToFinalize: number
    kycAwaitingClient: number
    kycAdvisorReview: number
    kycInconsistencies: number
    kycRecommendationBlocked: number
    incompleteKyc: number
    amlReview: number
    annualReviews: number
    openComplianceEvents: number
    openComplaints: number
    openComplianceIncidents: number
    supervisionReviewsOpen: number
    exceptionsPending: number
    blockingChecklistItems: number
    auditReportsGenerated: number
  }
  issues: ComplianceIssue[]
  complianceCenter: {
    events: Array<{
      id: string
      eventCategory: string
      eventTitle: string
      description: string | null
      severity: string
      status: string
      createdAt: string
      client: { id: string; firstName: string; lastName: string } | null
      assignedTo: { id: string; name: string | null; role: string } | null
    }>
    complaints: Array<{
      id: string
      complaintNumber: string
      category: string | null
      severity: string
      status: string
      receivedAt: string
      description: string
      client: { id: string; firstName: string; lastName: string }
      assignedTo: { id: string; name: string | null; role: string } | null
    }>
    incidents: Array<{
      id: string
      incidentNumber: string
      incidentType: string
      riskLevel: string
      seriousHarmRisk: boolean
      status: string
      detectedAt: string
      description: string
      client: { id: string; firstName: string; lastName: string } | null
      assignedTo: { id: string; name: string | null; role: string } | null
    }>
    supervisionReviews: Array<{
      id: string
      reviewType: string
      riskLevel: string
      status: string
      requiredCorrections: string | null
      findings: string | null
      createdAt: string
      client: { id: string; firstName: string; lastName: string } | null
      reviewer: { id: string; name: string | null; role: string } | null
    }>
    exceptions: Array<{
      id: string
      exceptionType: string
      reason: string
      riskLevel: string
      status: string
      createdAt: string
      client: { id: string; firstName: string; lastName: string } | null
      requestedBy: { id: string; name: string | null; role: string } | null
    }>
    checklistResults: Array<{
      id: string
      status: string
      updatedAt: string
      client: { id: string; firstName: string; lastName: string }
      checklist: { id: string; name: string; productType: string }
      item: { id: string; label: string; blocking: boolean; required: boolean } | null
    }>
    auditReports: Array<{
      id: string
      reportType: string
      title: string
      status: string
      generatedAt: string
      signedHash: string | null
      client: { id: string; firstName: string; lastName: string } | null
      createdBy: { id: string; name: string | null; role: string } | null
    }>
  }
  generatedAt: string
}

type PrivacyDashboardData = {
  metrics: {
    expiredConsents: number
    missingKycConsents: number
    clientsMissingRequiredPurposes: number
    openPrivacyRequests: number
    outsideQuebecDisclosures: number
    openIncidents: number
    retentionReviewDocuments: number
    piaDue: number
    vendorsToReview: number
    vendorsWithoutPia: number
    highAccessRiskEvents: number
  }
  purposes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isRequiredForService: boolean
    sensitiveDataAllowed: boolean
    consentRequired: boolean
  }>
  recentPrivacyRequests: Array<{
    id: string
    requestType: string
    status: string
    receivedAt: string
    dueAt: string | null
    client: { id: string; firstName: string; lastName: string }
    assignedTo: { id: string; name: string | null } | null
  }>
  recentDisclosures: Array<{
    id: string
    recipientName: string
    recipientType: string
    disclosedAt: string
    outsideQuebec: boolean
    method: string
    client: { id: string; firstName: string; lastName: string }
    purpose: { id: string; name: string; code: string } | null
  }>
  recentIncidents: Array<{
    id: string
    incidentType: string
    status: string
    riskLevel: string
    seriousHarmRisk: boolean
    affectedClientsCount: number
    detectedAt: string
    detectedBy: { id: string; name: string | null; role: string } | null
  }>
  piasToReview: Array<{
    id: string
    projectName: string
    systemOrVendor: string | null
    outsideQuebec: boolean
    status: string
    reviewDueAt: string | null
    approvedAt: string | null
  }>
  expiredConsentItems: Array<{
    id: string
    type: string
    status: string
    expiresAt: string | null
    client: { id: string; firstName: string; lastName: string }
    purpose: { id: string; name: string; code: string } | null
  }>
  missingKycConsentClients: Array<{
    id: string
    firstName: string
    lastName: string
    updatedAt: string
    advisor: { id: string; name: string | null } | null
  }>
  missingPurposeClients: Array<{
    id: string
    firstName: string
    lastName: string
    updatedAt: string
    advisor: { id: string; name: string | null } | null
    missingRequiredCount: number
    missingActionCount: number
    missingPurposes: Array<{
      id: string
      code: string
      name: string
      isRequiredForService: boolean
    }>
  }>
  retentionDocuments: Array<{
    id: string
    name: string
    type: string
    status: string
    retentionReviewAt: string | null
    client: { id: string; firstName: string; lastName: string } | null
  }>
  accessRiskItems: Array<{
    id: string
    eventType: string
    riskScore: number
    riskLevel: string
    reason: string | null
    createdAt: string
    user: { id: string; name: string | null; role: string } | null
  }>
}

const views: { id: ComplianceView; label: string; description: string }[] = [
  { id: "all", label: "À traiter", description: "Tous les éléments conformité ouverts." },
  { id: "kyc_incomplete", label: "Profils client incomplets", description: "Profils client manquants, incomplets ou expirés." },
  { id: "aml_review", label: "AML / LBA", description: "Source des fonds, source de richesse ou risque AML à valider." },
  { id: "documents", label: "Documents", description: "Documents requis, expirés ou rejetés." },
  { id: "consents", label: "Consentements", description: "Consentements manquants ou non confirmés." },
  { id: "critical_alert", label: "Alertes critiques", description: "Alertes conformité ouvertes à prioriser." },
  { id: "needs_analysis", label: "Analyses", description: "Analyses des besoins à compléter, rapporter ou verrouiller." },
  { id: "recommendation_signature", label: "Signatures recommandations", description: "Recommandations envoyées, signées ou à relancer." },
  { id: "annual_review", label: "Révisions annuelles", description: "Dossiers à revoir ou à planifier." },
  { id: "risk_profile", label: "Profil de risque", description: "Profil manquant, inconnu ou modifié récemment." },
]

const severityTone: Record<ComplianceIssue["severity"], StatusTone> = {
  CRITICAL: "rose",
  HIGH: "amber",
  MEDIUM: "sky",
  LOW: "slate",
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

export default function CompliancePage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<WorkbenchData | null>(null)
  const [privacyData, setPrivacyData] = useState<PrivacyDashboardData | null>(null)
  const [activeView, setActiveView] = useState<ComplianceView>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadWorkbench() {
    setIsLoading(true)
    setError(null)
    try {
      const [workbench, privacy] = await Promise.all([
        readData<WorkbenchData>(await fetch("/api/compliance/workbench", { cache: "no-store" })),
        readData<PrivacyDashboardData>(await fetch("/api/privacy/dashboard", { cache: "no-store" })),
      ])
      setData(workbench)
      setPrivacyData(privacy)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le centre conformité.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkbench()
  }, [])

  useEffect(() => {
    const view = searchParams.get("view")
    if (view && views.some((item) => item.id === view)) {
      setActiveView(view as ComplianceView)
    }
  }, [searchParams])

  const filteredIssues = useMemo(() => {
    const issues = data?.issues ?? []
    if (activeView === "all") return issues
    return issues.filter((issue) => issue.type === activeView)
  }, [activeView, data])

  const activeViewCopy = views.find((view) => view.id === activeView) ?? views[0]

  async function runAction(issue: ComplianceIssue, action: "resolve" | "task" | "note" | "block") {
    setIsSaving(`${action}-${issue.id}`)
    setNotice(null)
    try {
      if (action === "resolve") {
        if (issue.id.startsWith("compliance-event-")) {
          await readData<unknown>(await fetch(`/api/compliance/events/${issue.sourceId}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolutionNote: "Résolu depuis le centre conformité." }),
          }))
          setNotice("Événement conformité marqué comme résolu.")
        } else {
          await readData<unknown>(await fetch(`/api/compliance-alerts/${issue.sourceId}/resolve`, { method: "PATCH" }))
          setNotice("Alerte marquée comme résolue.")
        }
      }

      if (action === "task") {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 1)
        await readData<unknown>(await fetch(`/api/clients/${issue.clientId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Traiter conformité - ${issue.title}`,
            description: `${issue.description}\n\nDossier: ${issue.clientName}`,
            type: "COMPLIANCE",
            priority: issue.severity === "CRITICAL" ? "URGENT" : issue.severity === "HIGH" ? "HIGH" : "NORMAL",
            dueDate: dueDate.toISOString(),
          }),
        }))
        setNotice("Tâche conformité créée.")
      }

      if (action === "note") {
        const content = window.prompt("Note de justification conformité")
        if (!content?.trim()) return
        await readData<unknown>(await fetch(`/api/clients/${issue.clientId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Justification conformité - ${issue.title}`,
            content,
            type: "COMPLIANCE",
            visibility: "COMPLIANCE_ONLY",
          }),
        }))
        setNotice("Note de justification ajoutée.")
      }

      if (action === "block") {
        await readData<unknown>(await fetch(`/api/clients/${issue.clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complianceStatus: "BLOCKED", status: "REVIEW_NEEDED" }),
        }))
        setNotice("Dossier bloqué pour recommandation jusqu’à revue conformité.")
      }

      await loadWorkbench()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action conformité impossible.")
    } finally {
      setIsSaving(null)
    }
  }

  async function runPrivacyAction(action: "incident-task" | "incident-notify-cai" | "incident-notify-clients" | "incident-notify-serious" | "approve-pia" | "request-export" | "request-zip" | "request-encrypted" | "request-close" | "retention-postpone", id: string) {
    setIsSaving(`${action}-${id}`)
    setNotice(null)
    setError(null)
    try {
      if (action === "incident-task") {
        await readData<unknown>(await fetch(`/api/privacy-incidents/${id}/create-task`, { method: "POST" }))
        setNotice("Tâche de traitement d’incident créée.")
      }
      if (action === "incident-notify-cai" || action === "incident-notify-clients" || action === "incident-notify-serious") {
        await readData<unknown>(await fetch(`/api/privacy-incidents/${id}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: action === "incident-notify-cai" ? "CAI" : action === "incident-notify-serious" ? "SERIOUS_HARM" : "CLIENTS" }),
        }))
        setNotice(action === "incident-notify-cai" ? "Avis CAI préparé et journalisé." : action === "incident-notify-serious" ? "Avis CAI, clients et interne générés/journalisés." : "Avis clients généré et journalisé.")
      }
      if (action === "approve-pia") {
        await readData<unknown>(await fetch(`/api/privacy-impact-assessments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "APPROVED" }),
        }))
        setNotice("EFVP approuvée.")
      }
      if (action === "request-export") {
        await readData<unknown>(await fetch(`/api/privacy-requests/${id}/export`, { method: "POST" }))
        setNotice("Export de demande compilé et journalisé.")
      }
      if (action === "request-zip") {
        window.open(`/api/privacy-requests/${id}/export/zip`, "_blank", "noopener,noreferrer")
        setNotice("Export ZIP sécurisé demandé et journalisé.")
      }
      if (action === "request-encrypted") {
        const passphrase = window.prompt("Phrase secrète optionnelle pour chiffrer l’export. Laisser vide pour en générer une.")
        const result = await readData<{ fileName: string; encryption: unknown; passphrase?: string; passphraseNotice?: string }>(await fetch(`/api/privacy-requests/${id}/export/encrypted`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(passphrase ? { passphrase } : {}),
        }))
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = result.fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
        setNotice(result.passphrase ? `Export chiffré généré. Phrase secrète: ${result.passphrase}` : result.passphraseNotice ?? "Export chiffré généré.")
      }
      if (action === "request-close") {
        await readData<unknown>(await fetch(`/api/privacy-requests/${id}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Demande fermée depuis le centre conformité." }),
        }))
        setNotice("Demande confidentialité fermée.")
      }
      if (action === "retention-postpone") {
        const reviewAt = new Date()
        reviewAt.setFullYear(reviewAt.getFullYear() + 1)
        await readData<unknown>(await fetch(`/api/documents/${id}/retention-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policy: "Politique cabinet - revue annuelle",
            action: "REVIEW",
            reason: "Revue effectuée depuis le centre conformité; prochaine révision planifiée.",
            retentionReviewAt: reviewAt.toISOString(),
          }),
        }))
        setNotice("Revue de conservation reportée de 12 mois.")
      }
      await loadWorkbench()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action confidentialité impossible.")
    } finally {
      setIsSaving(null)
    }
  }

  async function runAuditAction(action: "resolve-event" | "approve-exception" | "audit-report" | "cabinet-report" | "evidence-deposit", id: string) {
    setIsSaving(`${action}-${id}`)
    setNotice(null)
    setError(null)
    try {
      if (action === "resolve-event") {
        await readData<unknown>(await fetch(`/api/compliance/events/${id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolutionNote: "Résolu depuis le centre conformité." }),
        }))
        setNotice("Événement conformité résolu.")
      }
      if (action === "approve-exception") {
        await readData<unknown>(await fetch(`/api/compliance/exceptions/${id}/approve`, { method: "POST" }))
        setNotice("Exception conformité approuvée et journalisée.")
      }
      if (action === "audit-report") {
        await readData<unknown>(await fetch(`/api/audit-reports/client/${id}`, { method: "POST" }))
        setNotice("Rapport d’audit client généré avec hash de preuve.")
      }
      if (action === "cabinet-report") {
        await readData<unknown>(await fetch("/api/audit-reports/cabinet", { method: "POST" }))
        setNotice("Rapport d’audit cabinet généré avec hash de preuve.")
      }
      if (action === "evidence-deposit") {
        const result = await readData<unknown[]>(await fetch(`/api/audit-reports/${id}/evidence-deposits`, { method: "POST" }))
        setNotice(`${result.length} dépôt(s) de preuve externe enregistré(s).`)
      }
      await loadWorkbench()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action audit impossible.")
    } finally {
      setIsSaving(null)
    }
  }

  async function installDefaultChecklists() {
    setIsSaving("install-default-checklists")
    setNotice(null)
    setError(null)
    try {
      const result = await readData<{ created: number; skipped: number }>(await fetch("/api/compliance/checklists/defaults/install", { method: "POST" }))
      setNotice(`${result.created} checklist(s) installée(s), ${result.skipped} déjà présente(s).`)
      await loadWorkbench()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Installation des checklists impossible.")
    } finally {
      setIsSaving(null)
    }
  }

  async function runComplianceUtility(action: "sample-supervision" | "import-history" | "verify-audit-chain") {
    setIsSaving(action)
    setNotice(null)
    setError(null)
    try {
      if (action === "sample-supervision") {
        const result = await readData<{ created: number }>(await fetch("/api/compliance/supervision-reviews/sample", { method: "POST" }))
        setNotice(`${result.created} revue(s) de supervision créée(s).`)
      }
      if (action === "import-history") {
        const result = await readData<{ created: number }>(await fetch("/api/compliance/migration/import-history", { method: "POST" }))
        setNotice(`${result.created} événement(s) historiques importé(s) dans l’audit trail.`)
      }
      if (action === "verify-audit-chain") {
        const result = await readData<{ scanned: number; verified: number; unsigned: number; brokenCount: number }>(await fetch("/api/audit-logs/verify-chain", { method: "POST" }))
        setNotice(`Chaîne audit vérifiée: ${result.verified}/${result.scanned} signé(s), ${result.unsigned} historique(s) non signé(s), ${result.brokenCount} rupture(s).`)
      }
      await loadWorkbench()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action conformité impossible.")
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <PageShell
      eyebrow="Centre conformité"
      title="Dossiers à risque et actions conformité"
      description="Une vue opérationnelle pour traiter profils client, AML / LBA, consentements, documents, alertes et blocages avant recommandation."
    >
      <section className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-50">CONFORMITÉ OPÉRATIONNELLE</p>
            <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-tight">Tout ce qui peut bloquer un dossier, au même endroit</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
              Ouvrez le bon onglet client, demandez un document, créez une tâche, documentez une justification ou bloquez une recommandation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void loadWorkbench()}>
              <RefreshCw className="size-4" />
              Rafraîchir
            </Button>
            <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" asChild>
              <Link href="/taches?type=compliance">Tâches conformité</Link>
            </Button>
          </div>
        </div>
      </section>

      {notice ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-black text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-black text-rose-700">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <ComplianceMetric icon={ShieldAlert} label="Alertes ouvertes" value={data?.metrics.openAlerts ?? 0} detail="À traiter" tone={(data?.metrics.openAlerts ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={LockKeyhole} label="Dossiers bloqués" value={data?.metrics.blockedClients ?? 0} detail="Recommandation bloquée" tone="amber" />
        <ComplianceMetric icon={UserRoundCheck} label="Profils expirés" value={data?.metrics.expiredKyc ?? 0} detail="Révision requise" tone="sky" />
        <ComplianceMetric icon={FileWarning} label="Docs requis" value={data?.metrics.requiredDocuments ?? 0} detail="Demandés ou expirés" tone="violet" />
        <ComplianceMetric icon={MessageSquareText} label="Consentements" value={data?.metrics.missingConsents ?? 0} detail="Manquants" tone="amber" />
        <ComplianceMetric icon={ClipboardCheck} label="Analyses" value={data?.metrics.needsAnalysesToReview ?? 0} detail="À finaliser" tone="sky" />
        <ComplianceMetric icon={ClipboardList} label="Reco non prête" value={data?.metrics.recommendationsNotReady ?? 0} detail="À compléter avant conseil" tone="slate" />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <ComplianceMetric icon={FileWarning} label="Docs non classés" value={data?.metrics.unclassifiedDocuments ?? 0} detail="À catégoriser" tone={(data?.metrics.unclassifiedDocuments ?? 0) > 0 ? "amber" : "emerald"} />
        <ComplianceMetric icon={ShieldAlert} label="Sensibles sans consentement" value={data?.metrics.sensitiveDocumentsWithoutConsent ?? 0} detail="Consentement ou revue requis" tone={(data?.metrics.sensitiveDocumentsWithoutConsent ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={ClipboardCheck} label="Extractions à valider" value={data?.metrics.documentExtractionsToValidate ?? 0} detail="Lecture IA non confirmée" tone={(data?.metrics.documentExtractionsToValidate ?? 0) > 0 ? "sky" : "emerald"} />
        <ComplianceMetric icon={ExternalLink} label="Partages externes" value={data?.metrics.externallySharedDocuments ?? 0} detail="Liens ou accès à vérifier" tone={(data?.metrics.externallySharedDocuments ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={LockKeyhole} label="Preuves verrouillées" value={data?.metrics.lockedProofDocuments ?? 0} detail="Documents figés au dossier" tone="slate" />
        <ComplianceMetric icon={FileWarning} label="Docs expirés coffre" value={data?.metrics.expiredVaultDocuments ?? 0} detail="Renouvellement à demander" tone={(data?.metrics.expiredVaultDocuments ?? 0) > 0 ? "amber" : "emerald"} />
        <ComplianceMetric icon={CalendarClock} label="Conservation due" value={data?.metrics.retentionReviewsDue ?? 0} detail="Archivage/destruction à revoir" tone={(data?.metrics.retentionReviewsDue ?? 0) > 0 ? "amber" : "emerald"} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ComplianceMetric icon={ClipboardCheck} label="Analyses à compléter" value={data?.metrics.analysesToComplete ?? 0} detail="Données, calculs ou validation" tone={(data?.metrics.analysesToComplete ?? 0) > 0 ? "amber" : "emerald"} />
        <ComplianceMetric icon={ShieldAlert} label="Remplacements à valider" value={data?.metrics.replacementsToValidate ?? 0} detail="Ancien contrat vs nouveau" tone={(data?.metrics.replacementsToValidate ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={FileWarning} label="Rapports à remettre" value={data?.metrics.reportsToDeliver ?? 0} detail="PDF daté à envoyer" tone={(data?.metrics.reportsToDeliver ?? 0) > 0 ? "violet" : "emerald"} />
        <ComplianceMetric icon={ShieldCheck} label="Signatures à suivre" value={data?.metrics.signaturesToFollow ?? 0} detail="Client ou conseiller" tone={(data?.metrics.signaturesToFollow ?? 0) > 0 ? "sky" : "emerald"} />
        <ComplianceMetric icon={ClipboardList} label="Signatures reco" value={data?.metrics.recommendationSignaturesToFollow ?? 0} detail="Rapports recommandation" tone={(data?.metrics.recommendationSignaturesToFollow ?? 0) > 0 ? "sky" : "emerald"} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ComplianceMetric icon={UserRoundCheck} label="Profils attente client" value={data?.metrics.kycAwaitingClient ?? 0} detail="Confirmation ou formulaire" tone={(data?.metrics.kycAwaitingClient ?? 0) > 0 ? "amber" : "emerald"} />
        <ComplianceMetric icon={ClipboardCheck} label="Profils révision conseiller" value={data?.metrics.kycAdvisorReview ?? 0} detail="Validation professionnelle" tone={(data?.metrics.kycAdvisorReview ?? 0) > 0 ? "sky" : "emerald"} />
        <ComplianceMetric icon={AlertTriangle} label="Incohérences profil" value={data?.metrics.kycInconsistencies ?? 0} detail="Risque, liquidité, levier" tone={(data?.metrics.kycInconsistencies ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={LockKeyhole} label="Reco bloquées profil" value={data?.metrics.kycRecommendationBlocked ?? 0} detail="Profil non utilisable" tone={(data?.metrics.kycRecommendationBlocked ?? 0) > 0 ? "amber" : "emerald"} />
        <ComplianceMetric icon={AlertTriangle} label="Signatures à relancer" value={data?.metrics.recommendationSignatureFailures ?? 0} detail="PandaDoc refusé/expiré/erreur" tone={(data?.metrics.recommendationSignatureFailures ?? 0) > 0 ? "rose" : "emerald"} />
        <ComplianceMetric icon={ShieldCheck} label="Reco signées à finaliser" value={data?.metrics.recommendationsSignedToFinalize ?? 0} detail="Verrouillage ou suite dossier" tone={(data?.metrics.recommendationsSignedToFinalize ?? 0) > 0 ? "amber" : "emerald"} />
      </section>

      <ContentCard title="Conformité & audit trail" description="Événements conformité, plaintes, incidents opérationnels, supervision, exceptions, checklists et rapports d’audit.">
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <QuickComplianceLink href="/compliance/aml" label="AML / LBA-FAT" detail="Sanctions, PPV, fonds, tiers et risque." />
          <QuickComplianceLink href="/compliance/plaintes" label="Registre plaintes" detail="Traitement, délais, AMF et résolution." />
          <QuickComplianceLink href="/compliance/incidents" label="Registre incidents" detail="Risque, avis, mesures et clôture." />
          <QuickComplianceLink href="/compliance/exceptions" label="Exceptions" detail="Dérogations, approbations et échéances." />
          <QuickComplianceLink href="/compliance/supervision" label="Supervision" detail="Dossiers à revoir et corrections." />
        </div>
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Bibliothèque de checklists produit</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Installe les checklists standard pour assurance vie, invalidité, placement et remplacement de contrat.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-2 bg-white font-black"
            disabled={isSaving === "install-default-checklists"}
            onClick={() => void installDefaultChecklists()}
          >
            {isSaving === "install-default-checklists" ? "Installation..." : "Installer les modèles"}
          </Button>
          <Button
            type="button"
            className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800"
            disabled={Boolean(isSaving)}
            onClick={() => void runAuditAction("cabinet-report", "cabinet")}
          >
            Générer audit cabinet
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-2 bg-white font-black"
            disabled={Boolean(isSaving)}
            onClick={() => void runComplianceUtility("sample-supervision")}
          >
            Échantillonnage auto
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-2 bg-white font-black"
            disabled={Boolean(isSaving)}
            onClick={() => void runComplianceUtility("import-history")}
          >
            Import historique
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-2 bg-white font-black"
            disabled={Boolean(isSaving)}
            onClick={() => void runComplianceUtility("verify-audit-chain")}
          >
            Vérifier hash chain
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <ComplianceMetric icon={ClipboardList} label="Événements" value={data?.metrics.openComplianceEvents ?? 0} detail="Ouverts" tone={(data?.metrics.openComplianceEvents ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric icon={ShieldAlert} label="Plaintes" value={data?.metrics.openComplaints ?? 0} detail="Registre ouvert" tone={(data?.metrics.openComplaints ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={AlertTriangle} label="Incidents" value={data?.metrics.openComplianceIncidents ?? 0} detail="Opérationnels" tone={(data?.metrics.openComplianceIncidents ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={UserRoundCheck} label="Supervision" value={data?.metrics.supervisionReviewsOpen ?? 0} detail="Revues ouvertes" tone={(data?.metrics.supervisionReviewsOpen ?? 0) > 0 ? "sky" : "emerald"} />
          <ComplianceMetric icon={LockKeyhole} label="Exceptions" value={data?.metrics.exceptionsPending ?? 0} detail="À approuver" tone={(data?.metrics.exceptionsPending ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric icon={ClipboardCheck} label="Checklists" value={data?.metrics.blockingChecklistItems ?? 0} detail="Items bloquants" tone={(data?.metrics.blockingChecklistItems ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={FileWarning} label="Rapports audit" value={data?.metrics.auditReportsGenerated ?? 0} detail="Générés" tone="slate" />
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <PrivacyList title="Événements conformité" empty="Aucun événement conformité ouvert.">
            {(data?.complianceCenter.events ?? []).map((event) => (
              <PrivacyRow
                key={event.id}
                title={`${event.eventCategory} - ${event.eventTitle}`}
                detail={`${event.status} · ${event.severity} · ${event.client ? `${event.client.firstName} ${event.client.lastName}` : "Cabinet"} · ${formatDate(event.createdAt)}`}
                href={event.client ? `/clients/${event.client.id}?tab=history` : "/compliance"}
                actionLabel="Résoudre"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runAuditAction("resolve-event", event.id)}
                tone={event.severity === "CRITICAL" || event.severity === "HIGH" ? "rose" : event.severity === "IMPORTANT" ? "amber" : "slate"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Plaintes" empty="Aucune plainte ouverte.">
            {(data?.complianceCenter.complaints ?? []).map((complaint) => (
              <PrivacyRow
                key={complaint.id}
                title={`${complaint.complaintNumber} - ${complaint.category ?? "Plainte"}`}
                detail={`${complaint.client.firstName} ${complaint.client.lastName} · ${complaint.status} · ${complaint.severity} · ${formatDate(complaint.receivedAt)}`}
                href={`/clients/${complaint.client.id}?tab=history`}
                actionLabel="Rapport audit"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runAuditAction("audit-report", complaint.client.id)}
                tone={complaint.severity === "CRITICAL" || complaint.severity === "HIGH" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Incidents conformité" empty="Aucun incident conformité ouvert.">
            {(data?.complianceCenter.incidents ?? []).map((incident) => (
              <PrivacyRow
                key={incident.id}
                title={`${incident.incidentNumber} - ${incident.incidentType}`}
                detail={`${incident.client ? `${incident.client.firstName} ${incident.client.lastName} · ` : ""}${incident.status} · ${incident.riskLevel} · ${formatDate(incident.detectedAt)}`}
                href={incident.client ? `/clients/${incident.client.id}?tab=history` : "/compliance"}
                actionLabel={incident.client ? "Rapport audit" : undefined}
                actionDisabled={Boolean(isSaving)}
                onAction={incident.client ? () => void runAuditAction("audit-report", incident.client!.id) : undefined}
                tone={incident.seriousHarmRisk || incident.riskLevel === "CRITICAL" || incident.riskLevel === "HIGH" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Supervision" empty="Aucune revue de supervision ouverte.">
            {(data?.complianceCenter.supervisionReviews ?? []).map((review) => (
              <PrivacyRow
                key={review.id}
                title={`${review.reviewType} - ${review.riskLevel}`}
                detail={`${review.client ? `${review.client.firstName} ${review.client.lastName}` : "Cabinet"} · ${review.status} · ${review.requiredCorrections ?? review.findings ?? "Revue à compléter"}`}
                href={review.client ? `/clients/${review.client.id}?tab=history` : "/compliance"}
                tone={review.riskLevel === "CRITICAL" || review.riskLevel === "HIGH" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Exceptions" empty="Aucune exception à approuver.">
            {(data?.complianceCenter.exceptions ?? []).map((exception) => (
              <PrivacyRow
                key={exception.id}
                title={`${exception.exceptionType} - ${exception.riskLevel}`}
                detail={`${exception.client ? `${exception.client.firstName} ${exception.client.lastName} · ` : ""}${exception.status} · ${exception.reason}`}
                href={exception.client ? `/clients/${exception.client.id}?tab=history` : "/compliance"}
                actionLabel="Approuver"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runAuditAction("approve-exception", exception.id)}
                tone={exception.riskLevel === "CRITICAL" || exception.riskLevel === "HIGH" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Checklists bloquantes" empty="Aucun item bloquant ouvert.">
            {(data?.complianceCenter.checklistResults ?? []).map((result) => (
              <PrivacyRow
                key={result.id}
                title={`${result.checklist.name} - ${result.item?.label ?? "Item"}`}
                detail={`${result.client.firstName} ${result.client.lastName} · ${result.checklist.productType} · ${result.status} · ${formatDate(result.updatedAt)}`}
                href={`/clients/${result.client.id}?tab=history`}
                actionLabel="Rapport audit"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runAuditAction("audit-report", result.client.id)}
                tone={result.status === "EXCEPTION" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Rapports d’audit récents" empty="Aucun rapport d’audit généré.">
            {(data?.complianceCenter.auditReports ?? []).map((report) => (
              <PrivacyRow
                key={report.id}
                title={report.title}
                detail={`${report.reportType} · ${report.status} · ${report.client ? `${report.client.firstName} ${report.client.lastName}` : "Cabinet"} · hash ${report.signedHash?.slice(0, 12) ?? "n/d"}`}
                href={`/api/audit-reports/${report.id}/inspection-zip`}
                actionLabel="Déposer preuve"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runAuditAction("evidence-deposit", report.id)}
                secondaryActionLabel="JSON"
                onSecondaryAction={() => window.open(`/api/audit-reports/${report.id}/download`, "_blank", "noopener,noreferrer")}
                tone="slate"
              />
            ))}
          </PrivacyList>
        </div>
      </ContentCard>

      <ContentCard title="Confidentialité & renseignements personnels" description="Consentements, demandes d’accès, divulgations, incidents, conservation et EFVP.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <ComplianceMetric icon={MessageSquareText} label="Consentements expirés" value={privacyData?.metrics.expiredConsents ?? 0} detail="Renouvellement requis" tone={(privacyData?.metrics.expiredConsents ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric
            icon={UserRoundCheck}
            label="Finalités manquantes"
            value={privacyData?.metrics.clientsMissingRequiredPurposes ?? privacyData?.metrics.missingKycConsents ?? 0}
            detail="Profil, analyse ou coffre"
            tone={(privacyData?.metrics.clientsMissingRequiredPurposes ?? privacyData?.metrics.missingKycConsents ?? 0) > 0 ? "rose" : "emerald"}
          />
          <ComplianceMetric icon={ClipboardList} label="Demandes ouvertes" value={privacyData?.metrics.openPrivacyRequests ?? 0} detail="Accès, portabilité, rectification" tone={(privacyData?.metrics.openPrivacyRequests ?? 0) > 0 ? "sky" : "emerald"} />
          <ComplianceMetric icon={ExternalLink} label="Hors Québec" value={privacyData?.metrics.outsideQuebecDisclosures ?? 0} detail="Divulgations journalisées" tone={(privacyData?.metrics.outsideQuebecDisclosures ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric icon={ShieldAlert} label="Incidents ouverts" value={privacyData?.metrics.openIncidents ?? 0} detail="Registre incident" tone={(privacyData?.metrics.openIncidents ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={CalendarClock} label="Conservation PRP" value={privacyData?.metrics.retentionReviewDocuments ?? 0} detail="Réviser/destruction" tone={(privacyData?.metrics.retentionReviewDocuments ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric icon={ServerCog} label="EFVP à revoir" value={privacyData?.metrics.piaDue ?? 0} detail="Fournisseurs/projets" tone={(privacyData?.metrics.piaDue ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={ServerCog} label="Fournisseurs" value={privacyData?.metrics.vendorsToReview ?? 0} detail="Revue ou statut à corriger" tone={(privacyData?.metrics.vendorsToReview ?? 0) > 0 ? "amber" : "emerald"} />
          <ComplianceMetric icon={ShieldAlert} label="Fournisseurs à risque" value={privacyData?.metrics.vendorsWithoutPia ?? 0} detail="Hors Québec sans EFVP/contrat" tone={(privacyData?.metrics.vendorsWithoutPia ?? 0) > 0 ? "rose" : "emerald"} />
          <ComplianceMetric icon={LockKeyhole} label="Accès à risque" value={privacyData?.metrics.highAccessRiskEvents ?? 0} detail="Anomalies à réviser" tone={(privacyData?.metrics.highAccessRiskEvents ?? 0) > 0 ? "rose" : "emerald"} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(privacyData?.purposes ?? []).slice(0, 6).map((purpose) => (
            <div key={purpose.id} className="rounded-[1.1rem] border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-950">{purpose.name}</p>
                {purpose.isRequiredForService ? <StatusBadge tone="amber">Service</StatusBadge> : <StatusBadge tone="slate">Optionnel</StatusBadge>}
                {purpose.sensitiveDataAllowed ? <StatusBadge tone="rose">Sensible</StatusBadge> : null}
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{purpose.description ?? "Finalité configurée pour les consentements client."}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <PrivacyList title="Demandes client" empty="Aucune demande ouverte.">
            {(privacyData?.recentPrivacyRequests ?? []).map((request) => (
              <PrivacyRow
                key={request.id}
                title={`${request.client.firstName} ${request.client.lastName} - ${request.requestType}`}
                detail={`${request.status} · reçue ${formatDate(request.receivedAt)} · échéance ${formatDate(request.dueAt)}`}
                href={`/clients/${request.client.id}`}
                actionLabel="Export chiffré"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runPrivacyAction("request-encrypted", request.id)}
                secondaryActionLabel="Fermer"
                onSecondaryAction={() => void runPrivacyAction("request-close", request.id)}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Divulgations récentes" empty="Aucune divulgation journalisée.">
            {(privacyData?.recentDisclosures ?? []).map((disclosure) => (
              <PrivacyRow
                key={disclosure.id}
                title={`${disclosure.recipientName} - ${disclosure.recipientType}`}
                detail={`${disclosure.client.firstName} ${disclosure.client.lastName} · ${disclosure.purpose?.name ?? "Finalité à préciser"} · ${disclosure.outsideQuebec ? "Hors Québec" : disclosure.method}`}
                href={`/clients/${disclosure.client.id}`}
                tone={disclosure.outsideQuebec ? "amber" : "slate"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Incidents ouverts" empty="Aucun incident ouvert.">
            {(privacyData?.recentIncidents ?? []).map((incident) => (
              <PrivacyRow
                key={incident.id}
                title={`${incident.incidentType} - ${incident.riskLevel}`}
                detail={`${incident.status} · ${incident.affectedClientsCount} client${incident.affectedClientsCount > 1 ? "s" : ""} · ${formatDate(incident.detectedAt)}`}
                actionLabel="Créer tâche"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runPrivacyAction("incident-task", incident.id)}
                secondaryActionLabel={incident.seriousHarmRisk ? "Avis CAI + clients" : "Avis clients"}
                onSecondaryAction={() => void runPrivacyAction(incident.seriousHarmRisk ? "incident-notify-serious" : "incident-notify-clients", incident.id)}
                tone={incident.seriousHarmRisk ? "rose" : "slate"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="EFVP à revoir" empty="Aucune EFVP à revoir.">
            {(privacyData?.piasToReview ?? []).map((pia) => (
              <PrivacyRow
                key={pia.id}
                title={`${pia.projectName}${pia.systemOrVendor ? ` - ${pia.systemOrVendor}` : ""}`}
                detail={`${pia.status} · ${pia.outsideQuebec ? "Hors Québec" : "Interne"} · revue ${formatDate(pia.reviewDueAt)}`}
                actionLabel={pia.status === "APPROVED" ? undefined : "Approuver"}
                actionDisabled={Boolean(isSaving)}
                onAction={pia.status === "APPROVED" ? undefined : () => void runPrivacyAction("approve-pia", pia.id)}
                tone={pia.outsideQuebec && pia.status !== "APPROVED" ? "rose" : "slate"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Consentements expirés" empty="Aucun consentement expiré.">
            {(privacyData?.expiredConsentItems ?? []).map((consent) => (
              <PrivacyRow
                key={consent.id}
                title={`${consent.client.firstName} ${consent.client.lastName} - ${consent.purpose?.name ?? consent.type}`}
                detail={`${consent.status} · expiré ${formatDate(consent.expiresAt)}`}
                href={`/clients/${consent.client.id}`}
                tone="amber"
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Finalités manquantes par client" empty="Aucun dossier avec finalité critique manquante.">
            {(privacyData?.missingPurposeClients ?? []).map((client) => (
              <PrivacyRow
                key={client.id}
                title={`${client.firstName} ${client.lastName}`}
                detail={`${client.missingPurposes.map((purpose) => purpose.name).join(", ")} · Conseiller: ${client.advisor?.name ?? "Non assigné"} · mis à jour ${formatDate(client.updatedAt)}`}
                href={`/clients/${client.id}?tab=compliance#kyc-consents-panel`}
                tone={client.missingRequiredCount > 0 ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Conservation documentaire" empty="Aucun document à revoir.">
            {(privacyData?.retentionDocuments ?? []).map((document) => (
              <PrivacyRow
                key={document.id}
                title={document.name}
                detail={`${document.client ? `${document.client.firstName} ${document.client.lastName}` : "Sans client"} · ${document.type} · revue ${formatDate(document.retentionReviewAt)}`}
                href={document.client ? `/clients/${document.client.id}` : "/documents"}
                actionLabel="Reporter"
                actionDisabled={Boolean(isSaving)}
                onAction={() => void runPrivacyAction("retention-postpone", document.id)}
                tone="amber"
              />
            ))}
          </PrivacyList>
          <PrivacyList title="Accès inhabituels" empty="Aucun accès à risque élevé.">
            {(privacyData?.accessRiskItems ?? []).map((event) => (
              <PrivacyRow
                key={event.id}
                title={`${event.eventType} - ${event.riskScore}/100`}
                detail={`${event.user?.name ?? "Utilisateur inconnu"} · ${event.riskLevel} · ${event.reason ?? "Raison non précisée"} · ${formatDate(event.createdAt)}`}
                href="/compliance"
                tone={event.riskLevel === "CRITICAL" ? "rose" : "amber"}
              />
            ))}
          </PrivacyList>
        </div>
      </ContentCard>

      <section className="rounded-[1.75rem] border-2 border-slate-200 bg-white shadow-[0_8px_0_#f1f5f9]">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vue actuelle</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{activeViewCopy.label}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {activeViewCopy.description} {isLoading ? "Chargement..." : `${filteredIssues.length} élément${filteredIssues.length > 1 ? "s" : ""} affiché${filteredIssues.length > 1 ? "s" : ""}.`}
              </p>
            </div>
            <p className="text-xs font-bold text-slate-500">Dernier recalcul: {formatDate(data?.generatedAt)}</p>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={activeView === view.id
                  ? "shrink-0 rounded-full border-2 border-slate-950 bg-slate-950 px-3 py-2 text-xs font-black text-white"
                  : "shrink-0 rounded-full border-2 border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm font-black text-slate-600">Chargement du centre conformité...</div>
          ) : filteredIssues.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
              <CheckCircle2 className="size-6 text-emerald-700" />
              <p className="mt-3 text-lg font-black text-emerald-950">Aucun élément dans cette vue.</p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">Les dossiers visibles ne présentent pas ce type de blocage actuellement.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredIssues.map((issue) => (
                <ComplianceIssueCard key={issue.id} issue={issue} isSaving={isSaving} onAction={runAction} />
              ))}
            </div>
          )}
        </div>
      </section>

      <ContentCard title="Liens rapides" description="Accès direct aux modules qui alimentent cette page.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <QuickComplianceLink href="/documents?status=required" label="Documents requis" detail="Voir les fichiers demandés ou expirés" />
          <QuickComplianceLink href="/taches?type=compliance" label="Tâches conformité" detail="Suivis assignés au conseiller" />
          <QuickComplianceLink href="/clients?segment=incomplete" label="Dossiers incomplets" detail="Clients avec données manquantes" />
          <QuickComplianceLink href="/recommendations" label="Recommandations" detail="Vérifier ce qui est prêt ou bloqué" />
          <QuickComplianceLink href="/parametres/confidentialite" label="Confidentialité cabinet" detail="Privacy-by-default, fournisseurs et masquage" />
        </div>
      </ContentCard>
    </PageShell>
  )
}

function ComplianceMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof ShieldAlert; label: string; value: number; detail: string; tone: "emerald" | "sky" | "violet" | "amber" | "rose" | "slate" }) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_6px_0_#bbf7d0]",
    sky: "border-sky-200 bg-sky-50 text-sky-900 shadow-[0_6px_0_#bae6fd]",
    violet: "border-violet-200 bg-violet-50 text-violet-900 shadow-[0_6px_0_#ddd6fe]",
    amber: "border-amber-200 bg-amber-50 text-amber-900 shadow-[0_6px_0_#fde68a]",
    rose: "border-rose-200 bg-rose-50 text-rose-900 shadow-[0_6px_0_#fecdd3]",
    slate: "border-slate-200 bg-slate-50 text-slate-800 shadow-[0_6px_0_#e2e8f0]",
  }[tone]

  return (
    <div className={`rounded-[1.35rem] border-2 p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="size-5 shrink-0" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </div>
  )
}

function ComplianceIssueCard({ issue, isSaving, onAction }: { issue: ComplianceIssue; isSaving: string | null; onAction: (issue: ComplianceIssue, action: "resolve" | "task" | "note" | "block") => void }) {
  const canResolve = issue.id.startsWith("alert-") || issue.id.startsWith("compliance-event-")

  return (
    <article className="rounded-[1.35rem] border-2 border-slate-100 bg-white p-4 shadow-[0_6px_0_#f1f5f9]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={severityTone[issue.severity]}>{issue.severity}</StatusBadge>
            <StatusBadge tone="slate">{issue.status}</StatusBadge>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Score {issue.score}</p>
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">{issue.title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{issue.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
            <span>Client: <Link className="text-slate-900 hover:text-emerald-700" href={`/clients/${issue.clientId}`}>{issue.clientName}</Link></span>
            <span>Conseiller: {issue.advisorName}</span>
            <span>Référence: {formatDate(issue.createdAt)}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[440px]">
          <Button className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" asChild>
            <Link href={issue.primaryHref}>
              <ExternalLink className="size-4" />
              {issue.primaryLabel}
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full border-2 font-black" asChild>
            <Link href={issue.secondaryHref}>Voir module lié</Link>
          </Button>
          <Button variant="outline" className="rounded-full border-2 font-black" disabled={Boolean(isSaving)} onClick={() => onAction(issue, "task")}>
            Créer tâche
          </Button>
          <Button variant="outline" className="rounded-full border-2 font-black" disabled={Boolean(isSaving)} onClick={() => onAction(issue, "note")}>
            Justifier
          </Button>
          {canResolve ? (
            <Button variant="outline" className="rounded-full border-2 border-emerald-200 font-black text-emerald-700 hover:bg-emerald-50" disabled={Boolean(isSaving)} onClick={() => onAction(issue, "resolve")}>
              Résoudre
            </Button>
          ) : null}
          <Button variant="outline" className="rounded-full border-2 border-rose-200 font-black text-rose-700 hover:bg-rose-50" disabled={Boolean(isSaving)} onClick={() => onAction(issue, "block")}>
            Bloquer reco
          </Button>
        </div>
      </div>
    </article>
  )
}

function PrivacyList({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-3 grid gap-2">
        {isEmpty ? <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">{empty}</p> : items}
      </div>
    </div>
  )
}

function PrivacyRow({
  title,
  detail,
  href,
  actionLabel,
  actionDisabled,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = "slate",
}: {
  title: string
  detail: string
  href?: string
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  tone?: "slate" | "amber" | "rose"
}) {
  const toneClass = {
    slate: "border-slate-100 bg-slate-50",
    amber: "border-amber-100 bg-amber-50",
    rose: "border-rose-100 bg-rose-50",
  }[tone]
  const content = (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
        </div>
        {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actionLabel && onAction ? (
              <Button type="button" variant="outline" size="sm" className="rounded-full bg-white text-xs font-black" disabled={actionDisabled} onClick={(event) => { event.preventDefault(); onAction() }}>
                {actionLabel}
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button type="button" variant="outline" size="sm" className="rounded-full bg-white text-xs font-black" disabled={actionDisabled} onClick={(event) => { event.preventDefault(); onSecondaryAction() }}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function QuickComplianceLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-white">
      <p className="font-black text-slate-950">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{detail}</p>
    </Link>
  )
}
