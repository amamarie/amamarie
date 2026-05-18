"use client"

import { Bot, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, ClipboardCheck, Copy, FileWarning, Loader2, RefreshCw, Save, ShieldAlert, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react"
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { complianceScoreLabel } from "@/lib/compliance/score"
import { ClientAmlSection } from "./ClientAmlSection"

type KycProfile = {
  id: string
  status: string
  subjectType: string
  legalFirstName: string | null
  legalLastName: string | null
  dateOfBirth: string | null
  countryOfResidence: string | null
  provinceOfResidence: string | null
  maritalStatus: string | null
  dependentsCount: number | null
  employmentStatus: string | null
  occupation: string | null
  employer: string | null
  annualIncome: number | null
  incomeRange: string | null
  netWorth: number | null
  liquidNetWorth: number | null
  totalAssets: number | null
  totalLiabilities: number | null
  monthlyExpenses: number | null
  emergencyFund: number | null
  liquidityNeeds: string | null
  investmentKnowledge: string | null
  investmentExperience: string | null
  borrowingNeeds: string | null
  sourceOfWealth: string | null
  sourceOfFunds: string | null
  primaryObjective: string | null
  investmentHorizon: string | null
  riskTolerance: string | null
  riskCapacity: string | null
  riskProfileResult: string | null
  financialGoals: string | null
  protectionNeeds: string | null
  estatePlanningNeeds: boolean
  educationFundingNeeds: boolean
  politicallyExposedPerson: boolean
  advisorOverride: boolean
  advisorOverrideReason: string | null
  reviewStatus: string | null
  reviewNotes: string | null
  advisorAttestation: boolean
  clientConfirmedNoChange?: boolean | null
  complianceScore: number
  nextKycReviewAt: string | null
}

type KybProfile = {
  id: string
  status: string
  subjectType: string
  legalName: string | null
  tradeName: string | null
  entityType: string | null
  jurisdiction: string | null
  registrationNumber: string | null
  taxNumber: string | null
  incorporationDate: string | null
  headOfficeAddress: string | null
  operatingAddress: string | null
  businessActivity: string | null
  industry: string | null
  website: string | null
  annualRevenue: number | null
  netProfit: number | null
  employeeCount: number | null
  cashIntensiveBusiness: boolean
  internationalActivity: boolean
  regulatedActivity: boolean
  directorsDocumented: boolean
  shareholdersDocumented: boolean
  beneficialOwnersDocumented: boolean
  authorizedSignersDocumented: boolean
  corporateDocumentsCollected: boolean
  ownershipStructureNotes: string | null
  authorizedSignersNotes: string | null
  beneficialOwnersNotes: string | null
  sourceOfFunds: string | null
  sourceOfWealth: string | null
  amlRiskLevel: string | null
  kybScore: number
  reviewNotes: string | null
  nextReviewAt: string | null
}

type KycClientSeed = {
  profileType: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  country: string | null
  province: string | null
  familyStatus: string | null
  dependents: number | null
  dependentsCount: number | null
  occupation: string | null
  employer: string | null
  employmentStatus: string | null
  yearsAtJob: number | null
  annualIncome: number | null
  approximateIncome: number | null
  incomeRange: string | null
  netWorth: number | null
  liquidAssets: number | null
  liabilities: number | null
  primaryGoal: string | null
  investmentHorizon: string | null
  riskProfile: string | null
  financialGoals: string | null
  goals: string | null
  protectionNeeds: boolean
  retirementGoal: boolean
  kycCompleted?: boolean
  nextReviewDate: string | null
}

type Consent = {
  id: string
  type: string
  status: string
  givenAt: string | null
  revokedAt: string | null
  expiresAt?: string | null
  method?: string | null
  version?: string | null
  purpose?: { id: string; code: string; name: string; isRequiredForService: boolean; sensitiveDataAllowed: boolean } | null
  template?: { id: string; title: string; version: string; language: string } | null
  events?: Array<{ id: string; eventType: string; actorType: string; createdAt: string }>
}
type PrivacyPurpose = { id: string; code: string; name: string; description?: string | null; isRequiredForService: boolean; sensitiveDataAllowed: boolean }
type PrivacyRequest = { id: string; requestType: string; status: string; receivedAt: string; dueAt: string | null; identityVerified: boolean; notes?: string | null }
type DataDisclosure = { id: string; recipientName: string; recipientType: string; method: string; outsideQuebec: boolean; disclosedAt: string; purpose?: { name: string } | null; consent?: { type: string } | null }
type Alert = { id: string; type: string; severity: string; status: string; title: string; description: string }
type AiSuggestedAction = { label: string; type: string; priority: string }
type AiExplanation = {
  id: string
  status: string
  summary: string
  whyItTriggered: string
  clientContext: string | null
  missingData: string[] | null
  suggestedActions: AiSuggestedAction[] | null
  advisorNoteDraft: string | null
  clientMessageDraft: string | null
  riskLevelExplanation: string | null
  complianceDisclaimer: string
}
type SnapshotSummary = {
  kycStatus?: string | null
  complianceScore?: number | null
  subjectType?: string | null
  identityVerified?: boolean
  consentGiven?: boolean
  activeConsents?: number
  documentsTotal?: number
  documentsValidated?: number
  documentsRequiredOpen?: number
  openAlerts?: number
  criticalAlerts?: number
  productsTotal?: number
}
type Snapshot = {
  id: string
  version: number
  reason: string
  createdAt: string
  snapshotData?: {
    capturedAt?: string
    summary?: SnapshotSummary
  } | null
  createdBy?: { name: string | null; email?: string | null } | null
  _count?: { insuranceNeedsAnalyses: number }
}
type AuditLog = { id: string; action: string; entityType: string; createdAt: string; user?: { name: string } | null }
type ComplianceCenterSummary = {
  metrics: {
    openEvents: number
    openComplaints: number
    openIncidents: number
    openSupervisionReviews: number
    pendingExceptions: number
    blockingChecklistItems: number
    auditReports: number
  }
  events: Array<{ id: string; eventCategory: string; eventTitle: string; description: string | null; severity: string; status: string; createdAt: string; assignedTo?: { name: string | null; role: string } | null }>
  complaints: Array<{ id: string; complaintNumber: string; category: string | null; description: string; severity: string; status: string; receivedAt: string; assignedTo?: { name: string | null; role: string } | null }>
  incidents: Array<{ id: string; incidentNumber: string; incidentType: string; description: string; riskLevel: string; seriousHarmRisk: boolean; status: string; detectedAt: string; assignedTo?: { name: string | null; role: string } | null }>
  supervisionReviews: Array<{ id: string; reviewType: string; riskLevel: string; status: string; findings: string | null; requiredCorrections: string | null; createdAt: string; reviewer?: { name: string | null; role: string } | null }>
  exceptions: Array<{ id: string; exceptionType: string; reason: string; riskLevel: string; status: string; createdAt: string; approvedBy?: { name: string | null; role: string } | null }>
  checklistResults: Array<{ id: string; status: string; note: string | null; updatedAt: string; checklist: { id: string; name: string; productType: string }; item: { id: string; label: string; blocking: boolean; required: boolean } | null }>
  auditReports: Array<{ id: string; title: string; reportType: string; status: string; generatedAt: string; signedHash: string | null; createdBy?: { name: string | null; role: string } | null }>
  activeChecklists: Array<{ id: string; name: string; productType: string; version: string; items: Array<{ id: string; label: string; blocking: boolean; required: boolean }> }>
}

type ComplianceView = "summary" | "profile" | "aml" | "evidence"

const auditActionLabels: Record<string, string> = {
  REPORT_GENERATED: "Rapport généré",
  PANDADOC_SIGNATURE_SENT: "Envoyé au client",
  PANDADOC_SIGNATURE_COMPLETED: "Signé par le client",
  PANDADOC_SIGNATURE_FAILED: "Signature à relancer",
  PANDADOC_STATUS_UPDATED: "Statut de signature mis à jour",
  LOCKED: "Verrouillé par le conseiller",
  USED_FOR_SUBMISSION: "Utilisé pour soumission",
  NEW_VERSION_CREATED: "Nouvelle version créée",
  CLIENT_CONFIRMED_RECEIPT: "Réception confirmée par le client",
  CALCULATED: "Analyse recalculée",
  AI_SUGGESTIONS_GENERATED: "Suggestions IA générées",
  AI_SMART_ACTIONS_APPLIED: "Tâches IA créées",
  AI_DOCUMENT_REQUESTS_SENT: "Documents IA demandés",
  INSURANCE_NEEDS_SETTINGS_UPDATED: "Hypothèses d’analyse modifiées",
  INPUT_UPDATED: "Donnée d’analyse modifiée",
  OPPORTUNITY_LINKED: "Opportunité liée",
}

const auditEntityLabels: Record<string, string> = {
  InsuranceNeedsAnalysis: "Analyse des besoins",
  InsuranceNeedsSettings: "Paramètres d’analyse",
  KYC: "Profil client",
  KYB: "Profil entreprise",
  CONSENT: "Consentement",
  COMPLIANCE_ALERT: "Alerte conformité",
  DOCUMENT: "Document",
  KycSnapshot: "Version profil",
  PRIORITY_ITEM: "Priorité",
}

function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (value) => value.toUpperCase())
}

function auditEntityLabel(entityType: string) {
  return auditEntityLabels[entityType] ?? entityType
}

function isConsentActive(consent: Consent) {
  if (consent.status !== "GIVEN") return false
  if (!consent.expiresAt) return true
  return new Date(consent.expiresAt).getTime() > Date.now()
}

const kycStatusLabels: Record<string, string> = {
  NOT_STARTED: "Non commencé",
  IN_PROGRESS: "En cours",
  PENDING_DOCUMENTS: "Documents requis",
  PENDING_REVIEW: "À vérifier",
  APPROVED: "Approuvé",
  NEEDS_UPDATE: "Mise à jour requise",
  EXPIRED: "Expiré",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
}

const severityTone: Record<string, "slate" | "emerald" | "sky" | "amber" | "rose" | "violet"> = {
  LOW: "slate",
  MEDIUM: "sky",
  HIGH: "amber",
  CRITICAL: "rose",
}

const corePrivacyPurposeCodes = new Set(["client_profile_collection", "kyc_use", "insurance_needs_analysis", "document_vault"])
const actionPrivacyPurposeCodes = new Set(["ai_assistance", "insurer_disclosure"])

const countryOptions = [
  { value: "", label: "À compléter" },
  { value: "Canada", label: "Canada" },
  { value: "États-Unis", label: "États-Unis" },
  { value: "France", label: "France" },
  { value: "Autre", label: "Autre" },
]

const provinceOptions = [
  { value: "", label: "À compléter" },
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "AB", label: "Alberta" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "NU", label: "Nunavut" },
  { value: "Autre", label: "Autre" },
]

const maritalStatusOptions = [
  { value: "", label: "À compléter" },
  { value: "SINGLE", label: "Célibataire" },
  { value: "MARRIED", label: "Marié(e)" },
  { value: "COMMON_LAW", label: "Conjoint(e) de fait" },
  { value: "DIVORCED", label: "Divorcé(e)" },
  { value: "WIDOWED", label: "Veuf/veuve" },
  { value: "OTHER", label: "Autre" },
]

const employmentStatusOptions = [
  { value: "", label: "À compléter" },
  { value: "EMPLOYED", label: "Employé(e)" },
  { value: "SELF_EMPLOYED", label: "Travailleur autonome" },
  { value: "BUSINESS_OWNER", label: "Entrepreneur / propriétaire" },
  { value: "INCORPORATED", label: "Incorporé(e)" },
  { value: "RETIRED", label: "Retraité(e)" },
  { value: "UNEMPLOYED", label: "Sans emploi" },
  { value: "STUDENT", label: "Étudiant(e)" },
  { value: "OTHER", label: "Autre" },
]

const clientProfileTypeOptions = [
  { value: "INDIVIDUAL", label: "Personne physique" },
  { value: "BUSINESS", label: "Entreprise / société" },
  { value: "TRUST", label: "Fiducie" },
  { value: "ESTATE", label: "Succession" },
  { value: "HOUSEHOLD", label: "Ménage / famille" },
  { value: "NON_PROFIT", label: "OBNL / association" },
  { value: "OTHER", label: "Autre type de dossier" },
]

const clientProfileTypeLabels = Object.fromEntries(clientProfileTypeOptions.map((option) => [option.value, option.label]))

