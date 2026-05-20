"use client"

import { AlertTriangle, BriefcaseBusiness, Calculator, CheckCircle2, Clock3, CopyPlus, FileText, HeartPulse, Loader2, Lock, Plus, RefreshCw, Send, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type AnalysisType = "LIFE" | "DISABILITY" | "CRITICAL_ILLNESS" | "BUSINESS" | "REPLACEMENT"

type AnalysisInput = {
  id: string
  inputKey: string
  label: string | null
  inputValue: { value?: unknown } | unknown
  source: string
  isVerified: boolean
}

type AnalysisResult = {
  id: string
  needCategory: string
  grossNeed: number
  existingCoverage: number
  availableAssetsOffset: number
  netNeed: number
  gapAmount: number
  calculationDetails?: Record<string, unknown> | null
}

type AnalysisAssumption = {
  id: string
  assumptionType: string
  label: string
  numericValue: number | null
  value: string | null
  unit: string | null
  reason: string | null
}

type AnalysisRecommendation = {
  id: string
  recommendedProductType: string
  recommendedAmount: number | null
  recommendedTerm: string | null
  reasoning: string | null
  alternativesConsidered: Array<{ label: string; amount: number; note: string }> | null
}

type Analysis = {
  id: string
  analysisType: AnalysisType
  status: string
  objective: string | null
  summary: string | null
  aiSummary: string | null
  analysisVersion: number
  analysisDate: string
  deliveredAt: string | null
  clientConfirmedAt: string | null
  signedAt: string | null
  lockedAt?: string | null
  advisorValidatedAt?: string | null
  reportDocumentId: string | null
  signatureDocumentId: string | null
  usedForRecommendation: boolean
  opportunityId?: string | null
  opportunity?: { id: string; type: string; status: string; company: string | null; productName: string | null; policyNumber: string | null; contractNumber: string | null } | null
  inputs: AnalysisInput[]
  assumptions: AnalysisAssumption[]
  results: AnalysisResult[]
  recommendations: AnalysisRecommendation[]
  reportDocument?: { id: string; name: string; status: string } | null
  signatureDocument?: { id: string; name: string; status: string } | null
}

type LinkedOpportunity = {
  id: string
  type: string
  status: string
  company: string | null
  productName: string | null
  policyNumber: string | null
  contractNumber: string | null
}

type Consent = {
  id: string
  type: string
  status: string
  purpose?: { id: string; code: string; name: string } | null
}

type ConsentPurposeCode = "insurance_needs_analysis" | "ai_assistance" | "document_vault" | "insurer_disclosure"
type AnalysisAction = "create" | "calculate" | "report" | "pandadoc" | "lock" | "new-version" | "smart-actions" | "smart-document-requests"

const consentPurposeLabels: Record<ConsentPurposeCode, string> = {
  insurance_needs_analysis: "Analyse des besoins",
  ai_assistance: "Assistance technologique / IA",
  document_vault: "Conservation documentaire",
  insurer_disclosure: "Communication / remise sécurisée",
}

const typeLabels: Record<AnalysisType, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Assurance entreprise",
  REPLACEMENT: "Remplacement",
}

const typeDescriptions: Record<AnalysisType, string> = {
  LIFE: "Décès, famille, hypothèque, revenu, legs et protection existante.",
  DISABILITY: "Revenu mensuel, dépenses, dettes, fonds d’urgence et protections invalidité.",
  CRITICAL_ILLNESS: "Liquidités, hypothèque, arrêt temporaire, adaptation et protection existante.",
  BUSINESS: "Personne clé, rachat de parts, dettes commerciales et continuité.",
  REPLACEMENT: "Comparaison ancien/nouveau contrat, garanties perdues et préavis.",
}

const productTypeLabels: Record<string, string> = {
  LIFE_INSURANCE: "Assurance vie",
  DISABILITY_INSURANCE: "Assurance invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  HEALTH_INSURANCE: "Assurance santé",
  GROUP_INSURANCE: "Assurance collective",
  LONG_TERM_CARE: "Soins longue durée",
  TRAVEL_INSURANCE: "Assurance voyage",
  OTHER_INSURANCE: "Autre assurance",
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Non commencée",
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Révision conseiller",
  RECOMMENDATION_PREPARED: "Recommandation préparée",
  WAITING_CLIENT: "Attente confirmation client",
  COMPLETED: "Complétée",
  DELIVERED: "Confirmée par le client",
  USED_FOR_SUBMISSION: "Utilisée pour soumission",
  ARCHIVED: "Archivée",
  NEEDS_UPDATE: "À mettre à jour",
}

const statusTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  DRAFT: "sky",
  MISSING_DATA: "amber",
  RECOMMENDATION_PREPARED: "violet",
  WAITING_CLIENT: "amber",
  DELIVERED: "emerald",
  COMPLETED: "emerald",
  NEEDS_UPDATE: "amber",
  ARCHIVED: "slate",
}

const editableInputs = new Set([
  "annualIncome",
  "clientAge",
  "monthlyGrossIncome",
  "spouseIncome",
  "monthlyNetIncome",
  "monthlyExpenses",
  "housingPayment",
  "monthlyDebtPayments",
  "childrenCount",
  "dependentsCount",
  "childrenAges",
  "mortgageBalance",
  "liabilities",
  "liquidAssets",
  "existingLifeCoverage",
  "existingPersonalLifeCoverage",
  "groupLifeCoverage",
  "beneficiariesConfirmed",
  "beneficiaryNotes",
  "policyDocumented",
  "estateLiquidityNeed",
  "legacyGoal",
  "premiumBudgetMonthly",
  "clientCoverageDecision",
  "existingDisabilityBenefit",
  "existingIndividualDisabilityBenefit",
  "groupDisabilityBenefit",
  "groupCoveragePercentage",
  "groupBenefitTaxable",
  "groupBenefitMaxMonthly",
  "waitingPeriodDays",
  "benefitDurationMonths",
  "emergencyFundMonths",
  "businessOverhead",
  "occupationRisk",
  "dividendIncome",
  "existingCriticalIllnessCoverage",
  "criticalIllnessPolicyDocumented",
  "disabilityCoverageAvailable",
  "mortgageProtectionGoal",
  "medicalLiquidityNeed",
  "homeAdaptationNeed",
  "familySupportNeed",
  "criticalIllnessObjective",
  "businessName",
  "businessType",
  "businessActivity",
  "annualBusinessRevenue",
  "shareholderCount",
  "previousShareholderCount",
  "previousOwnershipPercentage",
  "shareholdersChangedSinceLastReview",
  "hasShareholdersAgreement",
  "shareholdersAgreementUpdated",
  "agreementFunded",
  "businessValue",
  "ownershipPercentage",
  "keyPersonRevenueImpact",
  "keyPersonReplacementCost",
  "keyPersonTransitionCost",
  "corporateDebt",
  "personalGuaranteesAmount",
  "monthlyOperatingNeed",
  "existingCorporateCoverage",
  "policyOwnedByCorrectEntity",
  "beneficiaryStructureReviewed",
  "ownershipStructureNotes",
  "corporateDocumentsCollected",
  "beneficialOwnersDocumented",
  "existingCoverage",
  "proposedCoverage",
  "existingPremium",
  "proposedPremium",
  "existingCarrier",
  "proposedCarrier",
  "existingProductType",
  "proposedProductType",
  "existingPolicyNumber",
  "proposedPolicyNumber",
  "existingIssueDate",
  "proposedIssueDate",
  "existingTerm",
  "proposedTerm",
  "existingRiders",
  "proposedRiders",
  "existingPremiumGuarantee",
  "proposedPremiumGuarantee",
  "existingContestabilityPeriod",
  "proposedContestabilityPeriod",
  "existingFeesOrSurrenderCharges",
  "proposedFeesOrCharges",
  "existingOwner",
  "proposedOwner",
  "existingBeneficiaries",
  "proposedBeneficiaries",
  "underwritingRisks",
  "existingExclusions",
  "newExclusions",
  "lostBenefits",
  "cashValueSurrendered",
  "replacementAdvantages",
  "replacementDisadvantages",
  "replacementJustification",
  "replacementNoticeCompleted",
  "replacementComparisonExplained",
  "replacementClientAcknowledged",
  "replacementRequired",
])

