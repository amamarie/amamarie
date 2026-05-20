"use client"

import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bell,
  Bot,
  Building2,
  Clock3,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Fingerprint,
  Gauge,
  Globe2,
  History,
  KeyRound,
  LibraryBig,
  Link2,
  LockKeyhole,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  PenLine,
  ReceiptText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShieldUser,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  TestTube2,
  UploadCloud,
  UserPlus,
  UsersRound,
  Workflow,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { DocumentVaultSettingsPanel } from "@/components/settings/DocumentVaultSettingsPanel"
import { InsuranceNeedsSettingsPanel } from "@/components/settings/InsuranceNeedsSettingsPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdvisorProfile } from "@/lib/advisor-profile-store"
import { getAdvisorDisplayName, useAdvisorProfile } from "@/lib/advisor-profile-store"
import {
  offerableSubscriptionPlanKeys,
  subscriptionPlans,
  type OrganizationTypeKey,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
  type SubscriptionStatusKey,
} from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type Tone = "emerald" | "sky" | "violet" | "amber" | "rose" | "slate"

type SettingSectionId =
  | "general"
  | "advisor"
  | "organization"
  | "team"
  | "security"
  | "notifications"
  | "templates"
  | "documents"
  | "compliance"
  | "ai"
  | "billing"
  | "integrations"
  | "data"

type SettingSection = {
  id: SettingSectionId
  title: string
  description: string
  badge?: string
  tone: Tone
  icon: LucideIcon
}

type SettingsActionKind =
  | "general"
  | "advisor-profile"
  | "advisor-signature"
  | "advisor-photo"
  | "organization"
  | "brand"
  | "team-user"
  | "team-role"
  | "security"
  | "privacy"
  | "notification"
  | "template"
  | "document"
  | "compliance"
  | "ai"
  | "billing"
  | "integration"
  | "data"

type SettingsAction = {
  title: string
  description: string
  primaryLabel?: string
  icon?: LucideIcon
  kind?: SettingsActionKind
  mode?: "form" | "preview" | "test"
  danger?: boolean
}

type SettingsConfirmation = {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
}

type OpenSettingsAction = (action: SettingsAction) => void
type OpenSettingsConfirmation = (confirmation: SettingsConfirmation) => void

type TeamAdvisorRoutingRow = {
  id: string
  name: string
  email: string
  role: string
  title: string | null
  specialties: string | null
  routingTerritories: string | null
  routingLanguages: string | null
  licenseNumber: string | null
  routingPriority: number
  _count: {
    leads: number
    assignedTasks: number
    availabilitySlots: number
  }
}
type SettingsFormValues = Record<string, string>

type SettingsFormState = {
  advisorProfile: AdvisorProfile
  billing: SettingsBillingSummary
  organization: OrganizationSettingsProfile
  generalPreferences: GeneralPreferencesProfile
}

type GeneralPreferencesProfile = {
  spaceName: string
  homePage: string
  language: string
  timezone: string
  currency: string
  dateFormat: string
  clientView: string
  pipelineView: string
  reminders: string
  aiMode: string
}

export type OrganizationSettingsProfile = {
  name: string
  legalName: string
  businessNumber: string
  phone: string
  contactEmail: string
  website: string
  country: string
  region: string
  city: string
  publicAddress: string
}

export type SettingsBillingSummary = {
  plan: SubscriptionPlanKey
  planLabel: string
  planDescription: string
  organizationType: OrganizationTypeKey
  organizationTypeLabel: string
  organizationTypeDescription: string
  status: SubscriptionStatusKey
  statusLabel: string
  pricingMode: SubscriptionPricingModeKey
  pricingModeLabel: string
  currency: SubscriptionCurrencyKey
  currencyLabel: string
  priceSummary: string
  seatLimit: number
  seatsUsed: number
  moduleLabels: string[]
  isCustomAccess: boolean
}

type CommunicationTemplate = {
  id: string
  title: string
  channel: "SMS" | "Courriel"
  status: "Actif" | "Inactif" | "À personnaliser"
  category: string
  subject?: string
  body: string
  automations: number
  lastTest: string
  updatedBy: string
  updatedAt: string
  variables: string[]
  consent: string
  logging: string
}

type TemplateFilter = "Tous" | "SMS" | "Courriels" | "Actifs" | "À personnaliser" | "Automatisés"
type TemplateViewMode = "list" | "cards"
type IntegrationFilter = "Tous" | "Connectés" | "Non connectés" | "Recommandés" | "Bientôt disponible"

type GmailConnectionStatus = {
  connected: boolean
  configured: boolean
  email: string | null
  roleBlocked?: boolean
  scopes?: string[]
  missingScopes?: string[]
  hasWorkspaceScopes?: boolean
  connectedAt: string | null
  lastUsedAt: string | null
}

type ReminderChannelSettings = {
  slackWebhookUrl: "CONFIGURED" | null
  teamsWebhookUrl: "CONFIGURED" | null
  slackConfigured: boolean
  teamsConfigured: boolean
  externalAutoNotify: boolean
  externalNotifyMinPriority: "HIGH" | "CRITICAL"
  envFallback: {
    slack: boolean
    teams: boolean
  }
  roleBlocked?: boolean
}

const settingSections: SettingSection[] = [
  { id: "general", title: "Général", description: "Préférences de base de votre espace conseiller.", badge: "Actif", tone: "emerald", icon: Settings },
  { id: "advisor", title: "Profil conseiller", description: "Signature et spécialités", badge: "Complété", tone: "emerald", icon: ShieldUser },
  { id: "organization", title: "Organisation", description: "Cabinet et marque", badge: "À compléter", tone: "amber", icon: Building2 },
  { id: "team", title: "Équipe & rôles", description: "Accès utilisateurs", badge: "3 actifs", tone: "sky", icon: UsersRound },
  { id: "security", title: "Sécurité", description: "Accès et confidentialité", badge: "Recommandé", tone: "amber", icon: LockKeyhole },
  { id: "notifications", title: "Notifications", description: "Canaux et fréquences", badge: "Actif", tone: "emerald", icon: Bell },
  { id: "templates", title: "Modèles", description: "SMS et courriels clients", badge: "À personnaliser", tone: "violet", icon: MessageSquareText },
  { id: "documents", title: "Documents", description: "Types et validations", badge: "8 règles", tone: "sky", icon: FileText },
  { id: "compliance", title: "Conformité", description: "Profil client et audit", badge: "À configurer", tone: "amber", icon: ShieldCheck },
  { id: "ai", title: "Assistant IA", description: "Limites et résumés", badge: "Sécurisé", tone: "emerald", icon: Bot },
  { id: "billing", title: "Facturation", description: "Plan et factures", badge: "Non connecté", tone: "slate", icon: CreditCard },
  { id: "integrations", title: "Intégrations", description: "Calendriers, courriels et outils connectés", badge: "2 requis", tone: "sky", icon: Link2 },
  { id: "data", title: "Données", description: "Export et confidentialité", badge: "Protégé", tone: "emerald", icon: Database },
]

const progressSteps = [
  { title: "Profil conseiller", status: "Complété", text: "Signature et préférences configurées.", icon: BadgeCheck, tone: "emerald" as Tone },
  { title: "Organisation", status: "À compléter", text: "Ajoutez le nom légal, l’adresse et les informations du cabinet.", icon: Building2, tone: "amber" as Tone },
  { title: "Utilisateurs", status: "En cours", text: "3 utilisateurs actifs.", icon: UsersRound, tone: "sky" as Tone },
  { title: "Sécurité", status: "Recommandé", text: "Activez l’authentification renforcée.", icon: LockKeyhole, tone: "amber" as Tone },
  { title: "Notifications", status: "Complété", text: "Rappels de tâches et documents activés.", icon: Bell, tone: "emerald" as Tone },
  { title: "Modèles", status: "À personnaliser", text: "Personnalisez les SMS et courriels.", icon: MessageSquareText, tone: "violet" as Tone },
  { title: "Conformité", status: "À configurer", text: "Définissez les règles du profil client et les documents requis.", icon: ShieldCheck, tone: "amber" as Tone },
]

type SummaryCardData = {
  label: string
  value: string
  detail: string
  status: string
  action: string
  icon: LucideIcon
  tone: Tone
}

const summaryCards: SummaryCardData[] = [
  { label: "Organisation", value: "Solo", detail: "Cabinet pilote", status: "À compléter", action: "Modifier", icon: Building2, tone: "amber" as Tone },
  { label: "Utilisateurs", value: "3", detail: "1 propriétaire, 2 invités", status: "Actif", action: "Gérer", icon: UsersRound, tone: "emerald" as Tone },
  { label: "Rôle actif", value: "Owner", detail: "Accès complet", status: "Sécurisé", action: "Voir permissions", icon: ShieldCheck, tone: "emerald" as Tone },
  { label: "Plan", value: "Forfait", detail: "Abonnement actif", status: "Actif", action: "Changer", icon: CreditCard, tone: "sky" as Tone },
  { label: "Sécurité", value: "72 %", detail: "2 recommandations", status: "À renforcer", action: "Améliorer", icon: LockKeyhole, tone: "amber" as Tone },
  { label: "Notifications", value: "Actives", detail: "8 règles configurées", status: "Actif", action: "Modifier", icon: Bell, tone: "emerald" as Tone },
]

const users = [
  { name: "Sarah Martin", email: "sarah@cabinet.ca", role: "Conseiller", status: "Actif", access: "Clients et documents", lastActive: "Hier" },
  { name: "Nadia Roy", email: "nadia@cabinet.ca", role: "Assistant", status: "Invitation envoyée", access: "Accès limité", lastActive: "En attente" },
]

const notificationRules = [
  { event: "Tâches dues aujourd’hui", app: true, email: true, sms: false, frequency: "Chaque matin", status: "Actif" },
  { event: "Tâches en retard", app: true, email: true, sms: false, frequency: "Immédiat", status: "Actif" },
  { event: "Documents reçus", app: true, email: false, sms: false, frequency: "Immédiat", status: "Actif" },
  { event: "Documents manquants", app: true, email: true, sms: true, frequency: "Hebdomadaire", status: "Actif" },
  { event: "Renouvellements proches", app: true, email: true, sms: false, frequency: "30 jours avant", status: "Actif" },
  { event: "Profil client incomplet", app: true, email: true, sms: false, frequency: "Chaque semaine", status: "Actif" },
]