const kybSubjectTypeOptions = clientProfileTypeOptions.filter((option) => ["BUSINESS", "TRUST", "ESTATE", "NON_PROFIT", "OTHER"].includes(option.value))

const entityTypeOptions = [
  { value: "", label: "À compléter" },
  { value: "OPERATING_COMPANY", label: "Société opérante" },
  { value: "HOLDING", label: "Société de gestion / holding" },
  { value: "CORPORATION", label: "Société par actions" },
  { value: "TRUST", label: "Fiducie" },
  { value: "PARTNERSHIP", label: "Société de personnes" },
  { value: "SOLE_PROPRIETOR", label: "Entreprise individuelle" },
  { value: "NON_PROFIT", label: "OBNL / association" },
  { value: "OTHER", label: "Autre" },
]

const jurisdictionOptions = [
  { value: "", label: "À compléter" },
  { value: "QC", label: "Québec" },
  { value: "CA", label: "Fédéral Canada" },
  { value: "ON", label: "Ontario" },
  { value: "US", label: "États-Unis" },
  { value: "OTHER", label: "Autre juridiction" },
]

const industryOptions = [
  { value: "", label: "À compléter" },
  { value: "PROFESSIONAL_SERVICES", label: "Services professionnels" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "REAL_ESTATE", label: "Immobilier" },
  { value: "TECHNOLOGY", label: "Technologie" },
  { value: "HEALTHCARE", label: "Santé" },
  { value: "RETAIL", label: "Commerce de détail" },
  { value: "MANUFACTURING", label: "Fabrication" },
  { value: "FINANCIAL_SERVICES", label: "Services financiers" },
  { value: "OTHER", label: "Autre" },
]

