"use client"

import { Archive, Building2, CalendarDays, CalendarPlus, CheckCircle2, ClipboardCheck, ClipboardList, Copy, Download, Edit3, ExternalLink, Eye, FileArchive, FileCheck2, FilePlus2, Inbox, Loader2, Mail, MessageSquareText, PackagePlus, PhoneCall, Plus, RotateCcw, Send, ShieldAlert, Sparkles, StickyNote, Trash2, UserRoundCheck, XCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { ActivityTimeline } from "@/components/activities/ActivityTimeline"
import { CallSummaryModal } from "@/components/ai/CallSummaryModal"
import { ClientComplianceTab } from "@/components/clients/compliance/ClientComplianceTab"
import { ClientCrossSellTab } from "@/components/clients/cross-sell/ClientCrossSellTab"
import { ClientInsuranceNeedsTab } from "@/components/clients/insurance-needs/ClientInsuranceNeedsTab"
import { ClientRecommendationsTab } from "@/components/clients/recommendations/ClientRecommendationsTab"
import { NotesSection, type NoteItem } from "@/components/notes/NotesSection"
import { ClientSmartRemindersTab } from "@/components/smart-reminders/ClientSmartRemindersTab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClientComplianceAlerts } from "@/lib/compliance/client-alerts"
import {
  commissionTypeLabels,
  financialProductCategoryLabels,
  financialProductStatusLabels,
  financialProductTypeLabels,
  getFinancialProductSummary,
  getProductAlerts,
  paymentFrequencyLabels,
} from "@/lib/financial-products"
import type { StatusTone } from "@/types"

type ClientChild = {
  name?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  age?: number | null
}

type ApiClient = {
  id: string
  firstName: string
  lastName: string
  clientNumber: string | null
  gender: string | null
  phone: string
  email: string | null
  phonePrimary: string | null
  phoneSecondary: string | null
  emailPrimary: string | null
  emailSecondary: string | null
  preferredContactMethod: string | null
  preferredContactTime: string | null
  address: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string | null
  dateOfBirth: string | null
  occupation: string | null
  employer: string | null
  employmentStatus: string | null
  yearsAtJob: number | null
  incomeRange: string | null
  isSelfEmployed: boolean
  annualIncome: number | null
  approximateIncome: number | null
  profileType: string | null
  familyStatus: string | null
  dependents: number | null
  dependentsCount: number | null
  dependentsDetails: string | null
  hasChildren: boolean
  spouseName: string | null
  spouseGender: string | null
  spouseDateOfBirth: string | null
  children: ClientChild[] | null
  status: string
  riskProfile: string | null
  netWorth: number | null
  liquidAssets: number | null
  liabilities: number | null
  savingsRate: number | null
  financialGoals: string | null
  primaryGoal: string | null
  investmentHorizon: string | null
  retirementGoal: boolean
  protectionNeeds: boolean
  goals: string | null
  notes: string | null
  source: string | null
  referredBy: string | null
  relationshipStartDate: string | null
  lastContactAt: string | null
  nextReviewDate: string | null
  lastInteractionType: string | null
  lastInteractionDate: string | null
  totalInteractions: number
  kycCompleted: boolean
  kycDate: string | null
  identityVerified: boolean
  complianceStatus: string | null
  consentGiven: boolean
  updatedAt: string
  advisor?: { name: string } | null
  products?: ApiFinancialProduct[]
  documents?: { id: string; name: string; description?: string | null; type: string; status: string; visibility?: string | null; expiresAt?: string | null; createdAt: string; mimeType?: string | null; fileName?: string | null; originalFileName?: string | null; fileSize?: number | null; storagePath?: string | null; fileUrl?: string | null; url?: string | null }[]
  tasks?: { id: string; title: string; description?: string | null; status: string; priority: string; dueDate: string | null; assignedTo?: { name: string } | null }[]
  noteItems?: NoteItem[]
  activities?: { id: string; title: string; description: string | null; type: string; createdAt: string }[]
  kycProfile?: {
    complianceScore: number
    status: string
    occupation?: string | null
    employer?: string | null
    employmentStatus?: string | null
    annualIncome?: number | null
    incomeRange?: string | null
    sourceOfFunds?: string | null
    sourceOfWealth?: string | null
    protectionNeeds?: string | null
    primaryObjective?: string | null
    investmentHorizon?: string | null
    liquidityNeeds?: string | null
    investmentKnowledge?: string | null
    investmentExperience?: string | null
    borrowingNeeds?: string | null
    riskTolerance?: string | null
    riskCapacity?: string | null
    riskProfileResult?: string | null
    monthlyExpenses?: number | null
    emergencyFund?: number | null
    totalAssets?: number | null
    totalLiabilities?: number | null
    nextKycReviewAt?: string | null
    reviewStatus?: string | null
    clientConfirmedNoChange?: boolean | null
    advisorAttestation?: boolean | null
  } | null
  investmentProfile?: {
    finalRiskProfile: string | null
    finalRiskScore: number | null
    riskToleranceScore: number | null
    riskCapacityScore: number | null
    primaryObjective: string | null
    timeHorizon: string | null
    liquidityNeeds: string | null
    investmentKnowledge: string | null
    usesLeverage: boolean
    leverageDetails: string | null
    riskProfileRationale: string | null
  } | null
  financialGoalItems?: Array<{
    id: string
    goalName: string
    goalType: string
    priority: string
    targetAmount: number | null
    currentAmount: number | null
    timeHorizonYears: number | null
    liquidityNeed: string | null
    riskLevelForGoal: string | null
    contributionPlan?: string | null
    notes?: string | null
  }>
  riskQuestionnaireAnswers?: Array<{ id: string; questionLabel: string; questionCategory: string; answerValue: unknown; score: number | null }>
  kycVersions?: Array<{ id: string; versionNumber: number; lockedAt: string | null; usedForRecommendationAt: string | null; integrityHash: string | null }>
  kycAlerts?: Array<{ id: string; severity: string; status: string; title: string; message: string; alertType: string }>
  complianceAlerts?: { id: string; severity: string; status: string; title: string }[]
}

type ComplianceAlert = ReturnType<typeof getClientComplianceAlerts>[number]
type ClientTab = "overview" | "profile" | "kyc" | "products" | "documents" | "tasks" | "reminders" | "needs" | "opportunities" | "compliance" | "history"
type ClientWorkspaceStageId = typeof clientWorkspaceStages[number]["id"]
type MissingClientActionId = "kyc" | "identity" | "consent" | "documents" | "risk" | "objectives"
type ComplianceFocusTarget = "kyc" | "alerts" | "consents"
type WorkspaceModalType = "note" | "task" | "document" | "product" | "activity" | "email" | "portalMessage"
type MissingClientAction = {
  id: MissingClientActionId
  label: string
  summary: string
  details: string[]
  actionLabel: string
}
type PendingDocumentRequest = {
  type: string
  name: string
  description?: string
  documentId?: string
}
type DocumentRequestItem = PendingDocumentRequest & { id?: string }
type DocumentFolderOption = {
  id: string
  name: string
  path?: string | null
  type?: string | null
  clientId?: string | null
  status?: string | null
}
type ChildDraft = {
  id: string
  name: string
  dateOfBirth: string
  gender: string
}

const riskTone: Record<string, StatusTone> = {
  UNKNOWN: "slate",
  CONSERVATIVE: "emerald",
  MODERATE: "sky",
  BALANCED: "violet",
  GROWTH: "amber",
  AGGRESSIVE: "rose",
}

const clientStatusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  PROSPECT_CONVERTED: "Prospect converti",
  REVIEW_NEEDED: "Révision requise",
  ARCHIVED: "Archivé",
}

const clientProfileTypeLabels: Record<string, string> = {
  INDIVIDUAL: "Personne physique",
  BUSINESS: "Entreprise / société",
  TRUST: "Fiducie",
  ESTATE: "Succession",
  HOUSEHOLD: "Ménage / famille",
  NON_PROFIT: "OBNL / association",
  OTHER: "Autre",
}

const genderOptions = [
  { value: "", label: "À compléter" },
  { value: "FEMALE", label: "Femme" },
  { value: "MALE", label: "Homme" },
  { value: "NON_BINARY", label: "Non binaire" },
  { value: "PREFER_NOT_TO_SAY", label: "Préfère ne pas répondre" },
  { value: "OTHER", label: "Autre" },
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
  { value: "OTHER", label: "Autre" },
]

const countryOptions = [
  { value: "", label: "À compléter" },
  { value: "Canada", label: "Canada" },
  { value: "États-Unis", label: "États-Unis" },
  { value: "France", label: "France" },
  { value: "Autre", label: "Autre" },
]

const clientSourceOptions = [
  { value: "", label: "À compléter" },
  { value: "REFERRAL", label: "Référence client / professionnel" },
  { value: "WEBSITE", label: "Site web" },
  { value: "LEAD_FORM", label: "Formulaire entrant" },
  { value: "PHONE_CALL", label: "Appel entrant" },
  { value: "SMS", label: "SMS entrant" },
  { value: "EMAIL", label: "Courriel entrant" },
  { value: "GOOGLE_SHEETS", label: "Import Google Sheets" },
  { value: "EVENT", label: "Événement / conférence" },
  { value: "SOCIAL", label: "Réseaux sociaux" },
  { value: "CLIENT_PORTAL", label: "Espace client" },
  { value: "MANUAL", label: "Création manuelle" },
  { value: "OTHER", label: "Autre" },
]

const clientSourceLabels = Object.fromEntries(clientSourceOptions.map((option) => [option.value, option.label]))

const complianceStatusOptions = [
  { value: "", label: "À compléter" },
  { value: "GOOD_STANDING", label: "À jour" },
  { value: "IN_REVIEW", label: "En révision" },
  { value: "NEEDS_ATTENTION", label: "À compléter" },
  { value: "DOCUMENTS_REQUIRED", label: "Documents requis" },
  { value: "KYC_REQUIRED", label: "Profil client requis" },
  { value: "AML_REVIEW", label: "Revue AML / LBA" },
  { value: "BLOCKED", label: "Bloqué" },
]

const complianceStatusLabels = Object.fromEntries(complianceStatusOptions.map((option) => [option.value, option.label]))

const yesNoStatusOptions = [
  { value: "false", label: "Non" },
  { value: "true", label: "Oui" },
]

const financialGoalOptions = [
  { value: "", label: "À compléter" },
  { value: "RETIREMENT", label: "Retraite" },
  { value: "WEALTH_BUILDING", label: "Croissance du patrimoine" },
  { value: "PROTECTION", label: "Protection familiale" },
  { value: "TAX_OPTIMIZATION", label: "Optimisation fiscale" },
  { value: "EDUCATION", label: "Études des enfants" },
  { value: "BUSINESS_PROTECTION", label: "Protection d’entreprise" },
  { value: "ESTATE_PLANNING", label: "Planification successorale" },
  { value: "OTHER", label: "Autre objectif" },
]

const riskProfileLabels: Record<string, string> = {
  UNKNOWN: "Inconnu",
  CONSERVATIVE: "Conservateur",
  MODERATE_LOW: "Modéré-faible",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  GROWTH: "Croissance",
  AGGRESSIVE: "Audacieux",
}

const riskProfileSelectOptions = [
  { value: "", label: "À compléter" },
  { value: "CONSERVATIVE", label: "Conservateur" },
  { value: "MODERATE_LOW", label: "Modéré-faible" },
  { value: "MODERATE", label: "Modéré" },
  { value: "BALANCED", label: "Équilibré" },
  { value: "GROWTH", label: "Croissance" },
  { value: "AGGRESSIVE", label: "Audacieux" },
]

const riskCapacitySelectOptions = [
  { value: "", label: "À compléter" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Élevée" },
]

const horizonSelectOptions = [
  { value: "", label: "À compléter" },
  { value: "SHORT_TERM", label: "Court terme (0-3 ans)" },
  { value: "MEDIUM_TERM", label: "Moyen terme (3-10 ans)" },
  { value: "LONG_TERM", label: "Long terme (10 ans et plus)" },
]

const liquiditySelectOptions = [
  { value: "", label: "À compléter" },
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Élevé" },
]

const investmentKnowledgeSelectOptions = [
  { value: "", label: "À compléter" },
  { value: "BEGINNER", label: "Débutant" },
  { value: "INTERMEDIATE", label: "Intermédiaire" },
  { value: "ADVANCED", label: "Avancé" },
]

const investmentExperienceSelectOptions = [
  { value: "", label: "À compléter" },
  { value: "NONE", label: "Aucune expérience" },
  { value: "FUNDS_ETF", label: "Fonds / FNB" },
  { value: "BONDS_GIC", label: "Obligations / CPG" },
  { value: "STOCKS", label: "Actions" },
  { value: "ADVANCED_PRODUCTS", label: "Produits complexes" },
]

const borrowingNeedSelectOptions = [
  { value: "", label: "À compléter" },
  { value: "NO_LEVERAGE", label: "Aucun emprunt pour investir" },
  { value: "PERSONAL_DEBT_ONLY", label: "Dettes personnelles seulement" },
  { value: "USES_LEVERAGE", label: "Utilise ou envisage du levier" },
  { value: "TO_REVIEW", label: "À revoir avec le conseiller" },
]

type ApiFinancialProduct = {
  id: string
  clientId: string
  category: string
  type: string
  status: string
  company: string | null
  productName: string | null
  policyNumber: string | null
  contractNumber: string | null
  accountNumber: string | null
  premium: number | null
  premiumFrequency: string | null
  coverageAmount: number | null
  accountValue: number | null
  contributionAmount: number | null
  contributionFrequency: string | null
  commissionAmount: number | null
  commissionType: string | null
  currency: string
  primaryBeneficiary: string | null
  contingentBeneficiary: string | null
  beneficiaryNotes: string | null
  issuedAt: string | null
  effectiveDate: string | null
  renewalAt: string | null
  maturityAt: string | null
  cancellationAt: string | null
  lastReviewAt: string | null
  nextReviewAt: string | null
  documentStatus: string | null
  missingDocuments: string | null
  complianceNotes: string | null
  notes: string | null
  insuranceNeedsAnalyses?: Array<{
    id: string
    status: string
    analysisType: string
    clientConfirmedAt: string | null
    reportDocumentId: string | null
    reportDocument?: { id: string; status: string; name: string } | null
  }>
}

const taskStatusLabels: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  WAITING: "En attente",
  DONE: "Terminée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
  SNOOZED: "Reportée",
  ARCHIVED: "Archivée",
}

const priorityLabels: Record<string, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
}

const documentStatusLabels: Record<string, string> = {
  REQUIRED: "Requis",
  REQUESTED: "Demandé",
  RECEIVED: "Reçu",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  EXPIRED: "Expiré",
  WAIVED: "Exempté",
  ARCHIVED: "Archivé",
}

const documentRequestOptions: DocumentRequestItem[] = [
  { id: "kyc", type: "KYC_FORM", name: "Questionnaire profil client", description: "Questionnaire de connaissance client à compléter." },
  { id: "government-id", type: "GOVERNMENT_ID", name: "Pièce d’identité", description: "Permis de conduire, passeport ou carte d’assurance maladie selon vos règles internes." },
  { id: "proof-address", type: "PROOF_OF_ADDRESS", name: "Preuve d’adresse", description: "Document récent confirmant l’adresse du client." },
  { id: "consent", type: "CONSENT_FORM", name: "Formulaire de consentement", description: "Consentement nécessaire au suivi administratif du dossier." },
  { id: "risk-profile", type: "RISK_PROFILE", name: "Profil de risque", description: "Questionnaire ou document lié au profil de risque." },
  { id: "void-cheque", type: "VOID_CHEQUE", name: "Spécimen de chèque", description: "Document bancaire requis pour la mise en place administrative." },
  { id: "tax", type: "TAX_DOCUMENT", name: "Document fiscal", description: "Document fiscal requis pour compléter le dossier." },
  { id: "investment", type: "INVESTMENT_STATEMENT", name: "Relevé de placement", description: "Relevé récent lié aux informations du dossier." },
  { id: "insurance", type: "INSURANCE_STATEMENT", name: "Relevé d’assurance", description: "Relevé ou information d’assurance déjà détenue." },
  { id: "signature", type: "SIGNATURE_PAGE", name: "Page de signature", description: "Page ou formulaire à signer." },
]

const documentTypeOptions = [
  { value: "KYC_FORM", label: "Formulaire profil client" },
  { value: "GOVERNMENT_ID", label: "Pièce d’identité" },
  { value: "PROOF_OF_ADDRESS", label: "Preuve d’adresse" },
  { value: "VOID_CHEQUE", label: "Spécimen de chèque" },
  { value: "RISK_PROFILE", label: "Profil de risque" },
  { value: "CONSENT_FORM", label: "Consentement" },
  { value: "POLICY_DOCUMENT", label: "Police / contrat" },
  { value: "PROPOSAL", label: "Proposition" },
  { value: "ILLUSTRATION", label: "Illustration" },
  { value: "INVESTMENT_STATEMENT", label: "Relevé de placement" },
  { value: "INSURANCE_STATEMENT", label: "Relevé d’assurance" },
  { value: "BENEFICIARY_FORM", label: "Formulaire bénéficiaire" },
  { value: "SIGNATURE_PAGE", label: "Page de signature" },
  { value: "TAX_DOCUMENT", label: "Document fiscal" },
  { value: "CLIENT_NOTE", label: "Note client" },
  { value: "OTHER", label: "Autre" },
]

const documentTypeLabels = Object.fromEntries(documentTypeOptions.map((option) => [option.value, option.label]))

const documentVisibilityOptions = [
  { value: "TEAM", label: "Équipe" },
  { value: "INTERNAL", label: "Interne" },
  { value: "CLIENT_VISIBLE", label: "Visible client" },
  { value: "COMPLIANCE_ONLY", label: "Conformité seulement" },
]

const familyStatusLabels: Record<string, string> = {
  SINGLE: "Célibataire",
  MARRIED: "Marié(e)",
  COMMON_LAW: "Conjoint(e) de fait",
  DIVORCED: "Divorcé(e)",
  WIDOWED: "Veuf/veuve",
  OTHER: "Autre",
}

const employmentStatusLabels: Record<string, string> = {
  EMPLOYED: "Employé(e)",
  SELF_EMPLOYED: "Travailleur autonome",
  BUSINESS_OWNER: "Entrepreneur / propriétaire",
  INCORPORATED: "Incorporé(e)",
  UNEMPLOYED: "Sans emploi",
  RETIRED: "Retraité(e)",
  STUDENT: "Étudiant(e)",
  OTHER: "Autre",
}

const genderLabels: Record<string, string> = {
  male: "Homme",
  MALE: "Homme",
  female: "Femme",
  FEMALE: "Femme",
  femme: "Femme",
  FEMME: "Femme",
  homme: "Homme",
  HOMME: "Homme",
  woman: "Femme",
  man: "Homme",
  other: "Autre",
  OTHER: "Autre",
}

const contactMethodLabels: Record<string, string> = {
  PHONE: "Téléphone",
  EMAIL: "Courriel",
  SMS: "SMS",
  PORTAL: "Portail client",
}

const contactTimeLabels: Record<string, string> = {
  MORNING: "Matin",
  AFTERNOON: "Après-midi",
  EVENING: "Soir",
  ANYTIME: "N’importe quand",
}

const incomeRangeLabels: Record<string, string> = {
  "0-49999": "Moins de 50 000 $",
  "50000-99999": "50 000 $ à 99 999 $",
  "100000-149999": "100 000 $ à 149 999 $",
  "150000-249999": "150 000 $ à 249 999 $",
  "250000+": "250 000 $ et plus",
}

const clientWorkspaceStages = [
  { id: "created", label: "Fiche créée", shortLabel: "Créé", description: "Dossier ouvert" },
  { id: "profile", label: "Informations client", shortLabel: "Profil", description: "Profil à compléter" },
  { id: "kyc", label: "Profil client", shortLabel: "Profil client", description: "Questionnaire profil et identité" },
  { id: "documents", label: "Documents", shortLabel: "Docs", description: "Pièces requises" },
  { id: "needs", label: "Analyse des besoins", shortLabel: "Analyse", description: "Objectifs et contexte" },
  { id: "recommendation", label: "Recommandation", shortLabel: "Recommand.", description: "À préparer" },
  { id: "active", label: "Dossier actif", shortLabel: "Actif", description: "Relation suivie" },
  { id: "review", label: "Révision périodique", shortLabel: "Révision", description: "Suivi annuel" },
] as const