const communicationTemplates: CommunicationTemplate[] = [
  {
    id: "sms-follow-up",
    title: "Suivi après demande",
    channel: "SMS",
    status: "Actif",
    category: "Suivi client",
    body: "Bonjour {{prenom}}, merci pour votre demande. Je vous reviens rapidement avec les prochaines étapes.",
    automations: 2,
    lastTest: "Réussi aujourd’hui",
    updatedBy: "Conseiller principal",
    updatedAt: "6 mai 2026",
    variables: ["{{prenom}}", "{{nom_conseiller}}"],
    consent: "Consentement SMS requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "sms-appointment",
    title: "Rappel de rendez-vous",
    channel: "SMS",
    status: "Actif",
    category: "Rendez-vous",
    body: "Bonjour {{prenom}}, petit rappel pour notre rendez-vous prévu le {{date_rendez_vous}}.",
    automations: 1,
    lastTest: "Réussi hier",
    updatedBy: "Conseiller principal",
    updatedAt: "5 mai 2026",
    variables: ["{{prenom}}", "{{date_rendez_vous}}"],
    consent: "Consentement SMS requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "sms-missing-document",
    title: "Document manquant",
    channel: "SMS",
    status: "Actif",
    category: "Documents",
    body: "Bonjour {{prenom}}, il manque un document à votre dossier. Vous pouvez le téléverser ici : {{lien_document}}.",
    automations: 3,
    lastTest: "Réussi il y a 2 jours",
    updatedBy: "Conseiller principal",
    updatedAt: "4 mai 2026",
    variables: ["{{prenom}}", "{{lien_document}}"],
    consent: "Consentement SMS requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "sms-kyc",
    title: "Profil client à compléter",
    channel: "SMS",
    status: "À personnaliser",
    category: "Conformité",
    body: "Bonjour {{prenom}}, votre questionnaire de profil client doit être complété afin de poursuivre l’analyse de votre dossier.",
    automations: 0,
    lastTest: "À tester",
    updatedBy: "Système",
    updatedAt: "3 mai 2026",
    variables: ["{{prenom}}"],
    consent: "Consentement SMS requis",
    logging: "Journalisation recommandée",
  },
  {
    id: "sms-document-received",
    title: "Confirmation document reçu",
    channel: "SMS",
    status: "Inactif",
    category: "Documents",
    body: "Bonjour {{prenom}}, nous avons bien reçu {{nom_document}}. Il sera vérifié avant validation finale.",
    automations: 0,
    lastTest: "Dernier test il y a 10 jours",
    updatedBy: "Sarah Martin",
    updatedAt: "29 avril 2026",
    variables: ["{{prenom}}", "{{nom_document}}"],
    consent: "Consentement SMS requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-discovery",
    title: "Suivi après appel découverte",
    channel: "Courriel",
    status: "Actif",
    category: "Suivi client",
    subject: "Suivi de notre échange",
    body: "Bonjour {{prenom}},\n\nMerci pour notre échange. Je vous reviens avec les prochaines étapes administratives pour compléter votre dossier.\n\n{{signature_conseiller}}",
    automations: 1,
    lastTest: "Réussi aujourd’hui",
    updatedBy: "Conseiller principal",
    updatedAt: "6 mai 2026",
    variables: ["{{prenom}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-document-request",
    title: "Demande de documents pour analyse",
    channel: "Courriel",
    status: "Actif",
    category: "Documents",
    subject: "Documents requis pour votre dossier",
    body: "Bonjour {{prenom}},\n\nAfin de compléter votre dossier, merci de transmettre les documents demandés via ce lien sécurisé : {{lien_document}}.\n\n{{signature_conseiller}}",
    automations: 2,
    lastTest: "Réussi hier",
    updatedBy: "Conseiller principal",
    updatedAt: "5 mai 2026",
    variables: ["{{prenom}}", "{{lien_document}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-annual-review",
    title: "Préparation de révision annuelle",
    channel: "Courriel",
    status: "À personnaliser",
    category: "Révision",
    subject: "Préparation de votre révision annuelle",
    body: "Bonjour {{prenom}},\n\nVotre révision annuelle approche. Voici les éléments administratifs à vérifier avant notre rencontre.\n\n{{signature_conseiller}}",
    automations: 0,
    lastTest: "À tester",
    updatedBy: "Système",
    updatedAt: "2 mai 2026",
    variables: ["{{prenom}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisation recommandée",
  },
  {
    id: "email-meeting-confirmation",
    title: "Confirmation de rendez-vous",
    channel: "Courriel",
    status: "Actif",
    category: "Rendez-vous",
    subject: "Confirmation de rendez-vous",
    body: "Bonjour {{prenom}},\n\nJe confirme notre rendez-vous du {{date_rendez_vous}}. Vous pouvez me répondre directement si vous devez modifier l’heure.\n\n{{signature_conseiller}}",
    automations: 1,
    lastTest: "Réussi il y a 3 jours",
    updatedBy: "Conseiller principal",
    updatedAt: "3 mai 2026",
    variables: ["{{prenom}}", "{{date_rendez_vous}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-missing-document",
    title: "Relance document manquant",
    channel: "Courriel",
    status: "Actif",
    category: "Documents",
    subject: "Document manquant à votre dossier",
    body: "Bonjour {{prenom}},\n\nIl manque encore le document suivant à votre dossier : {{nom_document}}. Vous pouvez le transmettre ici : {{lien_document}}.\n\n{{signature_conseiller}}",
    automations: 2,
    lastTest: "Réussi il y a 2 jours",
    updatedBy: "Conseiller principal",
    updatedAt: "4 mai 2026",
    variables: ["{{prenom}}", "{{nom_document}}", "{{lien_document}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-document-received",
    title: "Confirmation de réception de document",
    channel: "Courriel",
    status: "Inactif",
    category: "Documents",
    subject: "Document reçu",
    body: "Bonjour {{prenom}},\n\nNous avons bien reçu votre document. Il sera vérifié avant d’être marqué comme validé dans votre dossier.\n\n{{signature_conseiller}}",
    automations: 0,
    lastTest: "Dernier test il y a 12 jours",
    updatedBy: "Sarah Martin",
    updatedAt: "28 avril 2026",
    variables: ["{{prenom}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisé dans l’historique client",
  },
  {
    id: "email-consent-reminder",
    title: "Relance consentement manquant",
    channel: "Courriel",
    status: "À personnaliser",
    category: "Conformité",
    subject: "Consentement requis pour votre dossier",
    body: "Bonjour {{prenom}},\n\nIl manque encore votre consentement afin de poursuivre le traitement administratif de votre dossier. Vous pouvez le compléter ici : {{lien_document}}.\n\n{{signature_conseiller}}",
    automations: 0,
    lastTest: "À tester",
    updatedBy: "Système",
    updatedAt: "2 mai 2026",
    variables: ["{{prenom}}", "{{lien_document}}", "{{signature_conseiller}}"],
    consent: "Consentement courriel requis",
    logging: "Journalisation recommandée",
  },
]

const templateVariableLibrary = [
  { key: "{{prenom}}", description: "Prénom du client utilisé dans l’appel personnalisé." },
  { key: "{{nom}}", description: "Nom de famille du client." },
  { key: "{{nom_conseiller}}", description: "Nom complet du conseiller responsable du dossier." },
  { key: "{{date_rendez_vous}}", description: "Date et heure du rendez-vous planifié." },
  { key: "{{lien_document}}", description: "Lien sécurisé pour téléverser un document demandé." },
  { key: "{{nom_document}}", description: "Nom du document manquant ou demandé." },
  { key: "{{nom_cabinet}}", description: "Nom affiché du cabinet." },
  { key: "{{telephone_conseiller}}", description: "Téléphone professionnel du conseiller." },
  { key: "{{courriel_conseiller}}", description: "Courriel professionnel du conseiller connecté." },
  { key: "{{titre_conseiller}}", description: "Titre professionnel du conseiller connecté." },
  { key: "{{signature_conseiller}}", description: "Signature courriel professionnelle configurée." },
]

const documentRules = [
  "Pièce d’identité",
  "Consentement client",
  "Questionnaire profil client",
  "Relevé financier",
  "Proposition",
  "Contrat",
  "Preuve d’adresse",
  "Justification de recommandation",
]

const integrations = [
  { name: "Google Workspace", description: "Connecte Gmail, Calendar, Drive et Sheets avec une seule autorisation conseiller.", status: "Recommandé", scope: "Gmail, calendrier, fichiers et feuilles", lastSync: "—", tone: "amber" as Tone, action: "Connecter", secondary: "Voir détails" },
  { name: "Outlook Calendar", description: "Synchronise le calendrier Microsoft du cabinet.", status: "Non connecté", scope: "Calendrier seulement", lastSync: "—", tone: "slate" as Tone, action: "Connecter", secondary: "Voir détails" },
  { name: "Google Calendar", description: "Inclus dans Google Workspace pour les disponibilités et rendez-vous.", status: "Inclus", scope: "Calendrier", lastSync: "Google Workspace", tone: "sky" as Tone, action: "Voir", secondary: "Voir détails" },
  { name: "Téléphonie Twilio", description: "Appels entrants, SMS et messages vocaux.", status: "Connecté", scope: "Appels et SMS", lastSync: "Aujourd’hui", tone: "emerald" as Tone, action: "Configurer", secondary: "Voir détails" },
  { name: "Slack / Microsoft Teams", description: "Envoie les rappels intelligents critiques vers les canaux internes du cabinet.", status: "Disponible", scope: "Notifications internes", lastSync: "Selon configuration", tone: "emerald" as Tone, action: "Configurer", secondary: "Voir détails" },
  { name: "Signature électronique", description: "Envoie et suit les documents à signer.", status: "Bientôt disponible", scope: "Documents seulement", lastSync: "—", tone: "sky" as Tone, action: "Voir", secondary: "Voir détails" },
]

function getTeamInviteBlockReason(billing: SettingsBillingSummary) {
  if (billing.plan === "ESSENTIEL") return "L’invitation d’utilisateurs est disponible à partir du forfait Croissance."
  if (billing.seatsUsed >= billing.seatLimit) return "La limite de sièges du forfait est atteinte."
  return null
}

function createDefaultGeneralPreferences(billing: SettingsBillingSummary): GeneralPreferencesProfile {
  return {
    spaceName: "FinAssuro CRM",
    homePage: "Tableau de bord",
    language: "Français",
    timezone: "America/Toronto",
    currency: billing.currency,
    dateFormat: "JJ/MM/AAAA",
    clientView: "Liste",
    pipelineView: "Kanban",
    reminders: "Activés",
    aiMode: "Résumés seulement",
  }
}

export function SettingsCenter({ billing: initialBilling, organization }: { billing: SettingsBillingSummary; organization: OrganizationSettingsProfile }) {
  const router = useRouter()
  const { advisorProfile, updateAdvisorProfile, updateAdvisorSignature } = useAdvisorProfile()
  const [activeSection, setActiveSection] = useState<SettingSectionId>("general")
  const [query, setQuery] = useState("")
  const [action, setAction] = useState<SettingsAction | null>(null)
  const [confirmation, setConfirmation] = useState<SettingsConfirmation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [billingProfile, setBillingProfile] = useState<SettingsBillingSummary>(initialBilling)
  const [organizationProfile, setOrganizationProfile] = useState<OrganizationSettingsProfile>(organization)
  const [generalPreferences, setGeneralPreferences] = useState<GeneralPreferencesProfile>(() => createDefaultGeneralPreferences(initialBilling))
  const [showProgressDetails, setShowProgressDetails] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus | null>(null)
  const billing = billingProfile
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBillingProfile(initialBilling)
  }, [initialBilling])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrganizationProfile(organization)
  }, [organization])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeneralPreferences((current) => ({ ...current, currency: billing.currency }))
  }, [billing.currency])
  const sections = useMemo(() => settingSections.map((section) => {
    if (section.id !== "billing") return section

    return {
      ...section,
      description: `${billing.planLabel} - ${billing.seatsUsed}/${billing.seatLimit} siège(s)`,
      badge: billing.isCustomAccess ? "Accès personnalisé" : billing.pricingModeLabel,
      tone: billing.isCustomAccess ? "violet" as Tone : billing.status === "ACTIVE" ? "emerald" as Tone : billing.status === "SUSPENDED" ? "rose" as Tone : "amber" as Tone,
    }
  }), [billing])
  const settingsFormState = useMemo<SettingsFormState>(() => ({
    advisorProfile,
    billing,
    organization: organizationProfile,
    generalPreferences,
  }), [advisorProfile, billing, organizationProfile, generalPreferences])
  const teamInviteBlockReason = getTeamInviteBlockReason(billing)
  const dashboardSummaryCards = useMemo<SummaryCardData[]>(() => summaryCards.map((card) => {
    if (card.label === "Organisation") {
      const location = [organizationProfile.city, organizationProfile.region, organizationProfile.country].filter(Boolean).join(", ")
      return {
        ...card,
        value: organizationProfile.name || "Identité du cabinet",
        detail: location || "Coordonnées, pays et ville",
        status: billing.organizationTypeLabel,
        tone: billing.organizationType === "INDEPENDANT" ? "emerald" : billing.organizationType === "CONSEILLER_ACTIF" ? "sky" : billing.organizationType === "CABINET" ? "violet" : "amber",
      }
    }

    if (card.label === "Plan") {
      return {
        ...card,
        value: billing.planLabel,
        detail: `${billing.priceSummary} - ${billing.seatsUsed}/${billing.seatLimit} siège(s)`,
        status: billing.isCustomAccess ? "Personnalisé" : billing.pricingModeLabel,
        tone: billing.isCustomAccess ? "violet" : billing.status === "ACTIVE" ? "emerald" : billing.status === "SUSPENDED" ? "rose" : "amber",
      }
    }

    if (card.label === "Utilisateurs") {
      const seatLimitReached = billing.seatsUsed >= billing.seatLimit
      return {
        ...card,
        value: `${billing.seatsUsed}/${billing.seatLimit}`,
        detail: "Sièges conseiller utilisés",
        status: seatLimitReached ? "Limite atteinte" : "Actif",
        tone: seatLimitReached ? "amber" : "emerald",
      }
    }

    return card
  }), [billing, organizationProfile])
  const prioritySummaryCards = useMemo(() => dashboardSummaryCards.filter((card) => ["Organisation", "Utilisateurs", "Plan", "Sécurité"].includes(card.label)), [dashboardSummaryCards])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/integrations/google/gmail/status")
      .then((response) => response.json())
      .then((payload: { ok?: boolean; data?: GmailConnectionStatus }) => {
        if (!cancelled && payload.ok && payload.data) setGmailStatus(payload.data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("gmail")
    if (!status) return
    const messages: Record<string, string> = {
      connected: "Google Workspace connecté. Gmail, Calendar, Drive et Sheets sont autorisés pour ce conseiller.",
      denied: "Connexion Google Workspace annulée.",
      not_configured: "Google OAuth n’est pas configuré. Ajoutez les clés Google dans l’environnement.",
      error: "La connexion Google Workspace a échoué. Vérifiez les paramètres OAuth.",
      forbidden: "La connexion Google ne correspond pas à l’utilisateur connecté.",
    }
    window.setTimeout(() => {
      showToast(messages[status] ?? "Statut Gmail mis à jour.")
    }, 0)
  }, [])

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return sections
    return sections.filter((section) =>
      [section.title, section.description, section.badge].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery))
    )
  }, [query, sections])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  function openSection(section: SettingSectionId) {
    setActiveSection(section)
    setQuery("")
  }

  function openAction(nextAction: SettingsAction) {
    setAction(nextAction)
  }

  async function saveAction(values: SettingsFormValues = {}, message = "Paramètres enregistrés.") {
    if (action) {
      const kind = getActionKind(action)

      if (kind === "advisor-profile") {
        const nextProfile = {
          firstName: values.firstName?.trim() || advisorProfile.firstName,
          lastName: values.lastName?.trim() || advisorProfile.lastName,
          title: values.title?.trim() || advisorProfile.title,
          phone: values.phone?.trim() || advisorProfile.phone,
          email: values.email?.trim() || advisorProfile.email,
          language: values.language?.trim() || advisorProfile.language,
          specialties: values.specialties?.trim() || advisorProfile.specialties,
          zones: values.zones?.trim() || advisorProfile.zones,
          licenseNumber: values.licenseNumber?.trim() || advisorProfile.licenseNumber,
        }

        try {
          const response = await fetch("/api/me/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextProfile),
          })
          const payload = await response.json().catch(() => null) as { error?: string } | null

          if (!response.ok) {
            showToast(payload?.error ?? "Impossible d’enregistrer le profil conseiller.")
            return
          }

          updateAdvisorProfile(nextProfile)
          router.refresh()
        } catch {
          showToast("Impossible d’enregistrer le profil conseiller.")
          return
        }
        message = "Profil conseiller mis à jour."
      }

      if (kind === "advisor-signature") {
        updateAdvisorSignature({
          signatureEmail: values.signatureEmail?.trim() || advisorProfile.signatureEmail,
          signatureSms: values.signatureSms?.trim() || advisorProfile.signatureSms,
        })
        message = "Signature professionnelle mise à jour."
      }

      if (kind === "general") {
        setGeneralPreferences((current) => ({
          spaceName: values.spaceName?.trim() || current.spaceName,
          homePage: values.homePage?.trim() || current.homePage,
          language: values.language?.trim() || current.language,
          timezone: values.timezone?.trim() || current.timezone,
          currency: values.currency?.trim() || current.currency,
          dateFormat: values.dateFormat?.trim() || current.dateFormat,
          clientView: values.clientView?.trim() || current.clientView,
          pipelineView: values.pipelineView?.trim() || current.pipelineView,
          reminders: values.reminders?.trim() || current.reminders,
          aiMode: values.aiMode?.trim() || current.aiMode,
        }))
        message = "Préférences générales mises à jour."
      }

      if (kind === "billing") {
        try {
          const response = await fetch("/api/settings/billing", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscriptionPlan: values.subscriptionPlan,
              subscriptionPricingMode: values.subscriptionPricingMode,
              subscriptionCurrency: values.subscriptionCurrency,
              advisorSeatLimit: values.advisorSeatLimit,
            }),
          })
          const payload = await response.json().catch(() => null) as { ok?: boolean; data?: SettingsBillingSummary; error?: { message?: string } } | null

          if (!response.ok || payload?.ok === false || !payload?.data) {
            showToast(payload?.error?.message ?? "Impossible de modifier le forfait.")
            return
          }

          const nextBilling = payload.data
          setBillingProfile(nextBilling)
          setGeneralPreferences((current) => ({ ...current, currency: nextBilling.currency }))
          router.refresh()
          message = "Forfait mis à jour."
        } catch {
          showToast("Impossible de modifier le forfait.")
          return
        }
      }

      if (kind === "organization") {
        const nextOrganization: OrganizationSettingsProfile = {
          name: values.name?.trim() || organizationProfile.name,
          legalName: values.legalName?.trim() ?? organizationProfile.legalName,
          businessNumber: values.businessNumber?.trim() ?? organizationProfile.businessNumber,
          phone: values.phone?.trim() ?? organizationProfile.phone,
          contactEmail: values.contactEmail?.trim() ?? organizationProfile.contactEmail,
          website: values.website?.trim() ?? organizationProfile.website,
          country: values.country?.trim() || organizationProfile.country || "Canada",
          region: values.region?.trim() ?? organizationProfile.region,
          city: values.city?.trim() ?? organizationProfile.city,
          publicAddress: values.publicAddress?.trim() ?? organizationProfile.publicAddress,
        }

        try {
          const response = await fetch("/api/settings/organization", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextOrganization),
          })
          const payload = await response.json().catch(() => null) as { ok?: boolean; data?: Partial<Record<keyof OrganizationSettingsProfile, string | null>>; error?: { message?: string } } | null

          if (!response.ok || payload?.ok === false) {
            showToast(payload?.error?.message ?? "Impossible d’enregistrer l’organisation.")
            return
          }

          setOrganizationProfile(normalizeOrganizationProfile({ ...nextOrganization, ...payload?.data }))
          router.refresh()
          message = "Organisation mise à jour."
        } catch {
          showToast("Impossible d’enregistrer l’organisation.")
          return
        }
      }
    }

    setAction(null)
    setConfirmation(null)
    showToast(message)
  }

  return (
    <div className="space-y-5">
      {toast ? <SettingsToast message={toast} /> : null}
      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white p-5 shadow-[0_12px_0_#d9f99d] sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="emerald">Cabinet sécurisé</StatusBadge>
            <StatusBadge tone="sky">{billing.planLabel}</StatusBadge>
            <StatusBadge tone="amber">{billing.seatsUsed}/{billing.seatLimit} siège</StatusBadge>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Paramètres
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            Gérez les informations du cabinet, les accès, les modèles et les intégrations sans doublons ni réglages dispersés.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button className="h-11 rounded-2xl border-2 border-emerald-700 bg-emerald-600 px-4 font-black shadow-[0_4px_0_#047857] hover:bg-emerald-700" onClick={() => {
              openSection("organization")
              openAction({
                title: "Compléter le cabinet",
                description: "Ajoutez l’identité, la localisation et les contacts publics du cabinet.",
                primaryLabel: "Enregistrer",
                icon: Gauge,
                kind: "organization",
              })
            }}>
              <Gauge className="size-4" />
              Compléter le cabinet
            </Button>
            {teamInviteBlockReason ? (
              <Button variant="outline" className="h-11 rounded-2xl border-2 px-4 font-black shadow-[0_4px_0_#e2e8f0]" title={teamInviteBlockReason} onClick={() => openSection("team")}>
                <UsersRound className="size-4" />
                Voir l’équipe
              </Button>
            ) : (
              <Button variant="outline" className="h-11 rounded-2xl border-2 px-4 font-black shadow-[0_4px_0_#e2e8f0]" onClick={() => {
                openSection("team")
                openAction({
                  title: "Inviter un utilisateur",
                  description: "Ajoutez un membre de votre équipe et définissez son rôle d’accès.",
                  primaryLabel: "Envoyer l’invitation",
                  icon: UserPlus,
                  kind: "team-user",
                })
              }}>
                <UsersRound className="size-4" />
                Inviter un utilisateur
              </Button>
            )}
            <Button variant="outline" className="h-11 rounded-2xl border-2 px-4 font-black shadow-[0_4px_0_#e2e8f0]" onClick={() => {
              openSection("templates")
              openAction({
                title: "Créer un modèle",
                description: "Créez un modèle SMS ou courriel réutilisable avec variables client.",
                primaryLabel: "Créer le modèle",
                icon: MessageSquareText,
              })
            }}>
              <MessageSquareText className="size-4" />
              Créer un modèle
            </Button>
            <div className="flex min-h-11 min-w-full flex-1 flex-wrap items-center gap-3 rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-3 py-2 sm:min-w-[420px]">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl border-2 border-white bg-white text-emerald-700 shadow-[0_3px_0_#bbf7d0]">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">Configuration <span className="text-emerald-800">68 %</span></p>
                  <p className="text-xs font-bold leading-4 text-emerald-900">Priorité : compléter l’organisation et revoir les accès.</p>
                </div>
              </div>
              <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full border border-emerald-100 bg-white">
                <div className="h-full w-[68%] rounded-full bg-emerald-500" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-9 rounded-xl bg-white" onClick={() => {
                  setShowProgressDetails((value) => !value)
                }}>
                  <Sparkles className="size-3.5" />
                  {showProgressDetails ? "Masquer" : "Voir les étapes"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {showProgressDetails ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {progressSteps.filter((step) => ["Profil conseiller", "Organisation", "Sécurité", "Modèles", "Conformité"].includes(step.title)).map((step) => (
              <ProgressStep key={step.title} {...step} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {prioritySummaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            onAction={() => {
              const section = getSectionForSummary(card.label)
              openSection(section)
              if (card.label === "Plan") {
                openAction({
                  title: "Changer de forfait",
                  description: "Modifiez le forfait, la devise et les sièges inclus. Les modules seront synchronisés avec le forfait choisi.",
                  primaryLabel: "Mettre à jour le forfait",
                  icon: card.icon,
                  kind: "billing",
                })
                return
              }

              if (card.label === "Organisation") {
                openAction({
                  title: "Modifier le cabinet",
                  description: "Mettez à jour l’identité, la localisation et les contacts publics.",
                  primaryLabel: "Enregistrer",
                  icon: card.icon,
                  kind: "organization",
                })
                return
              }

              openAction({
                title: `${card.action} - ${card.label}`,
                description: `${card.detail}. Statut actuel : ${card.status}.`,
                primaryLabel: card.action,
                icon: card.icon,
              })
            }}
          />
        ))}
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="min-w-0 rounded-[1.75rem] border-2 border-slate-200 bg-white p-3 shadow-[0_8px_0_#e2e8f0] lg:sticky lg:top-24 lg:self-start">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher réglage..."
              className="h-11 rounded-2xl border-2 pl-9 font-semibold"
            />
          </label>
          <div className="mt-3 grid max-h-none gap-1 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1">
            {filteredSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    isActive
                      ? "border-emerald-300 bg-emerald-50 text-slate-950 shadow-[0_4px_0_#bbf7d0]"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-emerald-700" : "text-slate-400")} />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-sm font-black">{section.title}</span>
                      {section.badge ? <StatusBadge tone={section.tone}>{section.badge}</StatusBadge> : null}
                    </span>
                    <span className="block truncate text-xs font-semibold text-slate-500">{section.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {activeSection === "general" ? <GeneralSection preferences={generalPreferences} onAction={openAction} /> : null}
          {activeSection === "advisor" ? <AdvisorSection profile={advisorProfile} onAction={openAction} /> : null}
          {activeSection === "organization" ? <OrganizationSection onAction={openAction} /> : null}
          {activeSection === "team" ? <TeamSection advisorProfile={advisorProfile} billing={billing} onAction={openAction} onConfirm={setConfirmation} /> : null}
          {activeSection === "security" ? <SecuritySection onAction={openAction} /> : null}
          {activeSection === "notifications" ? <NotificationsSection onAction={openAction} /> : null}
          {activeSection === "templates" ? <TemplatesSection onAction={openAction} onConfirm={setConfirmation} /> : null}
          {activeSection === "documents" ? <DocumentsSection onAction={openAction} /> : null}
          {activeSection === "compliance" ? <ComplianceSection onAction={openAction} /> : null}
          {activeSection === "ai" ? <AiSection onAction={openAction} /> : null}
          {activeSection === "billing" ? <BillingSection billing={billing} onAction={openAction} /> : null}
          {activeSection === "integrations" ? <IntegrationsSection gmailStatus={gmailStatus} onGmailDisconnected={setGmailStatus} onToast={showToast} onAction={openAction} /> : null}
          {activeSection === "data" ? <DataSection onAction={openAction} onConfirm={setConfirmation} /> : null}
        </div>
      </section>
      {action ? (
        <SettingsActionDrawer
          action={action}
          settings={settingsFormState}
          onClose={() => setAction(null)}
          onSave={(values) => saveAction(values, getSuccessMessage(action.title))}
        />
      ) : null}
      {confirmation ? (
        <SettingsConfirmationModal
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
          onConfirm={() => saveAction({}, "Action confirmée.")}
        />
      ) : null}
    </div>
  )
}

function ProgressStep({ title, status, text, icon: Icon, tone }: { title: string; status: string; text: string; icon: LucideIcon; tone: Tone }) {
  return (
    <div className="rounded-2xl border-2 border-white bg-white/90 p-3 shadow-[0_4px_0_#d9f99d]">
      <div className="flex items-start gap-2.5">
        <div className="rounded-xl border-2 border-emerald-100 bg-emerald-50 p-2 text-emerald-700">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950">{title}</p>
          <div className="mt-1">
            <StatusBadge tone={tone}>{status}</StatusBadge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, detail, status, action, icon: Icon, tone, onAction }: SummaryCardData & { onAction: () => void }) {
  return (
    <div className="min-h-0 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_7px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_9px_0_#bbf7d0]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-2.5 text-slate-700">
          <Icon className="size-4" />
        </div>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
      <p className="mt-3 text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-500">{detail}</p>
      <button type="button" onClick={onAction} className="mt-3 inline-flex items-center gap-1 text-sm font-black text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {action}
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

function GeneralSection({
  preferences,
  onAction,
}: {
  preferences: GeneralPreferencesProfile
  onAction: OpenSettingsAction
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ContentCard title="Préférences de l’espace" description="Réglages de base utilisés dans l’interface conseiller.">
        <InfoGrid items={[
          ["Langue", preferences.language],
          ["Fuseau horaire", preferences.timezone],
          ["Devise", preferences.currency],
          ["Page d’accueil", preferences.homePage],
        ]} />
        <CardActions
          primary="Modifier les préférences"
          primaryIcon={PenLine}
          onPrimary={() => onAction({
            title: "Modifier les préférences générales",
            description: "Ajustez l’affichage, la langue, la devise et les valeurs par défaut de l’espace conseiller.",
            primaryLabel: "Enregistrer les préférences",
            icon: Settings,
            kind: "general",
          })}
        />
      </ContentCard>
      <ContentCard title="Expérience CRM" description="Vues de travail et automatisations légères.">
        <InfoGrid items={[
          ["Vue clients par défaut", preferences.clientView],
          ["Vue pipeline par défaut", preferences.pipelineView],
          ["Rappels automatiques", preferences.reminders],
          ["Assistant IA", preferences.aiMode],
        ]} />
        <CardActions
          primary="Ajuster"
          primaryIcon={SlidersHorizontal}
          onPrimary={() => onAction({
            title: "Modifier préférences globales",
            description: "Ajustez les vues de travail, les rappels automatiques et le comportement de l’assistant IA.",
            primaryLabel: "Enregistrer les préférences",
            icon: SlidersHorizontal,
            kind: "general",
          })}
        />
      </ContentCard>
    </div>
  )
}

function AdvisorSection({
  profile,
  onAction,
}: {
  profile: AdvisorProfile
  onAction: OpenSettingsAction
}) {
  const fullName = profile.displayName

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ContentCard title="Profil conseiller" description="Informations visibles dans les communications et les suivis.">
        <InfoGrid items={[
          ["Prénom", profile.firstName],
          ["Nom", profile.lastName],
          ["Titre professionnel", profile.title],
          ["Téléphone", profile.phone || "À compléter"],
          ["Courriel professionnel", profile.email],
          ["Langue préférée", profile.language],
          ["Spécialités", profile.specialties],
          ["Zones desservies", profile.zones],
          ["Licence professionnelle", profile.licenseNumber || "À compléter"],
        ]} />
        <CardActions
          primary="Modifier le profil"
          secondary="Mettre à jour la photo"
          primaryIcon={PenLine}
          secondaryIcon={UploadCloud}
          onPrimary={() => onAction({
            title: "Modifier le profil conseiller",
            description: "Mettez à jour le titre professionnel, les coordonnées, les spécialités et les zones desservies.",
            primaryLabel: "Enregistrer le profil",
            icon: ShieldUser,
            kind: "advisor-profile",
          })}
          onSecondary={() => onAction({
            title: "Mettre à jour la photo",
            description: "Importez une photo de profil professionnelle pour l’espace conseiller.",
            primaryLabel: "Téléverser la photo",
            icon: UploadCloud,
          })}
        />
      </ContentCard>
      <ContentCard title="Signature professionnelle" description="Prévisualisation utilisée dans les courriels et suivis administratifs.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-base font-semibold text-slate-950">{fullName}</p>
          <p className="mt-1 text-sm text-slate-600">{profile.title}</p>
          <div className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{profile.signatureEmail}</div>
        </div>
        <CardActions
          primary="Prévisualiser la signature"
          secondary="Modifier signature SMS"
          primaryIcon={Eye}
          secondaryIcon={MessageSquareText}
          onPrimary={() => onAction({
            title: "Prévisualiser la signature",
            description: "Vérifiez l’apparence de la signature avant utilisation dans les courriels.",
            primaryLabel: "Fermer la prévisualisation",
            icon: Eye,
            mode: "preview",
          })}
          onSecondary={() => onAction({
            title: "Modifier signature SMS",
            description: "Définissez une signature courte adaptée aux messages administratifs par SMS.",
            primaryLabel: "Enregistrer la signature",
            icon: MessageSquareText,
            kind: "advisor-signature",
          })}
        />
      </ContentCard>
    </div>
  )
}

function OrganizationSection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ConfigCard icon={Palette} title="Paramètres de marque" status="Disponible" description="Logo, couleur principale, signature et nom affiché dans les communications." action="Prévisualiser" kind="brand" onAction={onAction} mode="preview" />
    </div>
  )
}

function TeamSection({ advisorProfile, billing, onAction, onConfirm }: { advisorProfile: AdvisorProfile; billing: SettingsBillingSummary; onAction: OpenSettingsAction; onConfirm: OpenSettingsConfirmation }) {
  const [advisors, setAdvisors] = useState<TeamAdvisorRoutingRow[]>([])
  const [editing, setEditing] = useState<Record<string, Partial<TeamAdvisorRoutingRow>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const inviteBlockReason = getTeamInviteBlockReason(billing)

  async function loadAdvisors() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/team/advisors", { cache: "no-store" })
      const payload = await response.json() as { ok?: boolean; data?: TeamAdvisorRoutingRow[]; error?: { message?: string } }
      if (payload.ok && payload.data) {
        setAdvisors(payload.data)
        setEditing(Object.fromEntries(payload.data.map((advisor) => [advisor.id, {
          specialties: advisor.specialties ?? "",
          routingTerritories: advisor.routingTerritories ?? "",
          routingLanguages: advisor.routingLanguages ?? "",
          licenseNumber: advisor.licenseNumber ?? "",
          routingPriority: advisor.routingPriority,
        }])))
      } else {
        setMessage(payload.error?.message ?? "Impossible de charger l’équipe.")
      }
    } catch {
      setMessage("Impossible de charger l’équipe.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAdvisors()
  }, [])

  async function saveAdvisor(advisorId: string) {
    const values = editing[advisorId] ?? {}
    setMessage(null)
    const response = await fetch("/api/team/advisors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: advisorId,
        specialties: values.specialties ?? "",
        routingTerritories: values.routingTerritories ?? "",
        routingLanguages: values.routingLanguages ?? "",
        licenseNumber: values.licenseNumber ?? "",
        routingPriority: values.routingPriority ?? 50,
      }),
    })
    const payload = await response.json() as { ok?: boolean; error?: { message?: string } }
    if (!response.ok || !payload.ok) {
      setMessage(payload.error?.message ?? "Enregistrement impossible.")
      return
    }
    setMessage("Règles de routage enregistrées.")
    await loadAdvisors()
  }

  function updateAdvisorDraft(advisorId: string, values: Partial<TeamAdvisorRoutingRow>) {
    setEditing((current) => ({
      ...current,
      [advisorId]: {
        ...(current[advisorId] ?? {}),
        ...values,
      },
    }))
  }

  return (
    <div className="space-y-5">
      <ContentCard title="Routage conseiller" description="Configurez les spécialités, territoires, langues, permis et priorité cabinet utilisés par l’automatisation formulaire → qualification IA → routage.">
        {message ? <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">{message}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="text-xs font-semibold text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-3 pr-4">Utilisateur</th>
                <th className="py-3 pr-4">Spécialités</th>
                <th className="py-3 pr-4">Territoires</th>
                <th className="py-3 pr-4">Langues</th>
                <th className="py-3 pr-4">Permis</th>
                <th className="py-3 pr-4">Priorité</th>
                <th className="py-3 pr-4">Charge</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-6 text-center font-semibold text-slate-500">Chargement de l’équipe...</td></tr>
              ) : null}
              {!isLoading && advisors.map((user) => {
                const draft = editing[user.id] ?? {}
                return (
                <tr key={user.email} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-slate-950">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs font-black uppercase text-slate-400">{user.role}</p>
                  </td>
                  <td className="py-4 pr-4"><CompactTextarea value={String(draft.specialties ?? "")} onChange={(value) => updateAdvisorDraft(user.id, { specialties: value })} placeholder="assurance vie, invalidité, placements" /></td>
                  <td className="py-4 pr-4"><CompactTextarea value={String(draft.routingTerritories ?? "")} onChange={(value) => updateAdvisorDraft(user.id, { routingTerritories: value })} placeholder="Québec, Montréal, Ontario" /></td>
                  <td className="py-4 pr-4"><CompactTextarea value={String(draft.routingLanguages ?? "")} onChange={(value) => updateAdvisorDraft(user.id, { routingLanguages: value })} placeholder="Français, anglais" /></td>
                  <td className="py-4 pr-4"><Input value={String(draft.licenseNumber ?? "")} onChange={(event) => updateAdvisorDraft(user.id, { licenseNumber: event.target.value })} className="h-9 min-w-32 rounded-xl" placeholder="Permis" /></td>
                  <td className="py-4 pr-4"><Input type="number" min={0} max={100} value={Number(draft.routingPriority ?? 50)} onChange={(event) => updateAdvisorDraft(user.id, { routingPriority: Number(event.target.value) })} className="h-9 w-24 rounded-xl" /></td>
                  <td className="py-4 pr-4 text-xs font-semibold text-slate-600">
                    <p>{user._count.leads} prospect(s)</p>
                    <p>{user._count.assignedTasks} tâche(s)</p>
                    <p>{user._count.availabilitySlots} plage(s)</p>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveAdvisor(user.id)}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onAction({
                        title: `Modifier ${user.name}`,
                        description: "Ajustez le rôle, l’accès et les permissions de cet utilisateur.",
                        primaryLabel: "Enregistrer le rôle",
                        icon: UserPlus,
                      })}>
                        <PenLine className="size-3.5" />
                        Modifier
                      </Button>
                      {user.role !== "OWNER" ? (
                        <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => onConfirm({
                          title: `Désactiver ${user.name}`,
                          description: "L’accès de cet utilisateur sera désactivé immédiatement. Les dossiers et activités resteront conservés.",
                          confirmLabel: "Désactiver",
                          danger: true,
                        })}>
                          <X className="size-3.5" />
                          Désactiver
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        {inviteBlockReason ? (
          <div className="mt-5 rounded-2xl border-2 border-amber-100 bg-amber-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-amber-950">Invitation verrouillée</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">{inviteBlockReason}</p>
                <p className="mt-1 text-xs font-bold text-amber-700">Forfait actuel : {billing.planLabel} · {billing.seatsUsed}/{billing.seatLimit} siège(s).</p>
              </div>
              <Button variant="outline" className="rounded-xl border-amber-200 bg-white font-black text-amber-900 hover:bg-amber-100" onClick={() => onAction({
                title: "Gérer les rôles",
                description: "Configurez les permissions par rôle pour les clients, documents, tâches, conformité et rapports.",
                primaryLabel: "Enregistrer les rôles",
                icon: ShieldCheck,
                kind: "team-role",
              })}>
                <ShieldCheck className="size-4" />
                Gérer les rôles
              </Button>
            </div>
          </div>
        ) : (
          <CardActions
            primary="Inviter un utilisateur"
            secondary="Gérer les rôles"
            primaryIcon={UserPlus}
            secondaryIcon={ShieldCheck}
            onPrimary={() => onAction({
              title: "Inviter un utilisateur",
              description: "Envoyez une invitation et attribuez un rôle précis au nouveau membre.",
              primaryLabel: "Envoyer l’invitation",
              icon: UserPlus,
              kind: "team-user",
            })}
            onSecondary={() => onAction({
              title: "Gérer les rôles",
              description: "Configurez les permissions par rôle pour les clients, documents, tâches, conformité et rapports.",
              primaryLabel: "Enregistrer les rôles",
              icon: ShieldCheck,
              kind: "team-role",
            })}
          />
        )}
      </ContentCard>
      <ContentCard title="Permissions par rôle" description="Vue rapide des accès aux modules sensibles.">
        <div className="grid gap-3 md:grid-cols-3">
          {["Owner · Accès complet", "Conseiller · Clients, documents, tâches", "Assistant · Accès limité"].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-800">{item}</div>
          ))}
        </div>
      </ContentCard>
    </div>
  )
}

function CompactTextarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      className="min-h-20 w-full min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      placeholder={placeholder}
    />
  )
}

function SecuritySection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <ContentCard title="Score de sécurité" description="Protection des accès et des données client.">
        <div className="text-5xl font-semibold text-slate-950">72 %</div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Votre espace est sécurisé, mais 2 recommandations peuvent renforcer la protection des données client.
        </p>
        <div className="mt-4 grid gap-2">
          {["Activer l’authentification à deux facteurs", "Limiter les accès invités", "Vérifier les sessions actives"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              <ShieldCheck className="size-4" />
              {item}
            </div>
          ))}
        </div>
        <CardActions
          primary="Activer 2FA"
          secondary="Voir les sessions"
          primaryIcon={KeyRound}
          secondaryIcon={Fingerprint}
          onPrimary={() => onAction({
            title: "Activer l’authentification à deux facteurs",
            description: "Renforcez la protection de l’espace avec une validation supplémentaire à la connexion.",
            primaryLabel: "Activer 2FA",
            icon: KeyRound,
          })}
          onSecondary={() => onAction({
            title: "Sessions actives",
            description: "Consultez les connexions récentes et révoquez les sessions suspectes.",
            primaryLabel: "Marquer comme vérifié",
            icon: Fingerprint,
            mode: "preview",
          })}
        />
      </ContentCard>
      <div className="grid gap-5">
        <ConfigCard icon={Fingerprint} title="Mode confidentialité" status="Actif" description="Masquer téléphones, courriels, adresses et valeurs financières selon le rôle." action="Modifier" onAction={onAction} />
        <ConfigCard icon={ReceiptText} title="Journal d’audit" status="Disponible" description="Consultez les connexions, exports et modifications sensibles." action="Consulter" onAction={onAction} mode="preview" />
      </div>
    </div>
  )
}