const numericInputKeys = new Set([
  "annualIncome",
  "clientAge",
  "monthlyGrossIncome",
  "spouseIncome",
  "monthlyNetIncome",
  "monthlyExpenses",
  "housingPayment",
  "monthlyDebtPayments",
  "childrenCount",
  "dependentsCount",
  "mortgageBalance",
  "liabilities",
  "liquidAssets",
  "existingLifeCoverage",
  "existingPersonalLifeCoverage",
  "groupLifeCoverage",
  "estateLiquidityNeed",
  "legacyGoal",
  "premiumBudgetMonthly",
  "existingDisabilityBenefit",
  "existingIndividualDisabilityBenefit",
  "groupDisabilityBenefit",
  "groupCoveragePercentage",
  "groupBenefitMaxMonthly",
  "waitingPeriodDays",
  "benefitDurationMonths",
  "emergencyFundMonths",
  "businessOverhead",
  "dividendIncome",
  "existingCriticalIllnessCoverage",
  "disabilityCoverageAvailable",
  "mortgageProtectionGoal",
  "medicalLiquidityNeed",
  "homeAdaptationNeed",
  "familySupportNeed",
  "annualBusinessRevenue",
  "businessValue",
  "ownershipPercentage",
  "shareholderCount",
  "previousShareholderCount",
  "previousOwnershipPercentage",
  "keyPersonRevenueImpact",
  "keyPersonReplacementCost",
  "keyPersonTransitionCost",
  "corporateDebt",
  "personalGuaranteesAmount",
  "monthlyOperatingNeed",
  "existingCorporateCoverage",
  "existingCoverage",
  "proposedCoverage",
  "existingPremium",
  "proposedPremium",
  "cashValueSurrendered",
])

const booleanInputKeys = new Set([
  "beneficiariesConfirmed",
  "policyDocumented",
  "groupBenefitTaxable",
  "selfEmployed",
  "criticalIllnessPolicyDocumented",
  "hasShareholdersAgreement",
  "shareholdersChangedSinceLastReview",
  "shareholdersAgreementUpdated",
  "agreementFunded",
  "policyOwnedByCorrectEntity",
  "beneficiaryStructureReviewed",
  "corporateDocumentsCollected",
  "beneficialOwnersDocumented",
  "replacementNoticeCompleted",
  "replacementComparisonExplained",
  "replacementClientAcknowledged",
  "replacementRequired",
])

const longTextInputKeys = new Set([
  "childrenAges",
  "beneficiaryNotes",
  "criticalIllnessObjective",
  "businessActivity",
  "ownershipStructureNotes",
  "existingRiders",
  "proposedRiders",
  "existingFeesOrSurrenderCharges",
  "proposedFeesOrCharges",
  "existingBeneficiaries",
  "proposedBeneficiaries",
  "underwritingRisks",
  "existingExclusions",
  "newExclusions",
  "lostBenefits",
  "replacementAdvantages",
  "replacementDisadvantages",
  "replacementJustification",
])

function extractValue(value: unknown) {
  if (value && typeof value === "object" && "value" in value) return (value as { value?: unknown }).value
  return value
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value ?? 0)
}

function formatDate(value?: string | null) {
  if (!value) return "Non confirmé"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

type AiSummary = {
  summary?: string
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  riskScore?: number
  advisorAttentionPoints?: string[]
  dataInconsistencies?: Array<{ severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; title: string; detail: string }>
  suggestedQuestions?: string[]
  documentsToRequest?: Array<{ name: string; reason: string; priority?: "LOW" | "MEDIUM" | "HIGH" }>
  nextBestActions?: Array<{ label: string; reason: string; priority?: "LOW" | "MEDIUM" | "HIGH" }>
  clientExplanation?: string
  complianceNotes?: string[]
}

function parseAiSummary(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as AiSummary
  } catch {
    return null
  }
}

function aiRiskTone(level?: string): "slate" | "emerald" | "sky" | "amber" | "rose" | "violet" {
  if (level === "CRITICAL" || level === "HIGH") return "rose"
  if (level === "MEDIUM") return "amber"
  if (level === "LOW") return "emerald"
  return "slate"
}

function aiRiskLabel(level?: string) {
  if (level === "CRITICAL") return "Critique"
  if (level === "HIGH") return "Élevé"
  if (level === "MEDIUM") return "À surveiller"
  if (level === "LOW") return "Faible"
  return "À recalculer"
}