const amlRiskLevelOptions = [
  { value: "", label: "À compléter" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Élevé" },
]

const yesNoOptions = [
  { value: "", label: "À compléter" },
  { value: "true", label: "Oui" },
  { value: "false", label: "Non" },
]

const incomeRangeOptions = [
  { value: "", label: "À compléter" },
  { value: "0-49999", label: "0 $ à 49 999 $" },
  { value: "50000-99999", label: "50 000 $ à 99 999 $" },
  { value: "100000-149999", label: "100 000 $ à 149 999 $" },
  { value: "150000-249999", label: "150 000 $ à 249 999 $" },
  { value: "250000+", label: "250 000 $ et plus" },
]

const objectiveOptions = [
  { value: "", label: "À compléter" },
  { value: "RETIREMENT", label: "Retraite" },
  { value: "PROTECTION", label: "Protection familiale" },
  { value: "WEALTH_BUILDING", label: "Croissance du patrimoine" },
  { value: "TAX_OPTIMIZATION", label: "Optimisation fiscale" },
  { value: "EDUCATION", label: "Études des enfants" },
  { value: "BUSINESS_PROTECTION", label: "Protection d’entreprise" },
  { value: "ESTATE_PLANNING", label: "Planification successorale" },
  { value: "OTHER", label: "Autre" },
]

const horizonOptions = [
  { value: "", label: "À compléter" },
  { value: "SHORT_TERM", label: "Court terme (0-3 ans)" },
  { value: "MEDIUM_TERM", label: "Moyen terme (3-10 ans)" },
  { value: "LONG_TERM", label: "Long terme (10 ans et plus)" },
]

const riskOptions = [
  { value: "", label: "À compléter" },
  { value: "CONSERVATIVE", label: "Conservateur" },
  { value: "MODERATE", label: "Modéré" },
  { value: "BALANCED", label: "Équilibré" },
  { value: "GROWTH", label: "Croissance" },
  { value: "AGGRESSIVE", label: "Audacieux" },
]

const riskCapacityOptions = [
  { value: "", label: "À compléter" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Élevée" },
]

const liquidityNeedOptions = [
  { value: "", label: "À compléter" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Élevé" },
]

const investmentKnowledgeOptions = [
  { value: "", label: "À compléter" },
  { value: "BEGINNER", label: "Débutant" },
  { value: "INTERMEDIATE", label: "Intermédiaire" },
  { value: "ADVANCED", label: "Avancé" },
]

const investmentExperienceOptions = [
  { value: "", label: "À compléter" },
  { value: "NONE", label: "Aucune expérience" },
  { value: "FUNDS_ETF", label: "Fonds / FNB" },
  { value: "BONDS_GIC", label: "Obligations / CPG" },
  { value: "STOCKS", label: "Actions" },
  { value: "ADVANCED_PRODUCTS", label: "Produits complexes" },
]

const borrowingNeedOptions = [
  { value: "", label: "À compléter" },
  { value: "NO_LEVERAGE", label: "Aucun emprunt pour investir" },
  { value: "PERSONAL_DEBT_ONLY", label: "Dettes personnelles seulement" },
  { value: "USES_LEVERAGE", label: "Utilise ou envisage du levier" },
  { value: "TO_REVIEW", label: "À revoir avec le conseiller" },
]

const sourceOfFundsOptions = [
  { value: "", label: "À compléter" },
  { value: "Salaire / épargne", label: "Salaire / épargne" },
  { value: "Vente immobilière", label: "Vente immobilière" },
  { value: "Héritage", label: "Héritage" },
  { value: "Vente d’entreprise", label: "Vente d’entreprise" },
  { value: "Dividendes", label: "Dividendes" },
  { value: "Transfert d’un compte existant", label: "Transfert d’un compte existant" },
  { value: "Don familial", label: "Don familial" },
  { value: "Prêt", label: "Prêt" },
  { value: "Autre", label: "Autre" },
]

const sourceOfWealthOptions = [
  { value: "", label: "À compléter" },
  { value: "Carrière professionnelle", label: "Carrière professionnelle" },
  { value: "Entreprise", label: "Entreprise" },
  { value: "Immobilier", label: "Immobilier" },
  { value: "Héritage familial", label: "Héritage familial" },
  { value: "Placements", label: "Placements" },
  { value: "Vente d’actifs", label: "Vente d’actifs" },
  { value: "Autre", label: "Autre" },
]

const protectionNeedOptions = [
  { value: "", label: "À compléter" },
  { value: "Protection familiale ou assurance à analyser", label: "Protection familiale" },
  { value: "Assurance vie", label: "Assurance vie" },
  { value: "Assurance invalidité", label: "Assurance invalidité" },
  { value: "Maladies graves", label: "Maladies graves" },
  { value: "Protection entreprise", label: "Protection entreprise" },
  { value: "Objectif retraite à documenter", label: "Objectif retraite" },
  { value: "Autre", label: "Autre" },
]

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number") return "Non documenté"
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function filled(...values: unknown[]) {
  return values.filter((value) => {
    if (typeof value === "string") return value.trim().length > 0
    return value !== null && typeof value !== "undefined" && value !== false
  }).length
}

function valueOrSeed<T>(value: T | null | undefined, seed: T | null | undefined): T | null | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value
  return seed
}

function dateValue(value?: string | null) {
  return value?.slice(0, 10)
}

function booleanValue(value?: boolean | null) {
  return typeof value === "boolean" ? String(value) : ""
}

function riskSeed(value?: string | null) {
  if (!value || value === "UNKNOWN") return null
  return value
}

function protectionSeed(client: KycClientSeed) {
  if (client.protectionNeeds) return "Protection familiale ou assurance à analyser"
  if (client.retirementGoal) return "Objectif retraite à documenter"
  return null
}

function requiresKyb(profileType?: string | null, employmentStatus?: string | null) {
  if (profileType && ["BUSINESS", "TRUST", "ESTATE", "NON_PROFIT"].includes(profileType)) return true
  return Boolean(employmentStatus && ["SELF_EMPLOYED", "BUSINESS_OWNER", "INCORPORATED"].includes(employmentStatus))
}

function getProfilePolicy(profileType?: string | null) {
  switch (profileType) {
    case "BUSINESS":
      return {
        title: "Entreprise / société",
        subtitle: "Le dossier doit identifier l’entité et les personnes qui la contrôlent.",
        primaryModule: "KYB",
        objective: "Comprendre l’entreprise, son activité, ses propriétaires, ses signataires et ses besoins corporatifs.",
        requirements: [
          "Fiche légale de l’entreprise",
          "Administrateurs et dirigeants",
          "Actionnaires et bénéficiaires effectifs",
          "Signataires autorisés",
          "Documents corporatifs",
          "Source des fonds et source de richesse",
        ],
        analysis: "Analyse corporative, personne clé, rachat de parts, dette commerciale, convention entre actionnaires.",
      }
    case "TRUST":
      return {
        title: "Fiducie",
        subtitle: "Le dossier doit distinguer fiduciaires, constituants, bénéficiaires et contrôle réel.",
        primaryModule: "KYB + AML",
        objective: "Documenter la structure, l’autorité, les bénéficiaires connus et la provenance des fonds.",
        requirements: [
          "Acte ou convention de fiducie",
          "Fiduciaires et personnes autorisées",
          "Constituant et bénéficiaires connus",
          "Bénéficiaires effectifs lorsque applicable",
          "Source des fonds",
          "Revue AML renforcée si structure complexe",
        ],
        analysis: "Planification successorale, fiscalité, liquidités, bénéficiaires, acceptabilité AML.",
      }
    case "ESTATE":
      return {
        title: "Succession",
        subtitle: "Le dossier doit confirmer qui peut agir et sur quels actifs ou obligations.",
        primaryModule: "KYB + documents",
        objective: "Valider le liquidateur, les documents successoraux, les bénéficiaires et les besoins de liquidité.",
        requirements: [
          "Preuve de décès ou document successoral",
          "Liquidateur ou représentant autorisé",
          "Inventaire sommaire des actifs",
          "Bénéficiaires connus",
          "Documents d’autorité",
          "Objectif de liquidation ou de transfert",
        ],
        analysis: "Liquidités successorales, fiscalité au décès, transfert d’actifs, besoins d’assurance ou de placement.",
      }
    case "HOUSEHOLD":
      return {
        title: "Ménage / famille",
        subtitle: "Le dossier regroupe plusieurs personnes, mais chaque adulte doit garder ses données propres.",
        primaryModule: "Profil ménage",
        objective: "Analyser les revenus, obligations, objectifs et protections au niveau familial sans mélanger les consentements.",
        requirements: [
          "Profil client de chaque adulte concerné",
          "Consentements distincts",
          "Revenus du ménage",
          "Personnes à charge",
          "Objectifs communs",
          "Protections existantes",
        ],
        analysis: "Protection familiale, retraite commune, études des enfants, budget, bénéficiaires.",
      }
    case "NON_PROFIT":
      return {
        title: "OBNL / association",
        subtitle: "Le dossier doit confirmer l’existence, la mission, les administrateurs et les pouvoirs de signature.",
        primaryModule: "KYB",
        objective: "Comprendre l’organisme, ses administrateurs, ses sources de financement et son autorité de signature.",
        requirements: [
          "Nom légal et numéro d’organisme",
          "Administrateurs",
          "Signataires autorisés",
          "Mission et activités",
          "Source des fonds",
          "Documents de gouvernance",
        ],
        analysis: "Gestion des liquidités, placements institutionnels simples, gouvernance et conformité.",
      }
    case "OTHER":
      return {
        title: "Autre type de dossier",
        subtitle: "Le dossier doit être classé avant de produire une recommandation fiable.",
        primaryModule: "Classification",
        objective: "Déterminer si le dossier doit suivre un parcours personne, entreprise, fiducie, succession ou ménage.",
        requirements: [
          "Type réel du client",
          "Personnes autorisées",
          "Documents justificatifs",
          "Objectif du dossier",
          "Risque AML initial",
          "Note conseiller",
        ],
        analysis: "À déterminer selon la classification finale.",
      }
    default:
      return {
        title: "Personne physique",
        subtitle: "Le dossier vise une personne cliente et son profil personnel, financier et familial.",
        primaryModule: "Profil client",
        objective: "Comprendre la personne, ses revenus, ses objectifs, son profil de risque et ses besoins de protection.",
        requirements: [
          "Identité et coordonnées",
          "Situation familiale",
          "Emploi et revenus",
          "Actifs et dettes",
          "Objectifs",
          "Profil de risque et consentements",
        ],
        analysis: "Assurance vie, invalidité, maladies graves, retraite, placement et convenance.",
      }
  }
}

export function ClientComplianceTab({
  clientId,
  client,
  onSynced,
  focusKycRequest = 0,
  focusTarget = "kyc",
  initialView = "summary",
  profileMode = false,
}: {
  clientId: string
  client: KycClientSeed
  onSynced?: () => Promise<void> | void
  focusKycRequest?: number
  focusTarget?: "kyc" | "alerts" | "consents"
  initialView?: ComplianceView
  profileMode?: boolean
}) {
  const [kyc, setKyc] = useState<KycProfile | null>(null)
  const [kyb, setKyb] = useState<KybProfile | null>(null)
  const [consents, setConsents] = useState<Consent[]>([])
  const [privacyPurposes, setPrivacyPurposes] = useState<PrivacyPurpose[]>([])
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([])
  const [dataDisclosures, setDataDisclosures] = useState<DataDisclosure[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [complianceCenter, setComplianceCenter] = useState<ComplianceCenterSummary | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [aiExplanations, setAiExplanations] = useState<Record<string, AiExplanation>>({})
  const [activeComplianceView, setActiveComplianceView] = useState<ComplianceView>(initialView)

  const loadCompliance = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [kycResponse, kybResponse, consentsResponse, purposesResponse, privacyRequestsResponse, disclosuresResponse, alertsResponse, snapshotsResponse, auditResponse, complianceCenterResponse] = await Promise.all([
        fetch(`/api/clients/${clientId}/kyc`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/kyb`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/consents`, { cache: "no-store" }),
        fetch(`/api/privacy/purposes`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/privacy-requests`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/data-disclosures`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/compliance-alerts`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/kyc/snapshots`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/audit-logs`, { cache: "no-store" }),
        fetch(`/api/clients/${clientId}/compliance-center`, { cache: "no-store" }),
      ])
      const kycResult = await readData<{ kyc: KycProfile | null }>(kycResponse)
      const kybResult = await readData<{ kyb: KybProfile | null }>(kybResponse)
      setKyc(kycResult.kyc)
      setKyb(kybResult.kyb)
      setConsents(await readData<Consent[]>(consentsResponse))
      setPrivacyPurposes(await readData<PrivacyPurpose[]>(purposesResponse))
      setPrivacyRequests(await readData<PrivacyRequest[]>(privacyRequestsResponse))
      setDataDisclosures(await readData<DataDisclosure[]>(disclosuresResponse))
      setAlerts(await readData<Alert[]>(alertsResponse))
      setSnapshots(await readData<Snapshot[]>(snapshotsResponse))
      setAuditLogs(await readData<AuditLog[]>(auditResponse))
      setComplianceCenter(await readData<ComplianceCenterSummary>(complianceCenterResponse))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la conformité.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCompliance()
  }, [loadCompliance])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveComplianceView(initialView)
  }, [initialView])

  useEffect(() => {
    if (!focusKycRequest || isLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveComplianceView(profileMode ? (focusTarget === "consents" ? "evidence" : "profile") : focusTarget === "consents" ? "evidence" : "summary")
    const timer = window.setTimeout(() => {
      const targetId = focusTarget === "consents" ? "kyc-consents-panel" : focusTarget === "alerts" ? "kyc-alerts-panel" : "client-kyc-questionnaire"
      const target = document.getElementById(targetId)
      target?.scrollIntoView({ behavior: "smooth", block: "start" })
      const firstInput = target?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
      firstInput?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusKycRequest, focusTarget, isLoading, profileMode])

  const openAlerts = useMemo(() => alerts.filter((alert) => alert.status === "OPEN"), [alerts])
  const score = kyc?.complianceScore ?? 0
  const criticalAlerts = openAlerts.filter((alert) => alert.severity === "CRITICAL" || alert.severity === "HIGH")
  const activeConsents = consents.filter(isConsentActive)
  const consentedPurposeIds = new Set(activeConsents.map((consent) => consent.purpose?.id).filter(Boolean))
  const missingCorePrivacyPurposes = privacyPurposes.filter((purpose) => !consentedPurposeIds.has(purpose.id) && (purpose.isRequiredForService || corePrivacyPurposeCodes.has(purpose.code)))
  const missingActionPrivacyPurposes = privacyPurposes.filter((purpose) => !consentedPurposeIds.has(purpose.id) && actionPrivacyPurposeCodes.has(purpose.code))
  const missingPrivacyPurposes = [...missingCorePrivacyPurposes, ...missingActionPrivacyPurposes]
  const marketingConsent = activeConsents.find((consent) => consent.purpose?.code === "marketing" || consent.type.toLowerCase().includes("marketing"))
  const aiConsent = activeConsents.find((consent) => consent.purpose?.code === "ai_assistance" || consent.type.toLowerCase().includes("ia"))
  const hasSnapshot = snapshots.length > 0
  const hasKyc = Boolean(kyc)
  const subjectType = kyc?.subjectType ?? client.profileType ?? "INDIVIDUAL"
  const kybRequired = requiresKyb(subjectType, kyc?.employmentStatus ?? client.employmentStatus)
  const seededKybSubjectType = kyb?.subjectType ?? (["BUSINESS", "TRUST", "ESTATE", "NON_PROFIT", "OTHER"].includes(subjectType) ? subjectType : "BUSINESS")
  const seededKyb = {
    subjectType: seededKybSubjectType,
    legalName: valueOrSeed(kyb?.legalName, client.employer),
    tradeName: kyb?.tradeName,
    entityType: kyb?.entityType,
    jurisdiction: kyb?.jurisdiction ?? client.province ?? "QC",
    registrationNumber: kyb?.registrationNumber,
    taxNumber: kyb?.taxNumber,
    incorporationDate: kyb?.incorporationDate,
    headOfficeAddress: valueOrSeed(kyb?.headOfficeAddress, client.country ? [client.province, client.country].filter(Boolean).join(", ") : null),
    operatingAddress: kyb?.operatingAddress,
    businessActivity: valueOrSeed(kyb?.businessActivity, client.occupation),
    industry: kyb?.industry,
    website: kyb?.website,
    annualRevenue: kyb?.annualRevenue,
    netProfit: kyb?.netProfit,
    employeeCount: kyb?.employeeCount,
    sourceOfFunds: kyb?.sourceOfFunds,
    sourceOfWealth: kyb?.sourceOfWealth,
    amlRiskLevel: kyb?.amlRiskLevel,
    nextReviewAt: kyb?.nextReviewAt ?? client.nextReviewDate,
  }
  const seededKyc = {
    subjectType,
    legalFirstName: valueOrSeed(kyc?.legalFirstName, client.firstName),
    legalLastName: valueOrSeed(kyc?.legalLastName, client.lastName),
    dateOfBirth: valueOrSeed(kyc?.dateOfBirth, client.dateOfBirth),
    countryOfResidence: valueOrSeed(kyc?.countryOfResidence, client.country ?? "Canada"),
    provinceOfResidence: valueOrSeed(kyc?.provinceOfResidence, client.province),
    maritalStatus: valueOrSeed(kyc?.maritalStatus, client.familyStatus),
    dependentsCount: valueOrSeed(kyc?.dependentsCount, client.dependentsCount ?? client.dependents),
    employmentStatus: valueOrSeed(kyc?.employmentStatus, client.employmentStatus),
    yearsAtJob: client.yearsAtJob,
    occupation: valueOrSeed(kyc?.occupation, client.occupation),
    employer: valueOrSeed(kyc?.employer, client.employer),
    annualIncome: valueOrSeed(kyc?.annualIncome, client.annualIncome ?? client.approximateIncome),
    incomeRange: valueOrSeed(kyc?.incomeRange, client.incomeRange),
    totalLiabilities: valueOrSeed(kyc?.totalLiabilities, client.liabilities),
    netWorth: valueOrSeed(kyc?.netWorth, client.netWorth),
    liquidNetWorth: valueOrSeed(kyc?.liquidNetWorth, client.liquidAssets),
    monthlyExpenses: kyc?.monthlyExpenses,
    emergencyFund: kyc?.emergencyFund,
    liquidityNeeds: kyc?.liquidityNeeds,
    investmentKnowledge: kyc?.investmentKnowledge,
    investmentExperience: kyc?.investmentExperience,
    borrowingNeeds: kyc?.borrowingNeeds,
    primaryObjective: valueOrSeed(kyc?.primaryObjective, client.primaryGoal),
    investmentHorizon: valueOrSeed(kyc?.investmentHorizon, client.investmentHorizon),
    riskProfileResult: valueOrSeed(kyc?.riskProfileResult, riskSeed(client.riskProfile)),
    protectionNeeds: valueOrSeed(kyc?.protectionNeeds, protectionSeed(client)),
    financialGoals: valueOrSeed(kyc?.financialGoals, client.financialGoals ?? client.goals),
    nextKycReviewAt: valueOrSeed(kyc?.nextKycReviewAt, client.nextReviewDate),
  }
  const kycCompleteness = kyc
    ? Math.round((filled(
        seededKyc.legalFirstName,
        seededKyc.legalLastName,
        seededKyc.dateOfBirth,
        seededKyc.countryOfResidence,
        seededKyc.provinceOfResidence,
        seededKyc.maritalStatus,
        seededKyc.employmentStatus,
        seededKyc.annualIncome ?? seededKyc.incomeRange,
        seededKyc.netWorth ?? kyc.totalAssets,
        seededKyc.totalLiabilities,
        seededKyc.primaryObjective,
        seededKyc.investmentHorizon,
        kyc.riskTolerance,
        kyc.riskCapacity,
        seededKyc.riskProfileResult,
        kyc.sourceOfFunds,
        kyc.sourceOfWealth,
        kyc.liquidityNeeds,
        kyc.investmentKnowledge,
        kyc.investmentExperience,
        kyc.borrowingNeeds,
        activeConsents.length > 0
      ) / 22) * 100)
    : 0
  const recommendationStatus = !kyc
    ? "Non prêt"
    : criticalAlerts.length > 0
      ? "Approbation requise"
      : kycCompleteness < 75
        ? "Non prêt"
        : hasSnapshot
          ? "Prêt"
          : "Prêt avec réserves"
  const recommendationTone: "emerald" | "amber" | "rose" | "sky" =
    recommendationStatus === "Prêt" ? "emerald" : recommendationStatus === "Prêt avec réserves" ? "amber" : recommendationStatus === "Approbation requise" ? "rose" : "sky"
  const kybCompleteness = kyb
    ? kyb.kybScore
    : kybRequired
      ? Math.round((filled(
          seededKyb.legalName,
          seededKyb.entityType,
          seededKyb.jurisdiction,
          seededKyb.registrationNumber,
          seededKyb.businessActivity,
          seededKyb.sourceOfFunds,
          seededKyb.sourceOfWealth,
          seededKyb.amlRiskLevel
        ) / 13) * 100)
      : 0
  const profilePolicy = getProfilePolicy(subjectType)
  const profileRequirementRows = [
    { label: "Type classé", done: Boolean(subjectType && subjectType !== "OTHER"), detail: clientProfileTypeLabels[subjectType] ?? "À confirmer" },
    { label: "profil client personnel", done: hasKyc && kycCompleteness >= 75, detail: hasKyc ? `${kycCompleteness} % de complétude` : "Profil client à créer" },
    { label: "KYB requis", done: !kybRequired || (Boolean(kyb) && kybCompleteness >= 75), detail: kybRequired ? (kyb ? `${kybCompleteness} % de complétude` : "Profil KYB à créer") : "Non requis selon le type actuel" },
    { label: "AML actif", done: criticalAlerts.length === 0, detail: criticalAlerts.length === 0 ? "Aucun blocage critique" : `${criticalAlerts.length} alerte(s) critique(s)` },
    { label: "Consentements", done: activeConsents.length > 0, detail: activeConsents.length > 0 ? `${activeConsents.length} actif(s)` : "Consentement à obtenir" },
    { label: "Version figée", done: hasSnapshot, detail: hasSnapshot ? `Version ${snapshots[0]?.version}` : "À créer avant recommandation" },
  ]

  const moduleCards = [
    {
      title: "Profil personne physique",
      label: "Profil client",
      icon: UserRoundCheck,
      tone: subjectType === "INDIVIDUAL" || subjectType === "HOUSEHOLD" ? "emerald" as const : "slate" as const,
      status: subjectType === "INDIVIDUAL" || subjectType === "HOUSEHOLD" ? (kyc ? kycStatusLabels[kyc.status] ?? kyc.status : "Non commencé") : "Profil des personnes liées requis",
      score: `${kycCompleteness} %`,
      detail: subjectType === "INDIVIDUAL" || subjectType === "HOUSEHOLD"
        ? "Identité, famille, emploi, finances, objectifs, risque et protections."
        : "À utiliser pour les propriétaires, administrateurs, signataires et bénéficiaires effectifs.",
    },
    {
      title: "Profil entreprise",
      label: "KYB",
      icon: Building2,
      tone: kybRequired ? (kybCompleteness >= 75 ? "emerald" as const : "sky" as const) : "slate" as const,
      status: kybRequired ? (kyb ? kycStatusLabels[kyb.status] ?? kyb.status : "KYB requis") : "Non requis détecté",
      score: kybRequired ? `${kybCompleteness} %` : clientProfileTypeLabels[subjectType] ?? "Type à confirmer",
      detail: "Entités, actionnaires, signataires, bénéficiaires effectifs et documents corporatifs.",
    },
    {
      title: "Conformité AML / LBA",
      label: "AML",
      icon: ShieldAlert,
      tone: criticalAlerts.length > 0 || kyc?.politicallyExposedPerson ? "rose" as const : "amber" as const,
      status: criticalAlerts.length > 0 ? "À revoir" : "Surveillance active",
      score: `${openAlerts.length} alerte${openAlerts.length > 1 ? "s" : ""}`,
      detail: "Identité, source des fonds, source de richesse, tiers, PPV/DOI et risque.",
    },
    {
      title: "Analyse des besoins",
      label: "Conseil",
      icon: ClipboardCheck,
      tone: recommendationTone,
      status: recommendationStatus,
      score: hasSnapshot ? `Version v${snapshots[0]?.version ?? ""}` : "Version requise",
      detail: "Assurance vie, invalidité, maladies graves, corporatif, placement et convenance.",
    },
  ]

  async function saveKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      const response = await fetch(`/api/clients/${clientId}/kyc`, {
        method: kyc ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setKyc(await readData<KycProfile>(response))
      setNotice("Profil client sauvegardé.")
      await loadCompliance()
      await onSynced?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder le profil client.")
    } finally {
      setIsSaving(false)
    }
  }

  async function saveKyb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      const response = await fetch(`/api/clients/${clientId}/kyb`, {
        method: kyb ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setKyb(await readData<KybProfile>(response))
      setNotice("KYB sauvegardé.")
      await loadCompliance()
      await onSynced?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder le KYB.")
    } finally {
      setIsSaving(false)
    }
  }

  async function postAction(path: string, body: object = {}, successMessage = "Action enregistrée.") {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      await readData<unknown>(await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      setNotice(successMessage)
      await loadCompliance()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function patchAction(path: string, body: object = {}, successMessage = "Action enregistrée.") {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      await readData<unknown>(await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      setNotice(successMessage)
      await loadCompliance()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.")
    } finally {
      setIsSaving(false)
    }
  }

  async function generateAuditReport() {
    await postAction(`/api/audit-reports/client/${clientId}`, {}, "Rapport d’audit client généré avec hash de preuve.")
  }

  async function applySelectedChecklist() {
    if (!selectedChecklistId) {
      setError("Sélectionnez une checklist à appliquer.")
      return
    }
    await postAction(
      `/api/clients/${clientId}/compliance-checklists/apply`,
      { checklistId: selectedChecklistId },
      "Checklist appliquée au dossier client.",
    )
  }

  async function updateChecklistResult(result: ComplianceCenterSummary["checklistResults"][number], status: string) {
    if (!result.item?.id) {
      setError("Cet item de checklist ne peut pas être mis à jour.")
      return
    }
    await patchAction(
      `/api/compliance/checklists/${result.checklist.id}/results`,
      {
        resultId: result.id,
        clientId,
        itemId: result.item.id,
        status,
        note: status === "EXCEPTION" ? "Exception documentée depuis la fiche client." : undefined,
      },
      status === "COMPLETED" ? "Item de checklist complété." : status === "EXCEPTION" ? "Exception de checklist enregistrée." : "Item de checklist remis à revoir.",
    )
  }

  async function createPurposeConsent(purpose: PrivacyPurpose) {
    await postAction(`/api/clients/${clientId}/consents`, {
      type: purpose.name,
      purposeId: purpose.id,
      status: "GIVEN",
      version: "1.0",
      method: "ADVISOR",
      purposeText: purpose.description,
      isSensitive: purpose.sensitiveDataAllowed,
      isRequiredForService: purpose.isRequiredForService,
      dataCategories: purpose.sensitiveDataAllowed ? ["identity", "financial", "documents"] : ["contact", "preferences"],
    }, `Consentement ${purpose.name} ajouté.`)
  }

  async function requestPurposeConsent(purpose: PrivacyPurpose) {
    await postAction(`/api/clients/${clientId}/consents`, {
      type: purpose.name,
      purposeId: purpose.id,
      status: "REQUESTED",
      version: "1.0",
      method: "PORTAL",
      purposeText: purpose.description,
      isSensitive: purpose.sensitiveDataAllowed,
      isRequiredForService: purpose.isRequiredForService || corePrivacyPurposeCodes.has(purpose.code),
      dataCategories: purpose.sensitiveDataAllowed ? ["identity", "financial", "documents"] : ["contact", "preferences"],
      notes: "Demande préparée depuis le centre de confidentialité du dossier client.",
    }, `Demande de consentement ${purpose.name} créée.`)
  }

  async function createPrivacyRequest(requestType: string) {
    await postAction(`/api/clients/${clientId}/privacy-requests`, {
      requestType,
      status: "RECEIVED",
      notes: "Demande créée depuis le centre de confidentialité du dossier client.",
    }, "Demande confidentialité créée.")
  }

  async function logInsurerDisclosure() {
    await postAction(`/api/clients/${clientId}/data-disclosures`, {
      recipientName: "Assureur / tiers à préciser",
      recipientType: "INSURER",
      method: "SECURE_PORTAL",
      dataCategories: ["profil client", "documents", "analyse"],
      outsideQuebec: false,
      notes: "Divulgation à compléter avec le destinataire réel avant l’envoi.",
    }, "Divulgation journalisée.")
  }

  async function explainAlert(alertId: string) {
    setAiLoadingId(alertId)
    setError(null)
    setNotice(null)
    try {
      const explanation = await readData<AiExplanation>(
        await fetch(`/api/alerts/${alertId}/ai-explanation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )
      setAiExplanations((current) => ({ ...current, [alertId]: explanation }))
      setNotice("Explication IA générée.")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible de générer l’explication IA.")
    } finally {
      setAiLoadingId(null)
    }
  }

  async function runAiAction(alertId: string, path: string, body: object = {}, successMessage = "Action IA enregistrée.") {
    setAiLoadingId(alertId)
    setError(null)
    setNotice(null)
    try {
      const method = path === "reviewed" ? "PATCH" : "POST"
      await readData<unknown>(
        await fetch(`/api/alerts/${alertId}/ai-explanation/${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )
      setNotice(successMessage)
      await loadCompliance()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action IA impossible.")
    } finally {
      setAiLoadingId(null)
    }
  }

  function focusKycForm() {
    const form = document.getElementById("client-kyc-questionnaire")
    form?.scrollIntoView({ behavior: "smooth", block: "start" })
    const firstInput = form?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
    firstInput?.focus({ preventScroll: true })
  }

  function focusKybForm() {
    const form = document.getElementById("client-kyb-profile")
    form?.scrollIntoView({ behavior: "smooth", block: "start" })
    const firstInput = form?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
    firstInput?.focus({ preventScroll: true })
  }

  async function completeAdvisorReview() {
    await postAction(`/api/clients/${clientId}/kyc/review`, {
      advisorAttestation: true,
      clientConfirmedNoChange: openAlerts.length === 0,
      changesDetected: openAlerts.length > 0,
      reviewNotes:
        openAlerts.length > 0
          ? "Révision conseiller complétée avec alertes à suivre dans le dossier."
          : "Révision conseiller complétée. Aucun changement critique détecté au moment de la revue.",
    })
  }

  async function rejectKyc() {
    const rejectedReason = window.prompt("Raison du rejet du profil client")
    if (!rejectedReason?.trim()) return
    await postAction(`/api/clients/${clientId}/kyc/reject`, { rejectedReason: rejectedReason.trim() })
  }

  async function createAdvisorSnapshot(options: {
    advisorAttestationAccepted?: boolean
    clientAccuracyConfirmed?: boolean
    useForAnalysisOrRecommendation?: boolean
    sendToClientForConfirmation?: boolean
  }) {
    await postAction(`/api/clients/${clientId}/kyc/snapshot`, {
      reason: "ADVISOR_UPDATE",
      advisorAttestationAccepted: options.advisorAttestationAccepted ?? false,
      clientAccuracyConfirmed: options.clientAccuracyConfirmed ?? Boolean(kyc?.clientConfirmedNoChange || client.kycCompleted),
      useForAnalysisOrRecommendation: options.useForAnalysisOrRecommendation ?? false,
      sendToClientForConfirmation: options.sendToClientForConfirmation ?? false,
    })
  }

  function focusSnapshotPanel() {
    document.getElementById("kyc-snapshots-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function copyDraft(value: string | null) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setNotice("Brouillon copié.")
    } catch {
      setError("Impossible de copier le brouillon.")
    }
  }

  const readinessItems = [
    { label: "Profil client créé", done: hasKyc, detail: hasKyc ? kycStatusLabels[kyc?.status ?? ""] ?? kyc?.status ?? "En cours" : "Créer le profil depuis le formulaire." },
    { label: "Données critiques", done: kycCompleteness >= 75, detail: `${kycCompleteness} % de complétude` },
    ...(kybRequired ? [{ label: "Profil KYB", done: Boolean(kyb) && kybCompleteness >= 75, detail: kyb ? `${kybCompleteness} % de complétude entreprise` : "Créer le profil entreprise." }] : []),
    { label: "Alertes critiques", done: criticalAlerts.length === 0, detail: criticalAlerts.length === 0 ? "Aucune alerte critique ouverte" : `${criticalAlerts.length} à traiter` },
    { label: "Consentement actif", done: activeConsents.length > 0, detail: activeConsents.length > 0 ? `${activeConsents.length} actif${activeConsents.length > 1 ? "s" : ""}` : "À obtenir" },
    { label: "Attestation conseiller", done: Boolean(kyc?.advisorAttestation), detail: kyc?.advisorAttestation ? "Révision confirmée" : "Révision à compléter" },
    { label: "Version verrouillée", done: hasSnapshot, detail: hasSnapshot ? `Version ${snapshots[0]?.version}` : "À créer avant recommandation" },
    { label: "Approbation", done: kyc?.status === "APPROVED", detail: kyc?.status === "APPROVED" ? "profil client approuvé" : "À approuver si conforme" },
  ]
  const blockedItems = readinessItems.filter((item) => !item.done)
  const primaryKycAction = !hasKyc || kycCompleteness < 75
    ? { label: hasKyc ? "Compléter les champs du profil" : "Remplir le profil", description: "Ouvrir le formulaire structuré et compléter les informations manquantes.", icon: UserRoundCheck, action: focusKycForm, disabled: false }
    : kybRequired && (!kyb || kybCompleteness < 75)
      ? { label: kyb ? "Compléter le KYB" : "Créer le profil KYB", description: "Documenter l’entité, les signataires, les bénéficiaires effectifs et les preuves corporatives.", icon: Building2, action: focusKybForm, disabled: false }
    : criticalAlerts.length > 0
      ? { label: "Traiter les alertes critiques", description: "Réviser les alertes avant d’approuver ou de verrouiller le dossier.", icon: ShieldAlert, action: () => document.getElementById("kyc-alerts-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), disabled: false }
      : activeConsents.length === 0
        ? { label: "Ajouter le consentement", description: "Créer un consentement actif pour documenter la permission client.", icon: ShieldCheck, action: () => postAction(`/api/clients/${clientId}/consents`, { type: "Communication électronique", status: "GIVEN", version: "1.0" }), disabled: isSaving }
        : !kyc?.advisorAttestation
          ? { label: "Compléter la révision", description: "Signer l’attestation conseiller et créer une trace d’audit.", icon: RefreshCw, action: completeAdvisorReview, disabled: isSaving || !hasKyc }
          : !hasSnapshot
            ? { label: "Créer la version", description: "Figer la version profil client utilisée pour l’analyse et les recommandations.", icon: ShieldCheck, action: focusSnapshotPanel, disabled: isSaving || !hasKyc }
            : { label: "Approuver le profil", description: "Marquer le dossier profil client comme approuvé lorsque la revue est satisfaisante.", icon: CheckCircle2, action: () => postAction(`/api/clients/${clientId}/kyc/approve`), disabled: isSaving || !hasKyc }
  const kycActionCards = [
    {
      title: "Mettre à jour le profil",
      detail: "Corriger les données personnelles, financières, objectifs et risque.",
      icon: UserRoundCheck,
      actionLabel: "Ouvrir le formulaire",
      onClick: focusKycForm,
      disabled: false,
    },
    {
      title: "Révision conseiller",
      detail: kyc?.advisorAttestation ? "Attestation déjà inscrite au dossier." : "Confirmer que les données sont revues professionnellement.",
      icon: RefreshCw,
      actionLabel: kyc?.advisorAttestation ? "Revoir de nouveau" : "Compléter",
      onClick: completeAdvisorReview,
      disabled: isSaving || !hasKyc,
    },
    {
      title: "Version de preuve",
      detail: hasSnapshot ? `Dernière version: v${snapshots[0]?.version}.` : "Créer une version figée avant analyse ou recommandation.",
      icon: ShieldCheck,
      actionLabel: hasSnapshot ? "Créer nouvelle version" : "Créer version",
      onClick: focusSnapshotPanel,
      disabled: isSaving || !hasKyc,
    },
    {
      title: "Décision conformité",
      detail: kyc?.status === "APPROVED" ? "Le profil client est approuvé." : "Approuver ou rejeter avec justification selon l’état du dossier.",
      icon: CheckCircle2,
      actionLabel: "Approuver",
      onClick: () => postAction(`/api/clients/${clientId}/kyc/approve`),
      disabled: isSaving || !hasKyc || criticalAlerts.length > 0,
      secondaryLabel: "Rejeter",
      secondaryClick: rejectKyc,
    },
  ]
  const PrimaryKycActionIcon = primaryKycAction.icon
  const complianceViews: Array<{ id: ComplianceView; label: string; detail: string; count?: string }> = profileMode
    ? []
    : [
        { id: "summary", label: "Résumé", detail: "État, blocages et prochaines actions", count: `${openAlerts.length}` },
        { id: "evidence", label: "Preuves & audit", detail: "Consentements, versions, rapports", count: `${snapshots.length}` },
      ]

  if (isLoading) {
    return <ContentCard title="Conformité"><div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="size-4 animate-spin" />Chargement...</div></ContentCard>
  }

  return (
    <section className="space-y-6">
      {profileMode ? (
        <>
          {notice ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
          {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
        </>
      ) : (
      <ContentCard title="Conformité">
        <div className="grid gap-4 lg:grid-cols-4">
          <Metric label="Score conformité" value={`${score}/100`} detail={complianceScoreLabel(score)} />
          <Metric label="Statut recommandation" value={recommendationStatus} detail="Contrôle des actions" />
          <Metric label="Alertes ouvertes" value={`${openAlerts.length}`} detail="À traiter" />
          <Metric label="Consentements" value={`${activeConsents.length}`} detail="Actifs" />
        </div>
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          Ce module aide à organiser la conformité. Il ne remplace pas les obligations légales, réglementaires ou professionnelles du conseiller.
        </p>
        {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </ContentCard>
      )}

      {complianceViews.length > 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {complianceViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveComplianceView(view.id)}
              className={activeComplianceView === view.id
                ? "rounded-xl bg-slate-950 p-3 text-left text-white shadow-sm"
                : "rounded-xl p-3 text-left text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"}
            >
              <span className="flex items-center justify-between gap-3 text-sm font-black">
                {view.label}
                {view.count ? <span className={activeComplianceView === view.id ? "rounded-full bg-white/15 px-2 py-0.5 text-xs text-white" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"}>{view.count}</span> : null}
              </span>
              <span className={activeComplianceView === view.id ? "mt-1 block text-xs leading-5 text-slate-200" : "mt-1 block text-xs leading-5 text-slate-500"}>{view.detail}</span>
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {activeComplianceView === "aml" ? <ClientAmlSection clientId={clientId} /> : null}

      {activeComplianceView === "summary" ? (
      <>
      <ContentCard title="Dossier client intelligent" description="Profil client, KYB, AML et analyse des besoins restent séparés, mais ils alimentent le même dossier de preuve.">
        <div className="grid gap-4 xl:grid-cols-4">
          {moduleCards.map((module) => {
            const Icon = module.icon
            return (
              <div key={module.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={module.tone === "rose" ? "rounded-2xl bg-rose-50 p-2 text-rose-700" : module.tone === "sky" ? "rounded-2xl bg-sky-50 p-2 text-sky-700" : module.tone === "amber" ? "rounded-2xl bg-amber-50 p-2 text-amber-700" : module.tone === "slate" ? "rounded-2xl bg-slate-100 p-2 text-slate-700" : "rounded-2xl bg-emerald-50 p-2 text-emerald-700"}>
                    <Icon className="size-5" />
                  </div>
                  <StatusBadge tone={module.tone}>{module.label}</StatusBadge>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{module.score}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{module.status}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{module.detail}</p>
              </div>
            )
          })}
        </div>
      </ContentCard>

      <ContentCard title="Type de dossier et exigences" description="Le SaaS adapte les champs, les preuves et les blocages selon la nature réelle du client.">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={kybRequired ? "sky" : "emerald"}>{profilePolicy.primaryModule}</StatusBadge>
                  <StatusBadge tone="slate">{clientProfileTypeLabels[subjectType] ?? "Type à confirmer"}</StatusBadge>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">{profilePolicy.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{profilePolicy.subtitle}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={focusKycForm}>
                  Ouvrir le profil
                </Button>
                {kybRequired ? (
                  <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={focusKybForm}>
                    Ouvrir KYB
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <Info title="Objectif du module" detail={profilePolicy.objective} />
              <Info title="Analyse alimentée" detail={profilePolicy.analysis} />
            </div>
            <div className="mt-4 rounded-2xl border border-white bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Preuves attendues pour ce type</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profilePolicy.requirements.map((requirement) => (
                  <span key={requirement} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {requirement}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Contrôle de préparation</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Chaque ligne influence la capacité à recommander proprement.</p>
              </div>
              <StatusBadge tone={profileRequirementRows.every((item) => item.done) ? "emerald" : "amber"}>
                {profileRequirementRows.filter((item) => item.done).length}/{profileRequirementRows.length}
              </StatusBadge>
            </div>
            <div className="mt-4 space-y-2">
              {profileRequirementRows.map((item) => (
                <RequirementRow key={item.label} label={item.label} detail={item.detail} done={item.done} />
              ))}
            </div>
          </div>
        </div>
      </ContentCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ContentCard title="Pipeline du dossier" description="La recommandation doit s’appuyer sur une version confirmée, pas sur un formulaire mouvant.">
          <div className="grid gap-3 md:grid-cols-3">
            <WorkflowStep done={Boolean(kyc)} title="Collecte" detail="Profil créé ou importé" />
            <WorkflowStep done={kycCompleteness >= 75} title="Validation" detail={`${kycCompleteness} % de complétude`} />
            <WorkflowStep done={openAlerts.length === 0} title="Alertes" detail={`${openAlerts.length} ouverte${openAlerts.length > 1 ? "s" : ""}`} />
            <WorkflowStep done={Boolean(kyc?.advisorAttestation)} title="Conseiller" detail="Validation professionnelle" />
            <WorkflowStep done={activeConsents.length > 0} title="Client" detail={`${activeConsents.length} consentement${activeConsents.length > 1 ? "s" : ""}`} />
            <WorkflowStep done={hasSnapshot} title="Version" detail={hasSnapshot ? `Version ${snapshots[0]?.version}` : "À créer"} />
          </div>
        </ContentCard>

        <ContentCard title="Données qui alimentent l’analyse">
          <div className="space-y-3">
            <Info title="Revenu annuel" detail={formatMoney(seededKyc.annualIncome)} />
            <Info title="Valeur nette" detail={formatMoney(seededKyc.netWorth)} />
            <Info title="Liquidités" detail={formatMoney(seededKyc.liquidNetWorth ?? kyc?.emergencyFund)} />
            <Info title="Passifs" detail={formatMoney(seededKyc.totalLiabilities)} />
            <Info title="Objectif principal" detail={seededKyc.primaryObjective ?? "Non documenté"} />
            <Info title="Profil de risque" detail={seededKyc.riskProfileResult ?? "Non confirmé"} />
            <Info title="Liquidité" detail={seededKyc.liquidityNeeds ?? "Non documenté"} />
            <Info title="Levier" detail={seededKyc.borrowingNeeds ?? "Non documenté"} />
          </div>
        </ContentCard>
      </section>
      </>
      ) : null}

      {activeComplianceView === "profile" ? (
      <>
      <form id="client-kyc-questionnaire" onSubmit={saveKyc} className="scroll-mt-6 rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Profil personne physique - profil client</h3>
            <p className="mt-1 text-sm text-slate-600">Données structurées utilisées par la conformité, l’analyse des besoins et les recommandations.</p>
            <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Le type de dossier détermine si le profil est traité comme profil client personnel, KYB entreprise, fiducie/succession ou ménage.
            </p>
          </div>
          <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Sauvegarder
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          <FormSection title="Identité et résidence" description="Informations de base utilisées pour rattacher le bon dossier et déclencher les règles par territoire." defaultOpen>
            <SelectField name="subjectType" label="Type de dossier" defaultValue={seededKyc.subjectType} options={clientProfileTypeOptions} />
            <Field name="legalFirstName" label="Prénom légal" defaultValue={seededKyc.legalFirstName} />
            <Field name="legalLastName" label="Nom légal" defaultValue={seededKyc.legalLastName} />
            <Field name="dateOfBirth" label="Date de naissance" type="date" defaultValue={dateValue(seededKyc.dateOfBirth)} />
            <SelectField name="countryOfResidence" label="Pays de résidence" defaultValue={seededKyc.countryOfResidence} options={countryOptions} />
            <SelectField name="provinceOfResidence" label="Province de résidence" defaultValue={seededKyc.provinceOfResidence} options={provinceOptions} />
          </FormSection>

          <FormSection title="Famille et emploi" description="Contexte utilisé pour les besoins de protection, les rappels intelligents et l’analyse de capacité.">
            <SelectField name="maritalStatus" label="État civil" defaultValue={seededKyc.maritalStatus} options={maritalStatusOptions} />
            <Field name="dependentsCount" label="Personnes à charge" type="number" defaultValue={seededKyc.dependentsCount?.toString()} />
            <SelectField name="employmentStatus" label="Statut d’emploi" defaultValue={seededKyc.employmentStatus} options={employmentStatusOptions} />
            <Field name="occupation" label="Profession" defaultValue={seededKyc.occupation} />
            <Field name="employer" label="Employeur" defaultValue={seededKyc.employer} />
            <Field name="yearsAtJob" label="Années en poste" type="number" defaultValue={seededKyc.yearsAtJob?.toString()} />
            <Field name="annualIncome" label="Revenu annuel" type="number" defaultValue={seededKyc.annualIncome?.toString()} />
            <SelectField name="incomeRange" label="Fourchette de revenu" defaultValue={seededKyc.incomeRange} options={incomeRangeOptions} />
          </FormSection>

          <FormSection title="Situation financière" description="Actifs, passifs, liquidités et sources utilisées pour l’analyse des besoins et AML.">
            <Field name="totalAssets" label="Actifs totaux" type="number" defaultValue={kyc?.totalAssets?.toString()} />
            <Field name="totalLiabilities" label="Passifs totaux" type="number" defaultValue={seededKyc.totalLiabilities?.toString()} />
            <Field name="netWorth" label="Valeur nette" type="number" defaultValue={seededKyc.netWorth?.toString()} />
            <Field name="liquidNetWorth" label="Liquidités / valeur nette liquide" type="number" defaultValue={seededKyc.liquidNetWorth?.toString()} />
            <Field name="monthlyExpenses" label="Dépenses mensuelles" type="number" defaultValue={seededKyc.monthlyExpenses?.toString()} />
            <Field name="emergencyFund" label="Fonds d’urgence en mois" type="number" defaultValue={seededKyc.emergencyFund?.toString()} />
            <SelectField name="liquidityNeeds" label="Besoin de liquidité" defaultValue={seededKyc.liquidityNeeds} options={liquidityNeedOptions} />
            <SelectField name="sourceOfFunds" label="Source des fonds" defaultValue={kyc?.sourceOfFunds} options={sourceOfFundsOptions} />
            <SelectField name="sourceOfWealth" label="Source de la richesse" defaultValue={kyc?.sourceOfWealth} options={sourceOfWealthOptions} />
          </FormSection>

          <FormSection title="Objectifs et risque" description="Données nécessaires pour expliquer la recommandation et éviter un profil de risque trop vague.">
            <SelectField name="primaryObjective" label="Objectif principal" defaultValue={seededKyc.primaryObjective} options={objectiveOptions} />
            <SelectField name="investmentHorizon" label="Horizon" defaultValue={seededKyc.investmentHorizon} options={horizonOptions} />
            <SelectField name="investmentKnowledge" label="Connaissances financières" defaultValue={seededKyc.investmentKnowledge} options={investmentKnowledgeOptions} />
            <SelectField name="investmentExperience" label="Expérience de placement" defaultValue={seededKyc.investmentExperience} options={investmentExperienceOptions} />
            <SelectField name="riskTolerance" label="Tolérance au risque" defaultValue={kyc?.riskTolerance} options={riskOptions} />
            <SelectField name="riskCapacity" label="Capacité de risque" defaultValue={kyc?.riskCapacity} options={riskCapacityOptions} />
            <SelectField name="riskProfileResult" label="Profil de risque" defaultValue={seededKyc.riskProfileResult} options={riskOptions} />
            <SelectField name="borrowingNeeds" label="Levier / emprunt pour investir" defaultValue={seededKyc.borrowingNeeds} options={borrowingNeedOptions} />
            <SelectField name="protectionNeeds" label="Besoins de protection" defaultValue={seededKyc.protectionNeeds} options={protectionNeedOptions} />
            <Field name="financialGoals" label="Objectifs financiers détaillés" defaultValue={seededKyc.financialGoals} />
          </FormSection>

          <FormSection title="Revue et justification" description="Contrôle final avant attestation, snapshot ou décision conformité.">
            <Field name="nextKycReviewAt" label="Prochaine révision" type="date" defaultValue={dateValue(seededKyc.nextKycReviewAt)} />
            <Field name="advisorOverrideReason" label="Justification de dérogation" defaultValue={kyc?.advisorOverrideReason} />
          </FormSection>
        </div>
      </form>

      {kybRequired ? (
        <form id="client-kyb-profile" onSubmit={saveKyb} className="scroll-mt-6 rounded-[1.5rem] border border-sky-100 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Profil entreprise - KYB</h3>
              <p className="mt-1 text-sm text-slate-600">Fiche de l’entité, personnes de contrôle, documents corporatifs et risque AML lié au dossier.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone={kybCompleteness >= 75 ? "emerald" : "sky"}>{kyb ? kycStatusLabels[kyb.status] ?? kyb.status : "À créer"}</StatusBadge>
                <StatusBadge tone="slate">Score KYB {kybCompleteness} %</StatusBadge>
                <StatusBadge tone="amber">Bénéficiaires effectifs requis</StatusBadge>
              </div>
            </div>
            <Button className="rounded-2xl bg-sky-600 hover:bg-sky-700" disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Sauvegarder KYB
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            <FormSection title="Identité de l’entité" description="Données légales et administratives de base pour le profil entreprise." defaultOpen>
              <SelectField name="subjectType" label="Type de dossier KYB" defaultValue={seededKyb.subjectType} options={kybSubjectTypeOptions} />
              <Field name="legalName" label="Nom légal de l’entité" defaultValue={seededKyb.legalName} />
              <Field name="tradeName" label="Nom commercial" defaultValue={seededKyb.tradeName} />
              <SelectField name="entityType" label="Type d’entité" defaultValue={seededKyb.entityType} options={entityTypeOptions} />
              <SelectField name="jurisdiction" label="Juridiction" defaultValue={seededKyb.jurisdiction} options={jurisdictionOptions} />
              <Field name="registrationNumber" label="NEQ / numéro d’entreprise" defaultValue={seededKyb.registrationNumber} />
              <Field name="taxNumber" label="Numéro fiscal" defaultValue={seededKyb.taxNumber} />
              <Field name="incorporationDate" label="Date de constitution" type="date" defaultValue={dateValue(seededKyb.incorporationDate)} />
              <Field name="headOfficeAddress" label="Adresse du siège" defaultValue={seededKyb.headOfficeAddress} />
              <Field name="operatingAddress" label="Adresse d’exploitation" defaultValue={seededKyb.operatingAddress} />
            </FormSection>

            <FormSection title="Activités et finances" description="Contexte opérationnel, secteur, revenus et facteurs de risque de l’entité.">
              <Field name="businessActivity" label="Activités commerciales" defaultValue={seededKyb.businessActivity} />
              <SelectField name="industry" label="Secteur" defaultValue={seededKyb.industry} options={industryOptions} />
              <Field name="website" label="Site web" defaultValue={seededKyb.website} />
              <Field name="annualRevenue" label="Revenus annuels" type="number" defaultValue={seededKyb.annualRevenue?.toString()} />
              <Field name="netProfit" label="Bénéfice net" type="number" defaultValue={seededKyb.netProfit?.toString()} />
              <Field name="employeeCount" label="Nombre d’employés" type="number" defaultValue={seededKyb.employeeCount?.toString()} />
              <SelectField name="cashIntensiveBusiness" label="Activité avec espèces importantes" defaultValue={booleanValue(kyb?.cashIntensiveBusiness)} options={yesNoOptions} />
              <SelectField name="internationalActivity" label="Activités internationales" defaultValue={booleanValue(kyb?.internationalActivity)} options={yesNoOptions} />
              <SelectField name="regulatedActivity" label="Activité réglementée" defaultValue={booleanValue(kyb?.regulatedActivity)} options={yesNoOptions} />
            </FormSection>

            <FormSection title="Contrôles KYB et AML" description="Preuves corporatives, signataires, bénéficiaires effectifs et risque AML.">
              <SelectField name="directorsDocumented" label="Administrateurs documentés" defaultValue={booleanValue(kyb?.directorsDocumented)} options={yesNoOptions} />
              <SelectField name="shareholdersDocumented" label="Actionnaires documentés" defaultValue={booleanValue(kyb?.shareholdersDocumented)} options={yesNoOptions} />
              <SelectField name="beneficialOwnersDocumented" label="Bénéficiaires effectifs documentés" defaultValue={booleanValue(kyb?.beneficialOwnersDocumented)} options={yesNoOptions} />
              <SelectField name="authorizedSignersDocumented" label="Signataires autorisés validés" defaultValue={booleanValue(kyb?.authorizedSignersDocumented)} options={yesNoOptions} />
              <SelectField name="corporateDocumentsCollected" label="Documents corporatifs reçus" defaultValue={booleanValue(kyb?.corporateDocumentsCollected)} options={yesNoOptions} />
              <SelectField name="sourceOfFunds" label="Source des fonds" defaultValue={seededKyb.sourceOfFunds} options={sourceOfFundsOptions} />
              <SelectField name="sourceOfWealth" label="Source de la richesse" defaultValue={seededKyb.sourceOfWealth} options={sourceOfWealthOptions} />
              <SelectField name="amlRiskLevel" label="Risque AML de l’entité" defaultValue={seededKyb.amlRiskLevel} options={amlRiskLevelOptions} />
              <Field name="nextReviewAt" label="Prochaine revue KYB" type="date" defaultValue={dateValue(seededKyb.nextReviewAt)} />
            </FormSection>

            <FormSection title="Notes de revue entreprise" description="Explications qualitatives conservées avec le dossier KYB.">
              <TextAreaField name="ownershipStructureNotes" label="Structure de propriété" defaultValue={kyb?.ownershipStructureNotes} placeholder="Actionnaires directs, sociétés intermédiaires, fiducies, contrôle réel." />
              <TextAreaField name="beneficialOwnersNotes" label="Bénéficiaires effectifs" defaultValue={kyb?.beneficialOwnersNotes} placeholder="Personnes physiques qui détiennent ou contrôlent 25 % et plus, ou justification d’absence." />
              <TextAreaField name="authorizedSignersNotes" label="Signataires autorisés" defaultValue={kyb?.authorizedSignersNotes} placeholder="Qui peut signer, donner instruction ou transmettre les documents." />
              <TextAreaField name="reviewNotes" label="Notes de revue KYB" defaultValue={kyb?.reviewNotes} placeholder="Décisions, documents manquants, revue conformité ou prochaines actions." />
            </FormSection>
          </div>
        </form>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <ContentCard title="Actions profil client" description="Guide opérationnel pour rendre le dossier utilisable en analyse et recommandation.">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                  <PrimaryKycActionIcon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-950">Action recommandée</p>
                  <h3 className="mt-1 text-lg font-semibold text-emerald-950">{primaryKycAction.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">{primaryKycAction.description}</p>
                </div>
              </div>
              <Button className="shrink-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={primaryKycAction.disabled} onClick={primaryKycAction.action}>
                <PrimaryKycActionIcon className="size-4" />
                Lancer
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {readinessItems.map((item) => (
              <div key={item.label} className={item.done ? "rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3" : "rounded-2xl border border-slate-200 bg-slate-50 p-3"}>
                <div className="flex items-start gap-2">
                  {item.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" /> : <FileWarning className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                  <div className="min-w-0">
                    <p className={item.done ? "text-sm font-semibold text-emerald-950" : "text-sm font-semibold text-slate-950"}>{item.label}</p>
                    <p className={item.done ? "mt-0.5 text-xs leading-5 text-emerald-800" : "mt-0.5 text-xs leading-5 text-slate-600"}>{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Préparation recommandation</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {blockedItems.length === 0
                    ? "Le profil client contient les preuves nécessaires pour passer à l’analyse des besoins."
                    : `${blockedItems.length} point${blockedItems.length > 1 ? "s" : ""} à compléter avant une recommandation documentée.`}
                </p>
              </div>
              <StatusBadge tone={blockedItems.length === 0 ? "emerald" : criticalAlerts.length > 0 ? "rose" : "amber"}>
                {blockedItems.length === 0 ? "Prêt" : criticalAlerts.length > 0 ? "À risque" : "À compléter"}
              </StatusBadge>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {kycActionCards.map((action) => {
              const Icon = action.icon
              return (
                <div key={action.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{action.detail}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={action.disabled} onClick={action.onClick}>
                      {action.actionLabel}
                    </Button>
                    {action.secondaryLabel ? (
                      <Button size="sm" variant="ghost" className="rounded-xl text-rose-700 hover:bg-rose-50 hover:text-rose-800" disabled={isSaving || !hasKyc} onClick={action.secondaryClick}>
                        {action.secondaryLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </ContentCard>
        <div id="kyc-alerts-panel" className="scroll-mt-6">
        <ContentCard title="Alertes conformité">
          <div className="mb-3 flex justify-end">
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => postAction(`/api/clients/${clientId}/compliance-alerts/generate`)}><RefreshCw className="size-4" />Générer</Button>
          </div>
          <List items={alerts} empty="Aucune alerte conformité.">
            {(alert) => (
              <div key={alert.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2"><StatusBadge tone={severityTone[alert.severity] ?? "slate"}>{alert.severity}</StatusBadge><StatusBadge tone="slate">{alert.status}</StatusBadge></div>
                <p className="mt-3 font-semibold text-slate-950">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={aiLoadingId === alert.id} onClick={() => explainAlert(alert.id)}>
                    {aiLoadingId === alert.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Expliquer avec IA
                  </Button>
                  {alert.status === "OPEN" ? <>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => patchAction(`/api/compliance-alerts/${alert.id}/resolve`)}>Résoudre</Button>
                    <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => patchAction(`/api/compliance-alerts/${alert.id}/dismiss`, { dismissReason: "Non applicable pour le moment." })}>Ignorer</Button>
                  </> : null}
                </div>
                {aiExplanations[alert.id] ? (
                  <AiExplanationPanel
                    explanation={aiExplanations[alert.id]}
                    isLoading={aiLoadingId === alert.id}
                    onCreateTask={(actionIndex) => runAiAction(alert.id, "create-task", { actionIndex }, "Tâche créée depuis l’explication IA.")}
                    onCreateNote={() => runAiAction(alert.id, "create-note", {}, "Note interne créée depuis l’explication IA.")}
                    onReviewed={() => runAiAction(alert.id, "reviewed", {}, "Explication IA marquée comme revue.")}
                    onCopyDraft={() => copyDraft(aiExplanations[alert.id].clientMessageDraft)}
                  />
                ) : null}
              </div>
            )}
          </List>
        </ContentCard>
        </div>
      </section>
      {profileMode ? <ClientAmlSection clientId={clientId} /> : null}
      </>
      ) : null}

      {activeComplianceView === "evidence" ? (
      <section className="grid gap-6 xl:grid-cols-3">
        <div id="kyc-consents-panel" className="scroll-mt-6">
        <ContentCard title="Confidentialité & consentements">
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Metric label="Consentements actifs" value={String(activeConsents.length)} detail={`${missingCorePrivacyPurposes.length} finalité(s) de base à obtenir`} />
            <Metric label="Demandes confidentialité" value={String(privacyRequests.filter((request) => !["CLOSED", "ARCHIVED"].includes(request.status)).length)} detail="Accès, rectification, portabilité ou retrait" />
            <Metric label="Divulgations" value={String(dataDisclosures.length)} detail={`${dataDisclosures.filter((disclosure) => disclosure.outsideQuebec).length} hors Québec`} />
            <Metric label="Préférences" value={marketingConsent?.status ?? "Marketing non consenti"} detail={aiConsent?.status ? `IA: ${aiConsent.status}` : "IA non consentie"} />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => postAction(`/api/clients/${clientId}/consents`, { type: "Communication électronique", status: "GIVEN", version: "1.0", method: "ADVISOR" })}>Ajouter consentement</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => createPrivacyRequest("ACCESS")}>Demande d’accès</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={() => createPrivacyRequest("RECTIFICATION")}>Rectification</Button>
            <Button variant="outline" className="rounded-2xl" disabled={isSaving} onClick={logInsurerDisclosure}>Journaliser divulgation</Button>
          </div>
          {missingCorePrivacyPurposes.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-950">Finalités de base sans consentement actif</p>
              <p className="mt-1 text-xs leading-5 text-amber-900">Ces finalités peuvent bloquer le profil client, l’analyse des besoins, le coffre documentaire ou les recommandations.</p>
              <div className="mt-2 grid gap-2">
                {missingCorePrivacyPurposes.map((purpose) => (
                  <div key={purpose.id} className="flex items-start justify-between gap-2 rounded-xl bg-white p-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{purpose.name}</p>
                      <p className="text-xs leading-5 text-slate-500">{purpose.description ?? "Finalité de traitement à documenter."}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => requestPurposeConsent(purpose)}>Demander</Button>
                      <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => createPurposeConsent(purpose)}>Obtenu</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {missingActionPrivacyPurposes.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-3">
              <p className="text-sm font-semibold text-sky-950">Autorisations d’action à obtenir au besoin</p>
              <p className="mt-1 text-xs leading-5 text-sky-900">Ces autorisations débloquent les usages encadrés comme l’assistance IA ou la communication à un assureur.</p>
              <div className="mt-2 grid gap-2">
                {missingActionPrivacyPurposes.map((purpose) => (
                  <div key={purpose.id} className="flex items-start justify-between gap-2 rounded-xl bg-white p-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{purpose.name}</p>
                      <p className="text-xs leading-5 text-slate-500">{purpose.description ?? "Autorisation à obtenir avant l’action concernée."}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => requestPurposeConsent(purpose)}>Demander</Button>
                      <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={isSaving} onClick={() => createPurposeConsent(purpose)}>Obtenu</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <List items={consents} empty="Aucun consentement.">{(consent) => <Info key={consent.id} title={consent.purpose?.name ?? consent.type} detail={`${consent.status} - ${formatDate(consent.givenAt)} - ${consent.template ? `${consent.template.title} v${consent.template.version}` : `v${consent.version ?? "n/d"}`}`} />}</List>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demandes et divulgations</p>
            <List items={privacyRequests.slice(0, 3)} empty="Aucune demande confidentialité.">{(request) => <Info key={request.id} title={`${request.requestType} - ${request.status}`} detail={`Reçue le ${formatDate(request.receivedAt)} · échéance ${formatDate(request.dueAt)}`} />}</List>
            <div className="mt-3">
              <List items={dataDisclosures.slice(0, 3)} empty="Aucune divulgation journalisée.">{(disclosure) => <Info key={disclosure.id} title={`${disclosure.recipientName} - ${disclosure.recipientType}`} detail={`${disclosure.purpose?.name ?? "Finalité à préciser"} · ${formatDate(disclosure.disclosedAt)} · ${disclosure.outsideQuebec ? "Hors Québec" : "Québec/Canada"}`} />}</List>
            </div>
          </div>
        </ContentCard>
        </div>
        <div id="kyc-snapshots-panel" className="scroll-mt-6">
        <ContentCard title="Versions profil">
          <SnapshotEvidencePanel
            snapshots={snapshots}
            isSaving={isSaving || !hasKyc}
            clientAlreadyConfirmed={Boolean(kyc?.clientConfirmedNoChange || client.kycCompleted)}
            onCreate={createAdvisorSnapshot}
          />
        </ContentCard>
        </div>
        <div id="audit-trail-panel" className="scroll-mt-24">
        <ContentCard title="Dossier conformité & audit trail">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Rapport d’audit client</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Compile KYC, documents, consentements, recommandations, plaintes, incidents, événements et journal complet avec hash de preuve.</p>
            </div>
            <Button type="button" className="rounded-2xl" disabled={isSaving} onClick={() => void generateAuditReport()}>
              Générer rapport
            </Button>
          </div>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">Appliquer une checklist produit</p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                Crée les items de conformité à suivre pour ce client, avec les items bloquants déjà marqués à réviser.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedChecklistId}
                onChange={(event) => setSelectedChecklistId(event.target.value)}
                className="min-w-72 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
              >
                <option value="">Sélectionner une checklist</option>
                {(complianceCenter?.activeChecklists ?? []).map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.productType} - {checklist.name} ({checklist.items.length})
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" className="rounded-2xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100" disabled={isSaving || !selectedChecklistId} onClick={() => void applySelectedChecklist()}>
                Appliquer
              </Button>
            </div>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <Metric label="Événements" value={String(complianceCenter?.metrics.openEvents ?? 0)} detail="Ouverts" />
            <Metric label="Plaintes / incidents" value={`${complianceCenter?.metrics.openComplaints ?? 0}/${complianceCenter?.metrics.openIncidents ?? 0}`} detail="Registres actifs" />
            <Metric label="Supervision / exceptions" value={`${complianceCenter?.metrics.openSupervisionReviews ?? 0}/${complianceCenter?.metrics.pendingExceptions ?? 0}`} detail="À réviser" />
            <Metric label="Audit" value={String(complianceCenter?.metrics.auditReports ?? 0)} detail="Rapports générés" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <AuditPanel title="Événements conformité" empty="Aucun événement conformité.">
              {(complianceCenter?.events ?? []).slice(0, 5).map((event) => (
                <AuditItem key={event.id} title={`${event.eventCategory} - ${event.eventTitle}`} detail={`${event.status} · ${event.severity} · ${event.assignedTo?.name ?? "Non assigné"} · ${formatDate(event.createdAt)}`} />
              ))}
            </AuditPanel>
            <AuditPanel title="Plaintes" empty="Aucune plainte.">
              {(complianceCenter?.complaints ?? []).slice(0, 5).map((complaint) => (
                <AuditItem key={complaint.id} title={`${complaint.complaintNumber} - ${complaint.category ?? "Plainte"}`} detail={`${complaint.status} · ${complaint.severity} · ${formatDate(complaint.receivedAt)}`} />
              ))}
            </AuditPanel>
            <AuditPanel title="Incidents conformité" empty="Aucun incident conformité.">
              {(complianceCenter?.incidents ?? []).slice(0, 5).map((incident) => (
                <AuditItem key={incident.id} title={`${incident.incidentNumber} - ${incident.incidentType}`} detail={`${incident.status} · ${incident.riskLevel} · ${incident.seriousHarmRisk ? "Préjudice sérieux" : "À surveiller"} · ${formatDate(incident.detectedAt)}`} />
              ))}
            </AuditPanel>
            <AuditPanel title="Supervision et exceptions" empty="Aucune revue ou exception.">
              {[...(complianceCenter?.supervisionReviews ?? []).slice(0, 3).map((review) => ({ id: `review-${review.id}`, title: `${review.reviewType} - ${review.riskLevel}`, detail: `${review.status} · ${review.reviewer?.name ?? "Non assigné"} · ${formatDate(review.createdAt)}` })),
                ...(complianceCenter?.exceptions ?? []).slice(0, 3).map((exception) => ({ id: `exception-${exception.id}`, title: `${exception.exceptionType} - ${exception.riskLevel}`, detail: `${exception.status} · ${exception.approvedBy?.name ?? "Approbation requise"} · ${formatDate(exception.createdAt)}` }))].map((item) => (
                <AuditItem key={item.id} title={item.title} detail={item.detail} />
              ))}
            </AuditPanel>
            <AuditPanel title="Checklists produit" empty="Aucun résultat de checklist.">
              {(complianceCenter?.checklistResults ?? []).slice(0, 5).map((result) => (
                <ChecklistResultItem
                  key={result.id}
                  result={result}
                  isSaving={isSaving}
                  onUpdate={updateChecklistResult}
                />
              ))}
            </AuditPanel>
            <AuditPanel title="Rapports d’audit" empty="Aucun rapport généré.">
              {(complianceCenter?.auditReports ?? []).slice(0, 5).map((report) => (
                <AuditItem
                  key={report.id}
                  title={report.title}
                  detail={`${report.status} · ${formatDate(report.generatedAt)} · hash ${report.signedHash?.slice(0, 12) ?? "n/d"}`}
                  href={`/api/audit-reports/${report.id}/download`}
                />
              ))}
            </AuditPanel>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Journal technique et métier</p>
            <List items={auditLogs} empty="Aucun audit.">
              {(audit) => (
                <Info
                  key={audit.id}
                  title={auditActionLabel(audit.action)}
                  detail={`${auditEntityLabel(audit.entityType)} - ${audit.user?.name ?? "Système"} - ${formatDate(audit.createdAt)}`}
                />
              )}
            </List>
          </div>
        </ContentCard>
        </div>
      </section>
      ) : null}
    </section>
  )
}

function FormSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string
  description: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 transition hover:bg-white">
        <span className="min-w-0">
          <span className="block text-sm font-black text-slate-950">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-lg font-semibold text-slate-500 ring-1 ring-slate-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="grid gap-4 border-t border-slate-200/70 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </details>
  )
}

function Field({ name, label, type = "text", defaultValue }: { name: string; label: string; type?: string; defaultValue?: string | null }) {
  if (type === "date") {
    return (
      <label className="space-y-2 text-sm font-medium text-slate-700">
        <span>{label}</span>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            name={name}
            type="text"
            inputMode="numeric"
            placeholder="AAAA-MM-JJ"
            pattern="\d{4}-\d{2}-\d{2}"
            defaultValue={defaultValue ?? ""}
            className="rounded-2xl pl-10"
          />
        </div>
        <span className="block text-xs font-normal text-slate-500">Exemple : 1985-04-21. Vous pouvez écrire la date directement.</span>
      </label>
    )
  }

  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <Input name={name} type={type} defaultValue={defaultValue ?? ""} className="rounded-2xl" />
    </label>
  )
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string
  label: string
  defaultValue?: string | null
  options: { value: string; label: string }[]
}) {
  const value = defaultValue ?? ""
  const hasCurrentValue = !value || options.some((option) => option.value === value)

  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/25"
      >
        {!hasCurrentValue ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextAreaField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string
  label: string
  defaultValue?: string | null
  placeholder?: string
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-1">
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/25"
      />
    </label>
  )
}

function WorkflowStep({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <div className={done ? "rounded-2xl border border-emerald-100 bg-emerald-50 p-4" : "rounded-2xl border border-slate-100 bg-slate-50 p-4"}>
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="size-4 text-emerald-700" /> : <BriefcaseBusiness className="size-4 text-slate-500" />}
        <p className={done ? "text-sm font-semibold text-emerald-900" : "text-sm font-semibold text-slate-900"}>{title}</p>
      </div>
      <p className={done ? "mt-2 text-xs leading-5 text-emerald-800" : "mt-2 text-xs leading-5 text-slate-600"}>{detail}</p>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function List<T>({ items, empty, children }: { items: T[]; empty: string; children: (item: T) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>
  return <div className="space-y-3">{items.map(children)}</div>
}

function AuditPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {hasItems ? <div className="space-y-2">{children}</div> : <p className="text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

function AuditItem({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return (
    <div className="rounded-xl border border-white bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {href ? (
          <a href={href} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Télécharger
          </a>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  )
}

function ChecklistResultItem({
  result,
  isSaving,
  onUpdate,
}: {
  result: ComplianceCenterSummary["checklistResults"][number]
  isSaving: boolean
  onUpdate: (result: ComplianceCenterSummary["checklistResults"][number], status: string) => Promise<void>
}) {
  const completed = result.status === "COMPLETED"
  return (
    <div className={completed ? "rounded-xl border border-emerald-100 bg-white p-3" : "rounded-xl border border-white bg-white p-3"}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{result.checklist.name} - {result.item?.label ?? "Item"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {result.status} · {result.item?.blocking ? "Bloquant" : "Non bloquant"} · {formatDate(result.updatedAt)}
          </p>
        </div>
        <StatusBadge tone={completed ? "emerald" : result.status === "EXCEPTION" ? "amber" : result.item?.blocking ? "rose" : "slate"}>
          {completed ? "Complété" : result.status === "EXCEPTION" ? "Exception" : result.status === "TO_REVIEW" ? "À revoir" : "Ouvert"}
        </StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50" disabled={isSaving || completed || !result.item} onClick={() => void onUpdate(result, "COMPLETED")}>
          Compléter
        </Button>
        <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={isSaving || !result.item} onClick={() => void onUpdate(result, "TO_REVIEW")}>
          À revoir
        </Button>
        <Button type="button" size="sm" variant="outline" className="rounded-full border-amber-200 text-amber-700 hover:bg-amber-50" disabled={isSaving || !result.item} onClick={() => void onUpdate(result, "EXCEPTION")}>
          Exception
        </Button>
      </div>
    </div>
  )
}

const snapshotReasonLabels: Record<string, string> = {
  ADVISOR_UPDATE: "Mise à jour conseiller",
  CLIENT_CONFIRMATION: "Confirmation client",
  COMPLIANCE_REVIEW: "Révision conformité",
  ANNUAL_REVIEW: "Revue annuelle",
}

function SnapshotEvidencePanel({
  snapshots,
  isSaving,
  clientAlreadyConfirmed,
  onCreate,
}: {
  snapshots: Snapshot[]
  isSaving: boolean
  clientAlreadyConfirmed: boolean
  onCreate: (options: {
    advisorAttestationAccepted: boolean
    clientAccuracyConfirmed: boolean
    useForAnalysisOrRecommendation: boolean
    sendToClientForConfirmation: boolean
  }) => Promise<void>
}) {
  const [advisorAttestationAccepted, setAdvisorAttestationAccepted] = useState(false)
  const [clientAccuracyConfirmed, setClientAccuracyConfirmed] = useState(clientAlreadyConfirmed)
  const [useForAnalysisOrRecommendation, setUseForAnalysisOrRecommendation] = useState(false)
  const [sendToClientForConfirmation, setSendToClientForConfirmation] = useState(false)
  const latest = snapshots[0]
  const summary = latest?.snapshotData?.summary
  const hasBlockingIssue = Boolean((summary?.criticalAlerts ?? 0) > 0 || (summary?.documentsRequiredOpen ?? 0) > 0 || !summary?.identityVerified || !summary?.consentGiven)
  const canCreate = advisorAttestationAccepted && useForAnalysisOrRecommendation
  const create = () => onCreate({
    advisorAttestationAccepted,
    clientAccuracyConfirmed,
    useForAnalysisOrRecommendation,
    sendToClientForConfirmation,
  })
  const controls = (
    <SnapshotCreationChecklist
      advisorAttestationAccepted={advisorAttestationAccepted}
      clientAccuracyConfirmed={clientAccuracyConfirmed}
      useForAnalysisOrRecommendation={useForAnalysisOrRecommendation}
      sendToClientForConfirmation={sendToClientForConfirmation}
      clientAlreadyConfirmed={clientAlreadyConfirmed}
      onAdvisorAttestationChange={setAdvisorAttestationAccepted}
      onClientAccuracyChange={setClientAccuracyConfirmed}
      onUseChange={setUseForAnalysisOrRecommendation}
      onSendChange={setSendToClientForConfirmation}
    />
  )

  if (!latest) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-950">Aucune version figée</p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          Créez une version figée après la révision profil client pour garder la preuve exacte utilisée dans l’analyse des besoins et la recommandation.
        </p>
        <div className="mt-4">{controls}</div>
        <Button className="mt-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving || !canCreate} onClick={() => void create()}>
          Créer version
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-950">Version de preuve active</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              v{latest.version} · {snapshotReasonLabels[latest.reason] ?? latest.reason} · créée le {formatDate(latest.createdAt)}
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Créée par {latest.createdBy?.name ?? "Système"} · liée à {latest._count?.insuranceNeedsAnalyses ?? 0} analyse(s)
            </p>
          </div>
          <StatusBadge tone={hasBlockingIssue ? "amber" : "emerald"}>{hasBlockingIssue ? "À vérifier" : "Preuve prête"}</StatusBadge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SnapshotMetric label="Score profil" value={typeof summary?.complianceScore === "number" ? `${summary.complianceScore}/100` : "Non coté"} />
          <SnapshotMetric label="Consentements" value={`${summary?.activeConsents ?? 0} actif(s)`} />
          <SnapshotMetric label="Documents" value={`${summary?.documentsValidated ?? 0}/${summary?.documentsTotal ?? 0} validés`} />
          <SnapshotMetric label="Alertes ouvertes" value={`${summary?.openAlerts ?? 0}`} />
        </div>
      </div>

      <div className="grid gap-2">
        <RequirementRow label="Identité vérifiée" detail={summary?.identityVerified ? "Présente dans la version figée." : "À vérifier avant recommandation finale."} done={Boolean(summary?.identityVerified)} />
        <RequirementRow label="Consentement actif" detail={summary?.consentGiven ? "Consentement inclus dans la preuve." : "Consentement manquant au moment de la version."} done={Boolean(summary?.consentGiven)} />
        <RequirementRow label="Documents requis" detail={(summary?.documentsRequiredOpen ?? 0) === 0 ? "Aucun document requis ouvert." : `${summary?.documentsRequiredOpen ?? 0} document(s) requis encore ouvert(s).`} done={(summary?.documentsRequiredOpen ?? 0) === 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="w-full">{controls}</div>
        <Button variant="outline" className="rounded-2xl" disabled={isSaving || !canCreate} onClick={() => void create()}>
          Créer nouvelle version
        </Button>
      </div>

      {snapshots.length > 1 ? (
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</p>
          <List items={snapshots.slice(1, 4)} empty="Aucune version précédente.">
            {(snapshot) => <Info key={snapshot.id} title={`Version ${snapshot.version}`} detail={`${snapshotReasonLabels[snapshot.reason] ?? snapshot.reason} - ${formatDate(snapshot.createdAt)}`} />}
          </List>
        </div>
      ) : null}
    </div>
  )
}

function SnapshotCreationChecklist({
  advisorAttestationAccepted,
  clientAccuracyConfirmed,
  useForAnalysisOrRecommendation,
  sendToClientForConfirmation,
  clientAlreadyConfirmed,
  onAdvisorAttestationChange,
  onClientAccuracyChange,
  onUseChange,
  onSendChange,
}: {
  advisorAttestationAccepted: boolean
  clientAccuracyConfirmed: boolean
  useForAnalysisOrRecommendation: boolean
  sendToClientForConfirmation: boolean
  clientAlreadyConfirmed: boolean
  onAdvisorAttestationChange: (value: boolean) => void
  onClientAccuracyChange: (value: boolean) => void
  onUseChange: (value: boolean) => void
  onSendChange: (value: boolean) => void
}) {
  return (
    <div className="grid gap-2 rounded-[1.25rem] border border-slate-100 bg-white p-3">
      <SnapshotCheck
        checked={advisorAttestationAccepted}
        onChange={onAdvisorAttestationChange}
        label="J’atteste avoir révisé les renseignements du profil client avant de figer cette version."
      />
      <SnapshotCheck
        checked={useForAnalysisOrRecommendation}
        onChange={onUseChange}
        label="Je confirme que cette version sera utilisé pour l’analyse des besoins ou une recommandation."
      />
      <SnapshotCheck
        checked={clientAccuracyConfirmed}
        onChange={onClientAccuracyChange}
        label={clientAlreadyConfirmed ? "Le client a déjà confirmé l’exactitude des renseignements." : "Je confirme que le client a validé l’exactitude des renseignements."}
      />
      <SnapshotCheck
        checked={sendToClientForConfirmation}
        onChange={onSendChange}
        label="Envoyer le rapport Version profil dans l’espace client pour confirmation."
      />
    </div>
  )
}

function SnapshotCheck({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium leading-5 text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
      <span>{label}</span>
    </label>
  )
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/85 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Info({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function RequirementRow({ label, detail, done }: { label: string; detail: string; done: boolean }) {
  return (
    <div className={done ? "rounded-2xl border border-emerald-100 bg-emerald-50 p-3" : "rounded-2xl border border-amber-100 bg-amber-50 p-3"}>
      <div className="flex items-start gap-2">
        {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" /> : <FileWarning className="mt-0.5 size-4 shrink-0 text-amber-700" />}
        <div className="min-w-0">
          <p className={done ? "text-sm font-semibold text-emerald-950" : "text-sm font-semibold text-amber-950"}>{label}</p>
          <p className={done ? "mt-0.5 text-xs leading-5 text-emerald-800" : "mt-0.5 text-xs leading-5 text-amber-800"}>{detail}</p>
        </div>
      </div>
    </div>
  )
}

function AiExplanationPanel({
  explanation,
  isLoading,
  onCreateTask,
  onCreateNote,
  onReviewed,
  onCopyDraft,
}: {
  explanation: AiExplanation
  isLoading: boolean
  onCreateTask: (actionIndex: number) => void
  onCreateNote: () => void
  onReviewed: () => void
  onCopyDraft: () => void
}) {
  return (
    <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="violet"><Bot className="mr-1 inline size-3" />Généré par IA</StatusBadge>
        <StatusBadge tone="amber">À valider</StatusBadge>
        <StatusBadge tone="slate">Interne seulement</StatusBadge>
      </div>
      <div className="mt-4 grid gap-4">
        <AiBlock title="Résumé" value={explanation.summary} />
        <AiBlock title="Pourquoi cette alerte existe" value={explanation.whyItTriggered} />
        <AiBlock title="Contexte client" value={explanation.clientContext} />
        {explanation.missingData?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Données à vérifier</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {explanation.missingData.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item}</span>)}
            </div>
          </div>
        ) : null}
        {explanation.suggestedActions?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions prudentes</p>
            <div className="mt-2 space-y-2">
              {explanation.suggestedActions.map((action, index) => (
                <div key={`${action.type}-${index}`} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                    <p className="text-xs text-slate-500">{action.type} - {action.priority}</p>
                  </div>
                  {action.type === "CREATE_TASK" || action.type === "REQUEST_DOCUMENT" || action.type === "SCHEDULE_REVIEW" ? (
                    <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={isLoading} onClick={() => onCreateTask(index)}>
                      Créer tâche
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <AiBlock title="Note interne suggérée" value={explanation.advisorNoteDraft} />
        <AiBlock title="Brouillon client" value={explanation.clientMessageDraft} />
        <AiBlock title="Priorité" value={explanation.riskLevelExplanation} />
        <p className="rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{explanation.complianceDisclaimer}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-xl" disabled={isLoading} onClick={onCreateNote}>Créer note</Button>
        <Button size="sm" variant="outline" className="rounded-xl" disabled={isLoading || !explanation.clientMessageDraft} onClick={onCopyDraft}><Copy className="size-4" />Copier brouillon</Button>
        <Button size="sm" variant="ghost" className="rounded-xl" disabled={isLoading} onClick={onReviewed}>Marquer revue</Button>
      </div>
    </div>
  )
}

function AiBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}