function NotificationsSection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <ContentCard title="Règles de notifications" description="Définissez les canaux et fréquences par événement.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs font-semibold text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="py-3 pr-4">Événement</th>
              <th className="py-3 pr-4">Application</th>
              <th className="py-3 pr-4">Courriel</th>
              <th className="py-3 pr-4">SMS</th>
              <th className="py-3 pr-4">Fréquence</th>
              <th className="py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {notificationRules.map((rule) => (
              <tr key={rule.event} className="border-b border-slate-100 last:border-0">
                <td className="py-4 pr-4 font-semibold text-slate-950">{rule.event}</td>
                <td className="py-4 pr-4">{rule.app ? "Activé" : "Désactivé"}</td>
                <td className="py-4 pr-4">{rule.email ? "Activé" : "Désactivé"}</td>
                <td className="py-4 pr-4">{rule.sms ? "Activé" : "Désactivé"}</td>
                <td className="py-4 pr-4">{rule.frequency}</td>
                <td className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="emerald">{rule.status}</StatusBadge>
                    <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
                      title: `Configurer - ${rule.event}`,
                      description: "Modifiez les canaux, la fréquence et le statut de cette notification.",
                      primaryLabel: "Mettre à jour",
                      icon: Bell,
                    })}>
                      <SlidersHorizontal className="size-3.5" />
                      Modifier
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardActions
        primary="Configurer notification"
        secondary="Tester notification"
        primaryIcon={Bell}
        secondaryIcon={TestTube2}
        onPrimary={() => onAction({
          title: "Configurer une notification",
          description: "Sélectionnez l’événement, les canaux et la fréquence d’envoi.",
          primaryLabel: "Enregistrer notification",
          icon: Bell,
        })}
        onSecondary={() => onAction({
          title: "Tester une notification",
          description: "Envoyez une notification de test à votre compte conseiller.",
          primaryLabel: "Envoyer le test",
          icon: TestTube2,
          mode: "test",
        })}
      />
    </ContentCard>
  )
}

function TemplatesSection({ onAction, onConfirm }: { onAction: OpenSettingsAction; onConfirm: OpenSettingsConfirmation }) {
  const { advisorProfile } = useAdvisorProfile()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<TemplateFilter>("Tous")
  const [viewMode, setViewMode] = useState<TemplateViewMode>("list")
  const templates = useMemo(() => communicationTemplates.map((template) => ({
    ...template,
    updatedBy: template.updatedBy === "Conseiller principal" ? advisorProfile.displayName : template.updatedBy,
  })), [advisorProfile.displayName])
  const filteredTemplates = useMemo(() => {
    const normalizedSearch = normalizeActionText(search)
    return templates.filter((template) => {
      const matchesSearch = !normalizedSearch || normalizeActionText([
        template.title,
        template.channel,
        template.status,
        template.category,
        template.body,
        template.subject ?? "",
      ].join(" ")).includes(normalizedSearch)
      return matchesSearch && matchesTemplateFilter(template, filter)
    })
  }, [filter, search, templates])
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="sky">{templates.length} modèles</StatusBadge>
              <StatusBadge tone="emerald">{templates.filter((template) => template.status === "Actif").length} actifs</StatusBadge>
              <StatusBadge tone="amber">{templates.filter((template) => template.status === "À personnaliser").length} à personnaliser</StatusBadge>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Modèles de communication</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Créez et personnalisez les SMS et courriels utilisés dans vos suivis clients.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction({
              title: "Créer un modèle",
              description: "Créez un modèle SMS ou courriel avec variables, consentement, aperçu et automatisation.",
              primaryLabel: "Enregistrer le modèle",
              icon: MessageSquareText,
              kind: "template",
            })}>
              <MessageSquareText className="size-4" />
              Créer un modèle
            </Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
              title: "Tester l’envoi d’un modèle",
              description: "Envoyez un test interne avec variables résolues avant utilisation client.",
              primaryLabel: "Envoyer le test",
              icon: TestTube2,
              kind: "template",
              mode: "test",
            })}>
              <TestTube2 className="size-4" />
              Tester l’envoi
            </Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
              title: "Variables disponibles",
              description: "Consultez les variables client et conseiller disponibles dans les modèles.",
              primaryLabel: "Fermer",
              icon: LibraryBig,
              kind: "template",
              mode: "preview",
            })}>
              <LibraryBig className="size-4" />
              Variables disponibles
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un modèle..." className="h-11 rounded-xl pl-9" />
          </label>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {(["Tous", "SMS", "Courriels", "Actifs", "À personnaliser", "Automatisés"] as TemplateFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  filter === item ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-500">{filteredTemplates.length} modèle{filteredTemplates.length > 1 ? "s" : ""} affiché{filteredTemplates.length > 1 ? "s" : ""}</p>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", viewMode === "list" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950")}
            >
              Vue liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", viewMode === "cards" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-950")}
            >
              Vue cartes
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <TemplateList templates={filteredTemplates} onAction={onAction} onConfirm={onConfirm} />
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onAction={onAction} onConfirm={onConfirm} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DocumentsSection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <ContentCard title="Types de documents requis" description="Configurez les pièces demandées et les règles de validation.">
        <div className="grid gap-3 md:grid-cols-2">
          {documentRules.map((rule) => (
            <div key={rule} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-sm font-semibold text-slate-900">{rule}</span>
              <StatusBadge tone="sky">Actif</StatusBadge>
            </div>
          ))}
        </div>
        <CardActions
          primary="Ajouter un type de document"
          secondary="Modifier les règles"
          primaryIcon={FileCheck2}
          secondaryIcon={SlidersHorizontal}
          onPrimary={() => onAction({
            title: "Ajouter un type de document",
            description: "Définissez un nouveau document requis, son statut initial et sa règle de validation.",
            primaryLabel: "Ajouter le document",
            icon: FileCheck2,
          })}
          onSecondary={() => onAction({
            title: "Modifier les règles documentaires",
            description: "Configurez les statuts, délais, validations et demandes automatiques de documents.",
            primaryLabel: "Enregistrer les règles",
            icon: SlidersHorizontal,
          })}
        />
      </ContentCard>
      <ContentCard title="Statuts documentaires" description="Cycle de vie des documents client.">
        <div className="grid gap-2">
          {["Manquant", "Demandé", "Reçu", "À valider", "Validé", "Rejeté", "Expiré"].map((status) => (
            <div key={status} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{status}</div>
          ))}
        </div>
        <CardActions
          primary="Activer OCR"
          secondary="Configurer statuts"
          primaryIcon={Sparkles}
          secondaryIcon={SlidersHorizontal}
          onPrimary={() => onAction({
            title: "Activer OCR",
            description: "Préparez l’analyse automatique des documents pour extraire les informations administratives.",
            primaryLabel: "Activer OCR",
            icon: Sparkles,
          })}
          onSecondary={() => onAction({
            title: "Configurer les statuts documentaires",
            description: "Définissez le cycle de vie des documents : manquant, demandé, reçu, validé, rejeté et expiré.",
            primaryLabel: "Enregistrer les statuts",
            icon: SlidersHorizontal,
          })}
        />
      </ContentCard>
      <div className="xl:col-span-2">
        <DocumentVaultSettingsPanel />
      </div>
    </div>
  )
}

function ComplianceSection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <ContentCard title="Règles de conformité actives" description="Règles appliquées aux dossiers client avant recommandation.">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          "Questionnaire profil client obligatoire avant recommandation",
          "Pièce d’identité requise",
          "Consentement client requis",
          "Profil de risque obligatoire",
          "Objectifs financiers obligatoires",
          "Justification de recommandation obligatoire",
          "Notes de rencontre recommandées",
        ].map((rule) => (
          <div key={rule} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-950">{rule}</p>
          </div>
        ))}
      </div>
      <CardActions
        primary="Modifier les règles"
        secondary="Voir le journal d’audit"
        primaryIcon={ShieldCheck}
        secondaryIcon={ReceiptText}
        onPrimary={() => onAction({
          title: "Modifier les règles de conformité",
          description: "Ajustez les règles du profil client, consentements, documents obligatoires et validations requises.",
          primaryLabel: "Enregistrer les règles",
          icon: ShieldCheck,
        })}
        onSecondary={() => onAction({
          title: "Journal d’audit conformité",
          description: "Consultez les changements importants sans exposer les données sensibles complètes.",
          primaryLabel: "Marquer comme consulté",
          icon: ReceiptText,
          mode: "preview",
        })}
      />
    </ContentCard>
  )
}

function AiSection({ onAction }: { onAction: OpenSettingsAction }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ContentCard title="Paramètres IA" description="Aide opérationnelle sans conseil financier automatisé.">
        <InfoGrid items={[
          ["Résumé dossier", "Activé"],
          ["Résumé appel", "Activé"],
          ["Aide courriel", "Activé"],
          ["Classement de documents", "Disponible"],
          ["Recommandations financières", "Désactivé"],
          ["Validation conformité automatique", "Désactivé"],
        ]} />
        <CardActions
          primary="Modifier paramètres IA"
          secondary="Tester résumé"
          primaryIcon={Bot}
          secondaryIcon={TestTube2}
          onPrimary={() => onAction({
            title: "Modifier paramètres IA",
            description: "Configurez les fonctions autorisées, les limites d’utilisation et les garde-fous de conformité.",
            primaryLabel: "Enregistrer IA",
            icon: Bot,
          })}
          onSecondary={() => onAction({
            title: "Tester résumé IA",
            description: "Lancez un test de synthèse non réglementaire avec données de démonstration.",
            primaryLabel: "Lancer le test",
            icon: TestTube2,
            mode: "test",
          })}
        />
      </ContentCard>
      <ContentCard title="Cadre de sécurité IA" description="Contrôles appliqués aux sorties générées.">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
          L’assistant IA aide à organiser l’information et à préparer les suivis. Il ne remplace pas le jugement professionnel du conseiller.
        </div>
        <CardActions
          primary="Voir limites d’utilisation"
          primaryIcon={Eye}
          onPrimary={() => onAction({
            title: "Limites d’utilisation IA",
            description: "L’IA peut résumer et structurer l’information, mais ne génère pas de conseil financier automatisé.",
            primaryLabel: "J’ai compris",
            icon: Eye,
            mode: "preview",
          })}
        />
      </ContentCard>
      <div className="xl:col-span-2">
        <InsuranceNeedsSettingsPanel />
      </div>
    </div>
  )
}

function BillingSection({ billing, onAction }: { billing: SettingsBillingSummary; onAction: OpenSettingsAction }) {
  const visibleModules = billing.moduleLabels.slice(0, 5).join(", ")
  const remainingModules = Math.max(0, billing.moduleLabels.length - 5)

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ConfigCard
        icon={CreditCard}
        title="Plan actuel"
        status={billing.isCustomAccess ? "Accès personnalisé" : billing.pricingModeLabel}
        description={`${billing.planLabel}: ${billing.priceSummary}. ${billing.planDescription}`}
        action="Changer de forfait"
        kind="billing"
        onAction={onAction}
      />
      <ConfigCard
        icon={UsersRound}
        title="Accès et sièges"
        status={`${billing.seatsUsed}/${billing.seatLimit} siège(s)`}
        description={`${billing.moduleLabels.length} modules actifs: ${visibleModules}${remainingModules ? ` + ${remainingModules}` : ""}.`}
        action="Gérer utilisateurs"
        kind="team-user"
        onAction={onAction}
      />
    </div>
  )
}