function aiPriorityClass(priority?: string) {
  if (priority === "HIGH") return "border-rose-200 bg-rose-50 text-rose-800"
  if (priority === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  return "border-amber-200 bg-amber-50 text-amber-800"
}

function typeIcon(type: AnalysisType) {
  if (type === "BUSINESS") return BriefcaseBusiness
  if (type === "REPLACEMENT") return FileText
  if (type === "DISABILITY" || type === "CRITICAL_ILLNESS") return HeartPulse
  return ShieldCheck
}

function defaultAnalysisTypeForProduct(productType?: string | null): AnalysisType {
  if (productType === "DISABILITY_INSURANCE") return "DISABILITY"
  if (productType === "CRITICAL_ILLNESS" || productType === "HEALTH_INSURANCE") return "CRITICAL_ILLNESS"
  return "LIFE"
}

function isAnalysisCompatibleWithProduct(analysisType: AnalysisType, productType?: string | null) {
  if (!productType) return true
  if (analysisType === "REPLACEMENT") return true
  if (productType === "DISABILITY_INSURANCE") return analysisType === "DISABILITY"
  if (productType === "CRITICAL_ILLNESS" || productType === "HEALTH_INSURANCE") return analysisType === "CRITICAL_ILLNESS"
  return analysisType === "LIFE" || analysisType === "BUSINESS"
}

function formatOpportunityLabel(opportunity?: LinkedOpportunity | null) {
  if (!opportunity) return "Opportunité sélectionnée"
  return [opportunity.company, opportunity.productName, opportunity.policyNumber ?? opportunity.contractNumber, productTypeLabels[opportunity.type] ?? opportunity.type]
    .filter(Boolean)
    .join(" - ")
}

function reportDeliveryState(analysis: Analysis) {
  if (analysis.reportDocument?.status === "REJECTED") {
    return {
      label: "Signature à relancer",
      tone: "rose" as const,
      detail: "PandaDoc a retourné une erreur, un refus ou une expiration.",
      actionHint: "Corrigez le dossier ou renvoyez le rapport. La recommandation finale doit rester bloquée.",
    }
  }
  if (analysis.signedAt || analysis.clientConfirmedAt || analysis.status === "DELIVERED") {
    return {
      label: "Rapport signé",
      tone: "emerald" as const,
      detail: `Preuve client confirmée${analysis.signedAt ? ` le ${formatDate(analysis.signedAt)}` : analysis.clientConfirmedAt ? ` le ${formatDate(analysis.clientConfirmedAt)}` : ""}`,
      actionHint: null as string | null,
    }
  }
  if (analysis.reportDocument?.status === "REQUESTED") {
    return {
      label: "Envoyé au client",
      tone: "amber" as const,
      detail: "Signature électronique en attente",
      actionHint: "Le rapport est chez le client. Le dossier restera bloqué jusqu’à la signature ou confirmation de réception.",
    }
  }
  if (analysis.reportDocumentId) {
    return {
      label: "À réviser",
      tone: "sky" as const,
      detail: "PDF préparé au dossier",
      actionHint: "Le rapport est généré. Révisez les données, puis cliquez sur Envoyer au client.",
    }
  }
  return {
    label: "Rapport à générer",
    tone: "slate" as const,
    detail: "Calcul requis avant remise",
    actionHint: null as string | null,
  }
}

function requiredPurposesForAction(action: AnalysisAction): ConsentPurposeCode[] {
  if (action === "calculate") return ["insurance_needs_analysis", "ai_assistance"]
  if (action === "report") return ["insurance_needs_analysis", "document_vault"]
  if (action === "pandadoc") return ["insurance_needs_analysis", "document_vault", "insurer_disclosure"]
  if (action === "smart-actions") return ["insurance_needs_analysis", "ai_assistance"]
  if (action === "smart-document-requests") return ["insurance_needs_analysis", "ai_assistance", "document_vault"]
  return ["insurance_needs_analysis"]
}

export function ClientInsuranceNeedsTab({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams()
  const requestedOpportunityId = searchParams.get("opportunityId")
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [linkedOpportunity, setLinkedOpportunity] = useState<LinkedOpportunity | null>(null)

  const selected = analyses.find((analysis) => analysis.id === selectedId) ?? analyses[0] ?? null

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [analysisResponse, consentsResponse] = await Promise.all([
        fetch(`/api/clients/${clientId}/insurance-analyses`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/consents`, { cache: "no-store" }),
      ])
      const data = await readData<Analysis[]>(analysisResponse)
      setConsents(await readData<Consent[]>(consentsResponse))
      setAnalyses(data)
      const requestedAnalysisId = searchParams.get("analysisId")
      const opportunityAnalysis = requestedOpportunityId ? data.find((analysis) => analysis.opportunityId === requestedOpportunityId) : null
      setSelectedId((current) =>
        requestedAnalysisId && data.some((analysis) => analysis.id === requestedAnalysisId)
          ? requestedAnalysisId
          : opportunityAnalysis?.id ?? current ?? data[0]?.id ?? null
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les analyses.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId, requestedOpportunityId, searchParams])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalyses()
  }, [loadAnalyses])

  useEffect(() => {
    if (!requestedOpportunityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedOpportunity(null)
      return
    }

    let isCurrent = true
    async function loadOpportunity() {
      try {
        const response = await fetch(`/api/financial-products/${requestedOpportunityId}`, { cache: "no-store" })
        const data = await readData<LinkedOpportunity>(response)
        if (isCurrent) setLinkedOpportunity(data)
      } catch {
        if (isCurrent) setLinkedOpportunity(null)
      }
    }

    void loadOpportunity()
    return () => {
      isCurrent = false
    }
  }, [requestedOpportunityId])

  useEffect(() => {
    if (!selected) return
    const next = Object.fromEntries(
      selected.inputs.map((input) => [input.inputKey, String(extractValue(input.inputValue) ?? "")])
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftValues(next)
  }, [selected])

  const summary = useMemo(() => {
    const open = analyses.filter((analysis) => !["COMPLETED", "ARCHIVED"].includes(analysis.status)).length
    const missing = analyses.filter((analysis) => analysis.status === "MISSING_DATA").length
    const reports = analyses.filter((analysis) => analysis.reportDocumentId).length
    const confirmed = analyses.filter((analysis) => Boolean(analysis.signedAt ?? analysis.clientConfirmedAt)).length
    return { open, missing, reports, confirmed }
  }, [analyses])

  const activePurposeCodes = useMemo(() => {
    return new Set(
      consents
        .filter((consent) => consent.status === "GIVEN")
        .map((consent) => consent.purpose?.code)
        .filter((code): code is ConsentPurposeCode => Boolean(code && code in consentPurposeLabels))
    )
  }, [consents])

  const missingCreatePurposes = useMemo(() => {
    return requiredPurposesForAction("create").filter((code) => !activePurposeCodes.has(code))
  }, [activePurposeCodes])

  function missingPurposesFor(action: AnalysisAction) {
    return requiredPurposesForAction(action).filter((code) => !activePurposeCodes.has(code))
  }

  function isActionBlocked(action: AnalysisAction) {
    return missingPurposesFor(action).length > 0
  }

  const linkedAnalysis = requestedOpportunityId
    ? analyses.find((analysis) => analysis.opportunityId === requestedOpportunityId)
    : null
  const suggestedType = defaultAnalysisTypeForProduct(linkedOpportunity?.type)
  const compatibleUnlinkedAnalysis = requestedOpportunityId && !linkedAnalysis
    ? analyses.find((analysis) => !analysis.opportunityId && analysis.status !== "ARCHIVED" && isAnalysisCompatibleWithProduct(analysis.analysisType, linkedOpportunity?.type))
    : null

  async function create(type: AnalysisType) {
    setActionId(`create-${type}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/insurance-analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, opportunityId: requestedOpportunityId }),
      })
      const analysis = await readData<Analysis>(response)
      setSelectedId(analysis.id)
      setNotice(`${typeLabels[type]} créée avec les données CRM disponibles${requestedOpportunityId ? " et liée à l’opportunité." : "."}`)
      await loadAnalyses()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Impossible de créer l’analyse.")
    } finally {
      setActionId(null)
    }
  }

  async function linkExistingAnalysis(analysisId: string) {
    setActionId(`link-${analysisId}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/insurance-analyses/${analysisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: requestedOpportunityId }),
      })
      const analysis = await readData<Analysis>(response)
      setSelectedId(analysis.id)
      setNotice("Analyse existante liée à l’opportunité. Le dossier évite maintenant une analyse en double.")
      await loadAnalyses()
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Impossible de lier l’analyse.")
    } finally {
      setActionId(null)
    }
  }

  async function runAction(analysisId: string, action: "calculate" | "report" | "pandadoc" | "lock" | "new-version" | "smart-actions" | "smart-document-requests") {
    setActionId(`${action}-${analysisId}`)
    setError(null)
    setNotice(null)
    try {
          const path = action === "pandadoc" ? "signature/pandadoc" : action
      const response = await fetch(`/api/insurance-analyses/${analysisId}/${path}`, { method: "POST" })
      await readData<Analysis>(response)
      setNotice(
        action === "calculate"
          ? "Analyse recalculée et recommandation interne créée."
          : action === "report"
            ? "Rapport généré et classé dans les documents du client."
            : action === "pandadoc"
              ? "Rapport envoyé au client pour signature électronique."
            : action === "new-version"
              ? "Nouvelle version créée. L’ancienne version signée reste conservée comme preuve."
              : action === "smart-actions"
                ? "Tâches intelligentes créées ou déjà présentes dans le CRM. Le conseiller garde la validation humaine."
                : action === "smart-document-requests"
                  ? "Documents suggérés demandés au client et classés au dossier. Une tâche de suivi a été créée."
                : "Analyse verrouillée pour recommandation."
      )
      await loadAnalyses()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setActionId(null)
    }
  }

  async function saveInput(analysisId: string, inputKey: string) {
    setActionId(`input-${inputKey}`)
    setError(null)
    try {
      const rawValue = draftValues[inputKey] ?? ""
      const value = rawValue.trim() === ""
        ? null
        : booleanInputKeys.has(inputKey)
          ? rawValue === "true"
          : numericInputKeys.has(inputKey) && Number.isFinite(Number(rawValue))
            ? Number(rawValue)
            : rawValue
      const response = await fetch(`/api/insurance-analyses/${analysisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputKey, value }),
      })
      await readData<Analysis>(response)
      setNotice("Donnée mise à jour. Recalculez l’analyse pour appliquer le changement.")
      await loadAnalyses()
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : "Impossible de sauvegarder la donnée.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="space-y-5">
      <ContentCard title="Analyse des besoins d’assurance" description="Module synchronisé avec le profil client, les polices, les documents, les tâches et les recommandations.">
        {requestedOpportunityId ? (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Opportunité liée</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">{formatOpportunityLabel(linkedOpportunity)}</p>
                <p className="mt-1 text-sm text-emerald-800">
                  {linkedAnalysis
                    ? "Une analyse est déjà liée à cette opportunité."
                    : compatibleUnlinkedAnalysis
                      ? `Une analyse ${typeLabels[compatibleUnlinkedAnalysis.analysisType].toLowerCase()} existe déjà. Vous pouvez la lier au lieu d’en créer une nouvelle.`
                      : `Créez une analyse ${typeLabels[suggestedType].toLowerCase()} déjà rattachée à cette opportunité.`}
                </p>
              </div>
              {linkedAnalysis ? (
                <Button variant="outline" className="rounded-xl border-emerald-200 bg-white text-emerald-700" onClick={() => setSelectedId(linkedAnalysis.id)}>
                  <FileText className="size-4" />
                  Ouvrir l’analyse liée
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {compatibleUnlinkedAnalysis ? (
                    <Button variant="outline" className="rounded-xl border-emerald-200 bg-white text-emerald-700" onClick={() => linkExistingAnalysis(compatibleUnlinkedAnalysis.id)} disabled={Boolean(actionId)}>
                      {actionId === `link-${compatibleUnlinkedAnalysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Lier l’analyse existante
                    </Button>
                  ) : null}
                    <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => create(suggestedType)} disabled={Boolean(actionId) || isActionBlocked("create")}>
                    {actionId === `create-${suggestedType}` ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Créer l’analyse recommandée
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Analyses ouvertes" value={summary.open} detail="À compléter ou valider" />
          <Metric label="Données manquantes" value={summary.missing} detail="Bloque la recommandation" tone="amber" />
          <Metric label="Rapports" value={summary.reports} detail="Classés au dossier" tone="emerald" />
          <Metric label="Confirmées client" value={summary.confirmed} detail="Preuve de remise" tone="violet" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(typeLabels) as AnalysisType[]).map((type) => {
            const Icon = typeIcon(type)
            const isBusy = actionId === `create-${type}`
            return (
              <Button key={type} variant="outline" className="h-auto rounded-xl px-3 py-2 text-left" onClick={() => create(type)} disabled={Boolean(actionId) || isActionBlocked("create")}>
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{typeLabels[type]}</span>
                  <span className="text-xs font-normal text-slate-500">{typeDescriptions[type]}</span>
                </span>
              </Button>
            )
          })}
        </div>
        {missingCreatePurposes.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-950">Consentement requis avant analyse</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                  {missingCreatePurposes.map((code) => consentPurposeLabels[code]).join(", ")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {notice ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </ContentCard>

      {isLoading ? (
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : analyses.length === 0 ? (
        <ContentCard title="Aucune analyse créée">
          <div className="flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-800">
            <Plus className="mt-0.5 size-5 shrink-0" />
            <p>Créez une première analyse. Les données connues du profil client seront préremplies automatiquement.</p>
          </div>
        </ContentCard>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
          <div className="space-y-3">
            {analyses.map((analysis) => {
              const Icon = typeIcon(analysis.analysisType)
              const result = analysis.results[0]
              return (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => setSelectedId(analysis.id)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 ${selected?.id === analysis.id ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                      <Icon className="size-5" />
                    </span>
                    <StatusBadge tone={statusTone[analysis.status] ?? "slate"}>{statusLabels[analysis.status] ?? analysis.status}</StatusBadge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{typeLabels[analysis.analysisType]}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{analysis.summary ?? typeDescriptions[analysis.analysisType]}</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{formatMoney(result?.gapAmount ?? analysis.recommendations[0]?.recommendedAmount ?? 0)}</p>
                  <p className="text-xs font-medium text-slate-500">Écart ou montant à valider</p>
                </button>
              )
            })}
          </div>

          {selected ? (
            <AnalysisWorkspace
              analysis={selected}
              draftValues={draftValues}
              setDraftValues={setDraftValues}
              actionId={actionId}
              activePurposeCodes={activePurposeCodes}
              onSaveInput={saveInput}
              onRunAction={runAction}
              clientId={clientId}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}

function AnalysisWorkspace({
  analysis,
  draftValues,
  setDraftValues,
  actionId,
  activePurposeCodes,
  onSaveInput,
  onRunAction,
  clientId,
}: {
  analysis: Analysis
  draftValues: Record<string, string>
  setDraftValues: (next: Record<string, string>) => void
  actionId: string | null
  activePurposeCodes: Set<ConsentPurposeCode>
  onSaveInput: (analysisId: string, inputKey: string) => Promise<void>
  onRunAction: (analysisId: string, action: "calculate" | "report" | "pandadoc" | "lock" | "new-version" | "smart-actions" | "smart-document-requests") => Promise<void>
  clientId: string
}) {
  const recommendation = analysis.recommendations[0]
  const result = analysis.results[0]
  const ai = parseAiSummary(analysis.aiSummary)
  const inputs = analysis.inputs.filter((input) => editableInputs.has(input.inputKey))
  const deliveryState = reportDeliveryState(analysis)
  const isReportAlreadySent = analysis.reportDocument?.status === "REQUESTED"
  const isReportConfirmed = Boolean(analysis.signedAt ?? analysis.clientConfirmedAt) || analysis.reportDocument?.status === "VALIDATED"
  const isLockedBySignature = Boolean(analysis.signedAt) || analysis.reportDocument?.status === "VALIDATED"
  const canGenerateReport = Boolean(result) && !isReportAlreadySent && !isReportConfirmed
  const canSendReport = Boolean(analysis.reportDocumentId) && !isReportAlreadySent && !isReportConfirmed
  const unverifiedInputs = analysis.inputs.filter((input) => editableInputs.has(input.inputKey) && !input.isVerified).slice(0, 8)
  const missingWorkflowPurposes = Array.from(
    new Set(["calculate", "report", "pandadoc", "lock", "smart-document-requests"].flatMap((action) => requiredPurposesForAction(action as AnalysisAction)))
  ).filter((code) => !activePurposeCodes.has(code))
  function missingPurposesFor(action: AnalysisAction) {
    return requiredPurposesForAction(action).filter((code) => !activePurposeCodes.has(code))
  }
  function isActionBlocked(action: AnalysisAction) {
    return missingPurposesFor(action).length > 0
  }
  const preflightItems = [
    {
      label: "Calcul exécuté",
      detail: result ? `${formatMoney(result.netNeed)} de besoin net estimé` : "Recalculez l’analyse après validation des données.",
      done: Boolean(result),
    },
    {
      label: "Données critiques",
      detail: analysis.status === "MISSING_DATA" ? "Des champs bloquent le rapport." : unverifiedInputs.length ? `${unverifiedInputs.length} donnée(s) à confirmer.` : "Aucun blocage détecté.",
      done: analysis.status !== "MISSING_DATA",
    },
    {
      label: "Rapport PDF",
      detail: analysis.reportDocumentId ? "Rapport généré et classé dans Documents." : "À générer après calcul complet.",
      done: Boolean(analysis.reportDocumentId),
    },
    {
      label: "Remise client",
      detail: analysis.deliveredAt ? `Envoyé le ${formatDate(analysis.deliveredAt)}` : "À envoyer au client après révision conseiller.",
      done: Boolean(analysis.deliveredAt),
    },
    {
      label: "Signature / réception",
      detail: analysis.signedAt ? `Signé le ${formatDate(analysis.signedAt)}` : analysis.clientConfirmedAt ? `Confirmé le ${formatDate(analysis.clientConfirmedAt)}` : "En attente.",
      done: Boolean(analysis.signedAt ?? analysis.clientConfirmedAt),
    },
    {
      label: "Verrouillage",
      detail: analysis.lockedAt ? `Verrouillé le ${formatDate(analysis.lockedAt)}` : "À verrouiller avant recommandation finale.",
      done: Boolean(analysis.lockedAt ?? analysis.usedForRecommendation),
    },
    {
      label: "Opportunité",
      detail: analysis.opportunityId ? "Analyse liée à une opportunité." : "Non liée à une opportunité.",
      done: Boolean(analysis.opportunityId),
    },
    {
      label: "Soumission",
      detail: analysis.status === "USED_FOR_SUBMISSION" ? "Analyse utilisée pour soumission." : "À utiliser seulement après preuve complète.",
      done: analysis.status === "USED_FOR_SUBMISSION",
    },
  ]

  return (
    <div className="space-y-5">
      <ContentCard title={`${typeLabels[analysis.analysisType]} - dossier de travail`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone[analysis.status] ?? "slate"}>{statusLabels[analysis.status] ?? analysis.status}</StatusBadge>
              <StatusBadge tone={deliveryState.tone}>{deliveryState.label}</StatusBadge>
              {analysis.usedForRecommendation ? <StatusBadge tone="violet">Utilisée pour recommandation</StatusBadge> : null}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {analysis.objective ?? typeDescriptions[analysis.analysisType]}
            </p>
            {analysis.opportunity ? (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Opportunité liée : {[analysis.opportunity.company, analysis.opportunity.productName, analysis.opportunity.policyNumber ?? analysis.opportunity.contractNumber, analysis.opportunity.type].filter(Boolean).join(" - ")}
              </p>
            ) : null}
            {isLockedBySignature ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Analyse signée ou validée : les données sont verrouillées. Créez une nouvelle version si le client modifie sa situation.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isLockedBySignature ? (
              <Button variant="outline" className="rounded-xl" disabled={Boolean(actionId) || isActionBlocked("new-version")} onClick={() => onRunAction(analysis.id, "new-version")}>
                {actionId === `new-version-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <CopyPlus className="size-4" />}
                Nouvelle version
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-xl" disabled={Boolean(actionId) || isLockedBySignature || isActionBlocked("calculate")} onClick={() => onRunAction(analysis.id, "calculate")}>
              {actionId === `calculate-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Recalculer
            </Button>
            <Button variant="outline" className="rounded-xl" disabled={Boolean(actionId) || !canGenerateReport || isActionBlocked("report")} onClick={() => onRunAction(analysis.id, "report")}>
              {actionId === `report-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {analysis.reportDocumentId && !isReportAlreadySent && !isReportConfirmed ? "Regénérer rapport" : "Générer rapport"}
            </Button>
            {analysis.reportDocumentId ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/documents/${analysis.reportDocumentId}`}>
                  <FileText className="size-4" />
                  Réviser le PDF
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-xl" disabled={Boolean(actionId) || !canSendReport || isActionBlocked("pandadoc")} onClick={() => onRunAction(analysis.id, "pandadoc")}>
              {actionId === `pandadoc-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Envoyer au client
            </Button>
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={Boolean(actionId) || !analysis.reportDocumentId || !(analysis.signedAt ?? analysis.clientConfirmedAt) || isActionBlocked("lock")} onClick={() => onRunAction(analysis.id, "lock")}>
              {actionId === `lock-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Verrouiller
            </Button>
          </div>
        </div>
        {missingWorkflowPurposes.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-950">Actions d’analyse bloquées par consentement</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                  {missingWorkflowPurposes.map((code) => consentPurposeLabels[code]).join(", ")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </ContentCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <ContentCard
          title="Preuve conformité"
          description="Résumé daté de la chaîne réglementaire : rapport, remise, signature, verrouillage et utilisation dans une soumission."
          className="lg:col-span-3"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <ProofStep
              icon={Calculator}
              title={`Version v${analysis.analysisVersion ?? 1}`}
              detail={result ? "Résultat disponible" : "Recalcul requis"}
              done={Boolean(result)}
            />
            <ProofStep
              icon={FileText}
              title="Rapport"
              detail={deliveryState.detail}
              done={Boolean(analysis.reportDocumentId)}
              href={analysis.reportDocumentId ? `/documents/${analysis.reportDocumentId}` : undefined}
            />
            <ProofStep
              icon={Clock3}
              title="Réception client"
              detail={analysis.signedAt ? `Signé le ${formatDate(analysis.signedAt)}` : analysis.deliveredAt ? `Remis le ${formatDate(analysis.deliveredAt)}` : analysis.reportDocument?.status === "REQUESTED" ? "Signature envoyée au client" : "Non envoyée"}
              done={Boolean(analysis.signedAt ?? analysis.clientConfirmedAt)}
              href={analysis.signatureDocumentId ? `/documents/${analysis.signatureDocumentId}` : undefined}
            />
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
            <ProofMeta label="Version analyse" value={`v${analysis.analysisVersion ?? 1}`} />
            <ProofMeta label="Rapport généré" value={analysis.reportDocumentId ? "Oui" : "À générer"} href={analysis.reportDocumentId ? `/documents/${analysis.reportDocumentId}` : undefined} tone={analysis.reportDocumentId ? "emerald" : "slate"} />
            <ProofMeta label="Remis au client" value={analysis.deliveredAt ? formatDate(analysis.deliveredAt) : "Non remis"} tone={analysis.deliveredAt ? "emerald" : "amber"} />
            <ProofMeta label="Signé le" value={analysis.signedAt ? formatDate(analysis.signedAt) : "Signature en attente"} tone={analysis.signedAt ? "emerald" : "amber"} />
            <ProofMeta label="Verrouillage" value={analysis.lockedAt ? formatDate(analysis.lockedAt) : analysis.usedForRecommendation ? "Utilisée pour recommandation" : "Non verrouillée"} tone={analysis.lockedAt || analysis.usedForRecommendation ? "emerald" : "slate"} />
            <ProofMeta label="Document signé" value={analysis.signatureDocumentId ? "Signature archivée" : "Non disponible"} href={analysis.signatureDocumentId ? `/documents/${analysis.signatureDocumentId}` : undefined} tone={analysis.signatureDocumentId ? "emerald" : "slate"} />
            <ProofMeta label="Soumission" value={analysis.status === "USED_FOR_SUBMISSION" ? "Utilisée pour soumission" : "Pas encore utilisée"} tone={analysis.status === "USED_FOR_SUBMISSION" ? "violet" : "slate"} />
            <ProofMeta label="Audit trail" value="Voir journal d’audit" href={`/clients/${clientId}?tab=compliance#audit-trail-panel`} />
          </div>
          {deliveryState.actionHint ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              {deliveryState.actionHint}
            </p>
          ) : null}
        </ContentCard>

        <ContentCard title="Résultat" className="lg:col-span-1">
          {result ? (
            <div className="space-y-4">
              <ResultLine label="Besoin brut" value={result.grossNeed} />
              <ResultLine label="Protection existante" value={result.existingCoverage} />
              <ResultLine label="Actifs déduits" value={result.availableAssetsOffset} />
              {analysis.analysisType === "LIFE" && result.calculationDetails ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="font-black uppercase text-slate-500">Composition vie</p>
                  <p>Revenu remplacé : {formatMoney(Number(result.calculationDetails.incomeReplacement ?? 0))}</p>
                  <p>Études enfants : {formatMoney(Number(result.calculationDetails.education ?? 0))}</p>
                  <p>Fonds d’urgence : {formatMoney(Number(result.calculationDetails.emergencyFund ?? 0))}</p>
                  <p>Liquidités successorales : {formatMoney(Number(result.calculationDetails.estateLiquidityNeed ?? 0))}</p>
                </div>
              ) : null}
              {analysis.analysisType === "DISABILITY" && result.calculationDetails ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="font-black uppercase text-slate-500">Composition invalidité</p>
                  <p>Dépenses essentielles : {formatMoney(Number(result.calculationDetails.essentialExpenses ?? 0))}</p>
                  <p>Logement : {formatMoney(Number(result.calculationDetails.housingPayment ?? 0))}</p>
                  <p>Dettes mensuelles : {formatMoney(Number(result.calculationDetails.monthlyDebtPayments ?? 0))}</p>
                  <p>Pourcentage collectif : {Number(result.calculationDetails.groupCoveragePercentage ?? 0).toLocaleString("fr-CA")} %</p>
                  <p>Protection collective nette estimée : {formatMoney(Number(result.calculationDetails.groupBenefitEstimatedNet ?? 0))}</p>
                </div>
              ) : null}
              {analysis.analysisType === "CRITICAL_ILLNESS" && result.calculationDetails ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="font-black uppercase text-slate-500">Composition maladies graves</p>
                  <p>Hypothèque protégée : {formatMoney(Number(result.calculationDetails.mortgagePortion ?? 0))}</p>
                  <p>Liquidités médicales : {formatMoney(Number(result.calculationDetails.medicalLiquidity ?? 0))}</p>
                  <p>Revenu temporaire : {formatMoney(Number(result.calculationDetails.incomeReplacement ?? 0))}</p>
                  <p>Fonds familial : {formatMoney(Number(result.calculationDetails.familySupportNeed ?? 0))}</p>
                </div>
              ) : null}
              {analysis.analysisType === "BUSINESS" && result.calculationDetails ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="font-black uppercase text-slate-500">Composition entreprise</p>
                  <p>Personne clé : {formatMoney(Number(result.calculationDetails.keyPersonNeed ?? 0))}</p>
                  <p>Rachat de parts : {formatMoney(Number(result.calculationDetails.buySellNeed ?? 0))}</p>
                  <p>Dettes commerciales : {formatMoney(Number(result.calculationDetails.corporateDebt ?? 0))}</p>
                  <p>Continuité : {formatMoney(Number(result.calculationDetails.continuityNeed ?? 0))}</p>
                  <p>Actionnariat modifié : {result.calculationDetails.ownershipChanged ? "Oui" : "Non"}</p>
                </div>
              ) : null}
              {analysis.analysisType === "REPLACEMENT" && result.calculationDetails ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <p className="font-black uppercase">Comparaison remplacement</p>
                  <p>Prime actuelle : {formatMoney(Number(result.calculationDetails.existingPremium ?? 0))}</p>
                  <p>Prime proposée : {formatMoney(Number(result.calculationDetails.proposedPremium ?? 0))}</p>
                  <p>Différence prime : {formatMoney(Number(result.calculationDetails.premiumDifference ?? 0))}</p>
                  <p>Préavis : {result.calculationDetails.noticeCompleted ? "Complété" : "Requis ou à confirmer"}</p>
                </div>
              ) : null}
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-700">Besoin net estimé</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-950">{formatMoney(result.netNeed)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Aucun calcul encore. Validez les données puis cliquez sur Recalculer.</p>
          )}
        </ContentCard>

        <ContentCard title="Recommandation interne" className="lg:col-span-2">
          {recommendation ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Produit" value={recommendation.recommendedProductType} detail="À valider" />
                <Metric label="Montant" value={formatMoney(recommendation.recommendedAmount)} detail="Non présenté automatiquement" tone="emerald" />
                <Metric label="Durée" value={recommendation.recommendedTerm ?? "À confirmer"} detail="Hypothèse conseiller" tone="violet" />
              </div>
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{recommendation.reasoning}</p>
              {recommendation.alternativesConsidered?.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {recommendation.alternativesConsidered.map((alternative) => (
                    <div key={alternative.label} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{alternative.label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(alternative.amount)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{alternative.note}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">La recommandation interne sera créée après le calcul. Elle restera une aide au conseiller, pas une recommandation automatique au client.</p>
          )}
        </ContentCard>

        <ContentCard
          title="Pré-vérification avant remise"
          description="Contrôle opérationnel du flux analyse → rapport → client → signature → recommandation."
          className="lg:col-span-3"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {preflightItems.map((item) => (
              <div key={item.label} className={item.done ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4" : "rounded-2xl border border-amber-200 bg-amber-50 p-4"}>
                <div className="flex items-start gap-3">
                  <span className={item.done ? "grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700" : "grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700"}>
                    {item.done ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className={item.done ? "font-black text-emerald-950" : "font-black text-amber-950"}>{item.label}</p>
                    <p className={item.done ? "mt-1 text-sm font-semibold leading-5 text-emerald-800" : "mt-1 text-sm font-semibold leading-5 text-amber-800"}>{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {unverifiedInputs.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-black text-amber-900">Données à confirmer avant de finaliser</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unverifiedInputs.map((input) => (
                  <span key={input.id} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                    {input.label ?? input.inputKey}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </ContentCard>
      </div>

      {analysis.analysisType === "REPLACEMENT" ? (
        <ContentCard title="Comparaison de remplacement" description="Tableau de travail ancien contrat vs nouveau contrat. Le rapport et la recommandation restent bloqués tant que les conséquences ne sont pas documentées.">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-900 text-xs font-black uppercase tracking-wide text-white">
              <div className="p-3">Point comparé</div>
              <div className="border-l border-white/10 p-3">Contrat actuel</div>
              <div className="border-l border-white/10 p-3">Contrat proposé</div>
            </div>
            {[
              ["Assureur", inputDisplay(analysis, "existingCarrier"), inputDisplay(analysis, "proposedCarrier")],
              ["Produit", inputDisplay(analysis, "existingProductType"), inputDisplay(analysis, "proposedProductType")],
              ["Numéro de police", inputDisplay(analysis, "existingPolicyNumber"), inputDisplay(analysis, "proposedPolicyNumber")],
              ["Montant assuré", inputDisplay(analysis, "existingCoverage", true), inputDisplay(analysis, "proposedCoverage", true)],
              ["Prime", inputDisplay(analysis, "existingPremium", true), inputDisplay(analysis, "proposedPremium", true)],
              ["Date d’émission", inputDisplay(analysis, "existingIssueDate"), inputDisplay(analysis, "proposedIssueDate")],
              ["Durée / structure", inputDisplay(analysis, "existingTerm"), inputDisplay(analysis, "proposedTerm")],
              ["Avenants", inputDisplay(analysis, "existingRiders"), inputDisplay(analysis, "proposedRiders")],
              ["Garantie de prime", inputDisplay(analysis, "existingPremiumGuarantee"), inputDisplay(analysis, "proposedPremiumGuarantee")],
              ["Contestabilité", inputDisplay(analysis, "existingContestabilityPeriod"), inputDisplay(analysis, "proposedContestabilityPeriod")],
              ["Frais / pertes", inputDisplay(analysis, "existingFeesOrSurrenderCharges"), inputDisplay(analysis, "proposedFeesOrCharges")],
              ["Titulaire", inputDisplay(analysis, "existingOwner"), inputDisplay(analysis, "proposedOwner")],
              ["Bénéficiaires", inputDisplay(analysis, "existingBeneficiaries"), inputDisplay(analysis, "proposedBeneficiaries")],
              ["Exclusions", inputDisplay(analysis, "existingExclusions"), inputDisplay(analysis, "newExclusions")],
            ].map(([label, current, proposed]) => (
              <div key={label} className="grid grid-cols-[1fr_1fr_1fr] border-t border-slate-200 bg-white text-sm">
                <div className="p-3 font-black text-slate-800">{label}</div>
                <div className="border-l border-slate-200 p-3 font-semibold text-slate-600">{current}</div>
                <div className="border-l border-slate-200 p-3 font-semibold text-slate-600">{proposed}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ProofMeta label="Préavis" value={inputDisplay(analysis, "replacementNoticeCompleted") === "true" ? "Complété" : "À compléter"} tone={inputDisplay(analysis, "replacementNoticeCompleted") === "true" ? "emerald" : "amber"} />
            <ProofMeta label="Comparaison expliquée" value={inputDisplay(analysis, "replacementComparisonExplained") === "true" ? "Oui" : "Non"} tone={inputDisplay(analysis, "replacementComparisonExplained") === "true" ? "emerald" : "amber"} />
            <ProofMeta label="Reconnaissance client" value={inputDisplay(analysis, "replacementClientAcknowledged") === "true" ? "Reçue" : "À obtenir"} tone={inputDisplay(analysis, "replacementClientAcknowledged") === "true" ? "emerald" : "amber"} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-950">Conséquences à expliquer</p>
              <dl className="mt-3 space-y-2 text-sm font-semibold text-amber-900">
                <div><dt className="font-black">Garanties perdues</dt><dd>{inputDisplay(analysis, "lostBenefits")}</dd></div>
                <div><dt className="font-black">Risques de souscription</dt><dd>{inputDisplay(analysis, "underwritingRisks")}</dd></div>
                <div><dt className="font-black">Valeur de rachat abandonnée</dt><dd>{inputDisplay(analysis, "cashValueSurrendered", true)}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Justification conseiller</p>
              <dl className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                <div><dt className="font-black">Avantages</dt><dd>{inputDisplay(analysis, "replacementAdvantages")}</dd></div>
                <div><dt className="font-black">Désavantages</dt><dd>{inputDisplay(analysis, "replacementDisadvantages")}</dd></div>
                <div><dt className="font-black">Conclusion</dt><dd>{inputDisplay(analysis, "replacementJustification")}</dd></div>
              </dl>
            </div>
          </div>
        </ContentCard>
      ) : null}

      <ContentCard title="Données utilisées">
        <div className="grid gap-3 md:grid-cols-2">
          {inputs.map((input) => (
            <label key={input.id} className="rounded-xl border border-slate-200 p-3">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">{input.label ?? input.inputKey}</span>
                <StatusBadge tone={input.isVerified ? "emerald" : "amber"}>{input.source}</StatusBadge>
              </span>
              <div className="mt-3 flex gap-2">
                {booleanInputKeys.has(input.inputKey) ? (
                  <select
                    value={draftValues[input.inputKey] ?? ""}
                    onChange={(event) => setDraftValues({ ...draftValues, [input.inputKey]: event.target.value })}
                    disabled={isLockedBySignature}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="">À confirmer</option>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                ) : input.inputKey === "clientCoverageDecision" ? (
                  <select
                    value={draftValues[input.inputKey] ?? "PENDING"}
                    onChange={(event) => setDraftValues({ ...draftValues, [input.inputKey]: event.target.value })}
                    disabled={isLockedBySignature}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="PENDING">À discuter</option>
                    <option value="ACCEPTED">Accepte la protection recommandée</option>
                    <option value="DECLINED">Refuse la protection suffisante</option>
                    <option value="DEFERRED">Décision reportée</option>
                  </select>
                ) : longTextInputKeys.has(input.inputKey) ? (
                  <textarea
                    value={draftValues[input.inputKey] ?? ""}
                    onChange={(event) => setDraftValues({ ...draftValues, [input.inputKey]: event.target.value })}
                    disabled={isLockedBySignature}
                    rows={2}
                    className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                ) : (
                  <input
                    value={draftValues[input.inputKey] ?? ""}
                    onChange={(event) => setDraftValues({ ...draftValues, [input.inputKey]: event.target.value })}
                    disabled={isLockedBySignature}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    inputMode={numericInputKeys.has(input.inputKey) ? "decimal" : undefined}
                  />
                )}
                <Button variant="outline" className="rounded-xl" disabled={isLockedBySignature || actionId === `input-${input.inputKey}`} onClick={() => onSaveInput(analysis.id, input.inputKey)}>
                  {actionId === `input-${input.inputKey}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Sauver
                </Button>
              </div>
            </label>
          ))}
        </div>
      </ContentCard>

      {analysis.assumptions.length ? (
        <ContentCard title="Hypothèses de calcul" description="Paramètres utilisés par le moteur. Chaque hypothèse reste modifiable et doit être validée par le conseiller avant recommandation.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {analysis.assumptions.map((assumption) => (
              <div key={assumption.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-900">{assumption.label}</p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {assumption.numericValue ?? assumption.value ?? "À confirmer"} {assumption.unit ?? ""}
                </p>
                {assumption.reason ? <p className="mt-2 text-xs leading-5 text-slate-500">{assumption.reason}</p> : null}
              </div>
            ))}
          </div>
        </ContentCard>
      ) : null}

      {ai ? (
        <ContentCard
          title="Intelligence conseiller"
          description="Lecture assistée par IA. Les calculs et blocages restent déterministes; ces signaux servent à préparer la validation humaine."
        >
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-sky-950">Transformer l’aide IA en suivi CRM</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-sky-800">
                Crée des tâches internes pour les actions et documents proposés. Aucun message n’est envoyé au client automatiquement.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl border-sky-200 bg-white text-sky-800 hover:bg-sky-100"
              disabled={Boolean(actionId) || isActionBlocked("smart-actions")}
              onClick={() => onRunAction(analysis.id, "smart-actions")}
            >
              {actionId === `smart-actions-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Créer tâches IA
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
              disabled={Boolean(actionId) || !(ai.documentsToRequest ?? []).length || isActionBlocked("smart-document-requests")}
              onClick={() => onRunAction(analysis.id, "smart-document-requests")}
            >
              {actionId === `smart-document-requests-${analysis.id}` ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Demander documents IA
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Lecture intelligente</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{ai.summary ?? analysis.summary ?? "Recalculez l’analyse pour générer l’aide intelligente."}</p>
                </div>
                <StatusBadge tone={aiRiskTone(ai.riskLevel)}>
                  {aiRiskLabel(ai.riskLevel)}
                </StatusBadge>
              </div>
              <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Score de vigilance</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={ai.riskLevel === "HIGH" || ai.riskLevel === "CRITICAL" ? "h-full rounded-full bg-rose-500" : ai.riskLevel === "MEDIUM" ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-emerald-500"}
                    style={{ width: `${Math.min(100, Math.max(0, ai.riskScore ?? 0))}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-black text-slate-900">{Math.round(ai.riskScore ?? 0)} / 100</p>
              </div>
              {ai.clientExplanation ? (
                <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Explication client à réviser</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{ai.clientExplanation}</p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SmartList
                title="Prochaines actions"
                empty="Aucune action intelligente disponible."
                items={(ai.nextBestActions ?? []).map((item) => ({
                  title: item.label,
                  detail: item.reason,
                  priority: item.priority,
                }))}
              />
              <SmartList
                title="Documents à demander"
                empty="Aucun document supplémentaire proposé."
                items={(ai.documentsToRequest ?? []).map((item) => ({
                  title: item.name,
                  detail: item.reason,
                  priority: item.priority,
                }))}
              />
              <SmartList
                title="Questions client"
                empty="Aucune question proposée."
                items={(ai.suggestedQuestions ?? []).map((question) => ({
                  title: question,
                  detail: "Question préparatoire. Validation humaine obligatoire.",
                  priority: "MEDIUM" as const,
                }))}
              />
              <SmartList
                title="Incohérences à vérifier"
                empty="Aucune incohérence signalée."
                items={(ai.dataInconsistencies ?? []).map((item) => ({
                  title: item.title,
                  detail: item.detail,
                  priority: item.severity === "CRITICAL" || item.severity === "HIGH" ? "HIGH" : item.severity === "LOW" ? "LOW" : "MEDIUM",
                }))}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <SmartChecklist
              title="Points à valider"
              icon={AlertTriangle}
              items={ai.advisorAttentionPoints ?? []}
              tone="amber"
            />
            <SmartChecklist
              title="Notes conformité"
              icon={RefreshCw}
              items={ai.complianceNotes ?? []}
              tone="sky"
            />
          </div>
        </ContentCard>
      ) : null}
    </div>
  )
}

function SmartList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ title: string; detail: string; priority?: "LOW" | "MEDIUM" | "HIGH" }>
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={`${item.title}-${item.detail}`} className={`rounded-xl border p-3 ${aiPriorityClass(item.priority)}`}>
              <p className="text-sm font-black">{item.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 opacity-90">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">{empty}</p>
      )}
    </div>
  )
}

function SmartChecklist({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string
  icon: LucideIcon
  items: string[]
  tone: "amber" | "sky"
}) {
  const iconClass = tone === "amber" ? "text-amber-500" : "text-sky-500"
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {items.map((point) => (
            <li key={point} className="flex gap-2">
              <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">À générer au prochain recalcul.</p>
      )}
    </div>
  )
}

function Metric({ label, value, detail, tone = "sky" }: { label: string; value: number | string; detail: string; tone?: "sky" | "amber" | "emerald" | "violet" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-800",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
    violet: "bg-violet-50 text-violet-800",
  }
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  )
}

function ResultLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{formatMoney(value)}</span>
    </div>
  )
}

function inputDisplay(analysis: Analysis, key: string, money = false) {
  const input = analysis.inputs.find((item) => item.inputKey === key)
  const value = extractValue(input?.inputValue)
  if (value === null || value === undefined || value === "") return "À confirmer"
  if (typeof value === "boolean") return String(value)
  if (money) return formatMoney(Number(value))
  return String(value)
}

function ProofMeta({
  label,
  value,
  href,
  tone = "sky",
}: {
  label: string
  value: string
  href?: string
  tone?: "sky" | "amber" | "emerald" | "violet" | "slate"
}) {
  const tones = {
    sky: "text-sky-800",
    amber: "text-amber-800",
    emerald: "text-emerald-800",
    violet: "text-violet-800",
    slate: "text-slate-700",
  }
  const body = (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${tones[tone]}`}>{value}</p>
    </div>
  )
  return href ? (
    <Link href={href} className="block transition hover:scale-[1.01]">
      {body}
    </Link>
  ) : body
}

function ProofStep({
  icon: Icon,
  title,
  detail,
  done,
  href,
}: {
  icon: LucideIcon
  title: string
  detail: string
  done: boolean
  href?: string
}) {
  const content = (
    <div className={done ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" : "rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700"}>
      <div className="flex items-start gap-3">
        <span className={done ? "grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700" : "grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500"}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-5 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  )

  if (!href) return content
  return (
    <Link href={href} className="block transition hover:scale-[1.01]">
      {content}
    </Link>
  )
}