const goalLabels: Record<string, string> = {
  RETIREMENT: "Retraite",
  WEALTH_BUILDING: "Croissance du patrimoine",
  PROTECTION: "Protection",
  TAX_OPTIMIZATION: "Optimisation fiscale",
  EDUCATION: "Éducation",
  BUSINESS_PROTECTION: "Protection d’entreprise",
  ESTATE_PLANNING: "Planification successorale",
  OTHER: "Autre",
}

const horizonLabels: Record<string, string> = {
  SHORT_TERM: "Court terme",
  MEDIUM_TERM: "Moyen terme",
  LONG_TERM: "Long terme",
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

function translate(map: Record<string, string>, value?: string | null, fallback = "À compléter") {
  if (!value) return fallback
  return map[value] ?? value
}

function formatDate(value?: string | null) {
  if (!value) return "À compléter"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function formatPhone(value?: string | null) {
  if (!value) return "À compléter"
  const digits = value.replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return value
}

function digitsOnly(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

function formatPhoneInput(value?: string | null) {
  const digits = digitsOnly(value).slice(0, 11)
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (local.length <= 3) return local
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`
  const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`
  return digits.length === 11 && digits.startsWith("1") ? `+1 ${formatted}` : formatted
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function calculateAge(dateValue: string) {
  if (!dateValue) return ""
  const birthDate = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1
  return age >= 0 ? `${age} an${age > 1 ? "s" : ""}` : ""
}

function compactLines(lines: Array<string | undefined>) {
  return lines.map((line) => line?.trim()).filter(Boolean).join("\n")
}

function normalizeClientChildren(children?: ClientChild[] | null): ChildDraft[] {
  if (!Array.isArray(children) || children.length === 0) return []
  return children.map((child, index) => ({
    id: `${Date.now()}-${index}`,
    name: child.name ?? "",
    dateOfBirth: child.dateOfBirth?.slice(0, 10) ?? "",
    gender: child.gender ?? "",
  }))
}

function formatContactPreference(method?: string | null, time?: string | null) {
  const parts = [
    translate(contactMethodLabels, method, ""),
    translate(contactTimeLabels, time, ""),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "À compléter"
}

function isTaskOverdue(task: { status: string; dueDate: string | null }) {
  if (!task.dueDate || task.status === "DONE") return false
  const dueDate = new Date(task.dueDate)
  dueDate.setHours(23, 59, 59, 999)
  return dueDate.getTime() < Date.now()
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function getClientWorkspaceStage(client: ApiClient) {
  if (client.status === "REVIEW_NEEDED" || client.complianceStatus === "NEEDS_UPDATE") return "review"
  if (client.status === "ACTIVE" && client.kycCompleted && client.identityVerified && client.consentGiven) return "active"
  const profileReady = Boolean(
    (client.phonePrimary ?? client.phone) &&
      (client.emailPrimary ?? client.email) &&
      client.dateOfBirth &&
      client.familyStatus &&
      (client.annualIncome ?? client.approximateIncome) &&
      client.primaryGoal
  )
  if (!profileReady) return "profile"
  if (!client.kycCompleted || !client.identityVerified || !client.consentGiven || client.complianceStatus !== "APPROVED") return "kyc"
  if ((client.products?.length ?? 0) > 0) return "recommendation"
  if (client.primaryGoal || client.financialGoals || client.goals) return "needs"
  if ((client.documents?.length ?? 0) > 0) return "documents"
  if (client.clientNumber || client.relationshipStartDate) return "profile"
  return "created"
}

async function readJson<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  const message = typeof result.error === "string" ? result.error : result.error?.message
  if (!response.ok) throw new Error(message ?? "Une erreur est survenue.")
  return result.data as T
}

export function ClientDetailApiPage({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams()
  const [client, setClient] = useState<ApiClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [modal, setModal] = useState<WorkspaceModalType | null>(null)
  const [callNoteOpen, setCallNoteOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ApiFinancialProduct | null>(null)
  const [documentRequest, setDocumentRequest] = useState<PendingDocumentRequest | null>(null)
  const [activeTab, setActiveTab] = useState<ClientTab>("overview")
  const [kycFocusRequest, setKycFocusRequest] = useState(0)
  const [complianceFocusTarget, setComplianceFocusTarget] = useState<ComplianceFocusTarget>("kyc")

  const loadClient = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/clients/${clientId}`, { cache: "no-store" })
      setClient(await readJson<ApiClient>(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le client.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClient()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadClient])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    const allowedTabs: ClientTab[] = ["overview", "profile", "kyc", "products", "documents", "tasks", "reminders", "needs", "opportunities", "compliance", "history"]
    if (requestedTab && allowedTabs.includes(requestedTab as ClientTab)) {
      if (requestedTab === "kyc") {
        setActiveTab("profile")
        setComplianceFocusTarget("kyc")
        setKycFocusRequest((request) => request + 1)
      } else {
        setActiveTab(requestedTab as ClientTab)
      }
    }

    const focus = searchParams.get("focus")
    if (focus === "alerts" || focus === "consents" || focus === "kyc") {
      setComplianceFocusTarget(focus)
      setKycFocusRequest((request) => request + 1)
    }
  }, [searchParams])

  async function postAction(path: string, payload?: Record<string, unknown>, method = "POST") {
    setIsSaving(true)
    try {
      const response = await fetch(path, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      })
      await readJson<unknown>(response)
      setNotice({ type: "success", message: "Action enregistrée." })
      setModal(null)
      await loadClient()
      return true
    } catch (actionError) {
      setNotice({ type: "error", message: actionError instanceof Error ? actionError.message : "Action impossible." })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function saveClient(payload: Record<string, string>) {
    const saved = await postAction(`/api/clients/${clientId}`, payload, "PATCH")
    if (saved) setIsEditing(false)
  }

  async function copyClientPortalLink() {
    if (!client) return
    const email = client.emailPrimary ?? client.email ?? client.emailSecondary
    if (!email) {
      setNotice({ type: "error", message: "Ajoutez un courriel au dossier client avant de copier le lien." })
      return
    }
    try {
      const response = await fetch(`/api/clients/${clientId}/portal-invitation`, { cache: "no-store" })
      const result = await readJson<{ url: string }>(response)
      await navigator.clipboard.writeText(result.url)
      setNotice({ type: "success", message: "Lien du profil client sécurisé copié." })
      await loadClient()
    } catch {
      const fallbackUrl = new URL("/sign-up", window.location.origin)
      fallbackUrl.searchParams.set("role", "client")
      fallbackUrl.searchParams.set("email", email)
      fallbackUrl.searchParams.set("redirect_url", `/espace-client?clientId=${client.id}#portal-profile-questionnaire`)
      window.prompt("Copiez ce lien profil client", fallbackUrl.toString())
    }
  }

  async function resendClientPortalInvitation() {
    const sent = await postAction(`/api/clients/${clientId}/portal-invitation`, {}, "POST")
    if (sent) setNotice({ type: "success", message: "Formulaire profil client envoyé par les canaux disponibles." })
  }

  async function createTimelineActivity(payload: Record<string, string>) {
    await postAction("/api/activities", { ...payload, clientId }, "POST")
  }

  async function saveWorkspaceAction(payload: Record<string, string> | FormData) {
    if (payload instanceof FormData) {
      setIsSaving(true)
      try {
        payload.set("clientId", clientId)
        const response = await fetch("/api/documents/upload", { method: "POST", body: payload })
        await readJson<unknown>(response)
        setNotice({ type: "success", message: "Document téléversé et ajouté au dossier." })
        setModal(null)
        await loadClient()
        return
      } catch (uploadError) {
        setNotice({ type: "error", message: uploadError instanceof Error ? uploadError.message : "Téléversement impossible." })
        return
      } finally {
        setIsSaving(false)
      }
    }

    if (modal === "activity") {
      await postAction(`/api/clients/${clientId}/tasks`, {
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        type: payload.taskType || "FOLLOW_UP",
        priority: payload.priority || "NORMAL",
      })
      return
    }

    if (modal === "email") {
      await createTimelineActivity({
        type: "EMAIL_SENT",
        title: payload.title || "Email préparé",
        description: payload.description || "Un email administratif a été préparé depuis le workspace client.",
        source: "USER",
      })
      return
    }

    if (modal === "portalMessage") {
      await postAction(`/api/clients/${clientId}/portal-message`, {
        subject: payload.title,
        message: payload.description,
      })
      return
    }

    await postAction(`/api/clients/${clientId}/${modal === "product" ? "financial-products" : modal === "document" ? "documents" : modal === "task" ? "tasks" : "notes"}`, payload)
  }

  async function sendDocumentRequest(payload: Record<string, string>) {
    if (!documentRequest) return
    const parsedDocuments = payload.documents
      ? JSON.parse(payload.documents) as DocumentRequestItem[]
      : [{
          documentId: documentRequest.documentId ?? "",
          type: payload.type || documentRequest.type,
          name: payload.name || documentRequest.name,
          description: payload.description || documentRequest.description || "",
        }]
    const saved = await postAction(`/api/clients/${clientId}/documents/request`, {
      documents: parsedDocuments,
      channel: payload.channel || "AUTO",
      message: payload.message || "",
      dueDate: payload.dueDate || "",
    })
    if (saved) setDocumentRequest(null)
  }

  async function updateDocumentStatus(documentId: string, nextStatus: string, extra: Record<string, string> = {}) {
    await postAction(`/api/documents/${documentId}/status`, { status: nextStatus, ...extra }, "PATCH")
  }

  async function completeTask(taskId: string) {
    await postAction(`/api/tasks/${taskId}/complete`, {}, "PATCH")
  }

  async function reopenTask(taskId: string) {
    await postAction(`/api/tasks/${taskId}/reopen`, undefined, "PATCH")
  }

  async function cancelTask(taskId: string) {
    const reason = window.prompt("Raison de l’annulation")
    if (!reason?.trim()) return
    await postAction(`/api/tasks/${taskId}/cancel`, { cancelReason: reason }, "PATCH")
  }

  if (isLoading) {
    return <PageShell eyebrow="Fiche client" title="Chargement..." description="Récupération du dossier client."><LoadingState /></PageShell>
  }

  if (error || !client) {
    return <PageShell eyebrow="Fiche client" title={error === "Client introuvable." ? "Client introuvable" : "Impossible de charger le client"} description="Le dossier peut être inaccessible pour votre organisation ou la session doit être rechargée."><StatePanel title={error ?? "Client introuvable"} /></PageShell>
  }

  const alerts = getClientComplianceAlerts(client)
  const openTasks = (client.tasks ?? []).filter((task) => task.status !== "DONE")
  const overdueTasksCount = openTasks.filter(isTaskOverdue).length
  const documentAlerts = alerts.filter((alert) => alert.type === "DOCUMENT")
  const missingDocs = documentAlerts.length
  const productSummary = getFinancialProductSummary(client.products ?? [])
  const complianceScore = client.kycProfile?.complianceScore ?? 0
  const openComplianceAlerts = Math.max(client.complianceAlerts?.length ?? 0, alerts.length)
  const workspaceStage = getClientWorkspaceStage(client)
  const nextAction = getNextAction(client, missingDocs)
  const fullAddress = [
    client.addressLine1 ?? client.address,
    client.addressLine2,
    client.city,
    client.province,
    client.postalCode,
    client.country,
  ].filter(Boolean).join(", ")

  function openKycQuestionnaire(target: ComplianceFocusTarget = "kyc") {
    setActiveTab("profile")
    setComplianceFocusTarget(target)
    setKycFocusRequest((request) => request + 1)
  }

  function runPrimaryClientAction() {
    if (/KYC/i.test(nextAction)) {
      openKycQuestionnaire()
      return
    }
    if (/identité|consentement|risque/i.test(nextAction)) {
      openKycQuestionnaire()
      return
    }
    if (/objectif/i.test(nextAction)) {
      setIsEditing(true)
      return
    }
    if (/document/i.test(nextAction)) {
      setModal("document")
      return
    }
    if (/produit|opportunité/i.test(nextAction)) {
      setModal("product")
      return
    }
    setModal("task")
  }

  function handleMissingAction(actionId: MissingClientActionId) {
    if (actionId === "documents") {
      setActiveTab("documents")
      return
    }
    if (actionId === "objectives") {
      setActiveTab("profile")
      setIsEditing(true)
      return
    }
    if (actionId === "kyc") {
      openKycQuestionnaire()
      return
    }
    if (actionId === "consent") {
      openKycQuestionnaire("consents")
      return
    }
    if (actionId === "risk" || actionId === "identity") {
      openKycQuestionnaire("kyc")
      return
    }
    setActiveTab("profile")
  }

  function handlePipelineStage(stageId: ClientWorkspaceStageId) {
    if (stageId === "created" || stageId === "profile") {
      setActiveTab("profile")
      return
    }
    if (stageId === "kyc") {
      openKycQuestionnaire()
      return
    }
    if (stageId === "documents") {
      setActiveTab("documents")
      return
    }
    if (stageId === "needs") {
      setActiveTab("needs")
      return
    }
    if (stageId === "recommendation") {
      setActiveTab("opportunities")
      return
    }
    if (stageId === "review") {
      setActiveTab("tasks")
      return
    }
    setActiveTab("overview")
  }

  return (
    <PageShell
      eyebrow="Fiche client"
      title={`${client.firstName} ${client.lastName}`}
      description="Dossier intelligent avec Profil client, KYB, AML, documents, recommandations et audit trail."
      showIntro={false}
    >
      {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}

      <ClientWorkspaceHeader
        client={client}
        complianceScore={complianceScore}
        openComplianceAlerts={openComplianceAlerts}
        primaryActionLabel={nextAction}
        onPrimaryAction={runPrimaryClientAction}
        onEdit={() => setIsEditing(true)}
        onNote={() => setModal("note")}
        onEmail={() => setModal("email")}
        onPortalMessage={() => setModal("portalMessage")}
        onTask={() => setModal("task")}
        onActivity={() => setModal("activity")}
        onCallNote={() => setCallNoteOpen(true)}
        onDocument={() => setModal("document")}
        onProduct={() => setModal("product")}
        onArchive={() => void postAction(`/api/clients/${client.id}`, undefined, "DELETE")}
      />

      <ClientDetailNavigation activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "compliance" || activeTab === "kyc" ? <ClientComplianceTab clientId={client.id} client={client} onSynced={loadClient} focusKycRequest={kycFocusRequest} focusTarget={complianceFocusTarget} /> : null}
      {activeTab === "reminders" ? <ClientSmartRemindersTab clientId={client.id} /> : null}
      {activeTab === "needs" ? <ClientInsuranceNeedsTab clientId={client.id} /> : null}
      {activeTab === "opportunities" ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <ClientCrossSellTab clientId={client.id} />
          <ClientRecommendationsTab clientId={client.id} />
        </section>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <ClientPriorityBanner client={client} missingDocs={missingDocs} onAction={handleMissingAction} />

          <ClientKeyIndicators
            client={client}
            openTasksCount={openTasks.length}
            overdueTasksCount={overdueTasksCount}
            missingDocs={missingDocs}
            complianceScore={complianceScore}
            onProfile={() => setActiveTab("profile")}
            onDocuments={() => setActiveTab("documents")}
            onCompliance={() => setActiveTab("compliance")}
            onProduct={() => setModal("product")}
            onTask={() => setModal("task")}
          />

          <ClientIntelligentDossierCard
            client={client}
            complianceScore={complianceScore}
            openComplianceAlerts={openComplianceAlerts}
            missingDocs={missingDocs}
            onKyc={openKycQuestionnaire}
            onKyb={() => setActiveTab("profile")}
            onAml={() => {
              setActiveTab("profile")
              setComplianceFocusTarget("kyc")
            }}
            onDocuments={() => setActiveTab("documents")}
            onRecommendations={() => {
              const firstMissingAction = getMissingClientActions(client, missingDocs)[0]
              if (firstMissingAction) {
                handleMissingAction(firstMissingAction.id)
                return
              }
              setActiveTab("needs")
            }}
          />

          <details className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-black text-slate-800">
              Espace client, lien portail et demandes visibles
            </summary>
            <div className="mt-4">
              <ClientPortalAccessPanel
                client={client}
                openTasksCount={openTasks.length}
                onCopyPortalLink={copyClientPortalLink}
                onResendPortalInvite={resendClientPortalInvitation}
                onPortalMessage={() => setModal("portalMessage")}
                onDocuments={() => setActiveTab("documents")}
              />
            </div>
          </details>

          <section className="grid gap-4 xl:grid-cols-2">
            <ContentCard title="Résumé client" description="Les informations essentielles du dossier.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label="Type" value="Particulier" />
                <Info label="Type de dossier" value={translate(clientProfileTypeLabels, client.profileType, "Personne physique")} />
                <Info label="Statut" value={translate(clientStatusLabels, client.status)} />
                <Info label="Segment" value={client.source ?? "À qualifier"} />
                <Info label="Dernier contact" value={formatDate(client.lastContactAt)} />
                <Info label="Contact préféré" value={[client.preferredContactMethod, client.preferredContactTime].filter(Boolean).join(" - ") || "À compléter"} />
                <Info label="Téléphone" value={client.phonePrimary ?? client.phone} />
                <Info label="Courriel" value={client.emailPrimary ?? client.email ?? "À compléter"} />
              </div>
            </ContentCard>

            <ContentCard title="Profil financier résumé" description="À compléter avant toute recommandation.">
              <Info label="Profil de risque" value={translate(riskProfileLabels, client.riskProfile, "À évaluer")} />
              <Info label="Objectif principal" value={translate(goalLabels, client.primaryGoal, "À définir")} />
              <Info label="Horizon" value={translate(horizonLabels, client.investmentHorizon, "À définir")} />
              <Info label="Valeur nette" value={client.netWorth !== null ? formatMoney(client.netWorth) : "À renseigner"} />
              <Info label="Actifs liquides" value={client.liquidAssets !== null ? formatMoney(client.liquidAssets) : "À renseigner"} />
              <Info label="Dettes" value={client.liabilities !== null ? formatMoney(client.liabilities) : "À renseigner"} />
              <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                Les revenus, objectifs, protections et risques doivent être documentés avant toute recommandation.
              </p>
            </ContentCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <FinancialProductsSection
              products={(client.products ?? []).slice(0, 3)}
              summary={productSummary}
              onArchive={async (productId) => { await postAction(`/api/financial-products/${productId}`, undefined, "DELETE") }}
              onEdit={setEditingProduct}
              onReview={async (productId) => { await postAction(`/api/financial-products/${productId}/review`) }}
            />
            <ContentCard title="Alertes de conformité">
              <List items={alerts} empty="Aucune alerte critique active.">
                {(alert) => (
                  <div key={alert.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-1">{alert.description}</p>
                  </div>
                )}
              </List>
            </ContentCard>
          </section>
        </>
      ) : null}

      {activeTab === "profile" ? (
        <section className="grid gap-6">
        <ClientProfileTab client={client} fullAddress={fullAddress} onEdit={() => setIsEditing(true)} onKyc={openKycQuestionnaire} />
          <ClientComplianceTab clientId={client.id} client={client} onSynced={loadClient} focusKycRequest={kycFocusRequest} focusTarget={complianceFocusTarget} initialView="profile" profileMode />
        </section>
      ) : null}

      {activeTab === "products" ? (
        <FinancialProductsSection
          products={client.products ?? []}
          summary={productSummary}
          onArchive={async (productId) => { await postAction(`/api/financial-products/${productId}`, undefined, "DELETE") }}
          onEdit={setEditingProduct}
          onReview={async (productId) => { await postAction(`/api/financial-products/${productId}/review`) }}
        />
      ) : null}

      {activeTab === "documents" ? (
        <ClientDocumentsSection documents={client.documents ?? []} requiredAlerts={documentAlerts} onAdd={() => setModal("document")} onRequest={setDocumentRequest} onStatus={updateDocumentStatus} />
      ) : null}

      {activeTab === "tasks" ? (
        <ClientTasksSection tasks={client.tasks ?? []} onAdd={() => setModal("task")} onComplete={completeTask} onReopen={reopenTask} onCancel={cancelTask} />
      ) : null}

      {activeTab === "history" ? (
        <ActivityTimeline endpoint={`/api/clients/${client.id}/activities`} defaultOpen />
      ) : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <ClientDocumentsSection documents={(client.documents ?? []).slice(0, 5)} requiredAlerts={documentAlerts} onAdd={() => setModal("document")} onRequest={setDocumentRequest} onStatus={updateDocumentStatus} compact />
          <ClientTasksSection tasks={openTasks.slice(0, 5)} onAdd={() => setModal("task")} onComplete={completeTask} onReopen={reopenTask} onCancel={cancelTask} compact />
          <div className="xl:col-span-2">
            <NotesSection entity="client" entityId={client.id} initialNotes={(client.noteItems ?? []).slice(0, 3)} onChanged={loadClient} />
          </div>
        </section>
      ) : null}

      {isEditing ? <ClientEditModal client={client} isSaving={isSaving} onClose={() => setIsEditing(false)} onSave={saveClient} /> : null}
      {callNoteOpen ? <CallSummaryModal entityType="client" entityId={client.id} onClose={() => setCallNoteOpen(false)} onSaved={loadClient} /> : null}
      {modal ? <ActionModal type={modal} clientId={client.id} isSaving={isSaving} onClose={() => setModal(null)} onSave={saveWorkspaceAction} /> : null}
      {documentRequest ? (
        <RequestDocumentModal
          request={documentRequest}
          client={client}
          isSaving={isSaving}
          onClose={() => setDocumentRequest(null)}
          onSave={sendDocumentRequest}
        />
      ) : null}
      {editingProduct ? (
        <ProductEditModal
          product={editingProduct}
          isSaving={isSaving}
          onClose={() => setEditingProduct(null)}
          onSave={async (payload) => {
            await postAction(`/api/financial-products/${editingProduct.id}`, payload, "PATCH")
            setEditingProduct(null)
          }}
        />
      ) : null}
    </PageShell>
  )
}

function ClientDetailNavigation({ activeTab, onSelect }: { activeTab: ClientTab; onSelect: (tab: ClientTab) => void }) {
  const items: Array<{ id: ClientTab; label: string }> = [
    { id: "overview", label: "Aperçu" },
    { id: "profile", label: "Profil client" },
    { id: "products", label: "Produits" },
    { id: "documents", label: "Documents" },
    { id: "tasks", label: "Tâches" },
    { id: "reminders", label: "Rappels" },
    { id: "needs", label: "Analyse" },
    { id: "opportunities", label: "Recommandations" },
    { id: "compliance", label: "Conformité" },
    { id: "history", label: "Historique" },
  ]

  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Navigation du dossier client">
      <div className="flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={(activeTab === item.id || (activeTab === "kyc" && item.id === "profile"))
              ? "shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm"
              : "shrink-0 rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

function ClientWorkspaceHeader({
  client,
  complianceScore,
  openComplianceAlerts,
  primaryActionLabel,
  onPrimaryAction,
  onEdit,
  onNote,
  onEmail,
  onPortalMessage,
  onTask,
  onActivity,
  onCallNote,
  onDocument,
  onProduct,
  onArchive,
}: {
  client: ApiClient
  complianceScore: number
  openComplianceAlerts: number
  primaryActionLabel: string
  onPrimaryAction: () => void
  onEdit: () => void
  onNote: () => void
  onEmail: () => void
  onPortalMessage: () => void
  onTask: () => void
  onActivity: () => void
  onCallNote: () => void
  onDocument: () => void
  onProduct: () => void
  onArchive: () => void
}) {
  const dossierState = getClientDossierState(client, openComplianceAlerts, complianceScore)
  const openTasksCount = (client.tasks ?? []).filter((task) => task.status !== "DONE").length
  const documentsCount = client.documents?.length ?? 0
  const productsCount = client.products?.length ?? 0
  const nextReviewLabel = client.nextReviewDate ? formatDate(client.nextReviewDate) : "À planifier"

  const secondaryActions = [
    { icon: StickyNote, label: "Note", onClick: onNote },
    { icon: ClipboardList, label: "Tâche", onClick: onTask },
    { icon: FilePlus2, label: "Document", onClick: onDocument },
    { icon: PackagePlus, label: "Produit", onClick: onProduct },
  ]
  const extraActions = [
    { icon: Mail, label: "Préparer email", onClick: onEmail },
    { icon: MessageSquareText, label: "Message portail", onClick: onPortalMessage },
    { icon: CalendarPlus, label: "Planifier suivi", onClick: onActivity },
    { icon: PhoneCall, label: "Résumer appel", onClick: onCallNote },
  ]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clients" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-white">
              Clients
            </Link>
            <StatusBadge tone={dossierState.tone}>{dossierState.label}</StatusBadge>
            <StatusBadge tone={riskTone[client.riskProfile ?? "UNKNOWN"] ?? "slate"}>{translate(riskProfileLabels, client.riskProfile)}</StatusBadge>
          </div>
          <h2 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{client.firstName} {client.lastName}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{dossierState.message}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5"><PhoneCall className="size-4 text-slate-400" />{client.phonePrimary ?? client.phone}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="size-4 shrink-0 text-slate-400" /><span className="truncate">{client.emailPrimary ?? client.email ?? "Courriel à compléter"}</span></span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-slate-400" />Dernier contact: {formatDate(client.lastContactAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[22rem] lg:items-end">
          <Button className="w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 lg:w-auto" onClick={onPrimaryAction}>
            <ShieldAlert className="size-4" />
            {primaryActionLabel}
          </Button>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {secondaryActions.map((action) => (
              <WorkspaceAction key={action.label} icon={action.icon} label={action.label} onClick={action.onClick} compact />
            ))}
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-50" onClick={onEdit}>
              <Edit3 className="size-4" />
              Modifier
            </Button>
          </div>
          <details className="w-full lg:max-w-md">
            <summary className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
              Plus d’actions
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-white p-2">
              {extraActions.map((action) => (
                <WorkspaceAction key={action.label} icon={action.icon} label={action.label} onClick={action.onClick} compact />
              ))}
              <Button variant="outline" className="rounded-xl border-rose-200 bg-white font-black text-rose-700 hover:bg-rose-50" onClick={onArchive}>
                <Archive className="size-4" />
                Archiver
              </Button>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClientHeroMetric label="Score conformité" value={`${complianceScore}/100`} inline />
        <ClientHeroMetric label="Documents" value={documentsCount} inline />
        <ClientHeroMetric label="Tâches ouvertes" value={openTasksCount} inline />
        <ClientHeroMetric label="Révision" value={nextReviewLabel} inline compact />
      </div>
    </section>
  )
}

function ClientHeroInfo({ icon: Icon, label, value }: { icon: typeof PhoneCall; label: string; value: string }) {
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

function ClientHeroMetric({ label, value, compact, inline }: { label: string; value: string | number; compact?: boolean; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
        <p className={compact ? "max-w-28 truncate text-sm font-black leading-tight text-slate-950" : "text-base font-black leading-tight text-slate-950"}>{value}</p>
        <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200">
      <p className={compact ? "truncate text-sm font-black leading-tight text-slate-950" : "text-lg font-black leading-tight text-slate-950"}>{value}</p>
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
    </div>
  )
}

function getClientCompletionScore(client: ApiClient) {
  const checks = [
    Boolean(client.firstName && client.lastName),
    Boolean(client.phonePrimary ?? client.phone),
    Boolean(client.emailPrimary ?? client.email),
    Boolean(client.preferredContactMethod),
    Boolean(client.addressLine1 ?? client.address),
    Boolean(client.dateOfBirth),
    Boolean(client.familyStatus),
    Boolean(client.occupation),
    Boolean(client.annualIncome ?? client.approximateIncome),
    Boolean(client.primaryGoal),
    Boolean(client.riskProfile && client.riskProfile !== "UNKNOWN"),
    client.kycCompleted,
    client.identityVerified,
    client.consentGiven,
    (client.documents ?? []).length > 0,
    (client.products ?? []).length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getClientDossierState(client: ApiClient, openComplianceAlerts: number, complianceScore: number): { label: string; tone: StatusTone; message: string } {
  const blockingCompliance = !client.kycCompleted || !client.identityVerified || !client.consentGiven || openComplianceAlerts > 0

  if (blockingCompliance) {
    return {
      label: "Onboarding incomplet",
      tone: complianceScore < 40 ? "rose" : "amber",
      message: "Ce dossier est actif, mais incomplet pour une recommandation.",
    }
  }

  if (client.status === "REVIEW_NEEDED") {
    return {
      label: "Révision requise",
      tone: "amber",
      message: "Le dossier doit être revu avant la prochaine action importante.",
    }
  }

  if (client.status === "ACTIVE") {
    return {
      label: "Dossier actif",
      tone: "emerald",
      message: "Le dossier est utilisable pour le suivi régulier.",
    }
  }

  return {
    label: translate(clientStatusLabels, client.status),
    tone: "slate",
    message: "Gardez les prochaines actions visibles pour maintenir le suivi.",
  }
}

function getNextAction(client: ApiClient, missingDocs: number) {
  if (!client.kycCompleted) return "Envoyer le formulaire profil client"
  if (!client.identityVerified) return "Vérifier l’identité"
  if (!client.consentGiven) return "Obtenir le consentement conformité"
  if (missingDocs > 0 || (client.documents ?? []).length === 0) return "Demander les documents requis"
  if (!client.riskProfile || client.riskProfile === "UNKNOWN") return "Évaluer le profil de risque"
  if (!client.primaryGoal) return "Compléter les objectifs"
  if ((client.products ?? []).length === 0) return "Ajouter un produit ou une opportunité"
  if (!client.nextReviewDate) return "Planifier la prochaine révision"
  return "Aucune action urgente"
}

function ClientPortalAccessPanel({
  client,
  openTasksCount,
  onCopyPortalLink,
  onResendPortalInvite,
  onPortalMessage,
  onDocuments,
}: {
  client: ApiClient
  openTasksCount: number
  onCopyPortalLink: () => void
  onResendPortalInvite: () => void
  onPortalMessage: () => void
  onDocuments: () => void
}) {
  const clientEmail = client.emailPrimary ?? client.email ?? client.emailSecondary
  const visibleDocuments = (client.documents ?? []).filter((document) => document.visibility !== "INTERNAL" && document.visibility !== "COMPLIANCE_ONLY")
  const requestedDocuments = visibleDocuments.filter((document) => ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"].includes(document.status))
  const portalMessages = (client.noteItems ?? []).filter((note) => /portail client/i.test(note.title ?? ""))
  const portalActivities = (client.activities ?? []).filter((activity) => /espace client|portail client|client.*portail|action client/i.test(`${activity.title} ${activity.description ?? ""}`))
  const lastPortalActivity = portalActivities[0]
  const portalReady = Boolean(clientEmail)
  const profileRequiredItems = [
    { label: "Date de naissance", done: Boolean(client.dateOfBirth) },
    { label: "Téléphone principal", done: Boolean(client.phonePrimary ?? client.phone) },
    { label: "Courriel principal", done: Boolean(client.emailPrimary ?? client.email) },
    { label: "Adresse", done: Boolean(client.addressLine1 ?? client.address) },
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

  return (
    <section className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_8px_0_#f1f5f9]">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <UserRoundCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Espace client</p>
              <h2 className="text-lg font-black tracking-tight text-slate-950">
                {portalReady ? "Invitation et suivi client disponibles" : "Courriel requis pour inviter le client"}
              </h2>
            </div>
            <StatusBadge tone={portalReady ? "emerald" : "amber"}>
              {portalReady ? "Prêt à inviter" : "Courriel manquant"}
            </StatusBadge>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ClientPortalStat label="Courriel client" value={clientEmail ?? "À compléter"} />
            <ClientPortalStat label="Profil client" value={`${profileCompletion} %`} detail={client.kycCompleted ? "Soumis au conseiller" : profileMissingItems.length > 0 ? `${profileMissingItems.length} champ(s) à compléter` : "Prêt à soumettre"} />
            <ClientPortalStat label="Documents visibles" value={`${visibleDocuments.length}`} detail={requestedDocuments.length > 0 ? `${requestedDocuments.length} à fournir` : "À jour"} />
            <ClientPortalStat label="Actions ouvertes" value={`${openTasksCount}`} detail="Portail + CRM" />
            <ClientPortalStat label="Messages portail" value={`${portalMessages.length}`} detail="Conversation dossier" />
            <ClientPortalStat label="Dernière activité" value={lastPortalActivity ? formatDate(lastPortalActivity.createdAt) : "Aucune"} detail={lastPortalActivity?.title ?? "Aucune trace portail"} />
          </div>
          {profileMissingItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <span className="text-xs font-black uppercase tracking-wide text-amber-800">À demander</span>
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

        <div className="flex flex-wrap items-start gap-2 xl:max-w-[420px] xl:justify-end">
          <Button variant="outline" className="rounded-full border-2 border-slate-200 bg-white font-black text-slate-800 hover:bg-slate-50" onClick={onCopyPortalLink} disabled={!portalReady}>
            <Copy className="size-4" />
            Copier lien
          </Button>
          <Button className="rounded-full bg-emerald-600 font-black text-white hover:bg-emerald-700" onClick={onResendPortalInvite} disabled={!portalReady}>
            <Send className="size-4" />
            Envoyer formulaire profil client
          </Button>
          <Button variant="outline" className="rounded-full border-2 border-slate-200 bg-white font-black text-slate-800 hover:bg-slate-50" asChild>
            <Link href={`/espace-client?clientId=${client.id}#portal-profile-questionnaire`}>
              <ExternalLink className="size-4" />
              Aperçu formulaire
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full border-2 border-slate-200 bg-white font-black text-slate-800 hover:bg-slate-50" onClick={onPortalMessage}>
            <MessageSquareText className="size-4" />
            Message portail
          </Button>
          <Button variant="outline" className="rounded-full border-2 border-slate-200 bg-white font-black text-slate-800 hover:bg-slate-50" onClick={onDocuments}>
            <FilePlus2 className="size-4" />
            Documents
          </Button>
        </div>
      </div>
    </section>
  )
}

function ClientPortalStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
      {detail ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{detail}</p> : null}
    </div>
  )
}

function getMissingClientActions(client: ApiClient, missingDocs: number): MissingClientAction[] {
  const missingKycFields = [
    !client.kycCompleted ? "Questionnaire profil client non complété" : null,
    !client.dateOfBirth ? "Date de naissance" : null,
    !client.familyStatus ? "Situation familiale" : null,
    !client.occupation ? "Occupation / profession" : null,
    !(client.annualIncome ?? client.approximateIncome) && !client.incomeRange ? "Revenu annuel ou fourchette" : null,
    !client.primaryGoal ? "Objectif principal" : null,
    !client.riskProfile || client.riskProfile === "UNKNOWN" ? "Profil de risque" : null,
  ].filter((field): field is string => Boolean(field))

  return [
    !client.kycCompleted ? {
      id: "kyc" as const,
      label: "Profil client",
      summary: "Compléter le profil personne physique avant de produire une recommandation.",
      details: missingKycFields.length > 0 ? missingKycFields.slice(0, 5) : ["Questionnaire profil client à sauvegarder"],
      actionLabel: "Ouvrir le questionnaire profil client",
    } : null,
    !client.identityVerified ? {
      id: "identity" as const,
      label: "identité",
      summary: "Documenter la vérification d’identité ou la méthode utilisée.",
      details: ["Statut identité vérifiée", "Méthode ou preuve de vérification", "Date et trace de validation"],
      actionLabel: "Ouvrir identité",
    } : null,
    !client.consentGiven ? {
      id: "consent" as const,
      label: "consentement conformité",
      summary: "Ajouter un consentement actif avant les communications ou documents sensibles.",
      details: ["Consentement de collecte/communication", "Version et date du consentement", "Preuve conservée au dossier"],
      actionLabel: "Ouvrir consentement",
    } : null,
    missingDocs > 0 || (client.documents ?? []).length === 0 ? {
      id: "documents" as const,
      label: "documents",
      summary: "Classer les pièces nécessaires dans le dossier client.",
      details: missingDocs > 0 ? [`${missingDocs} document${missingDocs > 1 ? "s" : ""} requis ou expiré${missingDocs > 1 ? "s" : ""}`, "Pièces classées dans le bon dossier client"] : ["Aucun document au dossier", "Ajouter une pièce d’identité, police ou preuve utile"],
      actionLabel: "Ouvrir documents",
    } : null,
    !client.riskProfile || client.riskProfile === "UNKNOWN" ? {
      id: "risk" as const,
      label: "profil de risque",
      summary: "Confirmer le profil de risque utilisé par l’analyse des besoins.",
      details: ["Tolérance au risque", "Capacité de risque", "Profil résultant"],
      actionLabel: "Ouvrir profil de risque",
    } : null,
    !client.primaryGoal ? {
      id: "objectives" as const,
      label: "objectifs",
      summary: "Définir l’objectif principal pour relier le dossier à une analyse concrète.",
      details: ["Objectif principal", "Horizon", "Contexte ou besoin prioritaire"],
      actionLabel: "Ouvrir objectifs",
    } : null,
  ].filter((action): action is MissingClientAction => Boolean(action))
}

function ClientPriorityBanner({
  client,
  missingDocs,
  onAction,
}: {
  client: ApiClient
  missingDocs: number
  onAction: (actionId: MissingClientActionId) => void
}) {
  const missingActions = getMissingClientActions(client, missingDocs)
  const isIncomplete = missingActions.length > 0
  const blocked = !client.kycCompleted || !client.identityVerified || !client.consentGiven

  return (
    <section className={blocked ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" : "rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 ring-1 ring-black/5">
            <ShieldAlert className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black">{isIncomplete ? "À traiter avant recommandation" : "Dossier prêt pour le suivi"}</h2>
              {isIncomplete ? <StatusBadge tone={blocked ? "amber" : "sky"}>{missingActions.length} action{missingActions.length > 1 ? "s" : ""}</StatusBadge> : null}
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 opacity-80">
              {isIncomplete ? missingActions.map((action) => action.label).join(", ") : "Aucune action bloquante détectée."}
            </p>
          </div>
        </div>

        {missingActions.length > 0 ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {missingActions.slice(0, 3).map((action) => (
              <Button key={action.id} type="button" size="sm" variant="outline" className="rounded-xl border-white bg-white font-black" onClick={() => onAction(action.id)}>
                {action.actionLabel}
              </Button>
            ))}
            {missingActions.length > 3 ? <span className="rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-black/5">+{missingActions.length - 3}</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ClientKeyIndicators({
  client,
  openTasksCount,
  overdueTasksCount,
  missingDocs,
  complianceScore,
  onProfile,
  onDocuments,
  onCompliance,
  onProduct,
  onTask,
}: {
  client: ApiClient
  openTasksCount: number
  overdueTasksCount: number
  missingDocs: number
  complianceScore: number
  onProfile: () => void
  onDocuments: () => void
  onCompliance: () => void
  onProduct: () => void
  onTask: () => void
}) {
  const completion = getClientCompletionScore(client)
  const indicators = [
    { label: "Conformité", value: `${complianceScore}/100`, detail: complianceScore >= 80 ? "Sous contrôle" : "Actions requises", action: "Vérifier", onClick: onCompliance },
    { label: "Documents requis", value: missingDocs > 0 ? `${missingDocs} manquant${missingDocs > 1 ? "s" : ""}` : "À jour", detail: `${client.documents?.length ?? 0} document${(client.documents?.length ?? 0) > 1 ? "s" : ""} au dossier`, action: "Demander", onClick: onDocuments },
    { label: "Tâches", value: overdueTasksCount > 0 ? `${overdueTasksCount} en retard` : `${openTasksCount} ouverte${openTasksCount > 1 ? "s" : ""}`, detail: overdueTasksCount > 0 ? "À traiter aujourd’hui" : openTasksCount > 0 ? "Suivi actif" : "Aucune tâche urgente", action: "Créer", onClick: onTask },
    { label: "Profil client", value: `${completion} %`, detail: completion >= 80 ? "Presque complet" : "À compléter", action: "Compléter", onClick: onProfile },
    { label: "Produits", value: (client.products?.length ?? 0) > 0 ? `${client.products?.length ?? 0} actif${(client.products?.length ?? 0) > 1 ? "s" : ""}` : "Aucun produit actif", detail: "Police, placement ou opportunité", action: "Ajouter", onClick: onProduct },
    { label: "Prochaine révision", value: formatDate(client.nextReviewDate), detail: client.nextReviewDate ? "Planifiée" : "À planifier", action: "Planifier", onClick: onTask },
  ]

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {indicators.map((indicator) => (
        <button
          key={indicator.label}
          type="button"
          onClick={indicator.onClick}
          className="rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{indicator.label}</p>
          <p className="mt-1 truncate text-base font-black text-slate-950">{indicator.value}</p>
          <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-500">{indicator.detail}</p>
        </button>
      ))}
    </section>
  )
}

function isBusinessProfileRelevant(client: ApiClient) {
  const employment = `${client.employmentStatus ?? ""} ${client.occupation ?? ""}`
  return ["BUSINESS", "TRUST", "ESTATE", "NON_PROFIT"].includes(client.profileType ?? "") || client.isSelfEmployed || /self|autonome|incorpor|entrepreneur|propri|business|soci[eé]t[eé]/i.test(employment)
}

function getDossierModuleTone(status: "ready" | "warning" | "blocked" | "neutral"): StatusTone {
  if (status === "ready") return "emerald"
  if (status === "blocked") return "rose"
  if (status === "warning") return "amber"
  return "slate"
}

function ClientIntelligentDossierCard({
  client,
  complianceScore,
  openComplianceAlerts,
  missingDocs,
  onKyc,
  onKyb,
  onAml,
  onDocuments,
  onRecommendations,
}: {
  client: ApiClient
  complianceScore: number
  openComplianceAlerts: number
  missingDocs: number
  onKyc: () => void
  onKyb: () => void
  onAml: () => void
  onDocuments: () => void
  onRecommendations: () => void
}) {
  const kycReady = client.kycCompleted && client.identityVerified && client.consentGiven
  const businessRelevant = isBusinessProfileRelevant(client)
  const hasKycProfile = Boolean(client.kycProfile)
  const analysisReady = kycReady && complianceScore >= 70 && missingDocs === 0 && openComplianceAlerts === 0
  const kycMissingParts = [
    !client.kycCompleted ? "questionnaire profil client" : null,
    !client.identityVerified ? "identité" : null,
    !client.consentGiven ? "consentement" : null,
    !client.riskProfile || client.riskProfile === "UNKNOWN" ? "profil de risque" : null,
    !client.primaryGoal ? "objectifs" : null,
  ].filter(Boolean).join(", ")
  const modules = [
    {
      title: "Profil personne physique",
      icon: UserRoundCheck,
      status: kycReady ? "Confirmé" : translate(kycStatusLabels, client.kycProfile?.status, "À compléter"),
      detail: kycMissingParts ? `À compléter: ${kycMissingParts}.` : "Identité, famille, emploi, revenus, objectifs, risque et consentements.",
      metric: client.kycProfile ? `${client.kycProfile.complianceScore}/100` : "Profil requis",
      tone: getDossierModuleTone(kycReady ? "ready" : "warning"),
      actionLabel: kycReady ? "Voir le profil" : "Compléter le profil",
      onClick: onKyc,
    },
    {
      title: "KYB entreprise",
      icon: Building2,
      status: businessRelevant ? "À structurer" : "Non requis détecté",
      detail: businessRelevant
        ? "Compléter l’emploi, l’entreprise, les associés, les signataires et les documents corporatifs."
        : "Aucun profil entreprise requis selon les données actuelles. Vérifiez l’emploi si le client est entrepreneur.",
      metric: businessRelevant ? "Profil entreprise" : "Profil personnel",
      tone: getDossierModuleTone(businessRelevant ? "warning" : "neutral"),
      actionLabel: businessRelevant ? "Compléter KYB" : "Vérifier profil",
      onClick: onKyb,
    },
    {
      title: "AML / LBA",
      icon: ShieldAlert,
      status: openComplianceAlerts > 0 ? "À revoir" : "Sous surveillance",
      detail: openComplianceAlerts > 0
        ? "Ouvrir les alertes et compléter identité, source des fonds, tiers ou PPV/DOI."
        : "Source des fonds, source de richesse, tiers, PPV/DOI et alertes de conformité.",
      metric: `${openComplianceAlerts} alerte${openComplianceAlerts > 1 ? "s" : ""}`,
      tone: getDossierModuleTone(openComplianceAlerts > 0 ? "blocked" : "ready"),
      actionLabel: openComplianceAlerts > 0 ? "Traiter alertes" : "Voir AML",
      onClick: onAml,
    },
    {
      title: "Analyse des besoins",
      icon: ClipboardCheck,
      status: analysisReady ? "Prête" : hasKycProfile ? "Prête avec réserves" : "Profil client requis",
      detail: analysisReady
        ? "Les données sont suffisantes pour ouvrir l’analyse et les recommandations."
        : "L’action ouvre la première information manquante avant de générer une recommandation.",
      metric: missingDocs > 0 ? `${missingDocs} document${missingDocs > 1 ? "s" : ""}` : "Données à jour",
      tone: getDossierModuleTone(analysisReady ? "ready" : "warning"),
      actionLabel: analysisReady ? "Ouvrir analyse" : missingDocs > 0 ? "Ajouter documents" : "Compléter données",
      onClick: analysisReady ? onRecommendations : missingDocs > 0 ? onDocuments : onRecommendations,
    },
  ]

  return (
    <ContentCard title="Modules du dossier" description="Accès rapide aux zones qui structurent la recommandation.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = module.icon
          return (
            <button
              key={module.title}
              type="button"
              onClick={module.onClick}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-200">
                  <Icon className="size-5" />
                </div>
                <StatusBadge tone={module.tone}>{module.status}</StatusBadge>
              </div>
              <p className="mt-3 text-sm font-black text-slate-950">{module.title}</p>
              <p className="mt-1 text-base font-black text-slate-950">{module.metric}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{module.detail}</p>
              <span className="mt-3 inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                {module.actionLabel}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        Une recommandation devrait être liée à une version profil client confirmée, aux documents requis et aux alertes AML résolues.
      </p>
    </ContentCard>
  )
}

function ClientKycWorkspace({ client, onOpenFullKyc, onSynced }: { client: ApiClient; onOpenFullKyc: () => void; onSynced: () => Promise<void> }) {
  const kyc = client.kycProfile
  const investmentProfile = client.investmentProfile
  const goals = client.financialGoalItems ?? []
  const questionnaireAnswers = client.riskQuestionnaireAnswers ?? []
  const versions = client.kycVersions ?? []
  const alerts = client.kycAlerts ?? []
  const completionScore = kyc?.complianceScore ?? 0
  const latestVersion = versions[0] ?? null
  const profileReady = Boolean(client.kycCompleted && client.identityVerified && client.consentGiven && latestVersion?.lockedAt)
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [goalNotice, setGoalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [isSavingRiskAnswers, setIsSavingRiskAnswers] = useState(false)
  const [riskNotice, setRiskNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  async function submitRiskAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!kyc) {
      setRiskNotice({ type: "error", message: "Créez d’abord le profil client complet avant d’éditer le questionnaire de risque." })
      return
    }
    const formData = new FormData(event.currentTarget)
    const payload = {
      riskTolerance: String(formData.get("riskTolerance") ?? ""),
      riskCapacity: String(formData.get("riskCapacity") ?? ""),
      riskProfileResult: String(formData.get("riskProfileResult") ?? ""),
      investmentHorizon: String(formData.get("investmentHorizon") ?? ""),
      liquidityNeeds: String(formData.get("liquidityNeeds") ?? ""),
      investmentKnowledge: String(formData.get("investmentKnowledge") ?? ""),
      investmentExperience: String(formData.get("investmentExperience") ?? ""),
      borrowingNeeds: String(formData.get("borrowingNeeds") ?? ""),
    }
    setIsSavingRiskAnswers(true)
    setRiskNotice(null)
    try {
      const response = await fetch(`/api/clients/${client.id}/kyc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<unknown>(response)
      setRiskNotice({ type: "success", message: "Questionnaire de risque mis à jour et opportunités synchronisées." })
      await onSynced()
    } catch (error) {
      setRiskNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de sauvegarder les réponses." })
    } finally {
      setIsSavingRiskAnswers(false)
    }
  }

  async function submitFinancialGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      goalName: String(formData.get("goalName") ?? ""),
      goalType: String(formData.get("goalType") ?? "OTHER"),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      targetAmount: String(formData.get("targetAmount") ?? ""),
      currentAmount: String(formData.get("currentAmount") ?? ""),
      timeHorizonYears: String(formData.get("timeHorizonYears") ?? ""),
      liquidityNeed: String(formData.get("liquidityNeed") ?? ""),
      riskLevelForGoal: String(formData.get("riskLevelForGoal") ?? ""),
      contributionPlan: String(formData.get("contributionPlan") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    }

    setIsSavingGoal(true)
    setGoalNotice(null)
    try {
      const response = await fetch(`/api/clients/${client.id}/kyc/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<unknown>(response)
      form.reset()
      setGoalFormOpen(false)
      setGoalNotice({ type: "success", message: "Objectif financier ajouté au profil client." })
      await onSynced()
    } catch (error) {
      setGoalNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible d’ajouter l’objectif." })
    } finally {
      setIsSavingGoal(false)
    }
  }

  async function deleteFinancialGoal(goalId: string) {
    if (!window.confirm("Supprimer cet objectif financier du profil client?")) return
    setIsSavingGoal(true)
    setGoalNotice(null)
    try {
      const response = await fetch(`/api/clients/${client.id}/kyc/goals/${goalId}`, { method: "DELETE" })
      await readJson<unknown>(response)
      setGoalNotice({ type: "success", message: "Objectif financier supprimé." })
      await onSynced()
    } catch (error) {
      setGoalNotice({ type: "error", message: error instanceof Error ? error.message : "Suppression impossible." })
    } finally {
      setIsSavingGoal(false)
    }
  }

  const goalTypeLabels: Record<string, string> = {
    RETIREMENT: "Retraite",
    LIQUIDITY: "Liquidité",
    PROTECTION: "Protection",
    EDUCATION: "Études",
    HOME_PURCHASE: "Achat immobilier",
    ESTATE: "Succession",
    WEALTH_BUILDING: "Croissance du patrimoine",
    OTHER: "Autre",
  }
  const priorityLabels: Record<string, string> = { HIGH: "Haute", MEDIUM: "Moyenne", LOW: "Faible" }
  const liquidityLabels: Record<string, string> = { LOW: "Faible", MEDIUM: "Moyenne", HIGH: "Élevée" }
  const riskLevelLabels: Record<string, string> = {
    CONSERVATIVE: "Conservateur",
    MODERATE_LOW: "Modéré-faible",
    MODERATE: "Modéré",
    GROWTH: "Croissance",
    AGGRESSIVE: "Agressif",
  }

  function formatGoalMoney(value?: number | null) {
    return value === null || typeof value === "undefined" ? "À définir" : formatMoney(value)
  }

  function formatQuestionnaireAnswer(value: unknown) {
    if (value === null || typeof value === "undefined") return "À compléter"
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return value.map((item) => String(item)).join(", ")
    try {
      return JSON.stringify(value)
    } catch {
      return "Réponse consignée"
    }
  }

  return (
    <section className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_10px_0_#d9f99d]">
        <div className="grid gap-4 bg-emerald-500 p-5 text-white lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Espace Profil client</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">Profil client, objectifs, risque et preuve</h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
              Vue dédiée pour confirmer si le client est suffisamment connu, à jour et cohérent avant recommandation.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={onOpenFullKyc}>
                <UserRoundCheck className="size-4" />
                Modifier le profil complet
              </Button>
              <Button type="button" variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" asChild>
                <a href={`/api/clients/${client.id}/kyc/export`} target="_blank" rel="noreferrer">Exporter le profil</a>
              </Button>
            </div>
          </div>
          <div className="rounded-[1.5rem] border-2 border-white/30 bg-white/15 p-4">
            <p className="text-4xl font-black">{completionScore}/100</p>
            <p className="mt-1 text-sm font-bold text-emerald-50">Score de complétude du profil</p>
            <div className="mt-4 grid gap-2">
              <StatusBadge tone={profileReady ? "emerald" : "amber"}>{profileReady ? "Utilisable" : "À compléter"}</StatusBadge>
              <p className="text-xs font-bold leading-5 text-emerald-50">
                {latestVersion ? `Version profil v${latestVersion.versionNumber} verrouillée le ${formatDate(latestVersion.lockedAt)}.` : "Aucune version profil verrouillée pour recommandation."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ContentCard title="Profil client" description="Identité, situation personnelle et confirmation.">
          <Info label="Statut profil" value={kyc?.status ?? "Non commencé"} />
          <Info label="Revue interne" value={kyc?.reviewStatus ?? "Non définie"} />
          <Info label="Identité" value={client.identityVerified ? "Vérifiée" : "Non vérifiée"} />
          <Info label="Consentement" value={client.consentGiven ? "Actif" : "Manquant"} />
          <Info label="Confirmation client" value={kyc?.clientConfirmedNoChange ? "Confirmée" : "À obtenir"} />
          <Info label="Attestation conseiller" value={kyc?.advisorAttestation ? "Confirmée" : "À obtenir"} />
          <Info label="Prochaine révision" value={formatDate(kyc?.nextKycReviewAt ?? client.nextReviewDate)} />
        </ContentCard>

        <ContentCard title="Situation financière" description="Données utilisées pour capacité, liquidité et convenance.">
          <Info label="Revenu annuel" value={kyc?.annualIncome !== null && kyc?.annualIncome !== undefined ? formatMoney(kyc.annualIncome) : client.annualIncome !== null ? formatMoney(client.annualIncome) : "À compléter"} />
          <Info label="Actifs totaux" value={kyc?.totalAssets !== null && kyc?.totalAssets !== undefined ? formatMoney(kyc.totalAssets) : client.netWorth !== null ? formatMoney(client.netWorth) : "À compléter"} />
          <Info label="Passifs" value={kyc?.totalLiabilities !== null && kyc?.totalLiabilities !== undefined ? formatMoney(kyc.totalLiabilities) : client.liabilities !== null ? formatMoney(client.liabilities) : "À compléter"} />
          <Info label="Dépenses mensuelles" value={kyc?.monthlyExpenses !== null && kyc?.monthlyExpenses !== undefined ? formatMoney(kyc.monthlyExpenses) : "À compléter"} />
          <Info label="Fonds d’urgence" value={kyc?.emergencyFund !== null && kyc?.emergencyFund !== undefined ? `${kyc.emergencyFund} mois` : "À compléter"} />
          <Info label="Source des fonds" value={kyc?.sourceOfFunds ?? "À compléter"} />
          <Info label="Source de richesse" value={kyc?.sourceOfWealth ?? "À compléter"} />
        </ContentCard>

        <ContentCard title="Profil investisseur" description="Tolérance, capacité, horizon et liquidité sont séparés.">
          <Info label="Objectif principal" value={investmentProfile?.primaryObjective ?? kyc?.primaryObjective ?? "À définir"} />
          <Info label="Horizon" value={investmentProfile?.timeHorizon ?? kyc?.investmentHorizon ?? "À définir"} />
          <Info label="Liquidité" value={investmentProfile?.liquidityNeeds ?? kyc?.liquidityNeeds ?? "À définir"} />
          <Info label="Connaissances" value={investmentProfile?.investmentKnowledge ?? kyc?.investmentKnowledge ?? "À définir"} />
          <Info label="Tolérance" value={kyc?.riskTolerance ?? "À évaluer"} />
          <Info label="Capacité" value={kyc?.riskCapacity ?? "À évaluer"} />
          <Info label="Profil final" value={investmentProfile?.finalRiskProfile ?? kyc?.riskProfileResult ?? "À calculer"} />
          <Info label="Levier financier" value={investmentProfile?.usesLeverage ? investmentProfile.leverageDetails ?? "Oui" : "Non / à confirmer"} />
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title="Objectifs financiers" description="Objectifs structurés liés au profil client.">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{goals.length} objectif{goals.length > 1 ? "s" : ""} structuré{goals.length > 1 ? "s" : ""}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Chaque objectif peut avoir son horizon, sa liquidité, son risque acceptable et son montant cible.</p>
            </div>
            <Button type="button" className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" onClick={() => setGoalFormOpen((open) => !open)}>
              <Plus className="size-4" />
              Ajouter un objectif
            </Button>
          </div>
          {goalNotice ? (
            <p className={goalNotice.type === "success" ? "mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" : "mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-900"}>
              {goalNotice.message}
            </p>
          ) : null}
          {goalFormOpen ? (
            <form onSubmit={submitFinancialGoal} className="mb-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Nom de l’objectif
                  <Input name="goalName" required placeholder="Retraite à 62 ans" className="rounded-xl bg-white" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Type
                  <select name="goalType" defaultValue="RETIREMENT" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {Object.entries(goalTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Priorité
                  <select name="priority" defaultValue="HIGH" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Montant cible
                  <Input name="targetAmount" type="number" min="0" step="100" placeholder="1200000" className="rounded-xl bg-white" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Montant actuel
                  <Input name="currentAmount" type="number" min="0" step="100" placeholder="420000" className="rounded-xl bg-white" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Horizon en années
                  <Input name="timeHorizonYears" type="number" min="0" step="1" placeholder="17" className="rounded-xl bg-white" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Besoin de liquidité
                  <select name="liquidityNeed" defaultValue="LOW" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {Object.entries(liquidityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Risque acceptable
                  <select name="riskLevelForGoal" defaultValue="MODERATE" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                    {Object.entries(riskLevelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                Contribution prévue
                <Input name="contributionPlan" placeholder="1 500 $ / mois vers REER et CELI" className="rounded-xl bg-white" />
              </label>
              <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                Notes conseiller
                <textarea name="notes" rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" placeholder="Contexte, documents consultés, contraintes ou justification." />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full font-black" onClick={() => setGoalFormOpen(false)}>Annuler</Button>
                <Button type="submit" className="rounded-full bg-emerald-600 font-black text-white hover:bg-emerald-700" disabled={isSavingGoal}>
                  {isSavingGoal ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Enregistrer l’objectif
                </Button>
              </div>
            </form>
          ) : null}
          {goals.length === 0 ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">Aucun objectif détaillé. Ajoutez retraite, liquidité, protection, succession ou autre objectif dans le profil client.</p>
          ) : (
            <div className="grid gap-3">
              {goals.map((goal) => (
                <div key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={goal.priority === "HIGH" ? "amber" : "slate"}>{priorityLabels[goal.priority] ?? goal.priority}</StatusBadge>
                      <StatusBadge tone="sky">{goalTypeLabels[goal.goalType] ?? goal.goalType}</StatusBadge>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-rose-100 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      onClick={() => void deleteFinancialGoal(goal.id)}
                      disabled={isSavingGoal}
                      aria-label="Supprimer l’objectif"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="mt-2 font-black text-slate-950">{goal.goalName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Cible: {formatGoalMoney(goal.targetAmount)} · Actuel: {formatGoalMoney(goal.currentAmount)} · Horizon: {goal.timeHorizonYears ?? "n/d"} ans
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Liquidité: {goal.liquidityNeed ? liquidityLabels[goal.liquidityNeed] ?? goal.liquidityNeed : "n/d"} · Risque: {goal.riskLevelForGoal ? riskLevelLabels[goal.riskLevelForGoal] ?? goal.riskLevelForGoal : "n/d"}
                  </p>
                  {goal.contributionPlan ? <p className="mt-2 text-sm font-bold text-slate-700">Contribution: {goal.contributionPlan}</p> : null}
                  {goal.notes ? <p className="mt-2 rounded-xl bg-white p-3 text-sm font-semibold leading-6 text-slate-600">{goal.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Historique du profil" description="Versions, alertes et réponses utilisées pour la preuve.">
          <div className="grid gap-3">
            {alerts.length > 0 ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-sm font-black text-rose-950">{alerts.length} alerte(s) profil client ouverte(s)</p>
                <div className="mt-2 grid gap-2">
                  {alerts.slice(0, 4).map((alert) => (
                    <p key={alert.id} className="text-sm font-semibold leading-6 text-rose-800">{alert.title}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Aucune alerte profil client dédiée ouverte.</div>
            )}
            {versions.length > 0 ? versions.map((version) => (
              <div key={version.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="font-black text-slate-950">Version profil v{version.versionNumber}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Verrouillée: {formatDate(version.lockedAt)} · Utilisée recommandation: {formatDate(version.usedForRecommendationAt)}
                </p>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-600">Aucune version profil verrouillée.</div>
            )}
          </div>
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title="Questionnaire de risque" description="Réponses consignées pour tolérance, capacité, horizon, liquidité, connaissances et levier.">
          <form onSubmit={submitRiskAnswers} className="mb-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            {riskNotice ? (
              <p className={riskNotice.type === "success" ? "mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" : "mb-3 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-900"}>
                {riskNotice.message}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <InlineSelect name="riskTolerance" label="Tolérance au risque" defaultValue={kyc?.riskTolerance} options={riskProfileSelectOptions} />
              <InlineSelect name="riskCapacity" label="Capacité de risque" defaultValue={kyc?.riskCapacity} options={riskCapacitySelectOptions} />
              <InlineSelect name="riskProfileResult" label="Profil final" defaultValue={kyc?.riskProfileResult} options={riskProfileSelectOptions} />
              <InlineSelect name="investmentHorizon" label="Horizon" defaultValue={kyc?.investmentHorizon} options={horizonSelectOptions} />
              <InlineSelect name="liquidityNeeds" label="Besoin de liquidité" defaultValue={kyc?.liquidityNeeds} options={liquiditySelectOptions} />
              <InlineSelect name="investmentKnowledge" label="Connaissances financières" defaultValue={kyc?.investmentKnowledge} options={investmentKnowledgeSelectOptions} />
              <InlineSelect name="investmentExperience" label="Expérience de placement" defaultValue={kyc?.investmentExperience} options={investmentExperienceSelectOptions} />
              <InlineSelect name="borrowingNeeds" label="Levier / emprunt" defaultValue={kyc?.borrowingNeeds} options={borrowingNeedSelectOptions} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" className="rounded-full bg-emerald-600 font-black text-white hover:bg-emerald-700" disabled={isSavingRiskAnswers || !kyc}>
                {isSavingRiskAnswers ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Sauvegarder les réponses
              </Button>
            </div>
          </form>
          {questionnaireAnswers.length === 0 ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              Aucune réponse structurée n’est encore consignée. Ouvrez le profil complet pour synchroniser le questionnaire.
            </div>
          ) : (
            <div className="grid gap-3">
              {questionnaireAnswers.map((answer) => (
                <div key={answer.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-950">{answer.questionLabel}</p>
                    <StatusBadge tone={answer.score && answer.score >= 4 ? "amber" : "slate"}>
                      {answer.score ? `Score ${answer.score}/5` : answer.questionCategory}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{formatQuestionnaireAnswer(answer.answerValue)}</p>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Contrôles recommandation" description="Ce que le CRM vérifie avant d’utiliser ce profil pour une recommandation.">
          <div className="grid gap-3">
            {[
              { label: "Profil client confirmé", done: Boolean(kyc?.clientConfirmedNoChange) },
              { label: "Attestation conseiller", done: Boolean(kyc?.advisorAttestation) },
              { label: "Identité et consentement", done: Boolean(client.identityVerified && client.consentGiven) },
              { label: "Profil investisseur calculé", done: Boolean(investmentProfile?.finalRiskProfile ?? kyc?.riskProfileResult) },
              { label: "Version profil verrouillée", done: Boolean(latestVersion?.lockedAt) },
              { label: "Aucune alerte profil ouverte", done: alerts.length === 0 },
            ].map((item) => (
              <div key={item.label} className={item.done ? "flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3" : "flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3"}>
                <span className={item.done ? "text-sm font-black text-emerald-950" : "text-sm font-black text-amber-950"}>{item.label}</span>
                {item.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-amber-600" />}
              </div>
            ))}
          </div>
        </ContentCard>
      </section>
    </section>
  )
}

function InlineSelect({
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
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
        {options.map((option) => <option key={`${name}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ClientProfileTab({
  client,
  fullAddress,
  onEdit,
  onKyc,
}: {
  client: ApiClient
  fullAddress: string
  onEdit: () => void
  onKyc: () => void
}) {
  const synced = getClientProfileSyncValues(client)
  const primaryPhone = formatPhone(client.phonePrimary ?? client.phone)
  const primaryEmail = client.emailPrimary ?? client.email ?? "À compléter"

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <section className="grid gap-6 xl:grid-cols-2">
            <ContentCard title="Identité et contact" description="Données utilisées pour le portail, les communications et les documents.">
              <Info label="Numéro client" value={client.clientNumber ?? "À compléter"} />
              <Info label="Genre" value={translate(genderLabels, client.gender, "À compléter")} />
              <Info label="Naissance" value={formatDate(client.dateOfBirth)} />
              <Info label="Téléphone principal" value={primaryPhone} />
              <Info label="Téléphone secondaire" value={client.phoneSecondary ? formatPhone(client.phoneSecondary) : "Optionnel"} />
              <Info label="Courriel principal" value={primaryEmail} />
              <Info label="Courriel secondaire" value={client.emailSecondary ?? "Optionnel"} />
              <Info label="Contact préféré" value={formatContactPreference(client.preferredContactMethod, client.preferredContactTime)} />
              <Info label="Adresse" value={fullAddress || "À compléter"} />
            </ContentCard>

            <ContentCard title="Ménage et emploi" description="Contexte familial et professionnel qui influence les besoins et les rappels.">
              <Info label="Situation familiale" value={translate(familyStatusLabels, client.familyStatus, "À compléter")} />
              <Info label="Conjoint(e)" value={formatSpouseSummary(client)} />
              <Info label="Enfants" value={formatChildrenStatus(client)} />
              <Info label="Personnes à charge" value={formatDependentsStatus(client)} />
              <Info label="Détails personnes à charge" value={formatDependentsDetails(client)} />
              <Info label="Occupation" value={synced.occupation ?? "À compléter"} />
              <Info label="Employeur" value={synced.employer ?? "À compléter"} />
              <Info label="Statut d'emploi" value={translate(employmentStatusLabels, synced.employmentStatus, "À compléter")} />
              <Info label="Années en poste" value={synced.yearsAtJob !== null ? `${synced.yearsAtJob}` : "À compléter"} />
              <Info label="Revenu annuel" value={synced.annualIncome !== null ? formatMoney(synced.annualIncome) : "À compléter"} />
              <Info label="Fourchette de revenu" value={translate(incomeRangeLabels, synced.incomeRange, "À compléter")} />
            </ContentCard>
          </section>

          <ContentCard title="Finances, objectifs et risque" description="Base de travail pour l’analyse des besoins, la convenance et les recommandations.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Info label="Profil de risque" value={translate(riskProfileLabels, client.riskProfile, "À évaluer")} />
              <Info label="Objectif principal" value={translate(goalLabels, client.primaryGoal, "À définir")} />
              <Info label="Horizon" value={translate(horizonLabels, client.investmentHorizon, "À définir")} />
              <Info label="Valeur nette" value={client.netWorth !== null ? formatMoney(client.netWorth) : "À renseigner"} />
              <Info label="Actifs liquides" value={client.liquidAssets !== null ? formatMoney(client.liquidAssets) : "À renseigner"} />
              <Info label="Dettes" value={client.liabilities !== null ? formatMoney(client.liabilities) : "À renseigner"} />
              <Info label="Taux d'épargne" value={client.savingsRate !== null ? `${client.savingsRate} %` : "À renseigner"} />
            </div>
          </ContentCard>
        </div>

        <aside className="grid gap-6 content-start">
          <ContentCard title="À compléter" description="Actions prioritaires pour rendre le profil utilisable.">
            <ProfileCompletionList client={client} onEdit={onEdit} onKyc={onKyc} />
          </ContentCard>

          <ContentCard title="Relation" description="Informations de suivi et de segmentation.">
            <Info label="Origine du client" value={client.source ? (clientSourceLabels[client.source] ?? client.source) : "À compléter"} />
            <Info label="Référence" value={client.referredBy ?? "À compléter"} />
            <Info label="Début de la relation" value={formatDate(client.relationshipStartDate)} />
            <Info label="Dernier contact" value={formatDate(client.lastContactAt)} />
            <Info label="Statut conformité" value={client.complianceStatus ? (complianceStatusLabels[client.complianceStatus] ?? client.complianceStatus) : "À compléter"} />
            <Info label="Interactions totales" value={`${client.totalInteractions ?? 0}`} />
          </ContentCard>
        </aside>
      </section>

      {Array.isArray(client.children) && client.children.length > 0 ? (
        <ContentCard title="Enfants et personnes à charge" description="Données familiales structurées utilisées pour l’assurance vie, les objectifs d’études et la planification familiale.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {client.children.map((child, index) => {
              const age = child.dateOfBirth ? calculateAge(child.dateOfBirth.slice(0, 10)) : child.age ? `${child.age} an${child.age > 1 ? "s" : ""}` : ""
              return (
                <div key={`${child.name ?? "enfant"}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Enfant {index + 1}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{child.name || "Nom à compléter"}</p>
                  <div className="mt-3 grid gap-1 text-sm font-semibold text-slate-600">
                    <span>Genre : {translate(genderLabels, child.gender, "À compléter")}</span>
                    <span>Naissance : {child.dateOfBirth ? formatDate(child.dateOfBirth) : "À compléter"}</span>
                    <span>Âge : {age || "À compléter"}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </ContentCard>
      ) : null}
    </>
  )
}

function normalizeClientEmploymentStatus(value?: string | null) {
  if (!value) return null
  if (["EMPLOYED", "SELF_EMPLOYED", "BUSINESS_OWNER", "INCORPORATED", "UNEMPLOYED", "RETIRED", "STUDENT", "OTHER"].includes(value)) return value
  return "OTHER"
}

function getClientProfileSyncValues(client: ApiClient) {
  return {
    occupation: client.occupation ?? client.kycProfile?.occupation ?? null,
    employer: client.employer ?? client.kycProfile?.employer ?? null,
    employmentStatus: normalizeClientEmploymentStatus(client.employmentStatus ?? client.kycProfile?.employmentStatus),
    yearsAtJob: client.yearsAtJob,
    annualIncome: client.annualIncome ?? client.approximateIncome ?? client.kycProfile?.annualIncome ?? null,
    incomeRange: client.incomeRange ?? client.kycProfile?.incomeRange ?? null,
  }
}

function formatChildrenStatus(client: ApiClient) {
  if (Array.isArray(client.children) && client.children.length > 0) {
    return `${client.children.length} enfant${client.children.length > 1 ? "s" : ""}`
  }
  const dependents = client.dependentsCount ?? client.dependents
  const dependentsCount = dependents ?? 0
  if (client.hasChildren || dependentsCount > 0) return dependentsCount > 0 ? `${dependentsCount}` : "Oui"
  if (client.hasChildren === false || dependents === 0) return "Non"
  return "À compléter"
}

function formatDependentsStatus(client: ApiClient) {
  const dependents = client.dependentsCount ?? client.dependents
  if (dependents !== null && dependents !== undefined) return dependents > 0 ? `${dependents}` : "Non"
  if (Array.isArray(client.children) && client.children.length > 0) return `${client.children.length}`
  if (client.hasChildren === false) return "Non"
  return "À compléter"
}

function hasSpouseStatus(client: ApiClient) {
  return client.familyStatus === "MARRIED" || client.familyStatus === "COMMON_LAW" || Boolean(client.spouseName || client.spouseGender || client.spouseDateOfBirth)
}

function formatSpouseSummary(client: ApiClient) {
  if (!hasSpouseStatus(client)) return "Non applicable"
  const parts = [
    client.spouseName || "Nom à compléter",
    translate(genderLabels, client.spouseGender, ""),
    client.spouseDateOfBirth ? `né(e) le ${formatDate(client.spouseDateOfBirth)}` : "",
  ].filter(Boolean)
  return parts.join(" · ")
}

function hasChildrenOrDependents(client: ApiClient) {
  const dependents = client.dependentsCount ?? client.dependents
  return Boolean(client.hasChildren || (dependents ?? 0) > 0 || (Array.isArray(client.children) && client.children.length > 0))
}

function formatDependentsDetails(client: ApiClient) {
  if (client.dependentsDetails?.trim()) return client.dependentsDetails
  if (!hasChildrenOrDependents(client)) return "Non applicable"
  return "À compléter"
}

function ProfileCompletionList({ client, onEdit, onKyc }: { client: ApiClient; onEdit: () => void; onKyc: () => void }) {
  const missing = getProfileMissingItems(client, onEdit, onKyc)

  if (missing.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
        Le profil client est prêt pour la prochaine étape.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="text-sm font-black text-amber-950">{missing.length} information{missing.length > 1 ? "s" : ""} à compléter</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
          Ces éléments bloquent ou fragilisent la recommandation. Ouvrez la bonne section pour corriger.
        </p>
      </div>
      {missing.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{item.label}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
              {item.action}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function getProfileMissingItems(client: ApiClient, onEdit: () => void, onKyc: () => void) {
  const spouseExpected = hasSpouseStatus(client)
  const childrenList = Array.isArray(client.children) ? client.children : []
  const dependents = client.dependentsCount ?? client.dependents
  const hasKnownDependentsAnswer = client.hasChildren === true || client.hasChildren === false || dependents !== null && dependents !== undefined || childrenList.length > 0
  const childrenExpected = client.hasChildren === true || (dependents ?? 0) > 0 || childrenList.length > 0

  return [
    !client.preferredContactMethod ? { label: "Contact préféré", detail: "Choisir le canal et le moment idéal pour joindre le client.", action: "Modifier le profil", onClick: onEdit } : null,
    !client.dateOfBirth ? { label: "Date de naissance", detail: "Requise pour l’âge, l’admissibilité et plusieurs analyses.", action: "Modifier le profil", onClick: onEdit } : null,
    !client.familyStatus ? { label: "Situation familiale", detail: "Nécessaire pour les protections, bénéficiaires et besoins familiaux.", action: "Modifier le profil", onClick: onEdit } : null,
    spouseExpected && !client.spouseName ? { label: "Conjoint(e)", detail: "Ajouter le nom, le genre et la date de naissance du/de la conjoint(e).", action: "Modifier le profil", onClick: onEdit } : null,
    !hasKnownDependentsAnswer ? { label: "Enfants", detail: "Confirmer si le client a des enfants ou personnes à charge.", action: "Modifier le profil", onClick: onEdit } : null,
    childrenExpected && childrenList.length === 0 ? { label: "Détails des enfants", detail: "Ajouter chaque enfant avec date de naissance, âge calculé et genre.", action: "Modifier le profil", onClick: onEdit } : null,
    childrenExpected && childrenList.some((child) => !child.name || !child.dateOfBirth || !child.gender) ? { label: "Enfants incomplets", detail: "Compléter le prénom, la date de naissance et le genre pour chaque enfant.", action: "Modifier le profil", onClick: onEdit } : null,
    !client.occupation ? { label: "Occupation", detail: "Alimente l’emploi, le revenu, l’invalidité et le profil client.", action: "Modifier le profil", onClick: onEdit } : null,
    !client.primaryGoal ? { label: "Objectif principal", detail: "Permet de lier le dossier à une analyse de besoins concrète.", action: "Modifier le profil", onClick: onEdit } : null,
    !client.riskProfile || client.riskProfile === "UNKNOWN" ? { label: "Profil de risque", detail: "À compléter avant une analyse de placement ou de convenance.", action: "Ouvrir le profil / AML", onClick: onKyc } : null,
    !client.kycCompleted ? { label: "Questionnaire profil client", detail: "Compléter le profil personne physique structuré.", action: "Ouvrir le profil", onClick: onKyc } : null,
    !client.identityVerified ? { label: "Identité", detail: "Valider l’identité ou documenter la méthode de vérification.", action: "Ouvrir le profil", onClick: onKyc } : null,
    !client.consentGiven ? { label: "Consentement", detail: "Ajouter un consentement actif avant les communications sensibles.", action: "Ouvrir le profil", onClick: onKyc } : null,
  ].filter((item): item is { label: string; detail: string; action: string; onClick: () => void } => Boolean(item))
}

function ClientPipeline({ currentStage, onSelectStage }: { currentStage: string; onSelectStage: (stageId: ClientWorkspaceStageId) => void }) {
  const currentIndex = Math.max(0, clientWorkspaceStages.findIndex((stage) => stage.id === currentStage))
  const currentStageItem = clientWorkspaceStages[currentIndex] ?? clientWorkspaceStages[0]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-950">Progression du dossier</p>
            <p className="text-xs font-medium text-slate-500">
              Étape actuelle: <span className="font-semibold text-slate-800">{currentStageItem.label}</span>
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {currentStageItem.description}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
        {clientWorkspaceStages.map((stage, index) => {
          const isDone = index < currentIndex
          const isCurrent = index === currentIndex
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={[
                "flex h-9 shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                isCurrent ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_8px_20px_rgba(5,150,105,0.10)]" : isDone ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white",
              ].join(" ")}
              title={`${stage.label} - ${stage.description}`}
            >
              <span
                className={[
                  "flex size-5 items-center justify-center rounded-full text-[11px]",
                  isCurrent ? "bg-emerald-600 text-white" : isDone ? "bg-sky-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200",
                ].join(" ")}
              >
                {isDone ? <CheckCircle2 className="size-3.5" /> : index + 1}
              </span>
              <span className="whitespace-nowrap">{stage.shortLabel}</span>
            </button>
          )
        })}
        </div>
      </div>
    </section>
  )
}

function WorkspaceAction({ icon: Icon, label, onClick, compact = false }: { icon: typeof Mail; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={compact
        ? "flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-left text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        : "flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"}
    >
      <Icon className="size-4 text-emerald-700" />
      <span>{label}</span>
    </button>
  )
}

function documentRequestFromAlert(alert: ComplianceAlert): PendingDocumentRequest {
  if (alert.id === "missing-kyc") {
    return {
      type: "KYC_FORM",
      name: "Questionnaire profil client",
      description: "Document requis pour compléter le profil de connaissance client.",
    }
  }
  if (alert.id === "missing-id") {
    return {
      type: "GOVERNMENT_ID",
      name: "Pièce d’identité",
      description: "Document requis pour vérifier l’identité du client.",
    }
  }
  return {
    type: "OTHER",
    name: alert.title,
    description: alert.description,
  }
}

function FinancialProductsSection({
  products,
  summary,
  onArchive,
  onEdit,
  onReview,
}: {
  products: ApiFinancialProduct[]
  summary: ReturnType<typeof getFinancialProductSummary>
  onArchive: (productId: string) => Promise<void>
  onEdit: (product: ApiFinancialProduct) => void
  onReview: (productId: string) => Promise<void>
}) {
  return (
    <ContentCard title="Produits financiers">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ProductMetric label="Produits actifs" value={`${summary.activeProductsCount}`} />
        <ProductMetric label="Couverture totale" value={formatMoney(summary.totalInsuranceCoverage)} />
        <ProductMetric label="Valeur placements" value={formatMoney(summary.totalInvestmentValue)} />
        <ProductMetric label="Commissions estimées" value={formatMoney(summary.totalEstimatedCommission)} />
        <ProductMetric label="Renouvellements proches" value={`${summary.upcomingRenewals.length}`} />
        <ProductMetric label="Produits à réviser" value={`${summary.productsNeedingReview.length}`} />
      </div>

      <div className="mt-5 grid gap-4">
        <List items={products} empty="Aucun produit financier.">
          {(product) => (
            <FinancialProductCard
              key={product.id}
              product={product}
              onArchive={() => onArchive(product.id)}
              onEdit={() => onEdit(product)}
              onReview={() => onReview(product.id)}
            />
          )}
        </List>
      </div>
    </ContentCard>
  )
}

function ClientDocumentsSection({
  documents,
  requiredAlerts = [],
  onAdd,
  onRequest,
  onStatus,
  compact = false,
}: {
  documents: NonNullable<ApiClient["documents"]>
  requiredAlerts?: ComplianceAlert[]
  onAdd: () => void
  onRequest: (request: PendingDocumentRequest) => void
  onStatus: (documentId: string, status: string, extra?: Record<string, string>) => Promise<void>
  compact?: boolean
}) {
  const activeDocuments = documents.filter((document) => document.status !== "ARCHIVED")
  const archivedDocuments = documents.filter((document) => document.status === "ARCHIVED")
  const receivedDocuments = activeDocuments.filter((document) => ["RECEIVED", "VALIDATED"].includes(document.status)).length
  const pendingDocuments = activeDocuments.filter((document) => ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"].includes(document.status)).length
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)

  async function openDocument(documentId: string, mode: "preview" | "download") {
    setOpeningDocumentId(`${mode}:${documentId}`)
    try {
      const response = await fetch(`/api/documents/${documentId}/${mode === "download" ? "download-url" : "preview-url"}`)
      const data = await readJson<{ url: string }>(response)
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Impossible d’ouvrir ce document.")
    } finally {
      setOpeningDocumentId(null)
    }
  }

  return (
    <ContentCard title="Documents" description="Pièces disponibles, demandes en attente et preuves classées dans le dossier client.">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-3">
          <DocumentMetric label="Disponibles" value={receivedDocuments} tone="emerald" />
          <DocumentMetric label="À compléter" value={pendingDocuments} tone={pendingDocuments > 0 ? "amber" : "slate"} />
          <DocumentMetric label="Archivés" value={archivedDocuments.length} tone="slate" />
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" onClick={() => onRequest({ type: "OTHER", name: "", description: "" })}>
            <Send className="size-4" />Demander au client
          </Button>
          <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={onAdd}><FilePlus2 className="size-4" />Ajouter manuellement</Button>
        </div>
      </div>

      {requiredAlerts.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">Documents requis à compléter</p>
          <div className="mt-2 grid gap-2">
            {requiredAlerts.slice(0, compact ? 2 : 4).map((alert) => {
              const request = documentRequestFromAlert(alert)
              return (
              <div key={alert.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-100">
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-800">{alert.description}</p>
                </div>
                <Button type="button" size="sm" className="shrink-0 rounded-xl bg-amber-600 text-white hover:bg-amber-700" onClick={() => onRequest(request)}>
                  <Send className="size-3.5" />Demander
                </Button>
              </div>
            )})}
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-black text-slate-950">Documents disponibles au dossier</p>
        <p className="text-xs font-semibold text-slate-500">{activeDocuments.length} document{activeDocuments.length > 1 ? "s" : ""}</p>
      </div>

      <List items={activeDocuments} empty="Aucun document reçu. Demandez les pièces nécessaires pour compléter le dossier.">
        {(document) => (
          <div key={document.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={document.status === "VALIDATED" ? "emerald" : document.status === "REJECTED" || document.status === "EXPIRED" ? "rose" : document.status === "REQUIRED" ? "amber" : "sky"}>{translate(documentStatusLabels, document.status)}</StatusBadge>
                  <StatusBadge tone="slate">{translate(documentTypeLabels, document.type)}</StatusBadge>
                  {isSnapshotReport(document) ? <StatusBadge tone="violet">PDF preuve</StatusBadge> : null}
                </div>
                <div className="mt-3 flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <FileCheck2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{document.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{documentSummary(document)}</p>
                    {!compact ? (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                        <span>Ajout: {formatDate(document.createdAt)}</span>
                        <span>Expiration: {formatDate(document.expiresAt)}</span>
                        <span>{documentFileLabel(document)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-[25rem] lg:justify-end">
                <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50" asChild>
                  <Link href={`/documents/${document.id}`}><ExternalLink className="size-4" />Fiche</Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-sky-200 bg-white text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!document.storagePath || openingDocumentId === `preview:${document.id}`} onClick={() => void openDocument(document.id, "preview")}>
                  {openingDocumentId === `preview:${document.id}` ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}Aperçu
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!document.storagePath || openingDocumentId === `download:${document.id}`} onClick={() => void openDocument(document.id, "download")}>
                  {openingDocumentId === `download:${document.id}` ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}PDF
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-sky-200 bg-white text-sky-700 hover:bg-sky-50" onClick={() => onStatus(document.id, "RECEIVED")}>
                  <Inbox className="size-4" />Reçu
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50" onClick={() => onStatus(document.id, "VALIDATED")}>
                  <FileCheck2 className="size-4" />Valider
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50" onClick={() => {
                  const reason = window.prompt("Raison du rejet")
                  if (reason?.trim()) void onStatus(document.id, "REJECTED", { rejectedReason: reason })
                }}>
                  <XCircle className="size-4" />Rejeter
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => onStatus(document.id, "ARCHIVED")}>
                  <FileArchive className="size-4" />Archiver
                </Button>
              </div>
            </div>
          </div>
        )}
      </List>

      {!compact && archivedDocuments.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Documents archivés ({archivedDocuments.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {archivedDocuments.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                <span className="min-w-0 truncate font-medium text-slate-700">{document.name}</span>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onStatus(document.id, "RECEIVED")}>
                  Restaurer
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </ContentCard>
  )
}

function DocumentMetric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "slate" }) {
  const toneClass = tone === "emerald"
    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
    : tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-800"
      : "border-slate-100 bg-slate-50 text-slate-700"

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  )
}

function isSnapshotReport(document: NonNullable<ApiClient["documents"]>[number]) {
  const text = `${document.name} ${document.description ?? ""}`.toLowerCase()
  return document.type === "KYC_FORM" && (
    text.includes("rapport snapshot kyc") ||
    text.includes("rapport profil client") ||
    text.includes("finadvisor crm")
  )
}

function documentSummary(document: NonNullable<ApiClient["documents"]>[number]) {
  if (isSnapshotReport(document)) {
    return "Rapport PDF généré automatiquement à partir de la version figée du profil client. Le contenu complet doit être consulté dans le fichier PDF."
  }

  const description = document.description?.replace(/\s+/g, " ").trim()
  if (!description) return "Document classé dans le coffre documentaire du client."
  if (description.length <= 170) return description
  return `${description.slice(0, 167).trim()}...`
}

function documentFileLabel(document: NonNullable<ApiClient["documents"]>[number]) {
  const type = document.mimeType?.includes("pdf") ? "PDF" : document.mimeType?.split("/").pop()?.toUpperCase() ?? "Fichier"
  const size = typeof document.fileSize === "number" && document.fileSize > 0 ? ` · ${formatFileSize(document.fileSize)}` : ""
  if (document.storagePath || document.fileUrl || document.url) return `${type}${size}`
  return "Aucun fichier attaché"
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function ClientTasksSection({
  tasks,
  onAdd,
  onComplete,
  onReopen,
  onCancel,
  compact = false,
}: {
  tasks: NonNullable<ApiClient["tasks"]>
  onAdd: () => void
  onComplete: (taskId: string) => Promise<void>
  onReopen: (taskId: string) => Promise<void>
  onCancel: (taskId: string) => Promise<void>
  compact?: boolean
}) {
  const orderedTasks = [...tasks].sort((a, b) => Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)))

  return (
    <ContentCard title="Tâches">
      <div className="mb-4 flex justify-end">
        <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={onAdd}><ClipboardList className="size-4" />Créer une tâche</Button>
      </div>
      <List items={orderedTasks} empty="Aucune tâche ouverte. Créez un suivi si une action est attendue.">
        {(task) => {
          const overdue = isTaskOverdue(task)
          return (
          <div key={task.id} className={overdue ? "rounded-2xl border border-rose-100 bg-rose-50 p-4" : "rounded-2xl border border-slate-100 bg-slate-50 p-4"}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={task.status === "DONE" ? "emerald" : overdue || task.status === "OVERDUE" || task.priority === "URGENT" ? "rose" : task.priority === "HIGH" ? "amber" : "sky"}>{overdue ? "En retard" : translate(taskStatusLabels, task.status)}</StatusBadge>
                  <StatusBadge tone="slate">{translate(priorityLabels, task.priority)}</StatusBadge>
                </div>
                <p className="mt-3 font-semibold text-slate-950">{task.title}</p>
                {!compact ? <p className="mt-1 text-sm text-slate-600">{task.description ?? "Sans description."}</p> : null}
                <p className={overdue ? "mt-1 text-xs font-semibold text-rose-700" : "mt-1 text-xs text-slate-500"}>
                  {overdue ? `En retard depuis le ${formatDate(task.dueDate)}` : `Échéance: ${formatDate(task.dueDate)}`} · Assignée à: {task.assignedTo?.name ?? "À assigner"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.status === "DONE" ? (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onReopen(task.id)}><RotateCcw className="size-4" />Réouvrir</Button>
                ) : (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onComplete(task.id)}><CheckCircle2 className="size-4" />Terminer</Button>
                )}
                <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => onCancel(task.id)}><XCircle className="size-4" />Annuler</Button>
              </div>
            </div>
          </div>
        )}}
      </List>
    </ContentCard>
  )
}

function FinancialProductCard({
  product,
  onArchive,
  onEdit,
  onReview,
}: {
  product: ApiFinancialProduct
  onArchive: () => Promise<void>
  onEdit: () => void
  onReview: () => Promise<void>
}) {
  const alerts = getProductAlerts(product)
  const linkedAnalysis = product.insuranceNeedsAnalyses?.[0] ?? null
  const analysisBadge = insuranceAnalysisBadge(linkedAnalysis?.status)
  const analysisHref = linkedAnalysis
    ? `/clients/${product.clientId}?tab=needs&analysisId=${linkedAnalysis.id}`
    : `/clients/${product.clientId}?tab=needs&opportunityId=${product.id}`
  const mainAmount =
    product.category === "INVESTMENT"
      ? `Valeur ${formatMoney(product.accountValue)}`
      : `Prime ${formatMoney(product.premium)}`
  const contractNumber = product.policyNumber ?? product.contractNumber ?? product.accountNumber

  return (
    <details className="group rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={product.category === "INSURANCE" ? "emerald" : product.category === "INVESTMENT" ? "sky" : "slate"}>
              {translate(financialProductCategoryLabels, product.category)}
            </StatusBadge>
            <StatusBadge tone={product.status === "ACTIVE" ? "emerald" : product.status === "UNDER_REVIEW" ? "amber" : product.status === "ARCHIVED" ? "slate" : "violet"}>
              {translate(financialProductStatusLabels, product.status)}
            </StatusBadge>
            {product.category === "INSURANCE" ? (
              <StatusBadge tone={analysisBadge.tone}>{analysisBadge.label}</StatusBadge>
            ) : null}
          </div>
          <div>
            <p className="truncate font-semibold text-slate-950">
              {translate(financialProductTypeLabels, product.type)}
              {product.productName ? ` - ${product.productName}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {product.company ?? "Compagnie non définie"} - {contractNumber ?? "Numéro de contrat absent"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <span key={alert} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {alert}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-1 text-sm text-slate-600 sm:min-w-48 sm:text-right">
          <span>{mainAmount}</span>
          <span>Renouvellement: {formatDate(product.renewalAt)}</span>
          <span>Révision: {formatDate(product.nextReviewAt)}</span>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2">
        <div className="space-y-2 text-sm text-slate-700">
          <p><strong>Couverture:</strong> {formatMoney(product.coverageAmount)}</p>
          <p><strong>Valeur actuelle:</strong> {formatMoney(product.accountValue)}</p>
          <p><strong>Contribution:</strong> {formatMoney(product.contributionAmount)} {translate(paymentFrequencyLabels, product.contributionFrequency, "")}</p>
          <p><strong>Commission:</strong> {formatMoney(product.commissionAmount)} {translate(commissionTypeLabels, product.commissionType, "")}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <p><strong>Bénéficiaire principal:</strong> {product.primaryBeneficiary ?? "À compléter"}</p>
          <p><strong>Bénéficiaire subsidiaire:</strong> {product.contingentBeneficiary ?? "À compléter"}</p>
          <p><strong>Document:</strong> {product.documentStatus ?? "À compléter"}</p>
          <p>
            <strong>Analyse des besoins:</strong>{" "}
            <Link href={analysisHref} className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
              {analysisBadge.shortLabel}
            </Link>
          </p>
          <p><strong>Notes:</strong> {product.notes ?? "Aucune note"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-2xl" onClick={onEdit}>
          Modifier
        </Button>
        <Button type="button" variant="outline" className="rounded-2xl" onClick={onReview}>
          Marquer comme révisé
        </Button>
        {product.category === "INSURANCE" ? (
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href={analysisHref}>
              <ClipboardCheck className="size-4" />
              {linkedAnalysis ? "Ouvrir l’analyse" : "Créer analyse liée"}
            </Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="rounded-2xl" onClick={onArchive}>
          Archiver
        </Button>
      </div>
    </details>
  )
}

function insuranceAnalysisBadge(status?: string | null) {
  if (!status) return { label: "Analyse des besoins : Non liée", shortLabel: "Non liée", tone: "amber" as const }
  if (status === "MISSING_DATA") return { label: "Analyse des besoins : Données manquantes", shortLabel: "Données manquantes", tone: "rose" as const }
  if (status === "ADVISOR_REVIEW") return { label: "Analyse des besoins : En révision conseiller", shortLabel: "En révision conseiller", tone: "amber" as const }
  if (status === "WAITING_CLIENT") return { label: "Analyse des besoins : En attente client", shortLabel: "En attente client", tone: "amber" as const }
  if (status === "DELIVERED") return { label: "Analyse des besoins : Remise au client", shortLabel: "Remise au client", tone: "emerald" as const }
  if (status === "USED_FOR_SUBMISSION") return { label: "Analyse des besoins : Utilisée pour soumission", shortLabel: "Utilisée pour soumission", tone: "violet" as const }
  if (status === "RECOMMENDATION_PREPARED" || status === "COMPLETED") return { label: "Analyse des besoins : Prête", shortLabel: "Prête", tone: "emerald" as const }
  return { label: "Analyse des besoins : À compléter", shortLabel: "À compléter", tone: "amber" as const }
}

function ProductMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function ProductEditModal({
  product,
  isSaving,
  onClose,
  onSave,
}: {
  product: ApiFinancialProduct
  isSaving: boolean
  onClose: () => void
  onSave: (payload: Record<string, string>) => Promise<void>
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = Object.fromEntries(Array.from(new FormData(event.currentTarget).entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>
    await onSave(payload)
  }

  return (
    <Modal title="Modifier le produit financier" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <FinancialProductFields product={product} />
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Enregistrer" />
      </form>
    </Modal>
  )
}

function ClientEditModal({ client, isSaving, onClose, onSave }: { client: ApiClient; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string>) => Promise<void> }) {
  const synced = getClientProfileSyncValues(client)
  const savedChildren = normalizeClientChildren(client.children)
  const initialChildrenCount = Math.max(savedChildren.length, client.dependentsCount ?? client.dependents ?? 0, client.hasChildren ? 1 : 0)
  const [hasSpouse, setHasSpouse] = useState(Boolean(client.spouseName || client.spouseGender || client.spouseDateOfBirth || client.familyStatus === "MARRIED" || client.familyStatus === "COMMON_LAW"))
  const [hasChildren, setHasChildren] = useState(initialChildrenCount > 0)
  const [children, setChildren] = useState<ChildDraft[]>(() => {
    if (savedChildren.length > 0) return savedChildren
    const count = initialChildrenCount > 0 ? initialChildrenCount : 1
    return Array.from({ length: count }, (_, index) => ({ id: `${Date.now()}-${index}`, name: "", dateOfBirth: "", gender: "" }))
  })
  const relationReadiness = [
    {
      label: "Origine du client",
      done: Boolean(client.source),
      detail: client.source ? (clientSourceLabels[client.source] ?? client.source) : "Source à documenter",
    },
    {
      label: "Relation active",
      done: Boolean(client.relationshipStartDate),
      detail: client.relationshipStartDate ? `Début ${formatDate(client.relationshipStartDate)}` : "Date de début manquante",
    },
    {
      label: "Suivi récent",
      done: Boolean(client.lastContactAt),
      detail: client.lastContactAt ? `Dernier contact ${formatDate(client.lastContactAt)}` : "Aucun dernier contact inscrit",
    },
    {
      label: "Révision planifiée",
      done: Boolean(client.nextReviewDate),
      detail: client.nextReviewDate ? `Prochaine révision ${formatDate(client.nextReviewDate)}` : "Date de revue à planifier",
    },
    {
      label: "Profil client",
      done: client.kycCompleted,
      detail: client.kycCompleted ? `Complété${client.kycDate ? ` le ${formatDate(client.kycDate)}` : ""}` : "profil client à compléter",
    },
    {
      label: "Identité et consentement",
      done: client.identityVerified && client.consentGiven,
      detail: `${client.identityVerified ? "Identité vérifiée" : "Identité non vérifiée"} · ${client.consentGiven ? "Consentement actif" : "Consentement manquant"}`,
    },
  ]
  const relationReadyCount = relationReadiness.filter((item) => item.done).length

  function updateChild(id: string, field: keyof ChildDraft, value: string) {
    setChildren((current) => current.map((child) => child.id === id ? { ...child, [field]: value } : child))
  }

  function addChild() {
    setHasChildren(true)
    setChildren((current) => [...current, { id: `${Date.now()}-${current.length}`, name: "", dateOfBirth: "", gender: "" }])
  }

  function removeChild(id: string) {
    setChildren((current) => {
      const next = current.filter((child) => child.id !== id)
      if (next.length === 0) {
        setHasChildren(false)
        return [{ id: `${Date.now()}-0`, name: "", dateOfBirth: "", gender: "" }]
      }
      return next
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>
    payload.phonePrimary = digitsOnly(payload.phonePrimary)
    payload.phoneSecondary = digitsOnly(payload.phoneSecondary)
    payload.emailPrimary = normalizeEmail(payload.emailPrimary)
    payload.emailSecondary = normalizeEmail(payload.emailSecondary)
    payload.email = normalizeEmail(payload.email)
    payload.hasChildren = hasChildren ? "true" : "false"

    if (!hasSpouse) {
      payload.spouseName = ""
      payload.spouseGender = ""
      payload.spouseDateOfBirth = ""
    }

    const childRows = hasChildren
      ? children
          .map((child) => {
            const dateOfBirth = String(formData.get(`childDateOfBirth_${child.id}`) ?? "").trim()
            const age = calculateAge(dateOfBirth).replace(/\D/g, "")
            return {
              name: String(formData.get(`childName_${child.id}`) ?? "").trim(),
              dateOfBirth,
              gender: String(formData.get(`childGender_${child.id}`) ?? "").trim(),
              age: age ? Number(age) : undefined,
            }
          })
          .filter((child) => child.name || child.dateOfBirth || child.gender)
      : []

    payload.children = JSON.stringify(childRows)
    payload.dependentsCount = hasChildren ? String(Math.max(childRows.length, Number(payload.dependentsCount || 0), 1)) : "0"
    payload.dependents = payload.dependentsCount
    const childrenDetails = childRows.length > 0
      ? `Enfants:\n${childRows.map((child, index) => {
          const age = child.dateOfBirth ? calculateAge(child.dateOfBirth) : ""
          return `${index + 1}. ${child.name || "Nom à compléter"}${child.gender ? ` | genre: ${child.gender}` : ""}${child.dateOfBirth ? ` | naissance: ${child.dateOfBirth}` : ""}${age ? ` | âge: ${age}` : ""}`
        }).join("\n")}`
      : undefined
    payload.dependentsDetails = compactLines([String(formData.get("familyNotes") ?? ""), childrenDetails])
    await onSave(payload)
  }

  return (
    <Modal title={`Modifier ${client.firstName} ${client.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <SectionTitle>Identité</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><Field name="firstName" label="Prénom" required defaultValue={client.firstName} /><Field name="lastName" label="Nom" required defaultValue={client.lastName} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field name="clientNumber" label="No client interne" defaultValue={client.clientNumber ?? ""} /><SelectField name="gender" label="Genre" defaultValue={client.gender ?? ""} options={genderOptions} /></div>
        <Field name="dateOfBirth" label="Date de naissance" type="date" defaultValue={client.dateOfBirth?.slice(0, 10) ?? ""} />

        <SectionTitle>Coordonnées</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><PhoneField name="phonePrimary" label="Téléphone principal" required defaultValue={client.phonePrimary ?? client.phone} /><PhoneField name="phoneSecondary" label="Téléphone secondaire (optionnel)" defaultValue={client.phoneSecondary ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><EmailField name="emailPrimary" label="Courriel principal" defaultValue={client.emailPrimary ?? client.email ?? ""} /><EmailField name="emailSecondary" label="Courriel secondaire (optionnel)" defaultValue={client.emailSecondary ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="preferredContactMethod" label="Contact préféré" defaultValue={client.preferredContactMethod ?? ""} options={[{ value: "", label: "À compléter" }, { value: "PHONE", label: "Téléphone" }, { value: "EMAIL", label: "Courriel" }, { value: "SMS", label: "SMS" }]} /><SelectField name="preferredContactTime" label="Moment préféré" defaultValue={client.preferredContactTime ?? ""} options={[{ value: "", label: "À compléter" }, { value: "MORNING", label: "Matin" }, { value: "AFTERNOON", label: "Après-midi" }, { value: "EVENING", label: "Soir" }]} /></div>

        <SectionTitle>Adresse</SectionTitle>
        <Field name="addressLine1" label="Adresse ligne 1" defaultValue={client.addressLine1 ?? client.address ?? ""} />
        <Field name="addressLine2" label="Adresse ligne 2" defaultValue={client.addressLine2 ?? ""} />
        <div className="grid gap-4 sm:grid-cols-4"><Field name="city" label="Ville" defaultValue={client.city ?? ""} /><SelectField name="province" label="Province" defaultValue={client.province ?? ""} options={provinceOptions} /><Field name="postalCode" label="Code postal" defaultValue={client.postalCode ?? ""} /><SelectField name="country" label="Pays" defaultValue={client.country ?? "Canada"} options={countryOptions} /></div>

        <SectionTitle>Situation familiale et professionnelle</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="familyStatus" label="Situation familiale" defaultValue={client.familyStatus ?? ""} options={[{ value: "", label: "À compléter" }, { value: "SINGLE", label: "Célibataire" }, { value: "MARRIED", label: "Marié(e)" }, { value: "COMMON_LAW", label: "Conjoint(e) de fait" }, { value: "DIVORCED", label: "Divorcé(e)" }, { value: "WIDOWED", label: "Veuf/veuve" }, { value: "OTHER", label: "Autre" }]} /><Field name="dependentsCount" label="Personnes à charge" type="number" defaultValue={client.dependentsCount?.toString() ?? client.dependents?.toString() ?? ""} /></div>
        <div className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Conjoint(e)
              <select value={hasSpouse ? "true" : "false"} onChange={(event) => setHasSpouse(event.target.value === "true")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Enfants
              <select value={hasChildren ? "true" : "false"} onChange={(event) => setHasChildren(event.target.value === "true")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </label>
          </div>

          {hasSpouse ? (
            <div className="grid gap-4 rounded-2xl border border-white bg-white p-4 shadow-sm sm:grid-cols-3">
              <Field name="spouseName" label="Nom du/de la conjoint(e)" defaultValue={client.spouseName ?? ""} />
              <SelectField name="spouseGender" label="Genre du/de la conjoint(e)" defaultValue={client.spouseGender ?? ""} options={genderOptions} />
              <Field name="spouseDateOfBirth" label="Date de naissance du/de la conjoint(e)" type="date" defaultValue={client.spouseDateOfBirth?.slice(0, 10) ?? ""} />
            </div>
          ) : (
            <>
              <input type="hidden" name="spouseName" value="" />
              <input type="hidden" name="spouseGender" value="" />
              <input type="hidden" name="spouseDateOfBirth" value="" />
            </>
          )}

          {hasChildren ? (
            <div className="grid gap-3">
              {children.map((child, index) => {
                const age = calculateAge(child.dateOfBirth)
                return (
                  <div key={child.id} className="grid gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                    <Field name={`childName_${child.id}`} label={`Enfant ${index + 1} - prénom`} defaultValue={child.name} />
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Date de naissance
                      <Input name={`childDateOfBirth_${child.id}`} type="date" value={child.dateOfBirth} onChange={(event) => updateChild(child.id, "dateOfBirth", event.target.value)} className="h-11 rounded-2xl" />
                      <span className="text-xs font-semibold text-slate-500">{age ? `Âge calculé : ${age}` : "L’âge se calcule automatiquement."}</span>
                    </label>
                    <SelectField name={`childGender_${child.id}`} label="Genre" defaultValue={child.gender} options={genderOptions} />
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="h-11 rounded-2xl text-rose-700 hover:border-rose-200 hover:bg-rose-50" onClick={() => removeChild(child.id)}>
                        Retirer
                      </Button>
                    </div>
                  </div>
                )
              })}
              <div>
                <Button type="button" variant="outline" className="rounded-full" onClick={addChild}>Ajouter un enfant</Button>
              </div>
            </div>
          ) : null}

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Notes familiales complémentaires
            <textarea name="familyNotes" defaultValue={client.dependentsDetails ?? ""} rows={3} className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3"><Field name="occupation" label="Occupation" defaultValue={synced.occupation ?? ""} /><Field name="employer" label="Employeur" defaultValue={synced.employer ?? ""} /><SelectField name="employmentStatus" label="Statut d'emploi" defaultValue={synced.employmentStatus ?? ""} options={[{ value: "", label: "À compléter" }, { value: "EMPLOYED", label: "Employé(e)" }, { value: "SELF_EMPLOYED", label: "Travailleur autonome" }, { value: "BUSINESS_OWNER", label: "Entrepreneur / propriétaire" }, { value: "INCORPORATED", label: "Incorporé(e)" }, { value: "UNEMPLOYED", label: "Sans emploi" }, { value: "RETIRED", label: "Retraité(e)" }, { value: "STUDENT", label: "Étudiant(e)" }, { value: "OTHER", label: "Autre" }]} /></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field name="yearsAtJob" label="Années en poste" type="number" defaultValue={synced.yearsAtJob?.toString() ?? ""} /><Field name="annualIncome" label="Revenu annuel" type="number" defaultValue={synced.annualIncome?.toString() ?? ""} /><SelectField name="incomeRange" label="Fourchette de revenu" defaultValue={synced.incomeRange ?? ""} options={[{ value: "", label: "À compléter" }, { value: "0-49999", label: "Moins de 50 000 $" }, { value: "50000-99999", label: "50 000 $ à 99 999 $" }, { value: "100000-149999", label: "100 000 $ à 149 999 $" }, { value: "150000-249999", label: "150 000 $ à 249 999 $" }, { value: "250000+", label: "250 000 $ et plus" }]} /></div>

        <SectionTitle>Profil financier et objectifs</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3"><SelectField name="profileType" label="Type de dossier" defaultValue={client.profileType ?? "INDIVIDUAL"} options={[{ value: "INDIVIDUAL", label: "Personne physique" }, { value: "BUSINESS", label: "Entreprise / société" }, { value: "TRUST", label: "Fiducie" }, { value: "ESTATE", label: "Succession" }, { value: "HOUSEHOLD", label: "Ménage / famille" }, { value: "NON_PROFIT", label: "OBNL / association" }, { value: "OTHER", label: "Autre" }]} /><SelectField name="status" label="Statut client" defaultValue={client.status} options={[{ value: "ACTIVE", label: "Actif" }, { value: "REVIEW_NEEDED", label: "Révision requise" }, { value: "INACTIVE", label: "Inactif" }, { value: "PROSPECT_CONVERTED", label: "Prospect converti" }, { value: "ARCHIVED", label: "Archivé" }]} /><SelectField name="riskProfile" label="Profil de risque" defaultValue={client.riskProfile ?? "UNKNOWN"} options={[{ value: "UNKNOWN", label: "Inconnu" }, { value: "CONSERVATIVE", label: "Conservateur" }, { value: "MODERATE", label: "Modéré" }, { value: "BALANCED", label: "Équilibré" }, { value: "GROWTH", label: "Croissance" }, { value: "AGGRESSIVE", label: "Audacieux" }]} /></div>
        <div className="grid gap-4 sm:grid-cols-4"><Field name="netWorth" label="Valeur nette" type="number" defaultValue={client.netWorth?.toString() ?? ""} /><Field name="liquidAssets" label="Actifs liquides" type="number" defaultValue={client.liquidAssets?.toString() ?? ""} /><Field name="liabilities" label="Dettes" type="number" defaultValue={client.liabilities?.toString() ?? ""} /><Field name="savingsRate" label="Taux d'épargne %" type="number" defaultValue={client.savingsRate?.toString() ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="primaryGoal" label="Objectif financier principal" defaultValue={client.primaryGoal ?? ""} options={financialGoalOptions} /><SelectField name="investmentHorizon" label="Horizon" defaultValue={client.investmentHorizon ?? ""} options={[{ value: "", label: "À compléter" }, { value: "SHORT_TERM", label: "Court terme" }, { value: "MEDIUM_TERM", label: "Moyen terme" }, { value: "LONG_TERM", label: "Long terme" }]} /></div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Détails sur les objectifs financiers<textarea name="financialGoals" defaultValue={client.financialGoals ?? client.goals ?? ""} rows={4} className="min-h-28 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Montants cibles, priorités, échéances, besoin de protection ou notes du conseiller." /></label>

        <SectionTitle>Relation et conformité</SectionTitle>
        <div className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-950">Préparation relation et conformité</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Cette section pilote la source du dossier, les dates de suivi, le statut profil client, la vérification d’identité et le consentement.
              </p>
            </div>
            <StatusBadge tone={relationReadyCount === relationReadiness.length ? "emerald" : relationReadyCount >= 4 ? "amber" : "rose"}>
              {relationReadyCount}/{relationReadiness.length} prêts
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {relationReadiness.map((item) => (
              <ComplianceMiniCheck key={item.label} label={item.label} detail={item.detail} done={item.done} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField name="source" label="Origine du client" defaultValue={client.source ?? ""} options={clientSourceOptions} />
          <Field name="referredBy" label="Référence / provenance précise" defaultValue={client.referredBy ?? ""} placeholder="Nom du référent, campagne, événement ou note interne" />
          <Field name="relationshipStartDate" label="Début de la relation" type="date" defaultValue={client.relationshipStartDate?.slice(0, 10) ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="lastContactAt" label="Dernier contact documenté" type="date" defaultValue={client.lastContactAt?.slice(0, 10) ?? ""} />
          <Field name="nextReviewDate" label="Prochaine révision prévue" type="date" defaultValue={client.nextReviewDate?.slice(0, 10) ?? ""} />
          <Field name="kycDate" label="Date de confirmation du profil" type="date" defaultValue={client.kycDate?.slice(0, 10) ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <SelectField name="kycCompleted" label="Profil client complété" defaultValue={client.kycCompleted ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="identityVerified" label="Identité vérifiée" defaultValue={client.identityVerified ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="consentGiven" label="Consentement actif" defaultValue={client.consentGiven ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="complianceStatus" label="Statut de conformité" defaultValue={client.complianceStatus ?? ""} options={complianceStatusOptions} />
        </div>

        <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Règle opérationnelle</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Une recommandation devrait être basée sur un Profil client complété, une identité vérifiée lorsque requise, un consentement actif et une prochaine révision planifiée.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Notes internes<textarea name="notes" defaultValue={client.notes ?? ""} rows={4} className="min-h-28 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Enregistrer" />
      </form>
    </Modal>
  )
}

function ActionModal({ type, clientId, isSaving, onClose, onSave }: { type: WorkspaceModalType; clientId: string; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string> | FormData) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (type === "document") {
      const formData = new FormData(event.currentTarget)
      const file = formData.get("file")
      if (file instanceof File && file.size > 0) {
        await onSave(formData)
        return
      }
      formData.delete("file")
      const data = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>
      await onSave(data)
      return
    }
    const data = Object.fromEntries(Array.from(new FormData(event.currentTarget).entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>
    await onSave(data)
  }
  const title =
    type === "product" ? "Ajouter un produit"
    : type === "document" ? "Ajouter un document au dossier"
    : type === "activity" ? "Planifier une activité"
    : type === "email" ? "Préparer un email"
    : type === "portalMessage" ? "Message au portail client"
    : type === "task" ? "Créer une tâche"
    : "Ajouter une note"
  const submitLabel =
    type === "document" ? "Enregistrer le document"
    : type === "activity" ? "Planifier"
    : type === "email" ? "Créer dans la timeline"
    : type === "portalMessage" ? "Envoyer au portail"
    : "Ajouter"

  return <Modal title={title} onClose={onClose}><form onSubmit={submit} className="grid gap-6">{type === "note" ? <><Field name="title" label="Titre" /><TextArea name="content" label="Note" required /></> : null}{type === "portalMessage" ? <><Field name="title" label="Sujet" required defaultValue="Réponse de votre conseiller" /><TextArea name="description" label="Message visible dans l’espace client" required /></> : null}{type === "email" ? <><Field name="title" label="Objet" required defaultValue="Suivi administratif" /><TextArea name="description" label="Message ou résumé" required defaultValue="Email administratif préparé depuis le dossier client." /></> : null}{type === "task" ? <><Field name="title" label="Titre" required /><Field name="description" label="Description" /><Field name="dueDate" label="Échéance" type="date" /><input type="hidden" name="priority" value="NORMAL" /></> : null}{type === "activity" ? <><SelectField name="taskType" label="Type d’activité" defaultValue="CALL" options={[{ value: "FOLLOW_UP", label: "To-Do" }, { value: "EMAIL", label: "Email" }, { value: "CALL", label: "Appel" }, { value: "MEETING", label: "Réunion" }, { value: "DOCUMENT", label: "Document" }]} /><Field name="title" label="Résumé" required /><Field name="dueDate" label="Date prévue" type="date" required /><SelectField name="priority" label="Priorité" defaultValue="NORMAL" options={[{ value: "LOW", label: "Basse" }, { value: "NORMAL", label: "Normale" }, { value: "HIGH", label: "Haute" }, { value: "URGENT", label: "Urgente" }]} /><TextArea name="description" label="Notes" /></> : null}{type === "document" ? <DocumentFields clientId={clientId} /> : null}{type === "product" ? <FinancialProductFields /> : null}<ModalActions isSaving={isSaving} onClose={onClose} submitLabel={submitLabel} /></form></Modal>
}

function RequestDocumentModal({
  request,
  client,
  isSaving,
  onClose,
  onSave,
}: {
  request: PendingDocumentRequest
  client: ApiClient
  isSaving: boolean
  onClose: () => void
  onSave: (payload: Record<string, string>) => Promise<void>
}) {
  const defaultDueDate = new Date()
  defaultDueDate.setDate(defaultDueDate.getDate() + 7)
  const dateValue = defaultDueDate.toISOString().slice(0, 10)
  const matchingOption = documentRequestOptions.find((option) =>
    request.name &&
    option.type === request.type &&
    option.name.toLowerCase() === request.name.toLowerCase()
  )
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() => matchingOption?.id ? [matchingOption.id] : [])
  const [customDocuments, setCustomDocuments] = useState<DocumentRequestItem[]>(() => request.name && !matchingOption ? [{ ...request, id: "initial-custom-document" }] : [])
  const [customName, setCustomName] = useState("")
  const [customType, setCustomType] = useState("OTHER")
  const [customDescription, setCustomDescription] = useState("")
  const [dueDate, setDueDate] = useState(dateValue)
  const clientEmail = client.emailPrimary ?? client.email ?? client.emailSecondary ?? ""
  const clientPhone = client.phonePrimary ?? client.phone ?? client.phoneSecondary ?? ""
  const clientHasEmail = Boolean(clientEmail)
  const clientHasPhone = Boolean(clientPhone)
  const [channel, setChannel] = useState(clientHasEmail ? "EMAIL" : client.preferredContactMethod === "SMS" ? "SMS" : "AUTO")
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const selectedDocuments = useMemo(() => {
    const selectedStandard = documentRequestOptions.filter((option) => option.id && selectedOptionIds.includes(option.id))
    return [...selectedStandard, ...customDocuments]
  }, [customDocuments, selectedOptionIds])
  const generatedMessage = useMemo(() => {
    const names = selectedDocuments.map((document) => document.name).filter(Boolean)
    const formattedDueDate = dueDate
      ? new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${dueDate}T00:00:00`))
      : ""
    const deadline = formattedDueDate ? ` avant le ${formattedDueDate}` : ""
    const list = names.length > 0 ? names.map((name) => `- ${name}`).join("\n") : "- Document à préciser"
    return `Bonjour ${client.firstName}, pourriez-vous nous transmettre les documents suivants${deadline}?\n${list}\nMerci, ${client.advisor?.name ?? "votre conseiller"}.`
  }, [client.advisor?.name, client.firstName, dueDate, selectedDocuments])
  const message = customMessage ?? generatedMessage

  function toggleDocument(optionId: string) {
    setLocalError(null)
    setSelectedOptionIds((current) =>
      current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
    )
  }

  function addCustomDocument() {
    const name = customName.trim()
    if (!name) {
      setLocalError("Inscrivez le nom du document à ajouter.")
      return
    }
    setCustomDocuments((current) => [
      ...current,
      {
        id: `custom-${current.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: customType,
        name,
        description: customDescription.trim() || undefined,
      },
    ])
    setCustomName("")
    setCustomType("OTHER")
    setCustomDescription("")
    setLocalError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedDocuments.length === 0) {
      setLocalError("Sélectionnez au moins un document ou ajoutez un document personnalisé.")
      return
    }
    await onSave({
      documents: JSON.stringify(selectedDocuments.map((document) => ({
        documentId: document.documentId ?? "",
        type: document.type,
        name: document.name,
        description: document.description ?? "",
      }))),
      channel,
      dueDate,
      message,
    })
  }

  return (
    <Modal title="Demander des documents au client" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <div className="grid gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sky-700 shadow-sm">
              <Send className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-sky-950">Demande administrative au client</p>
              <p className="mt-1">Cochez les documents requis ou ajoutez un document personnalisé. Une demande sera envoyée et une tâche de suivi sera créée automatiquement.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white/75 px-3 py-2 ring-1 ring-sky-100">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-500">Client</p>
              <p className="mt-1 font-semibold text-sky-950">{client.firstName} {client.lastName}</p>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-2 ring-1 ring-sky-100">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-500">Courriel</p>
              <p className="mt-1 truncate font-semibold text-sky-950">{clientEmail || "Non disponible"}</p>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-2 ring-1 ring-sky-100">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-500">Téléphone</p>
              <p className="mt-1 truncate font-semibold text-sky-950">{clientPhone || "Non disponible"}</p>
            </div>
          </div>
        </div>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Documents à demander</p>
              <p className="mt-1 text-xs text-slate-500">{selectedDocuments.length} document{selectedDocuments.length > 1 ? "s" : ""} sélectionné{selectedDocuments.length > 1 ? "s" : ""}</p>
            </div>
            <StatusBadge tone={selectedDocuments.length > 0 ? "emerald" : "amber"}>
              {selectedDocuments.length > 0 ? "Prêt" : "À cocher"}
            </StatusBadge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {documentRequestOptions.map((option) => {
              const optionId = option.id ?? option.name
              const checked = selectedOptionIds.includes(optionId)
              return (
                <label key={optionId} className={checked ? "flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 ring-1 ring-emerald-100" : "flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200 hover:bg-emerald-50/40"}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDocument(optionId)}
                    className="mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{option.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {selectedDocuments.length > 0 ? (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              {selectedDocuments.map((document) => (
                <span key={`${document.id ?? document.type}-${document.name}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                  {document.name}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-emerald-700" />
            <p className="text-sm font-semibold text-slate-950">Ajouter un document qui n’est pas dans la liste</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Nom du document
              <Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Ex. Attestation employeur" className="h-11 rounded-2xl bg-white" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Type
              <select value={customType} onChange={(event) => setCustomType(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {documentTypeOptions.map((option) => (
                  <option key={`request-custom-${option.value}`} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Description interne optionnelle
              <Input value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} placeholder="Précision visible dans le dossier CRM" className="h-11 rounded-2xl bg-white" />
            </label>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50" onClick={addCustomDocument}>
              <Plus className="size-4" />Ajouter
            </Button>
          </div>
          {customDocuments.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {customDocuments.map((document) => (
                <div key={document.id ?? document.name} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span className="min-w-0 truncate font-medium text-slate-800">{document.name}</span>
                  <Button type="button" size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setCustomDocuments((current) => current.filter((item) => item.id !== document.id))}>
                    <Trash2 className="size-3.5" />Retirer
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {localError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{localError}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Canal d’envoi
            <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="AUTO">Automatique</option>
              <option value="SMS">SMS Twilio{clientHasPhone ? "" : " - téléphone manquant"}</option>
              <option value="EMAIL">Courriel{clientHasEmail ? "" : " - courriel manquant"}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Date souhaitée de réception
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 rounded-2xl" />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Message envoyé au client
          <textarea
            required
            value={message}
            onChange={(event) => {
              setCustomMessage(event.target.value)
            }}
            rows={6}
            className="min-h-40 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
        <div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <MessageSquareText className="size-4 text-emerald-700" />
            Sécurité du message
          </div>
          <p>Aucun conseil financier, montant de couverture ou recommandation produit ne sera accepté dans ce message.</p>
        </div>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel={selectedDocuments.length > 1 ? "Envoyer les demandes" : "Envoyer la demande"} />
      </form>
    </Modal>
  )
}

function FinancialProductFields({ product }: { product?: ApiFinancialProduct }) {
  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        <p className="font-semibold text-emerald-950">Ajouter un produit au portefeuille</p>
        <p className="mt-1">
          Utilisez <strong>Actif</strong> pour une police ou un compte déjà en vigueur. Utilisez <strong>En attente</strong> ou <strong>Proposition en préparation</strong> seulement pour une nouvelle recommandation; ces statuts peuvent déclencher les blocages KYC/conformité.
        </p>
      </div>
      <SectionTitle>Identification du produit</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="category" label="Catégorie" defaultValue={product?.category ?? "INSURANCE"} options={[{ value: "INSURANCE", label: "Assurance" }, { value: "INVESTMENT", label: "Placement" }, { value: "OTHER", label: "Autre" }]} />
        <SelectField name="type" label="Type de produit" defaultValue={product?.type ?? "LIFE_INSURANCE"} options={[
          { value: "LIFE_INSURANCE", label: "Assurance vie" },
          { value: "DISABILITY_INSURANCE", label: "Assurance invalidité" },
          { value: "CRITICAL_ILLNESS", label: "Maladie grave" },
          { value: "HEALTH_INSURANCE", label: "Assurance santé" },
          { value: "GROUP_INSURANCE", label: "Assurance collective" },
          { value: "LONG_TERM_CARE", label: "Soins longue durée" },
          { value: "TRAVEL_INSURANCE", label: "Assurance voyage" },
          { value: "OTHER_INSURANCE", label: "Autre assurance" },
          { value: "RRSP", label: "REER" },
          { value: "TFSA", label: "CELI" },
          { value: "RESP", label: "REEE" },
          { value: "FHSA", label: "CELIAPP" },
          { value: "NON_REGISTERED", label: "Compte non enregistré" },
          { value: "INVESTMENT", label: "Placement" },
          { value: "MUTUAL_FUND", label: "Fonds commun" },
          { value: "SEGREGATED_FUND", label: "Fonds distinct" },
          { value: "GIC", label: "CPG" },
          { value: "ANNUITY", label: "Rente" },
          { value: "OTHER_INVESTMENT", label: "Autre placement" },
          { value: "OTHER", label: "Autre" },
        ]} />
        <SelectField name="status" label="Statut" defaultValue={product?.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Actif - déjà en vigueur" }, { value: "PENDING", label: "En attente - recommandation" }, { value: "UNDER_REVIEW", label: "Proposition en préparation" }, { value: "LAPSED", label: "Échu" }, { value: "CANCELLED", label: "Annulé" }, { value: "EXPIRED", label: "Expiré" }, { value: "TRANSFERRED", label: "Transféré" }, { value: "ARCHIVED", label: "Archivé" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="company" label="Compagnie ou institution" defaultValue={product?.company ?? ""} placeholder="Ex. Manuvie, Beneva, iA, RBC" />
        <Field name="productName" label="Nom du produit" defaultValue={product?.productName ?? ""} placeholder="Ex. Vie temporaire 20 ans, REER équilibré" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="policyNumber" label="No police" defaultValue={product?.policyNumber ?? ""} />
        <Field name="contractNumber" label="No contrat" defaultValue={product?.contractNumber ?? ""} />
        <Field name="accountNumber" label="No compte" defaultValue={product?.accountNumber ?? ""} />
      </div>

      <SectionTitle>Montants et commissions</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="premium" label="Prime" type="number" defaultValue={product?.premium?.toString() ?? ""} />
        <SelectField name="premiumFrequency" label="Fréquence de prime" defaultValue={product?.premiumFrequency ?? ""} options={frequencyOptions("À compléter")} />
        <Field name="coverageAmount" label="Montant de couverture" type="number" defaultValue={product?.coverageAmount?.toString() ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="accountValue" label="Valeur actuelle" type="number" defaultValue={product?.accountValue?.toString() ?? ""} />
        <Field name="contributionAmount" label="Contribution" type="number" defaultValue={product?.contributionAmount?.toString() ?? ""} />
        <SelectField name="contributionFrequency" label="Fréquence de contribution" defaultValue={product?.contributionFrequency ?? ""} options={frequencyOptions("À compléter")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="commissionAmount" label="Commission estimée" type="number" defaultValue={product?.commissionAmount?.toString() ?? ""} />
        <SelectField name="commissionType" label="Type de commission" defaultValue={product?.commissionType ?? ""} options={[{ value: "", label: "À compléter" }, { value: "FIRST_YEAR", label: "Première année" }, { value: "RENEWAL", label: "Renouvellement" }, { value: "TRAILER", label: "Suivi" }, { value: "FLAT", label: "Forfaitaire" }, { value: "UNKNOWN", label: "Inconnue" }]} />
        <Field name="currency" label="Devise" defaultValue={product?.currency ?? "CAD"} />
      </div>

      <SectionTitle>Dates et bénéficiaires</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="effectiveDate" label="Date d’entrée en vigueur" type="date" defaultValue={product?.effectiveDate?.slice(0, 10) ?? ""} />
        <Field name="renewalAt" label="Renouvellement" type="date" defaultValue={product?.renewalAt?.slice(0, 10) ?? ""} />
        <Field name="nextReviewAt" label="Prochaine révision" type="date" defaultValue={product?.nextReviewAt?.slice(0, 10) ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="primaryBeneficiary" label="Bénéficiaire principal" defaultValue={product?.primaryBeneficiary ?? ""} />
        <Field name="contingentBeneficiary" label="Bénéficiaire subsidiaire" defaultValue={product?.contingentBeneficiary ?? ""} />
      </div>
      <TextArea name="beneficiaryNotes" label="Notes sur les bénéficiaires" defaultValue={product?.beneficiaryNotes ?? ""} />

      <SectionTitle>Documents et conformité</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="documentStatus" label="Statut des documents" defaultValue={product?.documentStatus ?? "PENDING"} options={[{ value: "PENDING", label: "En attente" }, { value: "MISSING", label: "Manquant" }, { value: "RECEIVED", label: "Reçu" }, { value: "VALIDATED", label: "Validé" }, { value: "EXPIRED", label: "Expiré" }]} />
        <Field name="missingDocuments" label="Documents manquants" defaultValue={product?.missingDocuments ?? ""} />
      </div>
      <TextArea name="complianceNotes" label="Notes de conformité" defaultValue={product?.complianceNotes ?? ""} />
      <TextArea name="notes" label="Notes produit" defaultValue={product?.notes ?? ""} />
    </>
  )
}

function frequencyOptions(emptyLabel: string) {
  return [
    { value: "", label: emptyLabel },
    { value: "WEEKLY", label: "Hebdomadaire" },
    { value: "BIWEEKLY", label: "Aux deux semaines" },
    { value: "MONTHLY", label: "Mensuelle" },
    { value: "QUARTERLY", label: "Trimestrielle" },
    { value: "SEMI_ANNUAL", label: "Semestrielle" },
    { value: "ANNUAL", label: "Annuelle" },
    { value: "ONE_TIME", label: "Paiement unique" },
    { value: "IRREGULAR", label: "Irrégulière" },
    { value: "UNKNOWN", label: "Inconnue" },
  ]
}

function DocumentFields({ clientId }: { clientId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [folders, setFolders] = useState<DocumentFolderOption[]>([])
  const [folderId, setFolderId] = useState("")
  const [foldersLoading, setFoldersLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadFolders() {
      setFoldersLoading(true)
      try {
        const response = await fetch(`/api/document-folders?clientId=${encodeURIComponent(clientId)}`, { cache: "no-store" })
        const data = await readJson<DocumentFolderOption[]>(response)
        if (cancelled) return
        const activeFolders = data.filter((folder) => folder.status !== "ARCHIVED")
        setFolders(activeFolders)
        setFolderId("")
      } catch {
        if (!cancelled) setFolders([])
      } finally {
        if (!cancelled) setFoldersLoading(false)
      }
    }
    void loadFolders()
    return () => {
      cancelled = true
    }
  }, [clientId])
  const clientRootFolder = folders.find((folder) => folder.type === "CLIENT") ?? null
  const folderOptions = folders
    .filter((folder) => folder.type !== "ROOT")
    .sort((first, second) => {
      if (first.type === "CLIENT") return -1
      if (second.type === "CLIENT") return 1
      return (first.path ?? first.name).localeCompare(second.path ?? second.name, "fr")
    })
  function folderLabel(folder: DocumentFolderOption) {
    if (folder.type === "CLIENT") return "Dossier client principal"
    if (clientRootFolder?.path && folder.path?.startsWith(`${clientRootFolder.path}/`)) {
      return folder.path.slice(clientRootFolder.path.length + 1)
    }
    return folder.name
  }

  return (
    <>
      <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
            <FilePlus2 className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-emerald-950">Ajouter une pièce au dossier</p>
            <p className="mt-1">
              Enregistrez un document reçu, une exigence documentaire ou une pièce à valider. Pour envoyer un message au client, utilisez plutôt le bouton <span className="font-semibold">Demander au client</span> dans la section Documents.
            </p>
          </div>
        </div>
      </div>

      <SectionTitle>Identification du document</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Nom du document" required defaultValue="Document client" />
        <SelectField name="type" label="Catégorie" defaultValue="KYC_FORM" options={documentTypeOptions} />
      </div>
      <TextArea name="description" label="Description ou référence interne" defaultValue="" />

      <SectionTitle>Classement dans Documents</SectionTitle>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Dossier de destination
        <select
          name="folderId"
          value={folderId}
          onChange={(event) => setFolderId(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <option value="">{foldersLoading ? "Chargement des dossiers..." : "Automatique - dossier du client"}</option>
          {folderOptions.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folderLabel(folder)}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        Le classement automatique suffit dans la majorité des cas. Le menu affiche seulement les dossiers de ce client, pas ceux des autres clients.
      </p>

      <SectionTitle>Statut et accès</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="status" label="Statut documentaire" defaultValue="RECEIVED" options={[
          { value: "REQUIRED", label: "Requis" },
          { value: "REQUESTED", label: "Demandé" },
          { value: "RECEIVED", label: "Reçu" },
          { value: "VALIDATED", label: "Validé" },
          { value: "REJECTED", label: "Rejeté" },
          { value: "EXPIRED", label: "Expiré" },
          { value: "WAIVED", label: "Exempté" },
          { value: "ARCHIVED", label: "Archivé" },
        ]} />
        <SelectField name="visibility" label="Visibilité" defaultValue="TEAM" options={documentVisibilityOptions} />
        <SelectField name="isRequired" label="Document obligatoire" defaultValue="true" options={[{ value: "true", label: "Oui" }, { value: "false", label: "Non" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="requiredBy" label="Date limite attendue" type="date" />
        <Field name="expiresAt" label="Expiration du document" type="date" />
        <Field name="receivedAt" label="Date de réception" type="date" />
      </div>

      <SectionTitle>Fichier à téléverser</SectionTitle>
      <label className="grid cursor-pointer gap-3 rounded-[1.5rem] border-2 border-dashed border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100">
        <FilePlus2 className="mx-auto size-8" />
        <span>{selectedFile ? selectedFile.name : "Glisser-déposer ou sélectionner un fichier"}</span>
        <span className="text-xs font-medium text-emerald-700">
          PDF, image ou document accepté selon les règles de sécurité du coffre documentaire.
        </span>
        <input
          name="file"
          type="file"
          className="sr-only"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        Si aucun fichier n’est sélectionné, l’entrée sera enregistrée comme exigence documentaire dans le dossier. Si un fichier est sélectionné, il sera téléversé dans le coffre documentaire.
      </p>

      <SectionTitle>Validation et notes</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="rejectedReason" label="Raison de rejet si applicable" defaultValue="" />
        <Field name="waiverReason" label="Justification d’exemption si applicable" defaultValue="" />
      </div>
      <TextArea name="notes" label="Notes internes de validation" defaultValue="" />

      <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldAlert className="size-4 text-emerald-700" />
          Bonnes pratiques
        </div>
        <p>Utilisez “Validé” seulement après révision. Pour une pièce rejetée ou expirée, ajoutez une raison claire afin que l’historique conformité reste exploitable.</p>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  const isMissing = !value || /^À |^Non renseigné|^À renseigner|^À définir|^À évaluer/.test(value)
  const displayValue = isMissing ? "À compléter" : value
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={isMissing ? "mt-1 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100" : "mt-1 text-sm font-black text-slate-950"}>{displayValue}</p>
    </div>
  )
}

function List<T>({ items, empty, children }: { items: T[]; empty: string; children: (item: T) => ReactNode }) {
  if (items.length === 0) return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{empty}</div>
  return <div className="space-y-3">{items.map(children)}</div>
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function buildDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("fr-CA", { month: "long" }).format(new Date(2026, month, 1))
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  required,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  if (type === "date") {
    return <DateField name={name} label={label} defaultValue={defaultValue ?? ""} required={required} />
  }

  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<Input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} className="h-11 rounded-2xl" /></label>
}

function PhoneField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type="tel"
        inputMode="tel"
        pattern="(\\+?1\\s?)?\\(?[0-9]{3}\\)?[\\s.-]?[0-9]{3}[\\s.-]?[0-9]{4}"
        defaultValue={formatPhoneInput(defaultValue)}
        required={required}
        maxLength={17}
        onInput={(event) => {
          event.currentTarget.value = formatPhoneInput(event.currentTarget.value)
        }}
        className="h-11 rounded-2xl"
        placeholder="(438) 500-0678"
      />
      <span className="text-xs font-semibold text-slate-500">Format accepté : (438) 500-0678 ou +1 (438) 500-0678.</span>
    </label>
  )
}

function EmailField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type="email"
        inputMode="email"
        defaultValue={normalizeEmail(defaultValue)}
        required={required}
        className="h-11 rounded-2xl"
        placeholder="nom@exemple.ca"
        onBlur={(event) => {
          event.currentTarget.value = normalizeEmail(event.currentTarget.value)
        }}
      />
      <span className="text-xs font-semibold text-slate-500">Format requis : nom@domaine.ca.</span>
    </label>
  )
}

function DateField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const inputId = useId()
  const today = new Date()
  const initialDate = defaultValue && isValidDateInput(defaultValue) ? new Date(`${defaultValue}T00:00:00`) : today
  const [value, setValue] = useState(defaultValue ?? "")
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const selectedDay = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getDate() : null
  const selectedMonth = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getMonth() : null
  const selectedYear = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getFullYear() : null
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const calendarOffset = firstDay === 0 ? 6 : firstDay - 1
  const dayCount = daysInMonth(viewYear, viewMonth)
  const currentYear = today.getFullYear()
  const years = Array.from({ length: 131 }, (_, index) => currentYear + 20 - index)

  function handleManualChange(nextValue: string) {
    setValue(nextValue)
    if (isValidDateInput(nextValue)) {
      const date = new Date(`${nextValue}T00:00:00`)
      setViewYear(date.getFullYear())
      setViewMonth(date.getMonth())
    }
  }

  function selectDay(day: number) {
    setValue(buildDateValue(viewYear, viewMonth, day))
    setIsOpen(false)
  }

  function moveMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-JJ"
          pattern="\d{4}-\d{2}-\d{2}"
          value={value}
          onChange={(event) => handleManualChange(event.target.value)}
          required={required}
          className="h-11 rounded-2xl pl-10 pr-12"
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          aria-label={isOpen ? "Fermer le calendrier" : "Ouvrir le calendrier"}
          title={isOpen ? "Fermer le calendrier" : "Ouvrir le calendrier"}
        >
          <CalendarDays className="size-4" />
        </button>
      </div>
      {isOpen ? (
        <div className="relative z-50 mt-2 w-full min-w-[22rem] max-w-[24rem] rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.14)] max-sm:min-w-0 max-sm:max-w-full">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => moveMonth(-1)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50" aria-label="Mois précédent">
              ‹
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <select value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {Array.from({ length: 12 }, (_, month) => (
                  <option key={month} value={month}>{monthLabel(month)}</option>
                ))}
              </select>
              <select value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => moveMonth(1)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50" aria-label="Mois suivant">
              ›
            </button>
          </div>
          <div
            className="mt-4 gap-1 text-center text-[11px] font-bold uppercase text-slate-400"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <span key={`${day}-${index}`} className="grid h-7 place-items-center">
                {day}
              </span>
            ))}
          </div>
          <div
            className="mt-1 gap-1"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {Array.from({ length: calendarOffset }, (_, index) => <span key={`empty-${index}`} className="h-10" />)}
            {Array.from({ length: dayCount }, (_, index) => {
              const day = index + 1
              const isSelected = selectedDay === day && selectedMonth === viewMonth && selectedYear === viewYear
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={isSelected ? "grid h-10 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white" : "grid h-10 place-items-center rounded-xl text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => handleManualChange(buildDateValue(today.getFullYear(), today.getMonth(), today.getDate()))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              Aujourd’hui
            </button>
            <button type="button" onClick={() => { setValue(""); setIsOpen(false) }} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
              Effacer
            </button>
          </div>
        </div>
      ) : null}
      <span className="text-xs font-normal leading-5 text-slate-500">Écrire la date ou utiliser le calendrier. Format : AAAA-MM-JJ.</span>
    </div>
  )
}

function TextArea({ name, label, required = false, defaultValue = "" }: { name: string; label: string; required?: boolean; defaultValue?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<textarea name={name} required={required} defaultValue={defaultValue} rows={5} className="min-h-32 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label>
}

function ComplianceMiniCheck({ label, detail, done }: { label: string; detail: string; done: boolean }) {
  return (
    <div className={done ? "rounded-2xl border border-emerald-100 bg-white/80 p-3" : "rounded-2xl border border-amber-100 bg-white/80 p-3"}>
      <div className="flex items-start gap-2">
        {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />}
        <div className="min-w-0">
          <p className={done ? "text-sm font-semibold text-emerald-950" : "text-sm font-semibold text-amber-950"}>{label}</p>
          <p className={done ? "mt-0.5 text-xs leading-5 text-emerald-800" : "mt-0.5 text-xs leading-5 text-amber-800"}>{detail}</p>
        </div>
      </div>
    </div>
  )
}

function Notice({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  return <div className={type === "success" ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"}>{children}</div>
}

function LoadingState() {
  return <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-sm font-medium text-slate-600 shadow-sm"><Loader2 className="mr-2 inline size-4 animate-spin text-emerald-600" />Chargement...</div>
}

function StatePanel({ title }: { title: string }) {
  return <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center"><Sparkles className="mx-auto size-6 text-emerald-700" /><h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3><Button className="mt-5 rounded-2xl" variant="outline" asChild><Link href="/clients">Retour clients</Link></Button></div>
}

function SelectField({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: { value: string; label: string }[] }) {
  const currentValue = defaultValue ?? ""
  const hasCurrentValue = !currentValue || options.some((option) => option.value === currentValue)
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <select name={name} defaultValue={currentValue} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {!hasCurrentValue ? <option value={currentValue}>{currentValue}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0"><h3 className="text-sm font-semibold text-slate-950">{children}</h3></div>
}

function ModalActions({ isSaving, onClose, submitLabel = "Ajouter" }: { isSaving: boolean; onClose: () => void; submitLabel?: string }) {
  return <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>Annuler</Button><Button type="submit" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>{isSaving ? "Sauvegarde..." : submitLabel}</Button></div>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}><div className="flex h-[min(94vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>Fermer</Button></div><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div></div></div>
}