function IntegrationsSection({
  gmailStatus,
  onGmailDisconnected,
  onToast,
  onAction,
}: {
  gmailStatus: GmailConnectionStatus | null
  onGmailDisconnected: (status: GmailConnectionStatus) => void
  onToast: (message: string) => void
  onAction: OpenSettingsAction
}) {
  const [filter, setFilter] = useState<IntegrationFilter>("Tous")
  const [channelSettings, setChannelSettings] = useState<ReminderChannelSettings | null>(null)
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("")
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("")
  const [externalAutoNotify, setExternalAutoNotify] = useState(false)
  const [externalNotifyMinPriority, setExternalNotifyMinPriority] = useState<"HIGH" | "CRITICAL">("CRITICAL")
  const [channelsSaving, setChannelsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/reminders/channels/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.ok) {
          setChannelSettings(payload.data)
          setExternalAutoNotify(Boolean(payload.data.externalAutoNotify))
          setExternalNotifyMinPriority(payload.data.externalNotifyMinPriority === "HIGH" ? "HIGH" : "CRITICAL")
        }
      })
      .catch(() => {
        if (!cancelled) onToast("Impossible de charger les canaux Slack/Teams.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function disconnectGmail() {
    const response = await fetch("/api/integrations/google/gmail/disconnect", { method: "POST" })
    if (!response.ok) {
      onToast("La déconnexion Gmail a échoué.")
      return
    }
    onGmailDisconnected({ connected: false, configured: gmailStatus?.configured ?? true, email: null, connectedAt: null, lastUsedAt: null })
    onToast("Google Workspace déconnecté.")
  }

  async function saveReminderChannels(payload: { slackWebhookUrl?: string | null; teamsWebhookUrl?: string | null; externalAutoNotify?: boolean; externalNotifyMinPriority?: "HIGH" | "CRITICAL" }) {
    setChannelsSaving(true)
    try {
      const response = await fetch("/api/reminders/channels/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok || !body?.ok) {
        onToast(body?.error?.message ?? "La configuration Slack/Teams a échoué.")
        return
      }
      setChannelSettings(body.data)
      setExternalAutoNotify(Boolean(body.data.externalAutoNotify))
      setExternalNotifyMinPriority(body.data.externalNotifyMinPriority === "HIGH" ? "HIGH" : "CRITICAL")
      setSlackWebhookUrl("")
      setTeamsWebhookUrl("")
      onToast("Canaux Slack/Teams configurés.")
    } finally {
      setChannelsSaving(false)
    }
  }

  async function testReminderChannels(channel: "SLACK" | "TEAMS" | "ALL") {
    setChannelsSaving(true)
    try {
      const response = await fetch("/api/reminders/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      })
      const body = await response.json()
      if (!response.ok || !body?.ok) {
        onToast(body?.error?.message ?? "Le test Slack/Teams a échoué.")
        return
      }
      const failed = body.data.deliveries?.filter((delivery: { result?: { ok?: boolean } }) => !delivery.result?.ok)?.length ?? 0
      onToast(failed ? "Test envoyé avec au moins un canal en erreur." : "Test Slack/Teams envoyé.")
    } finally {
      setChannelsSaving(false)
    }
  }

  const entries = integrations.map((integration) => {
    const isGmail = integration.name === "Google Workspace"
    const isGmailConnected = Boolean(isGmail && gmailStatus?.connected)
    const needsReconnect = Boolean(isGmailConnected && gmailStatus?.hasWorkspaceScopes === false)
    const status = isGmail
      ? gmailStatus?.roleBlocked
        ? "Bloqué par rôle"
        : needsReconnect
        ? "Reconnecter"
        : isGmailConnected
        ? "Connecté"
        : gmailStatus?.configured === false
          ? "Configuration requise"
          : "Non connecté"
      : integration.status
    const tone = isGmail && gmailStatus?.roleBlocked ? "slate" : needsReconnect ? "amber" : isGmailConnected ? "emerald" : isGmail && gmailStatus?.configured === false ? "amber" : integration.tone
    const action = isGmail ? gmailStatus?.roleBlocked ? "Non disponible" : needsReconnect ? "Reconnecter" : isGmailConnected ? "Gérer" : "Connecter" : integration.action
    const lastSync = isGmailConnected ? gmailStatus?.lastUsedAt ?? "Connecté" : integration.lastSync
    return { ...integration, isGmail, isGmailConnected, status, tone, action, lastSync }
  })

  const filteredEntries = entries.filter((integration) => {
    if (filter === "Tous") return true
    if (filter === "Connectés") return integration.status === "Connecté"
    if (filter === "Non connectés") return integration.status === "Non connecté" || integration.status === "Reconnecter" || integration.status === "Configuration requise" || integration.status === "Disponible"
    if (filter === "Recommandés") return integration.status === "Recommandé" || integration.name === "Google Workspace"
    if (filter === "Bientôt disponible") return integration.status === "Bientôt disponible"
    return true
  })

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="sky">{entries.length} disponibles</StatusBadge>
              <StatusBadge tone="emerald">{entries.filter((entry) => entry.status === "Connecté").length} connectée</StatusBadge>
              <StatusBadge tone="amber">2 recommandées</StatusBadge>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Intégrations</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Connectez les outils du cabinet pour synchroniser calendriers, courriels, téléphonie, documents et notifications internes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction({
              title: "Ajouter une intégration",
              description: "Sélectionnez un outil et configurez la portée de synchronisation.",
              primaryLabel: "Ajouter l’intégration",
              icon: Link2,
              kind: "integration",
            })}>
              <Link2 className="size-4" />
              Ajouter une intégration
            </Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
              title: "Tester les connexions",
              description: "Vérifiez les connexions actives et les autorisations accordées.",
              primaryLabel: "Lancer le test",
              icon: TestTube2,
              kind: "integration",
              mode: "test",
            })}>
              <TestTube2 className="size-4" />
              Tester les connexions
            </Button>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
              title: "Journal des intégrations",
              description: "Consultez les synchronisations et erreurs récentes.",
              primaryLabel: "Fermer",
              icon: History,
              kind: "integration",
              mode: "preview",
            })}>
              <History className="size-4" />
              Voir le journal
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <div className="flex flex-wrap gap-2">
          {(["Tous", "Connectés", "Non connectés", "Recommandés", "Bientôt disponible"] as IntegrationFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                filter === item ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredEntries.map((integration) => (
            <div key={integration.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{integration.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{integration.description}</p>
                  {integration.isGmail && gmailStatus?.email ? <p className="mt-2 text-xs font-semibold text-emerald-700">Compte connecté : {gmailStatus.email}</p> : null}
                  {integration.isGmail && gmailStatus?.roleBlocked ? <p className="mt-2 text-xs font-semibold text-slate-600">Le rôle développeur ne peut pas connecter Google Workspace. Utilisez un compte propriétaire, conseiller ou conformité.</p> : null}
                  {integration.isGmail && gmailStatus?.connected && gmailStatus?.hasWorkspaceScopes === false ? <p className="mt-2 text-xs font-semibold text-amber-700">Reconnectez Google pour autoriser Calendar, Drive et Sheets.</p> : null}
                  {integration.isGmail && gmailStatus?.configured === false ? <p className="mt-2 text-xs font-semibold text-amber-700">Ajoutez les clés Google OAuth dans l’environnement.</p> : null}
                </div>
                <StatusBadge tone={integration.tone}>{integration.status}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">Portée : {integration.scope}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">Dernière synchronisation : {integration.lastSync}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={Boolean(integration.isGmail && gmailStatus?.roleBlocked)} onClick={() => {
                  if (integration.isGmail && (!integration.isGmailConnected || gmailStatus?.hasWorkspaceScopes === false)) {
                    window.location.href = "/api/integrations/google/gmail/connect"
                    return
                  }
                  onAction({
                    title: `${integration.action} - ${integration.name}`,
                    description: integration.isGmailConnected ? `Google Workspace est connecté avec ${gmailStatus?.email}. FinAssuro peut envoyer des courriels, synchroniser le calendrier et préparer l’accès Drive/Sheets autorisé.` : integration.description,
                    primaryLabel: integration.action,
                    icon: Link2,
                    mode: integration.action === "Voir" ? "preview" : "form",
                    kind: "integration",
                  })
                }}>
                  {integration.action === "Connecter" || integration.action === "Reconnecter" ? <Link2 className="size-3.5" /> : integration.action === "Configurer" || integration.action === "Gérer" ? <SlidersHorizontal className="size-3.5" /> : <Eye className="size-3.5" />}
                  {integration.action}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
                  title: `Détails - ${integration.name}`,
                  description: `${integration.description} Portée recommandée : ${integration.scope}. Dernière synchronisation : ${integration.lastSync}.`,
                  primaryLabel: "Fermer",
                  icon: Eye,
                  kind: "integration",
                  mode: "preview",
                })}>
                  <Eye className="size-3.5" />
                  Voir détails
                </Button>
                {integration.isGmailConnected ? (
                  <Button size="sm" variant="outline" className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50" disabled={Boolean(gmailStatus?.roleBlocked)} onClick={() => { void disconnectGmail() }}>
                    <X className="size-3.5" />
                    Déconnecter
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={channelSettings?.slackConfigured ? "emerald" : "slate"}>Slack {channelSettings?.slackConfigured ? "configuré" : "optionnel"}</StatusBadge>
              <StatusBadge tone={channelSettings?.teamsConfigured ? "emerald" : "slate"}>Teams {channelSettings?.teamsConfigured ? "configuré" : "optionnel"}</StatusBadge>
              {channelSettings?.roleBlocked ? <StatusBadge tone="slate">Rôle développeur bloqué</StatusBadge> : null}
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">Notifications Slack et Teams</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Configurez les canaux Slack et Microsoft Teams pour notifier le cabinet quand un rappel intelligent doit être escaladé.
            </p>
            {channelSettings?.envFallback.slack || channelSettings?.envFallback.teams ? (
              <p className="mt-2 text-xs font-semibold text-slate-600">Un fallback environnement est présent pour {channelSettings.envFallback.slack ? "Slack" : ""}{channelSettings.envFallback.slack && channelSettings.envFallback.teams ? " et " : ""}{channelSettings.envFallback.teams ? "Teams" : ""}.</p>
            ) : null}
          </div>
          <Button
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            disabled={channelsSaving || channelSettings?.roleBlocked || (!slackWebhookUrl.trim() && !teamsWebhookUrl.trim())}
            onClick={() => { void saveReminderChannels({ slackWebhookUrl: slackWebhookUrl.trim() || undefined, teamsWebhookUrl: teamsWebhookUrl.trim() || undefined }) }}
          >
            <CheckCircle2 className="size-4" />
            Enregistrer
          </Button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">URL Slack</label>
            <Input
              className="mt-2"
              disabled={channelsSaving || channelSettings?.roleBlocked}
              value={slackWebhookUrl}
              onChange={(event) => setSlackWebhookUrl(event.target.value)}
              placeholder={channelSettings?.slackConfigured ? "Canal Slack déjà configuré" : "https://hooks.slack.com/services/..."}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={channelsSaving || channelSettings?.roleBlocked || !channelSettings?.slackConfigured} onClick={() => { void testReminderChannels("SLACK") }}>
                Tester Slack
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={channelsSaving || channelSettings?.roleBlocked || !channelSettings?.slackConfigured} onClick={() => { void saveReminderChannels({ slackWebhookUrl: null }) }}>
                Retirer Slack
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">URL Teams</label>
            <Input
              className="mt-2"
              disabled={channelsSaving || channelSettings?.roleBlocked}
              value={teamsWebhookUrl}
              onChange={(event) => setTeamsWebhookUrl(event.target.value)}
              placeholder={channelSettings?.teamsConfigured ? "Canal Teams déjà configuré" : "https://..."}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={channelsSaving || channelSettings?.roleBlocked || !channelSettings?.teamsConfigured} onClick={() => { void testReminderChannels("TEAMS") }}>
                Tester Teams
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={channelsSaving || channelSettings?.roleBlocked || !channelSettings?.teamsConfigured} onClick={() => { void saveReminderChannels({ teamsWebhookUrl: null }) }}>
                Retirer Teams
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-slate-300 text-emerald-600"
                disabled={channelsSaving || channelSettings?.roleBlocked}
                checked={externalAutoNotify}
                onChange={(event) => setExternalAutoNotify(event.target.checked)}
              />
              <span>
                <span className="block font-semibold text-slate-950">Escalade automatique Slack/Teams</span>
                <span className="block leading-6 text-slate-600">Envoyer automatiquement les nouveaux rappels au-dessus du seuil choisi. Les recalculs ne renvoient pas le même rappel.</span>
              </span>
            </label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={channelsSaving || channelSettings?.roleBlocked || !externalAutoNotify}
              value={externalNotifyMinPriority}
              onChange={(event) => setExternalNotifyMinPriority(event.target.value === "HIGH" ? "HIGH" : "CRITICAL")}
            >
              <option value="CRITICAL">Critiques seulement</option>
              <option value="HIGH">Importants et critiques</option>
            </select>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl bg-white"
              disabled={channelsSaving || channelSettings?.roleBlocked}
              onClick={() => { void saveReminderChannels({ externalAutoNotify, externalNotifyMinPriority }) }}
            >
              Sauvegarder l’escalade automatique
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Button size="sm" variant="outline" className="rounded-xl bg-white" disabled={channelsSaving || channelSettings?.roleBlocked || (!channelSettings?.slackConfigured && !channelSettings?.teamsConfigured)} onClick={() => { void testReminderChannels("ALL") }}>
            <TestTube2 className="size-3.5" />
            Tester tous les canaux configurés
          </Button>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Les URL ne sont jamais réaffichées après sauvegarde. Les notifications Slack/Teams restent facultatives; les rappels internes continuent de fonctionner sans canal externe.
        </p>
      </section>
    </div>
  )
}

function DataSection({ onAction, onConfirm }: { onAction: OpenSettingsAction; onConfirm: OpenSettingsConfirmation }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ConfigCard icon={UploadCloud} title="Import et export" status="Disponible" description="Exporter les données, importer des fichiers et préparer les migrations." action="Exporter les données" onAction={onAction} mode="preview" />
      <ConfigCard icon={Database} title="Sauvegardes" status="Protégé" description="Conservation des données, sauvegardes et politiques de rétention." action="Voir sauvegardes" onAction={onAction} mode="preview" />
      <ConfigCard icon={ReceiptText} title="Journal d’audit" status="Disponible" description="Suivre les actions sensibles sans exposer les données confidentielles." action="Consulter" onAction={onAction} mode="preview" />
      <ConfigCard
        icon={LockKeyhole}
        title="Suppression de compte"
        status="Action sensible"
        description="Demande contrôlée avec confirmation et journalisation."
        action="Demander suppression"
        danger
        onAction={() => onConfirm({
          title: "Demander la suppression du compte",
          description: "Cette action est sensible. Une confirmation humaine et une vérification d’identité seront requises avant toute suppression.",
          confirmLabel: "Créer la demande",
          danger: true,
        })}
      />
    </div>
  )
}

function TemplateList({ templates, onAction, onConfirm }: { templates: CommunicationTemplate[]; onAction: OpenSettingsAction; onConfirm: OpenSettingsConfirmation }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="text-xs font-semibold text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="py-3 pr-4">Modèle</th>
            <th className="py-3 pr-4">Canal</th>
            <th className="py-3 pr-4">Statut</th>
            <th className="py-3 pr-4">Catégorie</th>
            <th className="py-3 pr-4">Utilisé dans</th>
            <th className="py-3 pr-4">Dernier test</th>
            <th className="py-3 pr-4">Dernière modification</th>
            <th className="py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className="border-b border-slate-100 last:border-0">
              <td className="py-4 pr-4">
                <div className="flex items-start gap-3">
                  <TemplateChannelIcon channel={template.channel} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{template.title}</p>
                    <p className="mt-1 line-clamp-1 max-w-sm text-xs text-slate-500">{template.subject ?? template.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {template.variables.slice(0, 3).map((variable) => (
                        <span key={variable} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{variable}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-4 pr-4">{template.channel}</td>
              <td className="py-4 pr-4"><TemplateStatusBadge status={template.status} /></td>
              <td className="py-4 pr-4">{template.category}</td>
              <td className="py-4 pr-4">{template.automations > 0 ? `Utilisé dans ${template.automations} automatisation${template.automations > 1 ? "s" : ""}` : "Non automatisé"}</td>
              <td className="py-4 pr-4">{template.lastTest}</td>
              <td className="py-4 pr-4">
                <p>{template.updatedAt}</p>
                <p className="text-xs text-slate-500">Par {template.updatedBy}</p>
              </td>
              <td className="py-4">
                <TemplateRowActions template={template} onAction={onAction} onConfirm={onConfirm} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-semibold text-slate-950">Aucun modèle ne correspond aux filtres.</p>
          <p className="mt-1 text-sm text-slate-500">Ajustez la recherche ou créez un nouveau modèle de communication.</p>
        </div>
      ) : null}
    </div>
  )
}

function TemplateCard({
  template,
  onAction,
  onConfirm,
}: {
  template: CommunicationTemplate
  onAction: OpenSettingsAction
  onConfirm: OpenSettingsConfirmation
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <TemplateChannelIcon channel={template.channel} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">{template.title}</p>
            <p className="mt-1 text-xs text-slate-500">{template.channel} · {template.category} · Par {template.updatedBy}</p>
          </div>
        </div>
        <TemplateStatusBadge status={template.status} />
      </div>
      <p className="mt-3 line-clamp-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-100">{template.body}</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <span>{template.automations > 0 ? `Utilisé dans ${template.automations} automatisation${template.automations > 1 ? "s" : ""}` : "Non automatisé"}</span>
        <span>{template.lastTest}</span>
        <span>{template.consent}</span>
        <span>{template.logging}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TemplateRowActions template={template} onAction={onAction} onConfirm={onConfirm} />
      </div>
    </div>
  )
}

function TemplateRowActions({ template, onAction, onConfirm }: { template: CommunicationTemplate; onAction: OpenSettingsAction; onConfirm: OpenSettingsConfirmation }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={() => openTemplateForm(template, onAction, "Modifier")}>
        <PenLine className="size-3.5" />
        Modifier
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl bg-white" onClick={() => onAction({
        title: `${template.channel === "SMS" ? "Tester" : "Prévisualiser"} - ${template.title}`,
        description: template.channel === "SMS" ? "Envoyez un test interne avec variables résolues et consentement vérifié." : "Prévisualisez ce courriel avec un client de démonstration et signature résolue.",
        primaryLabel: template.channel === "SMS" ? "Envoyer le test" : "Fermer",
        icon: template.channel === "SMS" ? TestTube2 : Eye,
        kind: "template",
        mode: template.channel === "SMS" ? "test" : "preview",
      })}>
        {template.channel === "SMS" ? <TestTube2 className="size-3.5" /> : <Eye className="size-3.5" />}
        {template.channel === "SMS" ? "Tester" : "Prévisualiser"}
      </Button>
      <details className="relative">
        <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 [&::-webkit-details-marker]:hidden" aria-label="Plus d’actions">
          <MoreHorizontal className="size-4" />
        </summary>
        <div className="absolute right-0 top-10 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
          <MenuAction icon={Copy} label="Dupliquer" onClick={() => openTemplateForm(template, onAction, "Dupliquer")} />
          <MenuAction icon={SlidersHorizontal} label={template.status === "Inactif" ? "Activer" : "Désactiver"} onClick={() => onAction({
            title: `${template.status === "Inactif" ? "Activer" : "Désactiver"} - ${template.title}`,
            description: "Modifiez le statut du modèle sans supprimer l’historique des communications envoyées.",
            primaryLabel: template.status === "Inactif" ? "Activer" : "Désactiver",
            icon: SlidersHorizontal,
            kind: "template",
          })} />
          <MenuAction icon={History} label="Historique" onClick={() => onAction({
            title: `Historique - ${template.title}`,
            description: `Dernière modification par ${template.updatedBy} le ${template.updatedAt}. Dernier test : ${template.lastTest}.`,
            primaryLabel: "Fermer",
            icon: History,
            kind: "template",
            mode: "preview",
          })} />
          <MenuAction icon={X} label="Supprimer" danger onClick={() => onConfirm({
            title: `Supprimer ce modèle ?`,
            description: `Le modèle “${template.title}” sera retiré des choix actifs. Les anciens messages envoyés resteront dans l’historique.`,
            confirmLabel: "Supprimer le modèle",
            danger: true,
          })} />
        </div>
      </details>
    </div>
  )
}

function ConfigCard({
  icon: Icon,
  title,
  status,
  description,
  action,
  kind,
  danger = false,
  mode = "form",
  onAction,
}: {
  icon: LucideIcon
  title: string
  status: string
  description: string
  action: string
  kind?: SettingsActionKind
  danger?: boolean
  mode?: SettingsAction["mode"]
  onAction: OpenSettingsAction
}) {
  return (
    <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_7px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_9px_0_#bbf7d0]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-2.5 text-slate-700">
          <Icon className="size-5" />
        </div>
        <StatusBadge tone={status === "Actif" || status === "Disponible" || status === "Protégé" ? "emerald" : status === "Non connecté" ? "slate" : "amber"}>{status}</StatusBadge>
      </div>
      <h3 className="mt-3 text-base font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      <Button variant={danger ? "destructive" : "outline"} className="mt-4 h-10 rounded-2xl border-2 font-black shadow-[0_4px_0_#e2e8f0]" onClick={() => onAction({
        title: `${action} - ${title}`,
        description: kind === "organization" ? "Mettez à jour l’identité, la localisation et les contacts publics." : description,
        primaryLabel: kind === "organization" ? "Enregistrer" : action,
        icon: Icon,
        kind,
        mode,
        danger,
      })}>
        {mode === "preview" ? <Eye className="size-4" /> : danger ? <LockKeyhole className="size-4" /> : <PenLine className="size-4" />}
        {action}
      </Button>
    </div>
  )
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  )
}

function CardActions({
  primary,
  secondary,
  primaryIcon: PrimaryIcon = Send,
  secondaryIcon: SecondaryIcon = SlidersHorizontal,
  onPrimary,
  onSecondary,
}: {
  primary: string
  secondary?: string
  primaryIcon?: LucideIcon
  secondaryIcon?: LucideIcon
  onPrimary: () => void
  onSecondary?: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={onPrimary}>
        <PrimaryIcon className="size-4" />
        {primary}
      </Button>
      {secondary ? (
        <Button variant="outline" className="rounded-xl" onClick={onSecondary}>
          <SecondaryIcon className="size-4" />
          {secondary}
        </Button>
      ) : null}
    </div>
  )
}

function getActiveSectionAction(section: SettingSectionId): { label: string; icon: LucideIcon; action: SettingsAction } {
  const actions: Record<SettingSectionId, { label: string; icon: LucideIcon; action: SettingsAction }> = {
    general: {
      label: "Modifier les préférences",
      icon: SlidersHorizontal,
      action: {
        title: "Modifier les préférences générales",
        description: "Ajustez la langue, le fuseau horaire, la devise, la page d’accueil et les vues par défaut.",
        primaryLabel: "Enregistrer les préférences",
        icon: SlidersHorizontal,
        kind: "general",
      },
    },
    advisor: {
      label: "Modifier le profil",
      icon: ShieldUser,
      action: {
        title: "Modifier le profil conseiller",
        description: "Mettez à jour le titre professionnel, les coordonnées, les spécialités et les zones desservies.",
        primaryLabel: "Enregistrer le profil",
        icon: ShieldUser,
        kind: "advisor-profile",
      },
    },
    organization: {
      label: "Modifier le cabinet",
      icon: Building2,
      action: {
        title: "Modifier le cabinet",
        description: "Mettez à jour l’identité, la localisation et les contacts publics.",
        primaryLabel: "Enregistrer",
        icon: Building2,
        kind: "organization",
      },
    },
    team: {
      label: "Gérer l’équipe",
      icon: UsersRound,
      action: {
        title: "Gérer l’équipe",
        description: "Consultez les accès et configurez les permissions des rôles.",
        primaryLabel: "Enregistrer les rôles",
        icon: UsersRound,
        kind: "team-role",
      },
    },
    security: {
      label: "Renforcer la sécurité",
      icon: LockKeyhole,
      action: {
        title: "Renforcer la sécurité",
        description: "Configurez 2FA, sessions, accès invités, confidentialité et audit des actions sensibles.",
        primaryLabel: "Enregistrer la sécurité",
        icon: LockKeyhole,
        kind: "security",
      },
    },
    notifications: {
      label: "Configurer notification",
      icon: Bell,
      action: {
        title: "Configurer une notification",
        description: "Sélectionnez l’événement, les canaux et la fréquence d’envoi.",
        primaryLabel: "Enregistrer notification",
        icon: Bell,
        kind: "notification",
      },
    },
    templates: {
      label: "Créer un modèle",
      icon: MessageSquareText,
      action: {
        title: "Créer un modèle",
        description: "Créez un modèle SMS ou courriel avec variables, consentement, aperçu et automatisation.",
        primaryLabel: "Enregistrer le modèle",
        icon: MessageSquareText,
        kind: "template",
      },
    },
    documents: {
      label: "Ajouter un type",
      icon: FileCheck2,
      action: {
        title: "Ajouter un type de document",
        description: "Définissez un nouveau document requis, son statut initial et sa règle de validation.",
        primaryLabel: "Ajouter le document",
        icon: FileCheck2,
        kind: "document",
      },
    },
    compliance: {
      label: "Modifier les règles",
      icon: ShieldCheck,
      action: {
        title: "Modifier les règles de conformité",
        description: "Ajustez les règles du profil client, consentements, documents obligatoires et validations requises.",
        primaryLabel: "Enregistrer les règles",
        icon: ShieldCheck,
        kind: "compliance",
      },
    },
    ai: {
      label: "Configurer l’IA",
      icon: Bot,
      action: {
        title: "Modifier paramètres IA",
        description: "Configurez les fonctions autorisées, les limites d’utilisation et les garde-fous de conformité.",
        primaryLabel: "Enregistrer IA",
        icon: Bot,
        kind: "ai",
      },
    },
    billing: {
      label: "Changer de forfait",
      icon: CreditCard,
      action: {
        title: "Changer de forfait",
        description: "Modifiez le forfait, la devise et les sièges inclus.",
        primaryLabel: "Mettre à jour le forfait",
        icon: CreditCard,
        kind: "billing",
      },
    },
    integrations: {
      label: "Ajouter intégration",
      icon: Link2,
      action: {
        title: "Ajouter une intégration",
        description: "Connectez un outil du cabinet avec une portée claire et contrôlée.",
        primaryLabel: "Configurer",
        icon: Link2,
        kind: "integration",
      },
    },
    data: {
      label: "Exporter données",
      icon: Download,
      action: {
        title: "Exporter les données",
        description: "Préparez un export contrôlé et journalisé des données de l’organisation.",
        primaryLabel: "Préparer l’export",
        icon: Download,
        kind: "data",
        mode: "preview",
      },
    },
  }

  return actions[section]
}

