"use client"

import { useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  ExternalLink,
  HeartPulse,
  Loader2,
  Mail,
  MessageSquareText,
  PenLine,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRoundCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PortalNavItem = {
  id: string
  page: ClientPortalPage
  icon: LucideIcon
  title: string
  detail: string
  count: string
  tone: "emerald" | "amber" | "sky" | "violet" | "slate"
}

export type ClientPortalPage =
  | "overview"
  | "profil"
  | "consentements"
  | "messages"
  | "documents"
  | "analyses"
  | "recommandations"
  | "conseiller"
  | "historique"

type ClientPortalPageDetails = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  primaryLabel?: string
  primaryPage?: ClientPortalPage
  secondaryLabel?: string
  secondaryPage?: ClientPortalPage
}

const clientPortalPageDetails: Record<ClientPortalPage, ClientPortalPageDetails> = {
  overview: {
    eyebrow: "Tableau de bord",
    title: "Vue d’ensemble du dossier",
    description: "Retrouvez les actions urgentes, les documents à fournir, les messages récents et le conseiller assigné.",
    icon: CalendarDays,
    primaryLabel: "Compléter mon profil",
    primaryPage: "profil",
    secondaryLabel: "Ajouter un document",
    secondaryPage: "documents",
  },
  profil: {
    eyebrow: "Profil client",
    title: "Compléter mon profil sécurisé",
    description: "Mettez à jour vos informations personnelles, familiales, financières et vos objectifs avant la révision du conseiller.",
    icon: UserRoundCheck,
    primaryLabel: "Voir mes consentements",
    primaryPage: "consentements",
    secondaryLabel: "Ajouter un document",
    secondaryPage: "documents",
  },
  consentements: {
    eyebrow: "Confidentialité",
    title: "Consentements et préférences",
    description: "Confirmez le profil, gérez les autorisations et gardez une preuve claire de vos préférences de communication.",
    icon: ShieldCheck,
    primaryLabel: "Écrire au conseiller",
    primaryPage: "messages",
    secondaryLabel: "Voir l’historique",
    secondaryPage: "historique",
  },
  messages: {
    eyebrow: "Communication",
    title: "Messages avec le conseiller",
    description: "Envoyez une question ou une précision. Les échanges restent liés à votre dossier client.",
    icon: MessageSquareText,
    primaryLabel: "Ajouter un document",
    primaryPage: "documents",
    secondaryLabel: "Voir le conseiller",
    secondaryPage: "conseiller",
  },
  documents: {
    eyebrow: "Documents",
    title: "Documents et demandes",
    description: "Téléversez les pièces demandées et consultez les documents visibles dans votre espace client.",
    icon: UploadCloud,
    primaryLabel: "Voir mes analyses",
    primaryPage: "analyses",
    secondaryLabel: "Écrire au conseiller",
    secondaryPage: "messages",
  },
  analyses: {
    eyebrow: "Assurance",
    title: "Analyses d’assurance",
    description: "Consultez les analyses préparées, les rapports remis et confirmez la réception lorsque requis.",
    icon: HeartPulse,
    primaryLabel: "Voir les recommandations",
    primaryPage: "recommandations",
    secondaryLabel: "Documents",
    secondaryPage: "documents",
  },
  recommandations: {
    eyebrow: "Conseil",
    title: "Recommandations et rapports",
    description: "Suivez les recommandations présentées, les décisions documentées et les preuves de signature.",
    icon: FileCheck2,
    primaryLabel: "Écrire au conseiller",
    primaryPage: "messages",
    secondaryLabel: "Historique",
    secondaryPage: "historique",
  },
  conseiller: {
    eyebrow: "Contact",
    title: "Conseiller et cabinet",
    description: "Retrouvez les coordonnées du conseiller, du cabinet et les informations de contact liées au dossier.",
    icon: UserRoundCheck,
    primaryLabel: "Écrire au conseiller",
    primaryPage: "messages",
    secondaryLabel: "Retour au dossier",
    secondaryPage: "overview",
  },
  historique: {
    eyebrow: "Suivi",
    title: "Historique du dossier",
    description: "Consultez les événements récents synchronisés depuis le CRM et les suivis effectués.",
    icon: Clock3,
    primaryLabel: "Écrire au conseiller",
    primaryPage: "messages",
    secondaryLabel: "Vue d’ensemble",
    secondaryPage: "overview",
  },
}

type PortalClient = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  emailPrimary: string | null
  emailSecondary: string | null
  phone: string
  phonePrimary: string | null
  phoneSecondary: string | null
  status: string
  gender: string | null
  dateOfBirth: string | null
  familyStatus: string | null
  dependentsCount: number | null
  dependents: number | null
  dependentsDetails: string | null
  spouseName: string | null
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
  riskProfile: string | null
  investmentHorizon: string | null
  financialGoals: string | null
  goals: string | null
  address: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string | null
  primaryGoal: string | null
  kycCompleted: boolean
  identityVerified: boolean
  consentGiven: boolean
  nextReviewDate: string | null
  lastContactAt: string | null
  advisor: { name: string; email: string } | null
  organization: {
    name: string
    communicationSettings?: {
      advisorSmsNotificationNumber: string | null
      twilioPhoneNumber: string | null
    } | null
  }
  documents: Array<{ id: string; name: string; description: string | null; type: string; status: string; createdAt: string; expiresAt: string | null; mimeType?: string | null; storagePath?: string | null }>
  tasks: Array<{ id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null }>
  activities: Array<{ id: string; title: string; description: string | null; type: string; createdAt: string }>
  noteItems: Array<{ id: string; title: string | null; content: string; createdAt: string; user: { name: string; role: string } | null }>
  products: Array<{ id: string; productName: string; company: string; status: string; category: string; type: string }>
  insuranceNeedsAnalyses: Array<{
    id: string
    analysisType: string
    status: string
    summary: string | null
    reportDocumentId: string | null
    analysisDate: string
    analysisVersion: number
    deliveredAt: string | null
    clientConfirmedAt: string | null
    signedAt: string | null
    signatureDocumentId: string | null
    reportDocument: { id: string; name: string; status: string } | null
    signatureDocument: { id: string; name: string; status: string } | null
    results: Array<{ gapAmount: number; netNeed: number }>
    recommendations: Array<{ recommendedProductType: string; recommendedAmount: number | null; recommendedTerm: string | null }>
  }>
  productRecommendations: Array<{
    id: string
    type: string
    status: string
    title: string
    description: string
    recommendationVersion: number
    clientDecision: string
    reportDocumentId: string | null
    presentedToClientAt: string | null
    clientSignedAt: string | null
    lockedAt: string | null
    metadata: Record<string, unknown> | null
    sourceKycVersion: { id: string; versionNumber: number; lockedAt: string | null } | null
    documents: Array<{
      id: string
      documentType: string
      deliveredToClient: boolean
      deliveredAt: string | null
      clientAcknowledgedAt: string | null
      document: { id: string; name: string; status: string; mimeType?: string | null } | null
    }>
  }>
  kycProfile: {
    complianceScore: number
    status: string
    sourceOfFunds: string | null
    sourceOfWealth: string | null
    monthlyExpenses: number | null
    emergencyFund: number | null
    liquidityNeeds: string | null
    investmentKnowledge: string | null
    investmentExperience: string | null
    riskTolerance: string | null
    riskCapacity: string | null
    riskProfileResult: string | null
    borrowingNeeds: string | null
    protectionNeeds: string | null
    notes: string | null
  } | null
  consents: Array<{
    id: string
    type: string
    status: string
    givenAt: string | null
    revokedAt?: string | null
    expiresAt?: string | null
    withdrawalAllowed?: boolean
    purpose?: { id: string; code: string; name: string; description: string | null; isRequiredForService: boolean } | null
    template?: { id: string; title: string; version: string; language: string } | null
  }>
  privacyRequests: Array<{
    id: string
    requestType: string
    status: string
    receivedAt: string
    dueAt: string | null
    closedAt: string | null
    notes: string | null
  }>
  complianceAlerts: Array<{ id: string; title: string; severity: string; status: string }>
}

type ClientPortalWorkspaceProps = {
  userName: string
  userEmail: string
  client: PortalClient
  isPreview?: boolean
  activePage?: ClientPortalPage
}

const documentTypeOptions = [
  { value: "GOVERNMENT_ID", label: "Pièce d’identité" },
  { value: "PROOF_OF_ADDRESS", label: "Preuve d’adresse" },
  { value: "POLICY_DOCUMENT", label: "Police / contrat" },
  { value: "INSURANCE_STATEMENT", label: "Relevé d’assurance" },
  { value: "INVESTMENT_STATEMENT", label: "Relevé de placement" },
  { value: "TAX_DOCUMENT", label: "Document fiscal" },
  { value: "OTHER", label: "Autre document" },
]

const familyStatusLabels: Record<string, string> = {
  SINGLE: "Célibataire",
  MARRIED: "Marié(e)",
  COMMON_LAW: "Conjoint(e) de fait",
  DIVORCED: "Divorcé(e)",
  WIDOWED: "Veuf/veuve",
}

const employmentStatusLabels: Record<string, string> = {
  EMPLOYED: "Employé(e)",
  SELF_EMPLOYED: "Travailleur autonome",
  BUSINESS_OWNER: "Entrepreneur / propriétaire",
  INCORPORATED: "Incorporé(e)",
  UNEMPLOYED: "Sans emploi",
  RETIRED: "Retraité(e)",
  STUDENT: "Étudiant(e)",
}

const riskProfileLabels: Record<string, string> = {
  CONSERVATIVE: "Conservateur",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  GROWTH: "Croissance",
  AGGRESSIVE: "Audacieux",
  UNKNOWN: "À préciser",
}

const insuranceAnalysisTypeLabels: Record<string, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Assurance entreprise",
  REPLACEMENT: "Remplacement",
}