function getSectionForSummary(label: string): SettingSectionId {
  const map: Record<string, SettingSectionId> = {
    Organisation: "organization",
    Utilisateurs: "team",
    "Rôle actif": "team",
    Plan: "billing",
    Sécurité: "security",
    Notifications: "notifications",
  }
  return map[label] ?? "general"
}

function getSuccessMessage(title: string) {
  if (/inviter|invitation/i.test(title)) return "Utilisateur invité."
  if (/modèle|template/i.test(title)) return "Modèle enregistré."
  if (/notification/i.test(title)) return "Notification mise à jour."
  if (/conformité/i.test(title)) return "Règle de conformité enregistrée."
  if (/test/i.test(title)) return "Test préparé."
  if (/export|facture|sauvegarde|audit/i.test(title)) return "Action préparée."
  return "Paramètres enregistrés."
}

function getActionKind(action: SettingsAction): SettingsActionKind {
  if (action.kind) return action.kind

  const text = normalizeActionText(`${action.title} ${action.description} ${action.primaryLabel ?? ""}`)

  if (hasAny(text, ["signature"])) return "advisor-signature"
  if (hasAny(text, ["photo", "avatar"])) return "advisor-photo"
  if (hasAny(text, ["profil conseiller", "titre professionnel", "specialites", "zones desservies", "licence professionnelle"])) return "advisor-profile"
  if (hasAny(text, ["confidentialite", "masquer telephones", "masquage"])) return "privacy"
  if (hasAny(text, ["2fa", "authentification", "sessions actives", "securite", "acces invites"])) return "security"
  if (hasAny(text, ["notification", "rappel", "frequence", "canaux"])) return "notification"
  if (hasAny(text, ["modele", "sms", "courriel", "email", "variables client"])) return "template"
  if (hasAny(text, ["document", "ocr", "statuts documentaires", "piece d'identite", "validation documentaire"])) return "document"
  if (hasAny(text, ["conformite", "kyc", "consentement", "profil de risque", "audit conformite"])) return "compliance"
  if (hasAny(text, ["assistant ia", "parametres ia", "resume ia", "limites d'utilisation ia", "classement de documents"])) return "ai"
  if (hasAny(text, ["plan", "facture", "abonnement", "paiement", "utilisateurs inclus"])) return "billing"
  if (hasAny(text, ["integration", "connecter", "google calendar", "outlook", "gmail", "twilio", "signature electronique", "api"])) return "integration"
  if (hasAny(text, ["organisation", "cabinet", "coordonnees publiques", "identite du cabinet", "numero d'entreprise"])) return "organization"
  if (hasAny(text, ["export", "sauvegarde", "donnees sensibles", "gestion des donnees", "suppression de compte", "retention"])) return "data"
  if (hasAny(text, ["roles", "permissions par role", "gerer les roles"])) return "team-role"
  if (hasAny(text, ["utilisateur", "inviter", "invitation", "modifier marie", "modifier sarah", "modifier nadia"])) return "team-user"
  if (hasAny(text, ["marque", "logo", "couleur principale", "communications"])) return "brand"

  return "general"
}

function normalizeActionText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function matchesTemplateFilter(template: CommunicationTemplate, filter: TemplateFilter) {
  if (filter === "Tous") return true
  if (filter === "SMS") return template.channel === "SMS"
  if (filter === "Courriels") return template.channel === "Courriel"
  if (filter === "Actifs") return template.status === "Actif"
  if (filter === "À personnaliser") return template.status === "À personnaliser"
  if (filter === "Automatisés") return template.automations > 0
  return true
}

function openTemplateForm(template: CommunicationTemplate, onAction: OpenSettingsAction, mode: "Modifier" | "Dupliquer") {
  onAction({
    title: `${mode} - ${template.title}`,
    description: `${template.channel} · ${template.category}. ${template.automations > 0 ? `Utilisé dans ${template.automations} automatisation${template.automations > 1 ? "s" : ""}.` : "Non automatisé."}`,
    primaryLabel: mode === "Dupliquer" ? "Enregistrer la copie" : "Enregistrer le modèle",
    icon: mode === "Dupliquer" ? Copy : MessageSquareText,
    kind: "template",
  })
}

function getTemplateFromAction(action: SettingsAction) {
  const actionText = normalizeActionText(action.title)
  return communicationTemplates.find((template) => actionText.includes(normalizeActionText(template.title)))
}

function templateStatusTone(status: CommunicationTemplate["status"]): Tone {
  if (status === "Actif") return "emerald"
  if (status === "Inactif") return "slate"
  return "amber"
}

function TemplateStatusBadge({ status }: { status: CommunicationTemplate["status"] }) {
  return <StatusBadge tone={templateStatusTone(status)}>{status}</StatusBadge>
}

function TemplateChannelIcon({ channel }: { channel: CommunicationTemplate["channel"] }) {
  const Icon = channel === "SMS" ? Smartphone : Mail
  return (
    <div className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
      channel === "SMS" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-sky-50 text-sky-700 ring-sky-100"
    )}>
      <Icon className="size-4" />
    </div>
  )
}

function MenuAction({ icon: Icon, label, danger = false, onClick }: { icon: LucideIcon; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function templateSampleVariables(profile?: Partial<AdvisorProfile>) {
  const displayName = profile ? getAdvisorDisplayName(profile) : "Conseiller"
  const title = profile?.title?.trim() || "Espace sécurisé"
  const phone = profile?.phone?.trim() || "(438) 500-0678"
  const email = profile?.email?.trim() || "conseiller@cabinet.ca"
  const signature = profile?.signatureEmail?.trim() || [
    displayName,
    title,
    "FinAssuro CRM",
    `${phone} · ${email} · Site web`,
  ].join("\n")

  return {
    "{{prenom}}": "Marc",
    "{{nom}}": "Tremblay",
    "{{nom_conseiller}}": displayName,
    "{{date_rendez_vous}}": "8 mai 2026 à 10 h",
    "{{lien_document}}": "https://finassuro.com/upload/securise",
    "{{nom_document}}": "Pièce d’identité",
    "{{nom_cabinet}}": "FinAssuro CRM",
    "{{telephone_conseiller}}": phone,
    "{{courriel_conseiller}}": email,
    "{{titre_conseiller}}": title,
    "{{signature_conseiller}}": signature,
  }
}

function resolveTemplatePreview(value: string, profile?: Partial<AdvisorProfile>) {
  const variables = templateSampleVariables(profile)
  return Object.entries(variables).reduce((content, [key, replacement]) => content.replaceAll(key, replacement), value)
}

function TemplatePreviewPanel({ template }: { template: CommunicationTemplate }) {
  const { advisorProfile } = useAdvisorProfile()
  const resolvedSubject = template.subject ? resolveTemplatePreview(template.subject, advisorProfile) : null
  const resolvedBody = resolveTemplatePreview(template.body, advisorProfile)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Aperçu avec variables résolues</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">{template.title}</h3>
        </div>
        <TemplateStatusBadge status={template.status} />
      </div>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        {resolvedSubject ? <p className="mb-3 text-sm font-semibold text-slate-950">Objet : {resolvedSubject}</p> : null}
        <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{resolvedBody}</p>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">
          <Workflow className="size-4" />
          {template.automations > 0 ? `Utilisé dans ${template.automations} automatisation${template.automations > 1 ? "s" : ""}` : "Non automatisé"}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-900">
          <TestTube2 className="size-4" />
          {template.lastTest}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">
          <ShieldCheck className="size-4" />
          {template.consent}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
          <Clock3 className="size-4" />
          Modifié par {template.updatedBy} · {template.updatedAt}
        </div>
      </div>
    </section>
  )
}

function TemplateVariableLibrary() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-sky-50 p-2 text-sky-700 ring-1 ring-sky-100">
          <LibraryBig className="size-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-950">Variables disponibles</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Variables standardisées pour éviter les messages incomplets.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {templateVariableLibrary.map((variable) => (
          <div key={variable.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-mono text-xs font-semibold text-slate-950">{variable.key}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{variable.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SettingsToast({ message }: { message: string }) {
  return (
    <div className="fixed right-4 top-24 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
      <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
      <span>{message}</span>
    </div>
  )
}

function SettingsActionDrawer({
  action,
  settings,
  onClose,
  onSave,
}: {
  action: SettingsAction
  settings: SettingsFormState
  onClose: () => void
  onSave: (values: SettingsFormValues) => Promise<void> | void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const Icon = action.icon ?? Settings
  const isPreview = action.mode === "preview"
  const isTest = action.mode === "test"
  const blockedTeamInviteReason = getActionKind(action) === "team-user" && hasAny(normalizeActionText(action.title), ["inviter", "invitation"])
    ? getTeamInviteBlockReason(settings.billing)
    : null

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blockedTeamInviteReason) return
    setIsSaving(true)
    try {
      await onSave(formValuesFromElement(event.currentTarget))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={action.title} onMouseDown={onClose}>
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l-2 border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-100 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className={cn("rounded-2xl border-2 p-3 shadow-[0_4px_0_#e2e8f0]", action.danger ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700")}>
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">{action.title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{action.description}</p>
            </div>
          </div>
          <button type="button" className="rounded-2xl border-2 border-transparent p-2 text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={onClose} aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {isPreview ? <ActionPreview action={action} settings={settings} /> : isTest ? <ActionTestForm action={action} /> : <ActionEditForm action={action} settings={settings} />}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t-2 border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-2 px-4 font-black shadow-[0_4px_0_#e2e8f0]" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" variant={action.danger ? "destructive" : "default"} className={cn("h-11 rounded-2xl border-2 px-4 font-black", action.danger ? "" : "border-emerald-700 bg-emerald-600 shadow-[0_4px_0_#047857] hover:bg-emerald-700")} disabled={isSaving || Boolean(blockedTeamInviteReason)} title={blockedTeamInviteReason ?? undefined}>
              {isPreview ? <Eye className="size-4" /> : isTest ? <TestTube2 className="size-4" /> : <PenLine className="size-4" />}
              {blockedTeamInviteReason ? "Invitation indisponible" : isSaving ? "Enregistrement..." : action.primaryLabel ?? "Enregistrer"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function formValuesFromElement(form: HTMLFormElement): SettingsFormValues {
  const values: SettingsFormValues = {}
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") values[key] = value
  }
  return values
}

function normalizeOrganizationProfile(values: Partial<Record<keyof OrganizationSettingsProfile, string | null | undefined>>): OrganizationSettingsProfile {
  return {
    name: values.name?.trim() || "FinAssuro CRM",
    legalName: values.legalName?.trim() ?? "",
    businessNumber: values.businessNumber?.trim() ?? "",
    phone: values.phone?.trim() ?? "",
    contactEmail: values.contactEmail?.trim() ?? "",
    website: values.website?.trim() ?? "",
    country: values.country === "France" ? "France" : "Canada",
    region: values.region?.trim() ?? "",
    city: values.city?.trim() ?? "",
    publicAddress: values.publicAddress?.trim() ?? "",
  }
}

function ActionEditForm({ action, settings }: { action: SettingsAction; settings: SettingsFormState }) {
  const kind = getActionKind(action)

  return (
    <div className="grid gap-5">
      <ActionContext action={action} kind={kind} />
      {kind === "advisor-profile" ? <AdvisorProfileForm profile={settings.advisorProfile} /> : null}
      {kind === "advisor-signature" ? <AdvisorSignatureForm profile={settings.advisorProfile} /> : null}
      {kind === "advisor-photo" ? <AdvisorPhotoForm /> : null}
      {kind === "organization" ? <OrganizationForm billing={settings.billing} organization={settings.organization} /> : null}
      {kind === "brand" ? <BrandForm /> : null}
      {kind === "team-user" ? <TeamUserForm action={action} billing={settings.billing} /> : null}
      {kind === "team-role" ? <RolePermissionsForm /> : null}
      {kind === "security" ? <SecurityForm action={action} /> : null}
      {kind === "privacy" ? <PrivacyForm /> : null}
      {kind === "notification" ? <NotificationForm action={action} /> : null}
      {kind === "template" ? <TemplateForm action={action} /> : null}
      {kind === "document" ? <DocumentSettingsForm action={action} /> : null}
      {kind === "compliance" ? <ComplianceSettingsForm /> : null}
      {kind === "ai" ? <AiSettingsForm /> : null}
      {kind === "billing" ? <BillingSettingsForm billing={settings.billing} /> : null}
      {kind === "integration" ? <IntegrationSettingsForm action={action} /> : null}
      {kind === "data" ? <DataSettingsForm action={action} /> : null}
      {kind === "general" ? <GeneralSettingsForm preferences={settings.generalPreferences} /> : null}
      <ProfessionalSaveNotice kind={kind} />
    </div>
  )
}

function ActionPreview({ action, settings }: { action: SettingsAction; settings: SettingsFormState }) {
  const kind = getActionKind(action)

  if (kind === "template") {
    const fullName = `${settings.advisorProfile.firstName} ${settings.advisorProfile.lastName}`.trim()
    const template = getTemplateFromAction(action) ?? communicationTemplates.find((item) => item.id === "email-document-request") ?? communicationTemplates[0]

    return (
      <div className="grid gap-4">
        <TemplatePreviewPanel template={template} />
        <TemplateVariableLibrary />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Signature actuelle : {fullName} · {settings.advisorProfile.title}. Chaque envoi doit conserver le consentement et être journalisé dans l’historique client.
        </div>
      </div>
    )
  }

  if (kind === "security" || kind === "privacy" || kind === "compliance") {
    return (
      <div className="grid gap-4">
        <PreviewItem icon={ShieldCheck} label="Contrôle serveur" value="Permission vérifiée à chaque action sensible" />
        <PreviewItem icon={ReceiptText} label="Journalisation" value="Modification conservée dans l’audit trail" />
        <PreviewItem icon={LockKeyhole} label="Portée" value="Application aux utilisateurs et dossiers autorisés seulement" />
        <PreviewItem icon={CheckCircle2} label="Statut" value="Prêt pour configuration owner" />
      </div>
    )
  }

  if (kind === "billing") {
    const billing = settings.billing

    return (
      <div className="grid gap-4">
        <InfoGrid items={[
          ["Plan actuel", billing.planLabel],
          ["Offre", billing.pricingModeLabel],
          ["Devise", billing.currency],
          ["Prix", billing.priceSummary],
          ["Statut", billing.statusLabel],
          ["Sièges conseiller", `${billing.seatsUsed}/${billing.seatLimit}`],
          ["Modules actifs", String(billing.moduleLabels.length)],
          ["Type d’accès", billing.isCustomAccess ? "Personnalisé par développeur" : `Défaut ${billing.planLabel}`],
        ]} />
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Modules inclus</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {billing.moduleLabels.map((moduleLabel) => (
              <span key={moduleLabel} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {moduleLabel}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (kind === "data") {
    return (
      <div className="grid gap-4">
        <PreviewItem icon={Download} label="Export" value="CSV, JSON et pièces jointes sur demande contrôlée" />
        <PreviewItem icon={Database} label="Sauvegardes" value="Conservation et rétention par organisation" />
        <PreviewItem icon={ReceiptText} label="Audit" value="Métadonnées seulement, sans contenu sensible complet" />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-950">{action.title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewItem icon={CheckCircle2} label="Statut" value="Disponible" />
        <PreviewItem icon={ShieldCheck} label="Contrôle" value="Accès owner requis" />
        <PreviewItem icon={ReceiptText} label="Audit" value="Action journalisée" />
        <PreviewItem icon={Download} label="Export" value="Préparé sur demande" />
      </div>
    </div>
  )
}

function ActionTestForm({ action }: { action: SettingsAction }) {
  const kind = getActionKind(action)
  const { advisorProfile } = useAdvisorProfile()

  if (kind === "template") {
    const template = getTemplateFromAction(action) ?? communicationTemplates.find((item) => item.id === "sms-missing-document") ?? communicationTemplates[0]

    return (
      <div className="grid gap-4">
        <FormSection title="Test d’envoi contextualisé" description="Le test reste interne et utilise des variables de démonstration avant toute utilisation client.">
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledSelect label="Modèle à tester" options={communicationTemplates.map((item) => item.title)} defaultValue={template.title} />
            <LabeledSelect label="Canal" options={["SMS", "Courriel"]} defaultValue={template.channel} />
            <LabeledInput label="Destinataire interne" defaultValue={template.channel === "SMS" ? "(438) 500-0678" : "conseiller@cabinet.ca"} />
            <LabeledSelect label="Client de prévisualisation" options={["Marc Tremblay", "Andrée Aubergiste", "Client de démonstration"]} />
          </div>
          <LabeledTextarea label="Message généré" defaultValue={resolveTemplatePreview(template.subject ? `${template.subject}\n\n${template.body}` : template.body, advisorProfile)} rows={template.channel === "SMS" ? 4 : 8} />
          <CheckboxList items={["Confirmer que le test reste interne", "Vérifier le consentement avant usage client", "Journaliser le test dans l’historique du modèle"]} />
        </FormSection>
        <TemplatePreviewPanel template={template} />
        <SafeAutomationNotice />
      </div>
    )
  }

  if (kind === "notification") {
    return (
      <div className="grid gap-4">
        <LabeledSelect label="Événement de test" options={["Document reçu", "Tâche en retard", "Profil client incomplet", "Rendez-vous à venir"]} />
        <ChannelChecklist />
        <LabeledInput label="Destinataire interne" defaultValue="conseiller@cabinet.ca" type="email" />
        <LabeledTextarea label="Message de test" defaultValue="Test interne : une notification de document reçu sera affichée dans l’application et envoyée selon les canaux choisis." />
      </div>
    )
  }

  if (kind === "ai") {
    return (
      <div className="grid gap-4">
        <LabeledSelect label="Scénario IA" options={["Résumé dossier client", "Résumé appel", "Liste des informations manquantes", "Aide courriel"]} />
        <LabeledTextarea label="Contexte de test" defaultValue="Client en onboarding, profil client manquant, deux documents requis, aucun produit actif." />
        <SafeAutomationNotice />
      </div>
    )
  }

  if (kind === "integration") {
    return (
      <div className="grid gap-4">
        <LabeledSelect label="Vérification" options={["Synchronisation calendrier", "Envoi courriel test", "Téléphonie", "Notifications internes"]} />
        <LabeledInput label="Compte ou identifiant à vérifier" defaultValue="cabinet@exemple.ca" />
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          Le test vérifie la configuration sans importer de données client réelles.
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <LabeledInput label="Destinataire de test" defaultValue="conseiller@cabinet.ca" />
      <LabeledTextarea label="Message de test" defaultValue={`Test interne : ${action.title}`} />
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Le test reste interne et ne transmet aucun conseil financier automatisé.
      </div>
    </div>
  )
}

function ActionContext({ action, kind }: { action: SettingsAction; kind: SettingsActionKind }) {
  const labels: Record<SettingsActionKind, string> = {
    general: "Préférences générales",
    "advisor-profile": "Profil conseiller",
    "advisor-signature": "Signature professionnelle",
    "advisor-photo": "Photo de profil",
    organization: "Fiche cabinet",
    brand: "Marque du cabinet",
    "team-user": "Utilisateur et accès",
    "team-role": "Rôles et permissions",
    security: "Sécurité",
    privacy: "Confidentialité",
    notification: "Notification",
    template: "Modèle de communication",
    document: "Documents",
    compliance: "Conformité",
    ai: "Assistant IA",
    billing: "Facturation",
    integration: "Intégration",
    data: "Données et confidentialité",
  }
  const contextLabels: Partial<Record<SettingsActionKind, string>> = {
    general: "Synchronisé avec l’espace",
    organization: "Synchronisé avec l’espace",
    security: "Contrôles sensibles",
    template: "Contenu réutilisable",
    billing: "Lecture seule",
  }
  const contextDescriptions: Partial<Record<SettingsActionKind, string>> = {
    general: "Ces choix servent de base pour l’affichage, les communications, les exports et les rapports du cabinet.",
    organization: "Ces informations alimentent la fiche du cabinet, les communications et les coordonnées publiques.",
  }

  return (
    <div className="rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="sky">{labels[kind]}</StatusBadge>
        <span className="text-xs font-bold text-slate-500">{contextLabels[kind] ?? "Paramètre sélectionné"}</span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{contextDescriptions[kind] ?? action.description}</p>
    </div>
  )
}

function GeneralSettingsForm({ preferences }: { preferences: GeneralPreferencesProfile }) {
  return (
    <FormSection title="Préférences de l’espace conseiller" description="Définissez l’affichage, la langue et les valeurs utilisées par défaut dans le CRM.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput name="spaceName" label="Nom affiché dans l’application" defaultValue={preferences.spaceName} />
        <LabeledSelect name="homePage" label="Écran d’accueil" options={["Tableau de bord", "Clients", "Pipeline", "Priorités", "Calendrier"]} defaultValue={preferences.homePage} />
        <LabeledSelect name="language" label="Langue de travail" options={["Français", "Anglais"]} defaultValue={preferences.language} />
        <LabeledSelect name="timezone" label="Fuseau horaire principal" options={["America/Toronto", "America/New_York", "America/Vancouver", "Europe/Paris"]} defaultValue={preferences.timezone} />
        <LabeledSelect name="currency" label="Devise par défaut" options={["CAD", "EUR", "USD"]} defaultValue={preferences.currency} />
        <LabeledSelect name="dateFormat" label="Format de date" options={["JJ/MM/AAAA", "AAAA-MM-JJ", "MM/JJ/AAAA"]} defaultValue={preferences.dateFormat} />
        <LabeledSelect name="clientView" label="Vue clients par défaut" options={["Liste", "Cartes", "Tableau compact"]} defaultValue={preferences.clientView} />
        <LabeledSelect name="pipelineView" label="Vue pipeline par défaut" options={["Kanban", "Liste", "Prévisions"]} defaultValue={preferences.pipelineView} />
        <LabeledSelect name="reminders" label="Rappels automatiques" options={["Activés", "Importants seulement", "Désactivés"]} defaultValue={preferences.reminders} />
        <LabeledSelect name="aiMode" label="Assistant IA" options={["Résumés seulement", "Suggestions et résumés", "Désactivé"]} defaultValue={preferences.aiMode} />
      </div>
      <div className="grid gap-3 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 sm:grid-cols-3">
        <PreferenceHint label="Interface" value="Appliqué aux listes, tableaux et tableaux de bord." />
        <PreferenceHint label="Communications" value="Utilisé comme préférence pour les modèles client." />
        <PreferenceHint label="Rapports" value="Repris dans les exports et les vues financières." />
      </div>
    </FormSection>
  )
}

function PreferenceHint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-emerald-800">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">{value}</p>
    </div>
  )
}

function AdvisorProfileForm({ profile }: { profile: AdvisorProfile }) {
  return (
    <FormSection title="Identité professionnelle" description="Informations visibles dans les communications et les dossiers.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput name="firstName" label="Prénom" defaultValue={profile.firstName} />
        <LabeledInput name="lastName" label="Nom" defaultValue={profile.lastName} />
        <LabeledInput name="title" label="Titre professionnel" defaultValue={profile.title} />
        <LabeledInput name="email" label="Courriel professionnel" defaultValue={profile.email === "Courriel du conseiller" ? "" : profile.email} placeholder="conseiller@cabinet.ca" type="email" />
        <LabeledInput name="phone" label="Téléphone professionnel" defaultValue={profile.phone} placeholder="(438) 000-0000" />
        <LabeledInput name="licenseNumber" label="Numéro de licence" defaultValue={profile.licenseNumber} placeholder="Numéro professionnel" />
        <LabeledSelect name="language" label="Langue préférée" options={["Français", "Anglais"]} defaultValue={profile.language} />
      </div>
      <LabeledTextarea name="specialties" label="Spécialités" defaultValue={profile.specialties} rows={4} />
        <LabeledTextarea name="zones" label="Zones desservies" defaultValue={profile.zones} rows={3} />
    </FormSection>
  )
}

function AdvisorSignatureForm({ profile }: { profile: AdvisorProfile }) {
  const fullName = profile.displayName

  return (
    <FormSection title="Signatures de communication" description="Signature utilisée dans les courriels, SMS et suivis administratifs.">
      <LabeledTextarea name="signatureEmail" label="Signature courriel" defaultValue={profile.signatureEmail} rows={6} />
      <LabeledTextarea name="signatureSms" label="Signature SMS" defaultValue={profile.signatureSms} rows={3} />
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Aperçu court : Bonjour Marc, merci pour votre retour. - {fullName}, {profile.title.toLowerCase()}
      </div>
    </FormSection>
  )
}

function AdvisorPhotoForm() {
  return (
    <FormSection title="Photo de profil" description="Ajoutez une photo professionnelle utilisée dans le profil et les communications.">
      <LabeledInput label="Téléverser une photo" type="file" />
      <LabeledSelect label="Visibilité" options={["Visible dans les communications", "Visible seulement en interne", "Masquée"]} />
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Format recommandé : image carrée, visage centré, fond sobre, minimum 512 x 512 px.
      </div>
    </FormSection>
  )
}

function OrganizationForm({ billing, organization }: { billing: SettingsBillingSummary; organization: OrganizationSettingsProfile }) {
  return (
    <FormSection title="Identité et coordonnées" description="Nom, immatriculation, contacts, pays et adresse du cabinet.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput label="Nom du cabinet" name="name" defaultValue={organization.name} />
        <ReadOnlyFormValue label="Type d’organisation" value={billing.organizationTypeLabel} />
        <LabeledInput label="Nom légal" name="legalName" defaultValue={organization.legalName} placeholder="Nom légal du cabinet" />
        <LabeledInput label="Numéro d’entreprise" name="businessNumber" defaultValue={organization.businessNumber} placeholder="NEQ ou numéro d’entreprise" />
        <LabeledInput label="Téléphone principal" name="phone" defaultValue={organization.phone} placeholder="(438) 000-0000" />
        <LabeledInput label="Courriel de contact" name="contactEmail" defaultValue={organization.contactEmail} placeholder="contact@cabinet.ca" type="email" />
        <LabeledInput label="Site web" name="website" defaultValue={organization.website} placeholder="https://cabinet.ca" />
      </div>
      <OrganizationLocationFields organization={organization} />
      <LabeledTextarea label="Adresse publique" name="publicAddress" defaultValue={organization.publicAddress} placeholder="Adresse complète du cabinet" rows={3} />
    </FormSection>
  )
}

function ReadOnlyFormValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <div className="flex h-11 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
        {value}
      </div>
    </div>
  )
}

function OrganizationLocationFields({ organization }: { organization: OrganizationSettingsProfile }) {
  const initialCountry = organization.country === "France" ? "France" : "Canada"
  const [country, setCountry] = useState<"Canada" | "France">(initialCountry)
  const locationOptions = country === "Canada"
    ? {
        regionLabel: "Province",
        regions: ["Québec", "Ontario", "Colombie-Britannique", "Alberta", "Manitoba", "Nouveau-Brunswick", "Nouvelle-Écosse", "Saskatchewan", "Terre-Neuve-et-Labrador", "Île-du-Prince-Édouard"],
        cityLabel: "Ville",
        cities: ["Montréal", "Québec", "Laval", "Gatineau", "Toronto", "Ottawa", "Vancouver", "Calgary"],
      }
    : {
        regionLabel: "Région",
        regions: ["Île-de-France", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine", "Occitanie", "Provence-Alpes-Côte d’Azur", "Hauts-de-France", "Grand Est", "Bretagne"],
        cityLabel: "Ville",
        cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nantes", "Nice"],
      }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1.5 text-sm font-black text-slate-700">
        Pays
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value as "Canada" | "France")}
          className="h-11 rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <option value="Canada">Canada</option>
          <option value="France">France</option>
        </select>
      </label>
      <LabeledSelect
        key={`${country}-region`}
        label={locationOptions.regionLabel}
        name="region"
        options={Array.from(new Set([organization.country === country ? organization.region : "", ...locationOptions.regions].filter(Boolean)))}
        defaultValue={organization.country === country ? organization.region : undefined}
      />
      <LabeledSelect
        key={`${country}-city`}
        label={locationOptions.cityLabel}
        name="city"
        options={Array.from(new Set([organization.country === country ? organization.city : "", ...locationOptions.cities].filter(Boolean)))}
        defaultValue={organization.country === country ? organization.city : undefined}
      />
    </div>
  )
}

function BrandForm() {
  return (
    <FormSection title="Marque et apparence" description="Paramètres utilisés dans les communications et documents générés.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput label="Nom affiché" defaultValue="FinAssuro CRM" />
        <LabeledInput label="Logo du cabinet" type="file" />
        <LabeledInput label="Couleur principale" defaultValue="#059669" type="color" />
        <LabeledSelect label="Style de signature" options={["Professionnel compact", "Professionnel complet", "Minimal"]} />
      </div>
      <LabeledTextarea label="Pied de page des communications" defaultValue="Ce message concerne votre dossier client et ne constitue pas un conseil financier automatisé." rows={4} />
    </FormSection>
  )
}

function TeamUserForm({ action, billing }: { action: SettingsAction; billing: SettingsBillingSummary }) {
  const isInvite = hasAny(normalizeActionText(action.title), ["inviter", "invitation"])
  const inviteBlockReason = isInvite ? getTeamInviteBlockReason(billing) : null

  if (inviteBlockReason) {
    return (
      <FormSection title="Invitation non disponible" description="Le forfait actuel ne permet pas d’ajouter un autre utilisateur au profil conseiller.">
        <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-950">{inviteBlockReason}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
            Forfait actuel : {billing.planLabel}. Sièges utilisés : {billing.seatsUsed}/{billing.seatLimit}.
          </p>
        </div>
      </FormSection>
    )
  }

  return (
    <FormSection title={isInvite ? "Nouvelle invitation" : "Accès utilisateur"} description="Définissez clairement qui peut accéder aux dossiers et aux modules sensibles.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput label="Nom complet" placeholder="Prénom Nom" defaultValue={isInvite ? "" : action.title.replace(/^Modifier\s*/, "")} />
        <LabeledInput label="Adresse courriel" placeholder="prenom@cabinet.ca" type="email" />
        <LabeledSelect label="Rôle" options={["Owner", "Admin", "Conseiller", "Assistant", "Conformité", "Lecture seule"]} />
        <LabeledSelect label="Statut" options={["Actif", "Invitation envoyée", "Suspendu", "Lecture seule"]} />
        <LabeledSelect label="Accès client" options={["Tous les clients", "Clients assignés seulement", "Aucun accès client"]} />
        <LabeledSelect label="Accès documents" options={["Éditeur", "Lecteur", "Aucun accès"]} />
      </div>
      <LabeledTextarea label="Message d’invitation" defaultValue="Bonjour, vous êtes invité à rejoindre l’espace sécurisé du cabinet dans FinAssuro CRM." rows={4} />
      <CheckboxList items={["Exiger 2FA à la première connexion", "Envoyer une copie au propriétaire", "Limiter l’accès aux dossiers assignés"]} />
    </FormSection>
  )
}

function RolePermissionsForm() {
  return (
    <FormSection title="Permissions par rôle" description="Configurez les accès module par module.">
      <LabeledSelect label="Rôle à configurer" options={["Owner", "Admin", "Conseiller", "Assistant", "Conformité", "Lecture seule"]} />
      <div className="grid gap-3">
        {["Clients", "Documents", "Tâches", "Conformité", "Rapports", "Paramètres", "Facturation"].map((module) => (
          <div key={module} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_180px] sm:items-center">
            <p className="text-sm font-semibold text-slate-950">{module}</p>
            <LabeledSelect label="Permission" options={["Accès complet", "Éditeur", "Lecture seule", "Aucun accès"]} compact />
          </div>
        ))}
      </div>
    </FormSection>
  )
}

function SecurityForm({ action }: { action: SettingsAction }) {
  return (
    <FormSection title="Sécurité des accès" description="Règles de connexion, 2FA, sessions et accès invités.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect label="Authentification renforcée" options={["Requise pour tous", "Requise pour Owner/Admin", "Recommandée", "Désactivée"]} />
        <LabeledSelect label="Expiration des sessions" options={["8 heures", "24 heures", "7 jours", "30 jours"]} />
        <LabeledSelect label="Accès invités" options={["Interdit", "Lecture seule", "Accès limité", "Selon dossier"]} />
        <LabeledSelect label="Alertes de connexion" options={["Immédiates", "Résumé quotidien", "Désactivées"]} />
      </div>
      <CheckboxList items={["Révoquer les sessions inconnues", "Bloquer les exports sans confirmation", "Notifier le propriétaire en cas de connexion inhabituelle"]} />
      <LabeledTextarea label="Note de sécurité" defaultValue={action.description} rows={4} />
    </FormSection>
  )
}

function PrivacyForm() {
  return (
    <FormSection title="Mode confidentialité" description="Masquez les données sensibles selon le rôle et le contexte.">
      <CheckboxList items={["Masquer les téléphones", "Masquer les courriels", "Masquer les adresses", "Masquer les valeurs financières", "Masquer les documents restreints aux assistants"]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect label="Mode par défaut" options={["Activé", "Activé seulement en partage écran", "Désactivé"]} />
        <LabeledSelect label="Exception Owner" options={["Voir toutes les données", "Masquage partiel", "Masquage complet"]} />
      </div>
    </FormSection>
  )
}

function NotificationForm({ action }: { action: SettingsAction }) {
  return (
    <FormSection title="Règle de notification" description="Choisissez l’événement, les canaux et la fréquence.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect label="Événement" options={["Tâches dues aujourd’hui", "Tâches en retard", "Documents reçus", "Documents manquants", "Renouvellements proches", "Profil client incomplet"]} />
        <LabeledSelect label="Fréquence" options={["Immédiat", "Chaque matin", "Hebdomadaire", "30 jours avant", "Désactivée"]} />
        <LabeledSelect label="Priorité" options={["Normale", "Haute", "Urgente"]} />
        <LabeledSelect label="Statut" options={["Actif", "Désactivé"]} />
      </div>
      <ChannelChecklist />
      <LabeledTextarea label="Message interne" defaultValue={action.description} rows={4} />
    </FormSection>
  )
}

function TemplateForm({ action }: { action: SettingsAction }) {
  const { advisorProfile } = useAdvisorProfile()
  const templateFromAction = getTemplateFromAction(action)
  const selectedTemplate = templateFromAction ? {
    ...templateFromAction,
    updatedBy: templateFromAction.updatedBy === "Conseiller principal" ? advisorProfile.displayName : templateFromAction.updatedBy,
  } : undefined
  const normalizedTitle = normalizeActionText(action.title)
  const channel = selectedTemplate?.channel ?? (hasAny(normalizedTitle, ["sms"]) ? "SMS" : "Courriel")
  const rawTitle = selectedTemplate?.title ?? action.title.replace(/^Créer |^Modifier - |^Dupliquer - |^Tester - |^Prévisualiser - /, "")
  const title = rawTitle || "Nouveau modèle"
  const subject = selectedTemplate?.subject ?? "Documents requis pour votre dossier"
  const body = selectedTemplate?.body ?? (channel === "SMS"
    ? "Bonjour {{prenom}}, il manque un document à votre dossier. Vous pouvez le téléverser ici : {{lien_document}}."
    : "Bonjour {{prenom}},\n\nAfin de compléter votre dossier, merci de transmettre le document demandé via ce lien sécurisé : {{lien_document}}.\n\n{{signature_conseiller}}")
  const previewTemplate: CommunicationTemplate = selectedTemplate ?? {
    id: "preview-template",
    title,
    channel,
    status: "À personnaliser",
    category: "Documents",
    subject: channel === "Courriel" ? subject : undefined,
    body,
    automations: 0,
    lastTest: "À tester",
    updatedBy: "Vous",
    updatedAt: "Aujourd’hui",
    variables: ["{{prenom}}", "{{lien_document}}", "{{signature_conseiller}}"],
    consent: channel === "SMS" ? "Consentement SMS requis" : "Consentement courriel requis",
    logging: "Journaliser chaque envoi dans l’historique client",
  }

  return (
    <div className="grid gap-5">
      <FormSection title="Informations du modèle" description="Identifiez le canal, la catégorie et l’état opérationnel.">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Nom du modèle" defaultValue={title} />
          <LabeledSelect label="Canal" options={["SMS", "Courriel"]} defaultValue={channel} />
          <LabeledSelect label="Catégorie" options={["Suivi client", "Documents", "Rendez-vous", "Conformité", "Révision", "Onboarding"]} defaultValue={selectedTemplate?.category ?? "Documents"} />
          <LabeledSelect label="Statut" options={["Actif", "Inactif", "À personnaliser"]} defaultValue={selectedTemplate?.status ?? "À personnaliser"} />
        </div>
      </FormSection>

      <FormSection title="Contenu" description="Rédigez un message clair, professionnel et non réglementaire.">
        {channel === "Courriel" ? <LabeledInput label="Objet du courriel" defaultValue={subject} /> : null}
        <LabeledTextarea label={channel === "SMS" ? "Message SMS" : "Corps du courriel"} defaultValue={body} rows={channel === "SMS" ? 4 : 9} />
        {channel === "Courriel" ? <LabeledTextarea label="Signature" defaultValue="{{signature_conseiller}}" rows={3} /> : null}
        {channel === "Courriel" ? <LabeledInput label="Pièces jointes optionnelles" placeholder="Ex. Guide de préparation, checklist PDF" /> : null}
      </FormSection>

      <FormSection title="Variables" description="Utilisez uniquement des variables standardisées.">
        <VariableChips />
      </FormSection>

      <FormSection title="Aperçu" description="Prévisualisez le rendu avec un client de démonstration.">
        <TemplatePreviewPanel template={previewTemplate} />
      </FormSection>

      <FormSection title="Automatisation" description="Définissez où ce modèle peut être utilisé.">
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledSelect label="Utilisation automatisée" options={["Non automatisé", "Demande de document", "Rappel rendez-vous", "Relance profil client", "Révision annuelle"]} defaultValue={selectedTemplate?.automations ? "Demande de document" : "Non automatisé"} />
          <LabeledSelect label="Validation avant envoi" options={["Toujours requise", "Requise seulement si client externe", "Owner seulement"]} />
        </div>
        <CheckboxList items={["Afficher dans les actions rapides", "Créer une activité après envoi", "Créer une tâche si le client ne répond pas", "Limiter aux clients avec consentement actif"]} />
      </FormSection>

      <FormSection title="Sécurité et consentement" description="Encadrez le consentement client et la journalisation.">
        <CheckboxList items={["Consentement client requis", "Journaliser chaque envoi dans l’historique client", "Bloquer l’envoi si le canal n’est pas autorisé", "Aucune recommandation financière dans le modèle"]} />
        <SafeAutomationNotice />
      </FormSection>
    </div>
  )
}

function DocumentSettingsForm({ action }: { action: SettingsAction }) {
  const normalizedTitle = normalizeActionText(action.title)
  const isOcr = hasAny(normalizedTitle, ["ocr"])
  const isStatus = hasAny(normalizedTitle, ["statuts"])

  return (
    <FormSection title={isOcr ? "OCR documentaire" : isStatus ? "Statuts documentaires" : "Type de document requis"} description="Standardisez les documents demandés, reçus, validés et archivés.">
      {isOcr ? (
        <>
          <LabeledSelect label="OCR" options={["Activé pour PDF et images", "Activé sur demande", "Désactivé"]} />
          <LabeledSelect label="Validation humaine" options={["Toujours requise", "Requise si faible confiance", "Non requise"]} />
          <CheckboxList items={["Détecter fournisseur/client", "Détecter date et montant", "Proposer un nom de fichier", "Proposer un dossier de classement"]} />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledInput label="Nom du document" defaultValue={isStatus ? "À valider" : "Pièce d’identité"} />
            <LabeledSelect label="Catégorie" options={["Identité", "Profil client", "Consentement", "Financier", "Contrat", "Justification"]} />
            <LabeledSelect label="Obligatoire pour" options={["Tous les clients", "Onboarding", "Assurance", "Placements", "Client entreprise"]} />
            <LabeledSelect label="Statut initial" options={["Manquant", "Demandé", "Reçu", "À valider"]} />
            <LabeledSelect label="Validation" options={["Manuelle obligatoire", "Manuelle recommandée", "Automatique après OCR"]} />
            <LabeledSelect label="Expiration" options={["Aucune", "12 mois", "24 mois", "36 mois"]} />
          </div>
          <CheckboxList items={["Permettre demande par courriel", "Permettre demande par SMS", "Créer une tâche si manquant", "Afficher dans la checklist conformité"]} />
        </>
      )}
    </FormSection>
  )
}

function ComplianceSettingsForm() {
  return (
    <FormSection title="Règles de conformité" description="Contrôles requis avant analyse, recommandation et suivi.">
      <CheckboxList items={["Questionnaire profil client obligatoire", "Pièce d’identité requise", "Consentement client requis", "Profil de risque obligatoire", "Objectifs financiers obligatoires", "Justification de recommandation obligatoire", "Notes de rencontre recommandées"]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect label="Blocage si profil client incomplet" options={["Bloquer recommandation", "Avertir seulement", "Désactivé"]} />
        <LabeledSelect label="Révision périodique" options={["Tous les 12 mois", "Tous les 24 mois", "Tous les 36 mois"]} />
        <LabeledSelect label="Niveau d’audit" options={["Complet", "Standard", "Léger"]} />
        <LabeledSelect label="Alertes conformité" options={["Actives", "Importantes seulement", "Désactivées"]} />
      </div>
    </FormSection>
  )
}

function AiSettingsForm() {
  return (
    <FormSection title="Assistant IA encadré" description="Configurez les fonctions permises sans conseil financier automatisé.">
      <CheckboxList items={["Résumer les dossiers client", "Résumer les appels", "Lister les informations manquantes", "Préparer des brouillons de courriels", "Classer les documents", "Exiger validation humaine avant enregistrement"]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect label="Recommandations financières" options={["Désactivées", "Lecture seule avec avertissement"]} />
        <LabeledSelect label="Validation conformité automatique" options={["Désactivée", "Assistance seulement"]} />
        <LabeledSelect label="Limite utilisateur" options={["10 requêtes / minute", "5 requêtes / minute", "Illimité Owner"]} />
        <LabeledSelect label="Conservation des résumés" options={["Dans la timeline", "Dans les notes seulement", "Ne pas conserver"]} />
      </div>
      <SafeAutomationNotice />
    </FormSection>
  )
}

function BillingSettingsForm({ billing }: { billing: SettingsBillingSummary }) {
  const planOptions = offerableSubscriptionPlanKeys.map((planKey) => subscriptionPlans[planKey].label)
  const pricingOptions = Array.from(new Set([billing.pricingModeLabel, "Offre standard", "Offre bêta"]))
  const currencyOptions = Array.from(new Set([billing.currency, "EUR", "CAD"]))
  const seatOptions = Array.from(new Set([
    String(billing.seatLimit),
    ...offerableSubscriptionPlanKeys.map((planKey) => String(subscriptionPlans[planKey].defaultSeatLimit)),
  ]))

  return (
    <FormSection title="Changer de forfait" description="Sélectionnez le forfait, la devise et le nombre de sièges à appliquer à l’espace conseiller.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledSelect name="subscriptionPlan" label="Forfait" options={planOptions} defaultValue={billing.planLabel} />
        <LabeledSelect name="subscriptionPricingMode" label="Offre" options={pricingOptions} defaultValue={billing.pricingModeLabel} />
        <LabeledSelect name="subscriptionCurrency" label="Devise" options={currencyOptions} defaultValue={billing.currency} />
        <LabeledSelect name="advisorSeatLimit" label="Sièges inclus" options={seatOptions} defaultValue={String(billing.seatLimit)} />
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
        Forfait actuel : {billing.planLabel} · {billing.priceSummary} · {billing.seatsUsed}/{billing.seatLimit} siège(s) utilisé(s).
      </div>
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">
          Modules actifs après synchronisation du forfait
        </p>
        {billing.isCustomAccess ? <p className="mt-1 text-xs font-bold text-amber-700">L’accès personnalisé développeur sera remplacé par les modules du forfait choisi.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {billing.moduleLabels.map((moduleLabel) => (
            <span key={moduleLabel} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {moduleLabel}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
        Le type d’organisation, les limites d’équipe et les modules du reste de l’application seront mis à jour selon le forfait sélectionné.
      </div>
    </FormSection>
  )
}

function IntegrationSettingsForm({ action }: { action: SettingsAction }) {
  const normalizedTitle = normalizeActionText(action.title)
  const provider = integrations.find((integration) => normalizeActionText(action.title).includes(normalizeActionText(integration.name)))?.name ?? "Intégration"
  const isTwilio = hasAny(normalizedTitle, ["twilio", "telephonie"])

  return (
    <FormSection title={`Configurer ${provider}`} description="Connectez l’outil avec une portée claire et contrôlée.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput label="Nom de l’intégration" defaultValue={provider} />
        <LabeledSelect label="Statut" options={["Connecté", "Non connecté", "Recommandé", "Bientôt disponible"]} />
        <LabeledSelect label="Portée" options={["Calendrier seulement", "Courriels seulement", "Documents seulement", "Notifications internes", "Téléphonie"]} defaultValue={isTwilio ? "Téléphonie" : undefined} />
        <LabeledSelect label="Synchronisation" options={["Temps réel", "Toutes les 15 minutes", "Toutes les heures", "Manuelle"]} />
        {isTwilio ? <LabeledInput label="Numéro Twilio principal" placeholder="+1 438 000 0000" /> : <LabeledInput label="Compte connecté" placeholder="compte@cabinet.ca" />}
        <LabeledInput label="Adresse de notification" placeholder="operations@cabinet.ca" />
      </div>
      <CheckboxList items={["Créer une activité lors de la synchronisation", "Notifier en cas d’échec", "Limiter aux données de l’organisation", "Journaliser les changements"]} />
    </FormSection>
  )
}

function DataSettingsForm({ action }: { action: SettingsAction }) {
  const normalizedTitle = normalizeActionText(action.title)
  const isBackup = hasAny(normalizedTitle, ["sauvegarde"])
  const isDelete = hasAny(normalizedTitle, ["suppression"])

  return (
    <FormSection title={isBackup ? "Sauvegardes et rétention" : isDelete ? "Demande sensible" : "Import, export et confidentialité"} description="Contrôlez les données sans exposer les informations sensibles inutilement.">
      {isDelete ? (
        <>
          <LabeledSelect label="Type de demande" options={["Suppression complète", "Désactivation temporaire", "Export avant suppression"]} />
          <LabeledTextarea label="Raison de la demande" placeholder="Expliquez la demande pour l’audit interne." rows={5} />
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
            Une confirmation humaine et une vérification d’identité seront exigées avant toute action irréversible.
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledSelect label={isBackup ? "Fréquence sauvegarde" : "Format d’export"} options={isBackup ? ["Quotidienne", "Hebdomadaire", "Mensuelle"] : ["CSV", "JSON", "XLSX", "Archive complète"]} />
            <LabeledSelect label="Période" options={["30 derniers jours", "12 derniers mois", "Toutes les données", "Période personnalisée"]} />
            <LabeledSelect label="Données incluses" options={["Clients seulement", "Clients + documents", "Tout sauf audit", "Archive complète"]} />
            <LabeledInput label="Notifier à" placeholder="owner@cabinet.ca" type="email" />
          </div>
          <CheckboxList items={["Inclure métadonnées", "Exclure données masquées", "Journaliser la demande", "Exiger confirmation Owner"]} />
        </>
      )}
    </FormSection>
  )
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_#e2e8f0]">
      <div>
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  )
}

function CheckboxList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <label key={item} className="flex items-start gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <input type="checkbox" defaultChecked className="mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
          <span>{item}</span>
        </label>
      ))}
    </div>
  )
}

function ChannelChecklist() {
  return <CheckboxList items={["Notification dans l’application", "Courriel", "SMS", "Résumé quotidien au conseiller"]} />
}

function VariableChips() {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-semibold text-sky-950">Variables disponibles</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["{{prenom}}", "{{nom}}", "{{nom_conseiller}}", "{{titre_conseiller}}", "{{date_rendez_vous}}", "{{lien_document}}", "{{nom_cabinet}}", "{{telephone_conseiller}}", "{{courriel_conseiller}}"].map((variable) => (
          <span key={variable} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">{variable}</span>
        ))}
      </div>
    </div>
  )
}

function SafeAutomationNotice() {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Validation humaine requise : aucun conseil financier et aucun message client ne sont envoyés automatiquement sans action du conseiller.
    </div>
  )
}

function ProfessionalSaveNotice({ kind }: { kind: SettingsActionKind }) {
  const sensitive = kind === "security" || kind === "privacy" || kind === "compliance" || kind === "data"
  if (!sensitive) return null

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Ces réglages sont sensibles. En production, ils doivent être validés côté serveur, journalisés et limités aux rôles autorisés.
    </div>
  )
}

function SettingsConfirmationModal({
  confirmation,
  onClose,
  onConfirm,
}: {
  confirmation: SettingsConfirmation
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={confirmation.title} onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className={cn("flex size-12 items-center justify-center rounded-2xl", confirmation.danger ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
          {confirmation.danger ? <LockKeyhole className="size-6" /> : <CheckCircle2 className="size-6" />}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-950">{confirmation.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{confirmation.description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Annuler</Button>
          <Button type="button" variant={confirmation.danger ? "destructive" : "default"} className={cn("rounded-xl", confirmation.danger ? "" : "bg-emerald-600 hover:bg-emerald-700")} onClick={onConfirm}>
            {confirmation.danger ? <LockKeyhole className="size-4" /> : <CheckCircle2 className="size-4" />}
            {confirmation.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function fieldNameFromLabel(label: string) {
  return normalizeActionText(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function LabeledInput({
  label,
  name,
  type = "text",
  defaultValue = "",
  placeholder,
}: {
  label: string
  name?: string
  type?: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <Input name={name ?? fieldNameFromLabel(label)} type={type} defaultValue={defaultValue} placeholder={placeholder} className="h-11 rounded-2xl border-2 font-semibold" />
    </label>
  )
}

function LabeledSelect({
  label,
  name,
  options,
  defaultValue,
  compact = false,
}: {
  label: string
  name?: string
  options: string[]
  defaultValue?: string
  compact?: boolean
}) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <select name={name ?? fieldNameFromLabel(label)} defaultValue={defaultValue} className={cn("rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500", compact ? "h-10" : "h-11")}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function LabeledTextarea({
  label,
  name,
  defaultValue = "",
  placeholder,
  rows = 5,
}: {
  label: string
  name?: string
  defaultValue?: string
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <textarea
        name={name ?? fieldNameFromLabel(label)}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        className="min-h-24 rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      />
    </label>
  )
}

function PreviewItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-600">
        <Icon className="size-4 text-emerald-700" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}