const insuranceAnalysisStatusLabels: Record<string, string> = {
  DRAFT: "En préparation",
  MISSING_DATA: "Informations à confirmer",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Révision conseiller",
  RECOMMENDATION_PREPARED: "Rapport en préparation",
  WAITING_CLIENT: "En attente client",
  COMPLETED: "Finalisée",
  DELIVERED: "Rapport disponible",
  USED_FOR_SUBMISSION: "Utilisée pour proposition",
  NEEDS_UPDATE: "À mettre à jour",
}

const recommendationTypeLabels: Record<string, string> = {
  LIFE_INSURANCE: "Assurance vie",
  DISABILITY_INSURANCE: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS_INSURANCE: "Assurance entreprise",
  REPLACEMENT: "Remplacement",
  INVESTMENT: "Placement",
  MAINTAIN: "Maintien",
  NO_ACTION: "Aucune action",
  CLIENT_DECLINED: "Refus documenté",
  PROTECTION: "Protection",
  INVESTMENT_REVIEW: "Révision placement",
}

const recommendationStatusLabels: Record<string, string> = {
  PRESENTED_TO_CLIENT: "Présentée",
  CLIENT_ACCEPTED: "Acceptée",
  CLIENT_DECLINED: "Refusée",
  SIGNED: "Signée",
  LOCKED: "Finalisée",
}

const consentDefinitions = [
  {
    field: "personalInfoCollectionAccepted",
    type: "PERSONAL_INFO_COLLECTION",
    title: "Collecte des renseignements personnels",
    detail: "J’autorise la collecte des renseignements nécessaires à la tenue de mon dossier client.",
    required: true,
  },
  {
    field: "advisorAnalysisUseAccepted",
    type: "ADVISOR_ANALYSIS_USE",
    title: "Utilisation pour l’analyse et la conformité",
    detail: "J’autorise l’utilisation de mes renseignements pour l’analyse de mes besoins, la conformité et le suivi des recommandations.",
    required: true,
  },
  {
    field: "electronicCommunicationAccepted",
    type: "SECURE_ELECTRONIC_COMMUNICATIONS",
    title: "Communications électroniques sécurisées",
    detail: "J’accepte les communications électroniques liées au suivi de mon dossier.",
    required: true,
  },
  {
    field: "documentExchangeAccepted",
    type: "CLIENT_DOCUMENT_EXCHANGE",
    title: "Échange de documents",
    detail: "J’autorise l’échange de documents dans mon espace client sécurisé.",
    required: true,
  },
] as const

const consentLabels: Record<string, string> = {
  PORTAL_KYC_CONFIRMATION: "Confirmation du profil client",
  PERSONAL_INFO_COLLECTION: "Collecte des renseignements personnels",
  ADVISOR_ANALYSIS_USE: "Utilisation pour l’analyse et la conformité",
  SECURE_ELECTRONIC_COMMUNICATIONS: "Communications électroniques sécurisées",
  CLIENT_DOCUMENT_EXCHANGE: "Échange de documents",
}

const consentStatusLabels: Record<string, string> = {
  GIVEN: "Actif",
  REVOKED: "Retiré",
  DECLINED: "Refusé",
  EXPIRED: "Expiré",
  NOT_REQUESTED: "Non demandé",
}

const privacyRequestLabels: Record<string, string> = {
  ACCESS: "Accès à mes renseignements",
  RECTIFICATION: "Rectification",
  PORTABILITY: "Portabilité",
  CONSENT_WITHDRAWAL: "Retrait de consentement",
  DELETION: "Suppression / destruction",
  QUESTION: "Question confidentialité",
}

const incomeRangeOptions = [
  { value: "", label: "Sélectionner" },
  { value: "0-24999", label: "Moins de 25 000 $" },
  { value: "25000-49999", label: "25 000 $ à 49 999 $" },
  { value: "50000-99999", label: "50 000 $ à 99 999 $" },
  { value: "100000-149999", label: "100 000 $ à 149 999 $" },
  { value: "150000-249999", label: "150 000 $ à 249 999 $" },
  { value: "250000+", label: "250 000 $ et plus" },
]

const horizonOptions = [
  { value: "", label: "Sélectionner" },
  { value: "COURT_TERME", label: "Court terme" },
  { value: "MOYEN_TERME", label: "Moyen terme" },
  { value: "LONG_TERME", label: "Long terme" },
  { value: "RETRAITE", label: "Retraite" },
]

const liquidityNeedOptions = [
  { value: "", label: "Sélectionner" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Élevé" },
]

const investmentKnowledgeOptions = [
  { value: "", label: "Sélectionner" },
  { value: "BEGINNER", label: "Débutant" },
  { value: "INTERMEDIATE", label: "Intermédiaire" },
  { value: "ADVANCED", label: "Avancé" },
]

const investmentExperienceOptions = [
  { value: "", label: "Sélectionner" },
  { value: "NONE", label: "Aucune expérience" },
  { value: "FUNDS_ETF", label: "Fonds / FNB" },
  { value: "BONDS_GIC", label: "Obligations / CPG" },
  { value: "STOCKS", label: "Actions" },
  { value: "ADVANCED_PRODUCTS", label: "Produits complexes" },
]

const riskCapacityOptions = [
  { value: "", label: "Sélectionner" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Élevée" },
]

const borrowingNeedOptions = [
  { value: "", label: "Sélectionner" },
  { value: "NO_LEVERAGE", label: "Aucun emprunt pour investir" },
  { value: "PERSONAL_DEBT_ONLY", label: "Dettes personnelles seulement" },
  { value: "USES_LEVERAGE", label: "Utilise ou envisage du levier" },
  { value: "TO_REVIEW", label: "À revoir avec le conseiller" },
]

function display(value?: string | number | null, fallback = "À compléter") {
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

function displayDependents(client: PortalClient) {
  const dependents = client.dependentsCount ?? client.dependents
  if (dependents !== null && dependents !== undefined) return dependents > 0 ? String(dependents) : "Non"
  return "À compléter"
}

function translate(labels: Record<string, string>, value?: string | null, fallback = "À compléter") {
  if (!value) return fallback
  return labels[value] ?? value
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "À compléter"
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return "À venir"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function formatPhone(value?: string | null) {
  if (!value) return "Téléphone non configuré"
  const digits = value.replace(/\D/g, "")
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (normalized.length !== 10) return value
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    REQUIRED: "Requis",
    REQUESTED: "Demandé",
    RECEIVED: "Reçu",
    VALIDATED: "Validé",
    REJECTED: "Refusé",
    EXPIRED: "Expiré",
    TODO: "À faire",
    IN_PROGRESS: "En cours",
    WAITING: "En attente",
    ACTIVE: "Actif",
    REVIEW_NEEDED: "À revoir",
  }
  return labels[value] ?? value
}

function insuranceAnalysisTypeLabel(value: string) {
  return insuranceAnalysisTypeLabels[value] ?? value
}

function insuranceAnalysisStatusLabel(value: string) {
  return insuranceAnalysisStatusLabels[value] ?? value
}

function recommendationTypeLabel(value: string) {
  return recommendationTypeLabels[value] ?? value
}

function recommendationStatusLabel(value: string) {
  return recommendationStatusLabels[value] ?? value
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function pandaDocStatusLabel(status?: unknown) {
  const value = String(status ?? "").toLowerCase()
  if (!value) return "Non envoyée"
  if (value.includes("completed")) return "Signée"
  if (value.includes("sent") || value.includes("viewed") || value.includes("waiting")) return "En attente de signature"
  if (value.includes("declined") || value.includes("expired") || value.includes("failed") || value.includes("voided") || value.includes("deleted")) return "À relancer"
  return String(status)
}

function canPreviewDocument(mimeType?: string | null) {
  return Boolean(mimeType && ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType))
}

async function readApiMessage(response: Response) {
  const result = await response.json().catch(() => null)
  if (response.ok) return
  throw new Error(result?.error?.message ?? "Une erreur est survenue.")
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

export function ClientPortalWorkspace({ userName, userEmail, client, isPreview = false, activePage = "overview" }: ClientPortalWorkspaceProps) {
  const router = useRouter()
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isConfirmingKyc, setIsConfirmingKyc] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false)
  const [confirmingAnalysisId, setConfirmingAnalysisId] = useState<string | null>(null)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [withdrawingConsentId, setWithdrawingConsentId] = useState<string | null>(null)
  const [acceptingConsentId, setAcceptingConsentId] = useState<string | null>(null)
  const [creatingPrivacyRequestType, setCreatingPrivacyRequestType] = useState<string | null>(null)
  const [isCopyingPortalLink, setIsCopyingPortalLink] = useState(false)
  const [isSendingInvitation, setIsSendingInvitation] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requiredDocuments = client.documents.filter((document) => ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"].includes(document.status))
  const openTasks = client.tasks.filter((task) => !["DONE", "ARCHIVED", "CANCELLED"].includes(task.status))
  const reportsAvailable = client.insuranceNeedsAnalyses.filter((analysis) => Boolean(analysis.reportDocument)).length
  const reportsConfirmed = client.insuranceNeedsAnalyses.filter((analysis) => Boolean(analysis.signedAt ?? analysis.clientConfirmedAt)).length
  const activeConsents = client.consents.filter((consent) => consent.status === "GIVEN")
  const completionItems = [
    { label: "Profil client", done: client.kycCompleted, detail: client.kycCompleted ? "Questionnaire reçu" : "À compléter dans l’espace client" },
    { label: "Identité", done: client.identityVerified, detail: client.identityVerified ? "Vérifiée" : "Validation requise" },
    { label: "Consentement", done: client.consentGiven || activeConsents.length > 0, detail: client.consentGiven || activeConsents.length > 0 ? "Actif" : "À confirmer" },
    { label: "Documents", done: requiredDocuments.length === 0 && client.documents.length > 0, detail: requiredDocuments.length > 0 ? `${requiredDocuments.length} à fournir` : `${client.documents.length} au dossier` },
    { label: "Analyse", done: Boolean(client.primaryGoal), detail: client.primaryGoal ?? "Objectif à préciser" },
    { label: "Suivi", done: Boolean(client.nextReviewDate), detail: formatDate(client.nextReviewDate) },
  ]
  const completion = Math.round((completionItems.filter((item) => item.done).length / completionItems.length) * 100)
  const nextAction = requiredDocuments[0]?.name ?? openTasks[0]?.title ?? (!client.kycCompleted ? "Compléter mon profil client" : !client.consentGiven && activeConsents.length === 0 ? "Confirmer le consentement" : "Attendre le prochain suivi")
  const advisorPhone = client.organization.communicationSettings?.advisorSmsNotificationNumber ?? client.organization.communicationSettings?.twilioPhoneNumber ?? null
  const givenConsentTypes = new Set(activeConsents.map((consent) => consent.type))
  const profileRequiredItems = [
    { label: "Prénom légal", done: Boolean(client.firstName) },
    { label: "Nom légal", done: Boolean(client.lastName) },
    { label: "Date de naissance", done: Boolean(client.dateOfBirth) },
    { label: "Téléphone principal", done: Boolean(client.phonePrimary ?? client.phone) },
    { label: "Courriel principal", done: Boolean(client.emailPrimary ?? client.email) },
    { label: "Adresse résidentielle", done: Boolean(client.addressLine1 ?? client.address) },
    { label: "Ville", done: Boolean(client.city) },
    { label: "Province", done: Boolean(client.province) },
    { label: "Code postal", done: Boolean(client.postalCode) },
    { label: "Situation familiale", done: Boolean(client.familyStatus) },
    { label: "Statut d’emploi", done: Boolean(client.employmentStatus) },
    { label: "Occupation", done: Boolean(client.occupation) },
    { label: "Revenus", done: Boolean(client.annualIncome ?? client.approximateIncome ?? client.incomeRange) },
    { label: "Objectif principal", done: Boolean(client.primaryGoal) },
    { label: "Profil de risque", done: Boolean(client.riskProfile) },
    { label: "Source des fonds", done: Boolean(client.kycProfile?.sourceOfFunds) },
    { label: "Source de la richesse", done: Boolean(client.kycProfile?.sourceOfWealth) },
  ]
  const profileMissingItems = profileRequiredItems.filter((item) => !item.done)
  const profileCompletion = Math.round(((profileRequiredItems.length - profileMissingItems.length) / profileRequiredItems.length) * 100)
  const portalHref = (page: ClientPortalPage) => {
    const query = `clientId=${encodeURIComponent(client.id)}`
    return page === "overview" ? `/espace-client?${query}` : `/espace-client/${page}?${query}`
  }
  const activePageDetails = clientPortalPageDetails[activePage]
  const ActivePageIcon = activePageDetails.icon
  const hasPrimaryWorkArea = ["overview", "profil", "consentements", "messages", "documents"].includes(activePage)
  const showOnPage = (...pages: ClientPortalPage[]) => pages.includes(activePage) ? "" : "hidden"
  const dossierFolders = [
    {
      id: "portal-profile-questionnaire",
      page: "profil",
      icon: UserRoundCheck,
      title: "Profil client sécurisé",
      detail: client.kycCompleted ? "Profil soumis au conseiller" : "Questionnaire guidé à compléter",
      count: client.kycCompleted ? "Soumis" : `${profileCompletion} %`,
      tone: client.kycCompleted ? "emerald" : "amber",
    },
    {
      id: "portal-consents",
      page: "consentements",
      icon: ShieldCheck,
      title: "Consentements",
      detail: client.consentGiven || activeConsents.length > 0 ? "Profil confirmé" : "Confirmation requise",
      count: `${activeConsents.length} actif${activeConsents.length > 1 ? "s" : ""}`,
      tone: client.consentGiven || activeConsents.length > 0 ? "emerald" : "amber",
    },
    {
      id: "portal-documents",
      page: "documents",
      icon: FileText,
      title: "Documents",
      detail: requiredDocuments.length > 0 ? `${requiredDocuments.length} document${requiredDocuments.length > 1 ? "s" : ""} à fournir` : "Documents classés",
      count: `${client.documents.length} fichier${client.documents.length > 1 ? "s" : ""}`,
      tone: requiredDocuments.length > 0 ? "amber" : "emerald",
    },
    {
      id: "portal-analyses",
      page: "analyses",
      icon: HeartPulse,
      title: "Analyses d’assurance",
      detail: reportsAvailable > 0 ? `${reportsAvailable} rapport${reportsAvailable > 1 ? "s" : ""} disponible${reportsAvailable > 1 ? "s" : ""}` : "En préparation",
      count: `${reportsConfirmed}/${client.insuranceNeedsAnalyses.length} confirmé${reportsConfirmed > 1 ? "s" : ""}`,
      tone: reportsAvailable > reportsConfirmed ? "amber" : reportsAvailable > 0 ? "emerald" : "slate",
    },
    {
      id: "portal-message",
      page: "messages",
      icon: MessageSquareText,
      title: "Messages",
      detail: "Échanger avec le conseiller",
      count: `${client.noteItems.length} message${client.noteItems.length > 1 ? "s" : ""}`,
      tone: "sky",
    },
    {
      id: "portal-advisor",
      page: "conseiller",
      icon: UserRoundCheck,
      title: "Conseiller",
      detail: client.advisor?.name ?? "Conseiller à assigner",
      count: formatPhone(advisorPhone),
      tone: "slate",
    },
    {
      id: "portal-history",
      page: "historique",
      icon: Clock3,
      title: "Historique",
      detail: "Activités récentes",
      count: `${client.activities.length} événement${client.activities.length > 1 ? "s" : ""}`,
      tone: "violet",
    },
  ] satisfies PortalNavItem[]
  const portalNavItems = [
    {
      id: "portal-overview",
      page: "overview",
      icon: CalendarDays,
      title: "Vue d’ensemble",
      detail: "Priorités du dossier",
      count: `${completion} %`,
      tone: "emerald",
    },
    dossierFolders[0],
    dossierFolders[1],
    dossierFolders[4],
    {
      id: "portal-upload",
      page: "documents",
      icon: UploadCloud,
      title: "Téléverser",
      detail: requiredDocuments.length > 0 ? "Répondre aux demandes" : "Ajouter un fichier",
      count: requiredDocuments.length > 0 ? `${requiredDocuments.length} requis` : "Prêt",
      tone: requiredDocuments.length > 0 ? "amber" : "emerald",
    },
    dossierFolders[2],
    dossierFolders[3],
    {
      id: "portal-recommendations",
      page: "recommandations",
      icon: FileCheck2,
      title: "Recommandations",
      detail: client.productRecommendations.length > 0 ? "Rapports et décisions" : "Aucune en attente",
      count: `${client.productRecommendations.length}`,
      tone: client.productRecommendations.length > 0 ? "sky" : "slate",
    },
    dossierFolders[5],
    dossierFolders[6],
  ] satisfies PortalNavItem[]

  const advisorInitials = useMemo(() => {
    const name = client.advisor?.name ?? "Conseiller"
    return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  }, [client.advisor?.name])
  const greetingName = isPreview ? `${client.firstName} ${client.lastName}` : userName || `${client.firstName} ${client.lastName}`

  async function copyPortalLink() {
    setIsCopyingPortalLink(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${client.id}/portal-invitation`, { cache: "no-store" })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.data?.url) {
        throw new Error(result?.error?.message ?? "Impossible de générer le lien client.")
      }
      await copyToClipboard(result.data.url)
      setNotice("Lien du profil client sécurisé copié dans le presse-papiers.")
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Impossible de copier le lien client.")
    } finally {
      setIsCopyingPortalLink(false)
    }
  }

  async function resendPortalInvitation() {
    setIsSendingInvitation(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${client.id}/portal-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      await readApiMessage(response)
      setNotice("Formulaire profil client envoyé par les canaux disponibles et activité ajoutée au dossier.")
      router.refresh()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Impossible de renvoyer l’invitation client.")
    } finally {
      setIsSendingInvitation(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSendingMessage(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch(isPreview ? `/api/clients/${client.id}/portal-message` : "/api/client-portal/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formData.get("subject"),
          message: formData.get("message"),
        }),
      })
      await readApiMessage(response)
      event.currentTarget.reset()
      setNotice(isPreview ? "Message ajouté au fil portail du client depuis le CRM." : "Message envoyé au conseiller. Une tâche de suivi a été créée dans son CRM.")
      router.refresh()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message impossible à envoyer.")
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsUploading(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    if (isPreview) {
      formData.set("clientId", client.id)
      formData.set("visibility", "CLIENT_VISIBLE")
    }
    try {
      const response = await fetch(isPreview ? "/api/documents/upload" : "/api/client-portal/upload", {
        method: "POST",
        body: formData,
      })
      await readApiMessage(response)
      event.currentTarget.reset()
      setNotice(isPreview ? "Document ajouté au dossier client depuis le CRM et visible dans l’espace client." : "Document ajouté au dossier. Votre conseiller a été avisé.")
      router.refresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document impossible à téléverser.")
    } finally {
      setIsUploading(false)
    }
  }

  async function confirmKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPreview) {
      setError(null)
      setNotice(null)
      setIsConfirmingKyc(true)
      try {
        const response = await fetch(`/api/clients/${client.id}/portal-invitation`, { cache: "no-store" })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.data?.url) {
          throw new Error(result?.error?.message ?? "Impossible de générer le lien client.")
        }
        await copyToClipboard(result.data.url)
        setNotice("Lien espace client copié. Envoyez-le au client pour qu’il confirme lui-même son profil et ses consentements.")
      } catch (copyError) {
        setError(copyError instanceof Error ? copyError.message : "Impossible de copier le lien client.")
      } finally {
        setIsConfirmingKyc(false)
      }
      return
    }
    setIsConfirmingKyc(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/client-portal/confirm-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: formData.get("accepted") === "on",
          personalInfoCollectionAccepted: formData.get("personalInfoCollectionAccepted") === "on",
          advisorAnalysisUseAccepted: formData.get("advisorAnalysisUseAccepted") === "on",
          electronicCommunicationAccepted: formData.get("electronicCommunicationAccepted") === "on",
          documentExchangeAccepted: formData.get("documentExchangeAccepted") === "on",
          typedSignature: formData.get("typedSignature"),
          note: formData.get("note"),
        }),
      })
      await readApiMessage(response)
      setNotice("Confirmation reçue. Votre conseiller a été avisé et une version de conformité a été créée.")
      router.refresh()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Confirmation impossible.")
    } finally {
      setIsConfirmingKyc(false)
    }
  }

  async function saveProfileQuestionnaire(event: FormEvent<HTMLFormElement>, mode: "draft" | "submit") {
    event.preventDefault()
    if (isPreview) {
      setError(null)
      setNotice(null)
      setIsSavingProfile(true)
      try {
        const response = await fetch(`/api/clients/${client.id}/portal-invitation`, { cache: "no-store" })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.data?.url) {
          throw new Error(result?.error?.message ?? "Impossible de générer le lien client.")
        }
        await copyToClipboard(result.data.url)
        setNotice("Lien du formulaire profil client copié. Le client pourra le compléter depuis son espace sécurisé.")
      } catch (copyError) {
        setError(copyError instanceof Error ? copyError.message : "Impossible de copier le lien client.")
      } finally {
        setIsSavingProfile(false)
      }
      return
    }

    mode === "draft" ? setIsSavingProfile(true) : setIsSubmittingProfile(true)
    setError(null)
    setNotice(null)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    try {
      const response = await fetch("/api/client-portal/profile-questionnaire", {
        method: mode === "draft" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          personalInfoCollectionAccepted: formData.get("personalInfoCollectionAccepted") === "on",
          advisorAnalysisUseAccepted: formData.get("advisorAnalysisUseAccepted") === "on",
          electronicCommunicationAccepted: formData.get("electronicCommunicationAccepted") === "on",
          documentExchangeAccepted: formData.get("documentExchangeAccepted") === "on",
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        const missing = Array.isArray(result?.error?.details?.missing) ? ` Champs à compléter: ${result.error.details.missing.join(", ")}.` : ""
        throw new Error(`${result?.error?.message ?? "Impossible d’enregistrer le profil."}${missing}`)
      }
      setNotice(mode === "draft" ? "Brouillon sauvegardé. Le dossier conseiller est déjà mis à jour." : "Profil client soumis. Votre conseiller a reçu une notification et une tâche de révision.")
      router.refresh()
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Impossible d’enregistrer le profil.")
    } finally {
      setIsSavingProfile(false)
      setIsSubmittingProfile(false)
    }
  }

  async function openDocument(documentId: string, mode: "preview" | "download") {
    setOpeningDocumentId(`${mode}:${documentId}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(isPreview ? `/api/documents/${documentId}/${mode === "download" ? "download-url" : "preview-url"}` : `/api/client-portal/documents/${documentId}/url?mode=${mode}`)
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok || !result.data?.url) {
        throw new Error(result?.error?.message ?? "Impossible d’ouvrir le document.")
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer")
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : "Impossible d’ouvrir le document.")
    } finally {
      setOpeningDocumentId(null)
    }
  }

  async function confirmInsuranceAnalysis(analysisId: string) {
    if (isPreview) {
      setError(null)
      setNotice("La confirmation du rapport doit être faite par le client depuis son propre lien d’accès.")
      return
    }
    setConfirmingAnalysisId(analysisId)
    setError(null)
    setNotice(null)
    try {
      const typedSignature = window.prompt("Tapez votre nom complet pour confirmer la réception du rapport.")
      if (!typedSignature?.trim()) {
        setConfirmingAnalysisId(null)
        return
      }
      const response = await fetch(`/api/client-portal/insurance-analyses/${analysisId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, typedSignature }),
      })
      await readApiMessage(response)
      setNotice("Réception du rapport confirmée. Votre conseiller a été avisé et la preuve est conservée au dossier.")
      router.refresh()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Impossible de confirmer la réception du rapport.")
    } finally {
      setConfirmingAnalysisId(null)
    }
  }

  async function completeTask(taskId: string, title: string) {
    setCompletingTaskId(taskId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(isPreview ? `/api/tasks/${taskId}/complete` : `/api/client-portal/tasks/${taskId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "Le client a confirmé cette action comme complétée dans son espace client." }),
      })
      await readApiMessage(response)
      setNotice(isPreview ? `Action complétée dans le CRM: ${title}.` : `Action complétée: ${title}. Votre conseiller a été avisé.`)
      router.refresh()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Impossible de compléter cette action.")
    } finally {
      setCompletingTaskId(null)
    }
  }

  async function withdrawConsent(consentId: string) {
    if (isPreview) {
      setError("Le retrait d’un consentement doit être fait par le client depuis son propre espace sécurisé.")
      return
    }
    setWithdrawingConsentId(consentId)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch(`/api/client-portal/consents/${consentId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Retrait demandé depuis le portail client." }),
      })
      await readApiMessage(response)
      setNotice("Consentement retiré. Votre conseiller verra la mise à jour dans le dossier.")
      router.refresh()
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : "Impossible de retirer ce consentement.")
    } finally {
      setWithdrawingConsentId(null)
    }
  }

  async function acceptConsent(consentId: string) {
    if (isPreview) {
      setError("L’acceptation d’un consentement doit être faite par le client depuis son propre espace sécurisé.")
      return
    }
    setAcceptingConsentId(consentId)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch(`/api/client-portal/consents/${consentId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      await readApiMessage(response)
      setNotice("Consentement accepté. Votre conseiller verra la mise à jour dans le dossier.")
      router.refresh()
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Impossible d’accepter ce consentement.")
    } finally {
      setAcceptingConsentId(null)
    }
  }

  async function createPrivacyRequest(requestType: string) {
    if (isPreview) {
      setError("Cette demande doit être créée par le client depuis son propre espace sécurisé.")
      return
    }
    setCreatingPrivacyRequestType(requestType)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch("/api/client-portal/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          notes: `Demande ${privacyRequestLabels[requestType] ?? requestType} soumise depuis le portail client.`,
        }),
      })
      await readApiMessage(response)
      setNotice("Demande reçue. Votre conseiller ou le responsable confidentialité fera le suivi.")
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de créer cette demande.")
    } finally {
      setCreatingPrivacyRequestType(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Espace client</span>
              <span className="block text-xs text-slate-500">{client.organization.name}</span>
            </span>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            {isPreview ? "Aperçu conseiller" : "Dossier synchronisé"}
          </span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {(notice || error) ? (
          <div className={error ? "mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" : "mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"}>
            {error ?? notice}
          </div>
        ) : null}
        {isPreview ? (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-sky-800">
            Aperçu interne du portail client pour le dossier de {client.firstName} {client.lastName}. Les données sont réelles. Les boutons utilisent les routes CRM du conseiller; la confirmation des consentements doit être faite par le client avec son lien d’accès.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-5 bg-slate-950 p-5 text-white lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-200">
                <Link href={portalHref("overview")} className="transition hover:text-white">Espace client</Link>
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span>{activePageDetails.eyebrow}</span>
              </div>
              <div className="mt-4 flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-white/20">
                  <ActivePageIcon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-300">Bonjour {greetingName}</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{activePageDetails.title}</h1>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{activePageDetails.description}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activePageDetails.primaryLabel && activePageDetails.primaryPage ? (
                  <Button asChild className="h-auto min-h-10 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400">
                    <Link href={portalHref(activePageDetails.primaryPage)}>{activePageDetails.primaryLabel}</Link>
                  </Button>
                ) : null}
                {activePageDetails.secondaryLabel && activePageDetails.secondaryPage ? (
                  <Button asChild variant="outline" className="h-auto min-h-10 rounded-xl border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/15">
                    <Link href={portalHref(activePageDetails.secondaryPage)}>{activePageDetails.secondaryLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-4xl font-black">{completion} %</p>
                  <p className="text-sm font-bold text-slate-300">Progression du dossier</p>
                </div>
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-emerald-700">{advisorInitials}</span>
              </div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(6, completion)}%` }} />
              </div>
              <p className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold leading-5 text-emerald-50">
                Prochaine action: {nextAction}
              </p>
            </div>
          </div>
        </section>

        {activePage === "overview" ? (
          <>
            <section className="mt-5 grid gap-4 lg:grid-cols-6">
              {completionItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
                    {item.done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Clock3 className="size-4 text-amber-500" />}
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-950">{item.done ? "À jour" : "À faire"}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </section>
            <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dossierFolders.slice(0, 4).map((folder) => (
                <DossierFolderCard key={folder.id} folder={folder} href={portalHref(folder.page)} />
              ))}
            </section>
          </>
        ) : (
          <section className="mt-5 grid gap-4 md:grid-cols-3">
            <PageSignalCard icon={CheckCircle2} label="Dossier" value={`${completion} % complété`} detail="Synchronisé avec le conseiller" />
            <PageSignalCard icon={Clock3} label="À traiter" value={`${openTasks.length + requiredDocuments.length} action${openTasks.length + requiredDocuments.length > 1 ? "s" : ""}`} detail={nextAction} />
            <PageSignalCard icon={Mail} label="Conseiller" value={client.advisor?.name ?? "À assigner"} detail={client.advisor?.email ?? client.organization.name} />
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <PortalSidebar
            items={portalNavItems}
            activePage={activePage}
            getHref={portalHref}
            completion={completion}
            nextAction={nextAction}
            isPreview={isPreview}
            clientId={client.id}
            isCopyingPortalLink={isCopyingPortalLink}
            isSendingInvitation={isSendingInvitation}
            onRefresh={() => router.refresh()}
            onCopyPortalLink={copyPortalLink}
            onResendPortalInvitation={resendPortalInvitation}
          />

          <div className="min-w-0 space-y-6">
            <section className={!hasPrimaryWorkArea ? "hidden" : activePage === "overview" ? "grid gap-5" : "grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"}>
          <div className={activePage === "overview" ? "hidden" : "space-y-5"}>
            <Panel id="portal-profile-questionnaire" className={`xl:col-span-2 ${showOnPage("profil")}`} title="Compléter mon profil client sécurisé" description="Ce formulaire remplit automatiquement votre dossier chez le conseiller. Vous pouvez sauvegarder un brouillon, puis soumettre quand les informations sont prêtes.">
              <div className={profileMissingItems.length > 0 ? "mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" : "mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={profileMissingItems.length > 0 ? "text-sm font-black text-amber-900" : "text-sm font-black text-emerald-900"}>
                      {profileMissingItems.length > 0 ? `${profileMissingItems.length} information${profileMissingItems.length > 1 ? "s" : ""} à compléter avant la soumission` : "Les informations critiques sont complètes"}
                    </p>
                    <p className={profileMissingItems.length > 0 ? "mt-1 text-xs font-semibold leading-5 text-amber-800" : "mt-1 text-xs font-semibold leading-5 text-emerald-800"}>
                      Le brouillon peut être sauvegardé en tout temps. La soumission finale exige les champs critiques et les consentements.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-black/5">
                    {profileCompletion} % complété
                  </span>
                </div>
                {profileMissingItems.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileMissingItems.slice(0, 8).map((item) => (
                      <span key={item.label} className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                        {item.label}
                      </span>
                    ))}
                    {profileMissingItems.length > 8 ? (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                        +{profileMissingItems.length - 8}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
                  saveProfileQuestionnaire(event, submitter?.value === "submit" ? "submit" : "draft")
                }}
              >
                <QuestionnaireBlock title="Identité et coordonnées" detail="Ces renseignements servent à identifier le bon dossier et à éviter les doublons.">
                  <QuestionnaireField name="legalFirstName" label="Prénom légal" required defaultValue={client.firstName} />
                  <QuestionnaireField name="legalLastName" label="Nom légal" required defaultValue={client.lastName} />
                  <QuestionnaireSelect name="gender" label="Genre" defaultValue={client.gender ?? ""} options={[{ value: "", label: "Sélectionner" }, { value: "FEMALE", label: "Femme" }, { value: "MALE", label: "Homme" }, { value: "OTHER", label: "Autre" }, { value: "PREFER_NOT_TO_SAY", label: "Préfère ne pas répondre" }]} />
                  <QuestionnaireField name="dateOfBirth" label="Date de naissance" type="date" required defaultValue={client.dateOfBirth?.slice(0, 10) ?? ""} />
                  <QuestionnaireField name="phonePrimary" label="Téléphone principal" inputMode="numeric" pattern="[0-9()+\\-\\s]{10,20}" required defaultValue={client.phonePrimary ?? client.phone ?? ""} />
                  <QuestionnaireField name="phoneSecondary" label="Téléphone secondaire (optionnel)" inputMode="numeric" pattern="[0-9()+\\-\\s]{10,20}" defaultValue={client.phoneSecondary ?? ""} />
                  <QuestionnaireField name="emailPrimary" label="Courriel principal" type="email" required defaultValue={client.emailPrimary ?? client.email ?? userEmail ?? ""} />
                  <QuestionnaireField name="emailSecondary" label="Courriel secondaire (optionnel)" type="email" defaultValue={client.emailSecondary ?? ""} />
                  <QuestionnaireField name="addressLine1" label="Adresse résidentielle" required defaultValue={client.addressLine1 ?? client.address ?? ""} className="sm:col-span-2" />
                  <QuestionnaireField name="addressLine2" label="Appartement / bureau (optionnel)" defaultValue={client.addressLine2 ?? ""} />
                  <QuestionnaireField name="city" label="Ville" required defaultValue={client.city ?? ""} />
                  <QuestionnaireField name="province" label="Province" required defaultValue={client.province ?? ""} />
                  <QuestionnaireField name="postalCode" label="Code postal" required defaultValue={client.postalCode ?? ""} />
                  <QuestionnaireField name="country" label="Pays" required defaultValue={client.country ?? "Canada"} />
                </QuestionnaireBlock>

                <QuestionnaireBlock title="Famille et personnes à charge" detail="Ces informations aident à évaluer les protections familiales et les bénéficiaires.">
                  <QuestionnaireSelect name="familyStatus" label="Situation familiale" required defaultValue={client.familyStatus ?? ""} options={[{ value: "", label: "Sélectionner" }, ...Object.entries(familyStatusLabels).map(([value, label]) => ({ value, label }))]} />
                  <QuestionnaireField name="spouseName" label="Nom du/de la conjoint(e) (si applicable)" defaultValue={client.spouseName ?? ""} />
                  <QuestionnaireField name="dependentsCount" label="Nombre de personnes à charge" type="number" min="0" defaultValue={String(client.dependentsCount ?? client.dependents ?? 0)} />
                  <QuestionnaireTextArea name="dependentsDetails" label="Détails utiles sur les enfants ou personnes à charge" defaultValue={client.dependentsDetails ?? ""} placeholder="Ex. enfant de 8 ans, parent à charge, besoins particuliers." className="sm:col-span-2" />
                </QuestionnaireBlock>

                <QuestionnaireBlock title="Emploi et revenus" detail="Le conseiller utilise ces données pour la capacité financière, l’assurance invalidité et la source des revenus.">
                  <QuestionnaireSelect name="employmentStatus" label="Statut d’emploi" required defaultValue={client.employmentStatus ?? ""} options={[{ value: "", label: "Sélectionner" }, ...Object.entries(employmentStatusLabels).map(([value, label]) => ({ value, label }))]} />
                  <QuestionnaireField name="occupation" label="Occupation / profession" required defaultValue={client.occupation ?? ""} />
                  <QuestionnaireField name="employer" label="Employeur ou entreprise" defaultValue={client.employer ?? ""} />
                  <QuestionnaireField name="yearsAtJob" label="Années en poste" type="number" min="0" defaultValue={client.yearsAtJob === null || client.yearsAtJob === undefined ? "" : String(client.yearsAtJob)} />
                  <QuestionnaireField name="annualIncome" label="Revenu annuel estimé" type="number" min="0" required={!client.incomeRange} defaultValue={String(client.annualIncome ?? client.approximateIncome ?? "")} />
                  <QuestionnaireSelect name="incomeRange" label="Fourchette de revenu" defaultValue={client.incomeRange ?? ""} options={incomeRangeOptions} />
                  <QuestionnaireField name="sourceOfFunds" label="Source des fonds" required defaultValue={client.kycProfile?.sourceOfFunds ?? ""} placeholder="Ex. salaire, entreprise, vente d’actif, épargne." className="sm:col-span-2" />
                  <QuestionnaireField name="sourceOfWealth" label="Source de la richesse" required defaultValue={client.kycProfile?.sourceOfWealth ?? ""} placeholder="Ex. revenus d’emploi, croissance d’entreprise, héritage." className="sm:col-span-2" />
                </QuestionnaireBlock>

                <QuestionnaireBlock title="Actifs, dettes et objectifs" detail="Ces données alimentent l’analyse des besoins, les recommandations et les alertes de conformité.">
                  <QuestionnaireField name="netWorth" label="Valeur nette estimée" type="number" min="0" defaultValue={String(client.netWorth ?? "")} />
                  <QuestionnaireField name="liquidAssets" label="Actifs liquides disponibles" type="number" min="0" defaultValue={String(client.liquidAssets ?? "")} />
                  <QuestionnaireField name="liabilities" label="Dettes totales estimées" type="number" min="0" defaultValue={String(client.liabilities ?? "")} />
                  <QuestionnaireField name="monthlyExpenses" label="Dépenses mensuelles estimées" type="number" min="0" defaultValue={String(client.kycProfile?.monthlyExpenses ?? "")} />
                  <QuestionnaireField name="emergencyFund" label="Fonds d’urgence en mois" type="number" min="0" defaultValue={String(client.kycProfile?.emergencyFund ?? "")} />
                  <QuestionnaireSelect name="liquidityNeeds" label="Besoin de liquidité" required defaultValue={client.kycProfile?.liquidityNeeds ?? ""} options={liquidityNeedOptions} />
                  <QuestionnaireSelect name="investmentHorizon" label="Horizon" defaultValue={client.investmentHorizon ?? ""} options={horizonOptions} />
                  <QuestionnaireSelect name="primaryGoal" label="Objectif principal" required defaultValue={client.primaryGoal ?? ""} options={[{ value: "", label: "Sélectionner" }, { value: "Protection familiale", label: "Protection familiale" }, { value: "Retraite", label: "Retraite" }, { value: "Invalidité / revenu", label: "Protection du revenu" }, { value: "Maladies graves", label: "Liquidités en cas de maladie grave" }, { value: "Entreprise", label: "Protection entreprise" }, { value: "Placement", label: "Placement / croissance" }, { value: "Succession", label: "Succession" }]} />
                  <QuestionnaireSelect name="investmentKnowledge" label="Connaissances financières" required defaultValue={client.kycProfile?.investmentKnowledge ?? ""} options={investmentKnowledgeOptions} />
                  <QuestionnaireSelect name="investmentExperience" label="Expérience de placement" required defaultValue={client.kycProfile?.investmentExperience ?? ""} options={investmentExperienceOptions} />
                  <QuestionnaireSelect name="riskTolerance" label="Tolérance au risque" required defaultValue={client.kycProfile?.riskTolerance ?? client.riskProfile ?? ""} options={[{ value: "", label: "Sélectionner" }, ...Object.entries(riskProfileLabels).map(([value, label]) => ({ value, label }))]} />
                  <QuestionnaireSelect name="riskCapacity" label="Capacité de risque" required defaultValue={client.kycProfile?.riskCapacity ?? ""} options={riskCapacityOptions} />
                  <QuestionnaireSelect name="riskProfile" label="Profil de risque final" required defaultValue={client.riskProfile ?? client.kycProfile?.riskProfileResult ?? ""} options={[{ value: "", label: "Sélectionner" }, ...Object.entries(riskProfileLabels).map(([value, label]) => ({ value, label }))]} />
                  <QuestionnaireSelect name="borrowingNeeds" label="Levier / emprunt pour investir" required defaultValue={client.kycProfile?.borrowingNeeds ?? ""} options={borrowingNeedOptions} />
                  <QuestionnaireTextArea name="financialGoals" label="Objectifs financiers ou besoins à préciser" defaultValue={client.financialGoals ?? client.goals ?? ""} placeholder="Décrivez ce que vous souhaitez protéger, financer ou planifier." className="sm:col-span-2" />
                </QuestionnaireBlock>

                <QuestionnaireBlock title="Protections et consentements" detail="Ces réponses aident le conseiller à vérifier les lacunes et à communiquer de façon sécurisée.">
                  <QuestionnaireTextArea name="protectionNeeds" label="Assurances ou protections existantes" defaultValue={client.kycProfile?.protectionNeeds ?? ""} placeholder="Ex. assurance vie collective, invalidité, police personnelle, assurance hypothécaire." className="sm:col-span-2" />
                  <QuestionnaireTextArea name="additionalNotes" label="Notes ou précisions pour le conseiller" defaultValue={client.kycProfile?.notes ?? ""} placeholder="Ajoutez toute information importante pour votre dossier." className="sm:col-span-2" />
                  <div className="sm:col-span-2 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {consentDefinitions.map((consent) => {
                      const alreadyGiven = givenConsentTypes.has(consent.type)
                      return (
                        <label key={`profile-${consent.type}`} className="flex gap-3 text-sm font-semibold leading-6 text-slate-700">
                          <input name={consent.field} type="checkbox" className="mt-1 size-4 accent-emerald-600" defaultChecked={alreadyGiven} />
                          <span>
                            <span className="block font-black text-slate-950">{consent.title}</span>
                            <span className="block text-xs font-semibold leading-5 text-slate-500">{consent.detail}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </QuestionnaireBlock>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <Button type="submit" name="profileAction" value="draft" formNoValidate variant="outline" className="rounded-xl bg-white font-black" disabled={isSavingProfile || isSubmittingProfile}>
                    {isSavingProfile ? <Loader2 className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
                    Sauvegarder brouillon
                  </Button>
                  <Button type="submit" name="profileAction" value="submit" className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700" disabled={isSavingProfile || isSubmittingProfile}>
                    {isSubmittingProfile ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Soumettre à mon conseiller
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel id="portal-consents" className={showOnPage("consentements")} title="Confirmer mon profil client" description="Cette acceptation horodatée fige une version du dossier pour la révision du conseiller.">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Nom" value={`${client.firstName} ${client.lastName}`} />
                <SummaryItem label="Date de naissance" value={formatDate(client.dateOfBirth)} />
                <SummaryItem label="Adresse" value={[client.addressLine1 ?? client.address, client.city, client.province, client.postalCode].filter(Boolean).join(", ") || "À compléter"} />
                <SummaryItem label="Situation familiale" value={translate(familyStatusLabels, client.familyStatus)} />
                <SummaryItem label="Personnes à charge" value={displayDependents(client)} />
                <SummaryItem label="Emploi" value={[translate(employmentStatusLabels, client.employmentStatus, ""), client.occupation, client.employer].filter(Boolean).join(" · ") || "À compléter"} />
                <SummaryItem label="Revenu" value={formatMoney(client.annualIncome ?? client.approximateIncome)} />
                <SummaryItem label="Profil de risque" value={translate(riskProfileLabels, client.riskProfile)} />
                <SummaryItem label="Objectif principal" value={client.primaryGoal ?? client.financialGoals ?? client.goals ?? "À compléter"} />
                <SummaryItem label="Horizon" value={client.investmentHorizon ?? "À compléter"} />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <CheckSquare className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-950">Consentements nécessaires</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Chaque consentement est conservé séparément au dossier avec la date, l’adresse IP et le texte accepté.
                    </p>
                  </div>
                </div>
              </div>

              {client.kycCompleted && (client.consentGiven || client.consents.length > 0) ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
                  Votre profil est déjà confirmé. Une nouvelle confirmation peut être faite après une modification importante.
                </div>
              ) : null}

              <form onSubmit={confirmKyc} className="mt-4 space-y-3">
                <textarea
                  name="note"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Note optionnelle si une information doit être précisée au conseiller."
                />
                <div className="grid gap-2">
                  {consentDefinitions.map((consent) => {
                    const alreadyGiven = givenConsentTypes.has(consent.type)
                    return (
                      <label key={consent.type} className={alreadyGiven ? "flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-900" : "flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700"}>
                        <input
                          name={consent.field}
                          type="checkbox"
                          className="mt-1 size-4 accent-emerald-600"
                          required={isPreview ? false : consent.required}
                          defaultChecked={alreadyGiven}
                        />
                        <span>
                          <span className="block font-black">{consent.title}</span>
                          <span className="block text-xs font-semibold leading-5 opacity-80">{consent.detail}</span>
                          {alreadyGiven ? <span className="mt-1 block text-xs font-black text-emerald-700">Déjà accepté au dossier.</span> : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                  <input name="accepted" type="checkbox" className="mt-1 size-4 accent-emerald-600" required={isPreview ? false : true} />
                  <span>Je confirme que les renseignements affichés dans mon dossier sont exacts et complets à ma connaissance, et j’autorise mon conseiller à les utiliser pour le suivi, la conformité et l’analyse de mes besoins.</span>
                </label>
                <label className="grid gap-1.5 text-sm font-black text-slate-700">
                  Signature électronique
                  <Input
                    name="typedSignature"
                    required={!isPreview}
                    placeholder={`${client.firstName} ${client.lastName}`}
                    className="rounded-xl"
                  />
                  <span className="text-xs font-semibold leading-5 text-slate-500">
                    Tapez votre nom complet pour signer électroniquement cette confirmation.
                  </span>
                </label>
                <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={isConfirmingKyc}>
                  {isConfirmingKyc ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                  {isPreview ? "Copier le lien de confirmation client" : "Confirmer et signer électroniquement"}
                </Button>
              </form>
            </Panel>

            <Panel id="portal-message" className={showOnPage("messages")} title="Communiquer avec mon conseiller" description="Le message est ajouté au dossier client et crée une tâche de réponse pour le conseiller.">
              <form onSubmit={sendMessage} className="space-y-3">
                <Input name="subject" placeholder="Sujet du message" defaultValue={requiredDocuments.length > 0 ? "Document ou information à valider" : ""} />
                <textarea
                  name="message"
                  required
                  minLength={2}
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Écrivez votre message, question ou précision pour le conseiller."
                />
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={isSendingMessage}>
                  {isSendingMessage ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {isPreview ? "Ajouter au portail client" : "Envoyer au conseiller"}
                </Button>
              </form>
            </Panel>

            <Panel id="portal-upload" className={showOnPage("documents")} title="Ajouter un document" description="Le fichier est classé automatiquement dans votre dossier client et le conseiller reçoit une notification.">
              <form onSubmit={uploadDocument} className="space-y-3">
                <Input name="name" placeholder="Nom du document" />
                {requiredDocuments.length > 0 ? (
                  <label className="grid gap-1.5 text-sm font-black text-slate-700">
                    Répondre à une demande
                    <select name="documentId" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" defaultValue="">
                      <option value="">Nouveau document non demandé</option>
                      {requiredDocuments.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.name} · {statusLabel(document.status)}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-semibold leading-5 text-slate-500">
                      Si le conseiller a demandé un document, sélectionnez-le ici pour fermer automatiquement la demande.
                    </span>
                  </label>
                ) : null}
                <select name="type" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" defaultValue="OTHER">
                  {documentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
                <Input name="description" placeholder="Note optionnelle pour le conseiller" />
                <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={isUploading}>
                  {isUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                  {isPreview ? "Ajouter au dossier client" : "Téléverser dans mon dossier"}
                </Button>
              </form>
            </Panel>
          </div>

          <div className={activePage === "overview" || activePage === "messages" ? "space-y-5" : "hidden"}>
            <Panel className={showOnPage("overview")} title="Demandes et prochaines étapes" description="Les actions ouvertes dans le CRM du conseiller apparaissent ici.">
              <div className="space-y-3">
                {openTasks.length === 0 && requiredDocuments.length === 0 ? <EmptyLine text="Aucune action requise pour le moment." /> : null}
                {requiredDocuments.map((document) => (
                  <ListLine key={document.id} icon={FilePlus2} title={document.name} detail={`${statusLabel(document.status)} · ${document.description ?? "Document demandé"}`} />
                ))}
                {openTasks.map((task) => (
                  <PortalTaskLine
                    key={task.id}
                    task={task}
                    isCompleting={completingTaskId === task.id}
                    onComplete={() => completeTask(task.id, task.title)}
                  />
                ))}
              </div>
            </Panel>

            <Panel className={showOnPage("overview", "messages")} title="Messages du dossier" description="Conversations ajoutées depuis le portail client.">
              <div className="space-y-3">
                {client.noteItems.length === 0 ? <EmptyLine text="Aucun message portail pour le moment." /> : null}
                {client.noteItems.map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">{note.title ?? "Message"}</p>
                      <span className="text-xs font-semibold text-slate-400">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{note.content}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">{note.user?.name ?? "Portail"}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

            <section className={activePage === "overview" ? "grid gap-5 xl:grid-cols-3" : "grid gap-5"}>
          <Panel id="portal-documents" className={showOnPage("overview", "documents")} title="Documents au dossier" description="Documents reçus, demandés ou validés.">
            <div className="space-y-3">
              {client.documents.length === 0 ? <EmptyLine text="Aucun document visible pour le moment." /> : null}
              {client.documents.map((document) => (
                <PortalDocumentLine
                  key={document.id}
                  document={document}
                  isOpeningPreview={openingDocumentId === `preview:${document.id}`}
                  isOpeningDownload={openingDocumentId === `download:${document.id}`}
                  onPreview={() => openDocument(document.id, "preview")}
                  onDownload={() => openDocument(document.id, "download")}
                />
              ))}
            </div>
          </Panel>

          <Panel id="portal-analyses" className={showOnPage("analyses")} title="Votre analyse d’assurance" description="Suivez les analyses préparées par le conseiller et les rapports disponibles dans votre dossier.">
            <div className="space-y-3">
              {client.insuranceNeedsAnalyses.length === 0 ? <EmptyLine text="Aucune analyse visible pour le moment." /> : null}
              {client.insuranceNeedsAnalyses.map((analysis) => (
                <div key={analysis.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
                      <HeartPulse className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-950">{insuranceAnalysisTypeLabel(analysis.analysisType)}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                          {insuranceAnalysisStatusLabel(analysis.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                        {analysis.summary ?? "Votre conseiller prépare cette analyse à partir des renseignements et documents au dossier."}
                      </p>
                      {analysis.reportDocument ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openDocument(analysis.reportDocument!.id, "preview")}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
                            >
                              <Eye className="size-4" />
                              Voir le rapport
                            </button>
                            {analysis.signatureDocument ? (
                              <button
                                type="button"
                                onClick={() => openDocument(analysis.signatureDocument!.id, "preview")}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                              >
                                <FileText className="size-4" />
                                Document signé
                              </button>
                            ) : null}
                            {analysis.signedAt ?? analysis.clientConfirmedAt ? (
                              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                                <CheckCircle2 className="size-4" />
                                Signé le {formatDate(analysis.signedAt ?? analysis.clientConfirmedAt)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => confirmInsuranceAnalysis(analysis.id)}
                                disabled={confirmingAnalysisId === analysis.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {confirmingAnalysisId === analysis.id ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                                Confirmer réception
                              </button>
                            )}
                          </div>
                          <div className="mt-3 grid gap-2 rounded-2xl border border-emerald-100 bg-white p-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
                            <span>Rapport remis : {analysis.deliveredAt ? formatDate(analysis.deliveredAt) : "en attente"}</span>
                            <span>Signature reçue : {analysis.signedAt ? formatDate(analysis.signedAt) : "en attente"}</span>
                            <span>Document signé : {analysis.signatureDocument ? "disponible" : "non disponible"}</span>
                            <span>Étape suivante : finalisation conseiller</span>
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                          Rapport non disponible tant que le conseiller n’a pas terminé la validation.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Version v{analysis.analysisVersion ?? 1}
                        {analysis.deliveredAt ? ` · Remis le ${formatDate(analysis.deliveredAt)}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel id="portal-recommendations" className={showOnPage("recommandations")} title="Vos recommandations" description="Rapports présentés par votre conseiller, décisions et preuves de signature.">
            <div className="space-y-3">
              {client.productRecommendations.length === 0 ? <EmptyLine text="Aucune recommandation visible pour le moment." /> : null}
              {client.productRecommendations.map((recommendation) => {
                const reportLink = recommendation.documents.find((document) => document.documentType === "RECOMMENDATION_REPORT" || document.document?.id === recommendation.reportDocumentId)
                const signatureLink = recommendation.documents.find((document) => document.documentType === "SIGNATURE" || document.document?.status === "VALIDATED")
                const pandaDoc = asRecord(asRecord(recommendation.metadata).pandaDoc)
                const signatureStatus = recommendation.clientSignedAt ? "document.completed" : pandaDoc.status
                const deliveredAt = reportLink?.deliveredAt ?? recommendation.presentedToClientAt
                const signedAt = recommendation.clientSignedAt ?? (typeof pandaDoc.completedAt === "string" ? pandaDoc.completedAt : null)

                return (
                  <div key={recommendation.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
                        <FileCheck2 className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-950">{recommendation.title}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                            {recommendationStatusLabel(recommendation.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">
                          {recommendationTypeLabel(recommendation.type)} · v{recommendation.recommendationVersion}
                          {recommendation.sourceKycVersion ? ` · Profil client v${recommendation.sourceKycVersion.versionNumber}` : ""}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{recommendation.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {reportLink?.document ? (
                            <button
                              type="button"
                              onClick={() => openDocument(reportLink.document!.id, "preview")}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
                            >
                              <Eye className="size-4" />
                              Voir le rapport
                            </button>
                          ) : null}
                          {signatureLink?.document ? (
                            <button
                              type="button"
                              onClick={() => openDocument(signatureLink.document!.id, "preview")}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                            >
                              <FileText className="size-4" />
                              Document signé
                            </button>
                          ) : null}
                          {signedAt ? (
                            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                              <CheckCircle2 className="size-4" />
                              Signé le {formatDate(signedAt)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 grid gap-2 rounded-2xl border border-emerald-100 bg-white p-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
                          <span>Rapport remis : {deliveredAt ? formatDate(deliveredAt) : "en attente"}</span>
                          <span>Signature : {pandaDocStatusLabel(signatureStatus)}</span>
                          <span>Document signé : {signatureLink?.document ? "disponible" : "non disponible"}</span>
                          <span>Prochaine étape : {signedAt ? "votre conseiller finalise le dossier" : "signature ou suivi avec le conseiller"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel id="portal-advisor" className={showOnPage("overview", "conseiller")} title="Conseiller et cabinet" description="Coordonnées liées au dossier.">
            <div className="space-y-3">
              <ListLine icon={UserRoundCheck} title={client.advisor?.name ?? "Conseiller à assigner"} detail={client.organization.name} />
              <ContactLine icon={Mail} title={client.advisor?.email ?? "Courriel non disponible"} detail="Courriel du conseiller" href={client.advisor?.email ? `mailto:${client.advisor.email}` : undefined} />
              <ContactLine icon={Phone} title={formatPhone(advisorPhone)} detail={advisorPhone ? "Téléphone du conseiller ou du cabinet" : "À configurer dans les communications du cabinet"} href={advisorPhone ? `tel:${advisorPhone}` : undefined} />
              <ListLine icon={Phone} title={formatPhone(client.phonePrimary ?? client.phone)} detail="Votre numéro au dossier" />
            </div>
          </Panel>

          <Panel className={showOnPage("consentements")} title="Mes consentements et préférences" description="Autorisations, refus et retraits conservés avec preuve au dossier.">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {["ACCESS", "RECTIFICATION", "PORTABILITY"].map((requestType) => (
                  <Button
                    key={requestType}
                    type="button"
                    variant="outline"
                    className="min-h-10 rounded-full bg-white text-xs font-black"
                    disabled={Boolean(creatingPrivacyRequestType)}
                    onClick={() => void createPrivacyRequest(requestType)}
                  >
                    {creatingPrivacyRequestType === requestType ? <Loader2 className="size-3 animate-spin" /> : null}
                    {privacyRequestLabels[requestType]}
                  </Button>
                ))}
              </div>
              {client.privacyRequests.length > 0 ? (
                <div className="rounded-[1.15rem] border border-sky-100 bg-sky-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-sky-700">Demandes confidentialité récentes</p>
                  <div className="mt-2 space-y-2">
                    {client.privacyRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                        <p className="min-w-0 text-xs font-black text-slate-800">{privacyRequestLabels[request.requestType] ?? request.requestType}</p>
                        <p className="shrink-0 text-[0.7rem] font-bold text-slate-500">{statusLabel(request.status)} · {formatDate(request.receivedAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {client.consents.length === 0 ? <EmptyLine text="Aucun consentement visible pour le moment." /> : null}
              {client.consents.map((consent) => (
                <div
                  key={consent.id}
                  className="rounded-[1.15rem] border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-start gap-3">
                    <CheckSquare className={consent.status === "GIVEN" ? "mt-0.5 size-4 shrink-0 text-emerald-600" : "mt-0.5 size-4 shrink-0 text-slate-400"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 text-sm font-black text-slate-950">{consent.purpose?.name ?? consentLabels[consent.type] ?? consent.type}</p>
                        <span className={consent.status === "GIVEN" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-black uppercase text-emerald-700" : "rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-black uppercase text-slate-600"}>
                          {consentStatusLabels[consent.status] ?? statusLabel(consent.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        {consent.purpose?.description ?? consent.template?.title ?? "Préférence liée au dossier client."}
                      </p>
                      <p className="mt-1 text-[0.7rem] font-bold text-slate-400">
                        {consent.status === "GIVEN" ? `Accepté le ${formatDate(consent.givenAt)}` : consent.revokedAt ? `Retiré le ${formatDate(consent.revokedAt)}` : statusLabel(consent.status)}
                        {consent.template ? ` · Texte ${consent.template.version} ${consent.template.language}` : ""}
                        {consent.expiresAt ? ` · Expire le ${formatDate(consent.expiresAt)}` : ""}
                      </p>
                    </div>
                    {["REQUESTED", "NOT_REQUESTED", "DECLINED"].includes(consent.status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full bg-white text-xs font-black"
                        disabled={Boolean(acceptingConsentId)}
                        onClick={() => void acceptConsent(consent.id)}
                      >
                        {acceptingConsentId === consent.id ? <Loader2 className="size-3 animate-spin" /> : null}
                        Accepter
                      </Button>
                    ) : null}
                    {consent.status === "GIVEN" && consent.withdrawalAllowed !== false ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full bg-white text-xs font-black"
                        disabled={Boolean(withdrawingConsentId)}
                        onClick={() => void withdrawConsent(consent.id)}
                      >
                        {withdrawingConsentId === consent.id ? <Loader2 className="size-3 animate-spin" /> : null}
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel id="portal-history" className={showOnPage("historique")} title="Évolution du dossier" description="Historique récent synchronisé depuis le CRM.">
            <div className="space-y-3">
              {client.activities.length === 0 ? <EmptyLine text="Aucune activité visible pour le moment." /> : null}
              {client.activities.map((activity) => (
                <ListLine key={activity.id} icon={CheckCircle2} title={activity.title} detail={`${activity.description ?? statusLabel(activity.type)} · ${formatDate(activity.createdAt)}`} />
              ))}
            </div>
          </Panel>
        </section>
          </div>
        </div>
      </section>
    </main>
  )
}

function PortalSidebar({
  items,
  activePage,
  getHref,
  completion,
  nextAction,
  isPreview,
  clientId,
  isCopyingPortalLink,
  isSendingInvitation,
  onRefresh,
  onCopyPortalLink,
  onResendPortalInvitation,
}: {
  items: PortalNavItem[]
  activePage: ClientPortalPage
  getHref: (page: ClientPortalPage) => string
  completion: number
  nextAction: string
  isPreview: boolean
  clientId: string
  isCopyingPortalLink: boolean
  isSendingInvitation: boolean
  onRefresh: () => void
  onCopyPortalLink: () => void
  onResendPortalInvitation: () => void
}) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Navigation</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Dossier client</h2>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
            {completion} %
          </span>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(6, completion)}%` }} />
        </div>
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
          Prochaine action: <span className="font-black text-slate-950">{nextAction}</span>
        </p>

        <nav className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Sections du portail client">
          {items.map((item) => (
            <PortalSidebarItem key={`${item.page}-${item.id}`} item={item} href={getHref(item.page)} isActive={item.page === activePage} />
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            {isPreview ? "Actions conseiller" : "Actions rapides"}
          </p>
          <div className="mt-3 grid gap-2">
            {isPreview ? (
              <>
                <Button asChild variant="outline" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-white px-3 py-2 text-left text-xs font-black leading-5">
                  <a href={`/clients/${clientId}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4 shrink-0" />
                    Ouvrir le dossier CRM
                  </a>
                </Button>
                <Button type="button" variant="outline" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-white px-3 py-2 text-left text-xs font-black leading-5" onClick={onCopyPortalLink} disabled={isCopyingPortalLink}>
                  {isCopyingPortalLink ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Copy className="size-4 shrink-0" />}
                  Copier le lien client
                </Button>
                <Button type="button" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-slate-950 px-3 py-2 text-left text-xs font-black leading-5 text-white hover:bg-slate-800" onClick={onResendPortalInvitation} disabled={isSendingInvitation}>
                  {isSendingInvitation ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Send className="size-4 shrink-0" />}
                  Envoyer formulaire profil client
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-white px-3 py-2 text-left text-xs font-black leading-5">
                  <Link href={getHref("messages")}>
                    <MessageSquareText className="size-4 shrink-0" />
                    Écrire au conseiller
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-white px-3 py-2 text-left text-xs font-black leading-5">
                  <Link href={getHref("documents")}>
                    <UploadCloud className="size-4 shrink-0" />
                    Ajouter un document
                  </Link>
                </Button>
                <Button type="button" className="h-auto min-h-10 justify-start whitespace-normal rounded-xl bg-emerald-600 px-3 py-2 text-left text-xs font-black leading-5 text-white hover:bg-emerald-700" onClick={onRefresh}>
                  <RefreshCw className="size-4 shrink-0" />
                  Rafraîchir le dossier
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

function PortalSidebarItem({ item, href, isActive }: { item: PortalNavItem; href: string; isActive: boolean }) {
  const Icon = item.icon
  const toneClass = {
    emerald: "text-emerald-700 bg-emerald-50 ring-emerald-100",
    amber: "text-amber-700 bg-amber-50 ring-amber-100",
    sky: "text-sky-700 bg-sky-50 ring-sky-100",
    violet: "text-violet-700 bg-violet-50 ring-violet-100",
    slate: "text-slate-700 bg-slate-50 ring-slate-200",
  }[item.tone]

  return (
    <Link
      href={href}
      className={isActive
        ? "group flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left shadow-sm ring-1 ring-emerald-100"
        : "group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50"}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${toneClass}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-950">{item.title}</span>
        <span className="block truncate text-xs font-semibold text-slate-500">{item.detail}</span>
      </span>
      <span className="max-w-20 shrink-0 truncate rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-black text-slate-600">
        {item.count}
      </span>
    </Link>
  )
}

function HeroInfo({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-white/25 bg-white/15 px-3 py-2">
      <Icon className="size-4 shrink-0 text-white" />
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-50">{label}</p>
        <p className="truncate text-sm font-black text-white">{value}</p>
      </div>
    </div>
  )
}

function PageSignalCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function QuestionnaireBlock({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function QuestionnaireField({
  label,
  className,
  ...props
}: {
  name: string
  label: string
  className?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`grid gap-1.5 text-sm font-black text-slate-700 ${className ?? ""}`}>
      {label}
      <Input
        {...props}
        className="rounded-xl border-slate-200 bg-white font-semibold focus-visible:ring-emerald-200"
      />
    </label>
  )
}

function QuestionnaireSelect({
  name,
  label,
  defaultValue,
  required,
  options,
}: {
  name: string
  label: string
  defaultValue?: string
  required?: boolean
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function QuestionnaireTextArea({
  name,
  label,
  defaultValue,
  placeholder,
  className,
}: {
  name: string
  label: string
  defaultValue?: string | null
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-black text-slate-700 ${className ?? ""}`}>
      {label}
      <textarea
        name={name}
        rows={4}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  )
}

function Panel({ id, title, description, className, children }: { id?: string; title: string; description: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
      <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DossierFolderCard({
  folder,
  href,
}: {
  folder: { icon: LucideIcon; title: string; detail: string; count: string; tone: "emerald" | "amber" | "sky" | "violet" | "slate" }
  href: string
}) {
  const Icon = folder.icon
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }[folder.tone]

  return (
    <Link
      href={href}
      className={`group rounded-[1.25rem] border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#e2e8f0] ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/80 ring-1 ring-black/5">
          <Icon className="size-5" />
        </span>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black ring-1 ring-black/5">{folder.count}</span>
      </div>
      <p className="mt-4 text-base font-black">{folder.title}</p>
      <p className="mt-1 text-sm font-semibold leading-5 opacity-80">{folder.detail}</p>
      <p className="mt-3 text-xs font-black uppercase tracking-wide opacity-70 group-hover:opacity-100">Ouvrir</p>
    </Link>
  )
}

function ListLine({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function ContactLine({ icon: Icon, title, detail, href }: { icon: LucideIcon; title: string; detail: string; href?: string }) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
      </div>
    </>
  )

  if (!href) {
    return <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">{content}</div>
  }

  return (
    <a href={href} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
      {content}
    </a>
  )
}

function PortalDocumentLine({
  document,
  isOpeningPreview,
  isOpeningDownload,
  onPreview,
  onDownload,
}: {
  document: PortalClient["documents"][number]
  isOpeningPreview: boolean
  isOpeningDownload: boolean
  onPreview: () => void
  onDownload: () => void
}) {
  const hasFile = Boolean(document.storagePath)
  const previewAvailable = canPreviewDocument(document.mimeType)

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{document.name}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {statusLabel(document.status)} · {formatDate(document.createdAt)}
            {!hasFile ? " · Fichier non joint" : ""}
          </p>
        </div>
      </div>
      {hasFile ? (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          {previewAvailable ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-full bg-white text-xs font-black" onClick={onPreview} disabled={isOpeningPreview || isOpeningDownload}>
              {isOpeningPreview ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
              Aperçu
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full bg-white text-xs font-black" onClick={onDownload} disabled={isOpeningPreview || isOpeningDownload}>
            {isOpeningDownload ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Télécharger
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PortalTaskLine({
  task,
  isCompleting,
  onComplete,
}: {
  task: PortalClient["tasks"][number]
  isCompleting: boolean
  onComplete: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
          <Clock3 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-950">{task.title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {statusLabel(task.status)} · Échéance: {formatDate(task.dueDate)}
          </p>
          {task.description ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{task.description}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-12">
        <Button type="button" size="sm" className="h-8 rounded-full bg-slate-950 text-xs font-black text-white hover:bg-slate-800" onClick={onComplete} disabled={isCompleting}>
          {isCompleting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          J’ai complété
        </Button>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  const isMissing = value === "À compléter"
  return (
    <div className={isMissing ? "rounded-2xl border border-amber-100 bg-amber-50 p-3" : "rounded-2xl border border-slate-100 bg-slate-50 p-3"}>
      <p className={isMissing ? "text-[11px] font-black uppercase tracking-wide text-amber-600" : "text-[11px] font-black uppercase tracking-wide text-slate-400"}>{label}</p>
      <p className={isMissing ? "mt-1 text-sm font-black text-amber-900" : "mt-1 text-sm font-black text-slate-950"}>{value}</p>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
      {text}
    </div>
  )
}
