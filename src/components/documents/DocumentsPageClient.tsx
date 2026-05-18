"use client"

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileSearch,
  FileText,
  FileWarning,
  Folder,
  FolderOpen,
  Grid3X3,
  Inbox,
  List,
  LockKeyhole,
  Mail,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  XCircle,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiRequest, uploadDocument } from "@/lib/api"
import { documentStatusLabels, documentTypeLabels } from "@/lib/documents/labels"

type DocumentFolder = {
  id: string
  parentId?: string | null
  parent_id?: string | null
  name: string
  status: string
  path?: string
  description?: string | null
  type?: string | null
  clientId?: string | null
  leadId?: string | null
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  _count?: { documents: number; children: number }
  document_count?: number
  child_count?: number
  client?: { id: string; firstName: string; lastName: string } | null
}

type DocumentRow = {
  id: string
  folderId?: string | null
  folder_id?: string | null
  clientId?: string | null
  name?: string
  description?: string | null
  originalFileName?: string | null
  original_file_name?: string | null
  document_category?: string
  type?: string
  human_review_status?: string | null
  status: string
  file_type?: string | null
  mimeType?: string | null
  file_size?: number | null
  fileSize?: number | null
  version?: number | null
  storagePath?: string | null
  notes?: string | null
  source?: string | null
  sensitivityLevel?: string | null
  isLocked?: boolean | null
  retentionReviewAt?: string | null
  consentId?: string | null
  externalSharingEnabled?: boolean | null
  publicLinkActive?: boolean | null
  containsPersonalData?: boolean | null
  containsFinancialData?: boolean | null
  containsMedicalData?: boolean | null
  containsIdentityData?: boolean | null
  downloadCount?: number | null
  lastAccessedAt?: string | null
  extractionSummary?: Record<string, unknown> | null
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  client?: { id?: string; firstName: string; lastName: string } | null
  folder?: { id: string; name: string; path?: string | null } | null
}

type ClientOption = { id: string; firstName: string; lastName: string }
type ViewMode = "grid" | "list"

type MissingDocumentRequirement = {
  id: string
  ruleKey: string
  clientId: string
  clientName: string
  contextType: "CLIENT" | "PRODUCT" | "ANALYSIS" | "RECOMMENDATION"
  contextId: string
  contextLabel: string
  documentType: string
  documentName: string
  reason: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  suggestedAction: string
}

type RetentionPolicyOption = {
  value: string
  label: string
  description: string
  duration: string
}

type DocumentVaultSettings = {
  requireConsentForSensitiveDocuments: boolean
  restrictIdentityDocuments: boolean
  restrictMedicalDocuments: boolean
  restrictCriticalDocuments: boolean
  accessLogEnabled: boolean
  semanticSearchEnabled: boolean
  retentionPolicies: RetentionPolicyOption[]
}

type DocumentVaultAudit = {
  versions: Array<{
    id: string
    versionNumber: number
    fileName?: string | null
    changeReason?: string | null
    createdAt: string
    changedBy?: { name: string | null; role: string } | null
  }>
  links: Array<{
    id: string
    linkedEntityType: string
    linkedEntityId: string
    relationshipType: string
    label?: string | null
    sourceFieldKey?: string | null
    proofStatus?: string | null
    createdAt: string
    createdBy?: { name: string | null; role: string } | null
  }>
  extractions: Array<{
    id: string
    extractionType: string
    status: string
    confidenceScore?: string | number | null
    method?: string | null
    modelVersion?: string | null
    humanReviewNote?: string | null
    createdAt: string
    validatedAt?: string | null
    fields: Array<{
      id: string
      fieldKey: string
      fieldLabel: string
      extractedValue?: unknown
      validatedValue?: unknown
      confidenceScore?: string | number | null
      pageNumber?: number | null
      status: string
      validationNote?: string | null
      synchronizedEntityType?: string | null
      synchronizedEntityId?: string | null
      synchronizedFieldKey?: string | null
      synchronizedAt?: string | null
    }>
  }>
  accessLogs: Array<{
    id: string
    eventType: string
    purpose?: string | null
    createdAt: string
    user?: { name: string | null; role: string } | null
  }>
}

const categoryOptions = Object.entries(documentTypeLabels)
const statusOptions = Object.entries(documentStatusLabels)
const requiredDocumentStatuses = ["REQUIRED", "REQUESTED", "EXPIRED"]
const vaultRiskFilters = [
  { value: "REVIEW_REQUIRED", label: "Revue humaine" },
  { value: "UNCLASSIFIED", label: "À classer" },
  { value: "EXTRACTION_TO_VALIDATE", label: "Extraction à valider" },
  { value: "SENSITIVE_WITHOUT_CONSENT", label: "Sensible sans consentement" },
  { value: "EXTERNAL_SHARED", label: "Partagé externe" },
  { value: "RETENTION_DUE", label: "Conservation à revoir" },
  { value: "LOCKED", label: "Preuves verrouillées" },
]
const folderTypeOptions = [
  { value: "ROOT", label: "Dossier principal" },
  { value: "CLIENT", label: "Client" },
  { value: "CLIENT_SECTION", label: "Section client" },
  { value: "HR", label: "Ressources humaines" },
  { value: "ACCOUNTING", label: "Comptabilité" },
  { value: "SUPPLIER", label: "Fournisseur" },
  { value: "PROJECT", label: "Projet" },
  { value: "INTERNAL", label: "Documents internes" },
]

function parentId(folder: DocumentFolder) {
  return folder.parent_id ?? folder.parentId ?? null
}

function folderDocumentCount(folder: DocumentFolder) {
  return folder.document_count ?? folder._count?.documents ?? 0
}

function folderChildCount(folder: DocumentFolder) {
  return folder.child_count ?? folder._count?.children ?? 0
}

function folderTypeLabel(folder: DocumentFolder) {
  return folderTypeOptions.find((option) => option.value === folder.type)?.label ?? folder.type ?? "Dossier"
}

function folderConfidentiality(folder: DocumentFolder) {
  const name = `${folder.path ?? folder.name}`.toLowerCase()
  if (name.includes("évaluation") || name.includes("evaluation") || name.includes("personnel") || name.includes("contrat")) return "Restreint"
  if (name.includes("comptabilité") || name.includes("facture") || name.includes("fiscal")) return "Confidentiel"
  if (name.includes("public")) return "Interne"
  return "Interne"
}

function folderClassificationRule(folder: DocumentFolder) {
  const name = `${folder.path ?? folder.name}`.toLowerCase()
  if (name.includes("contrat")) return "Ajouter uniquement les contrats, avenants et documents signés liés à ce dossier."
  if (name.includes("facture")) return "Ajouter les factures, reçus et pièces comptables correspondant à ce contexte."
  if (name.includes("document signé") || name.includes("documents signés")) return "Classer seulement les documents finalisés ou en attente de signature."
  if (name.includes("communication")) return "Conserver les échanges importants, confirmations et pièces transmises."
  if (name.includes("à classer")) return "Déplacer chaque fichier vers le dossier précis dès que son contexte est connu."
  return "Placer les documents dans le sous-dossier le plus précis possible et éviter les noms vagues."
}

function documentFolderId(document: DocumentRow) {
  return document.folder_id ?? document.folderId ?? null
}

function documentName(document: DocumentRow) {
  return document.original_file_name ?? document.originalFileName ?? document.name ?? "Document sans nom"
}

function documentCategory(document: DocumentRow) {
  return document.document_category ?? document.type ?? "OTHER"
}

function documentFileType(document: DocumentRow) {
  return document.file_type ?? document.mimeType ?? "Fichier"
}

function documentFileSize(document: DocumentRow) {
  return document.file_size ?? document.fileSize ?? null
}

function isKycSnapshotPdf(document: DocumentRow) {
  const text = `${documentName(document)} ${document.description ?? ""}`.toLowerCase()
  return documentCategory(document) === "KYC_FORM" && (
    text.includes("rapport snapshot kyc") ||
    text.includes("rapport profil client") ||
    text.includes("finadvisor crm")
  )
}

function documentSummary(document: DocumentRow) {
  if (isKycSnapshotPdf(document)) {
    return "Rapport PDF de preuve généré à partir d’une version figée du profil client. Le contenu complet doit être consulté dans le fichier joint."
  }

  const description = document.description?.replace(/\s+/g, " ").trim()
  if (!description) return "Document classé dans le coffre documentaire du dossier."
  if (description.length <= 180) return description
  return `${description.slice(0, 177).trim()}...`
}

function documentCreatedAt(document: DocumentRow) {
  return document.created_at ?? document.createdAt ?? null
}

function documentUpdatedAt(document: DocumentRow) {
  return document.updated_at ?? document.updatedAt ?? null
}

function documentVersion(document: DocumentRow) {
  return "version" in document && typeof document.version === "number" ? `v${document.version}` : "v1"
}

function documentNotes(document: DocumentRow) {
  if (!document.notes) return {}
  try {
    const parsed = JSON.parse(document.notes)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function documentCategoryLabel(document: DocumentRow) {
  const label = documentNotes(document).categoryLabel
  return typeof label === "string" && label.trim() ? label.trim() : null
}

function documentSubcategory(document: DocumentRow) {
  const categoryLabel = documentCategoryLabel(document)
  if (categoryLabel) return categoryLabel
  const category = documentCategory(document)
  const name = documentName(document).toLowerCase()
  if (isKycSnapshotPdf(document)) return "Rapport profil client figé"
  if (name.includes("recommandation") && name.includes("sign")) return "Recommandation documentée signée"
  if (name.includes("analyse") && name.includes("sign")) return "Analyse des besoins signée"
  if (category === "POLICY_DOCUMENT" || name.includes("contrat")) return "Contrat client"
  if (category === "PROPOSAL" || name.includes("devis")) return "Devis ou proposition"
  if (category === "TAX_DOCUMENT" || name.includes("fiscal")) return "Document fiscal"
  if (category === "GOVERNMENT_ID" || name.includes("identité")) return "Pièce justificative"
  if (category === "SIGNATURE_PAGE" || name.includes("signé")) return "Document signé"
  if (category === "OTHER") return "À classifier"
  return documentTypeLabels[category] ?? category
}

function documentConfidentiality(document: DocumentRow) {
  if (document.sensitivityLevel === "CRITICAL") return "Critique"
  if (document.sensitivityLevel === "HIGH") return "Restreint"
  if (document.sensitivityLevel === "MEDIUM") return "Confidentiel"
  const category = documentCategory(document)
  const name = documentName(document).toLowerCase()
  if (category === "GOVERNMENT_ID" || category === "KYC_FORM" || category === "RISK_PROFILE" || name.includes("identité")) return "Restreint"
  if (category === "TAX_DOCUMENT" || category === "INVESTMENT_STATEMENT" || category === "INSURANCE_STATEMENT") return "Confidentiel"
  if (category === "POLICY_DOCUMENT" || category === "CONSENT_FORM" || category === "SIGNATURE_PAGE") return "Confidentiel"
  return "Interne"
}

function proofStatusLabel(status?: string | null) {
  if (!status) return "Preuve liée"
  const labels: Record<string, string> = {
    VALIDATED_BY_ADVISOR: "Validé par conseiller",
    EXTRACTION_TO_VALIDATE: "Extraction à valider",
    CLIENT_CONFIRMED: "Confirmé par client",
    USED_FOR_RECOMMENDATION: "Utilisé pour recommandation",
  }
  return labels[status] ?? status
}

function extractionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "En attente",
    PROCESSING: "Extraction en cours",
    TO_VALIDATE: "À valider",
    VALIDATED: "Validée",
    REJECTED: "Rejetée",
    SYNCHRONIZED: "Synchronisée",
    PROPOSED: "Proposé",
    CORRECTED: "Corrigé",
    NOT_APPLICABLE: "Non applicable",
  }
  return labels[status] ?? status
}

function accessEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    VIEW: "Consulté",
    PREVIEW: "Aperçu",
    DOWNLOAD: "Téléchargé",
    UPLOAD: "Téléversé",
    SHARE: "Partagé",
    LINK: "Lié",
    UNLINK: "Délié",
    UPDATE: "Modifié",
    VALIDATE: "Validé",
    REJECT: "Rejeté",
    ARCHIVE: "Archivé",
    RESTORE: "Restauré",
    DELETE: "Supprimé",
    LOCK: "Verrouillé",
    EXPORT: "Exporté",
  }
  return labels[eventType] ?? eventType
}

function displayExtractedValue(value: unknown) {
  if (value === null || value === undefined) return "Non détecté"
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Aucun"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function documentSource(document: DocumentRow) {
  if (document.source === "PORTAL") return "Portail client"
  if (document.source === "EMAIL") return "Courriel"
  if (document.source === "API") return "API"
  if (document.source === "SYSTEM") return "Système"
  if (document.source === "IMPORT") return "Import"
  if (document.storagePath) return "Import manuel"
  if (document.status === "REQUIRED" || document.status === "REQUESTED") return "Demande de document"
  return "Métadonnée CRM"
}

function documentTags(document: DocumentRow) {
  const tags = new Set<string>()
  const category = documentCategory(document)
  const categoryLabel = documentCategoryLabel(document)
  if (categoryLabel) tags.add(categoryLabel.toLowerCase())
  tags.add((documentTypeLabels[category] ?? category).toLowerCase())
  tags.add(document.status.toLowerCase())
  if (document.client) tags.add("client")
  if (documentConfidentiality(document) !== "Interne") tags.add(documentConfidentiality(document).toLowerCase())
  const year = documentCreatedAt(document) ? new Date(documentCreatedAt(document) as string).getFullYear() : null
  if (year) tags.add(String(year))
  return Array.from(tags).slice(0, 5)
}

function normalizeSearchTerm(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

const semanticDocumentTerms: Record<string, string[]> = {
  hypotheque: ["hypotheque", "hypothèque", "mortgage", "pret", "prêt", "dette", "solde", "banque"],
  police: ["police", "contrat", "assurance", "avenant", "protection", "beneficiaire", "bénéficiaire"],
  identite: ["identite", "identité", "passeport", "permis", "gouvernement", "aml", "lba"],
  fiscal: ["fiscal", "impot", "impôt", "cotisation", "t1", "t4", "reer", "revenu"],
  placement: ["placement", "reer", "celi", "ferr", "portefeuille", "releve", "relevé", "compte"],
  recommandation: ["recommandation", "convenance", "rapport", "signature", "document remis", "preuve"],
}

function expandedSearchTerms(query: string, semanticEnabled?: boolean) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  const terms = new Set([normalizedQuery])
  if (semanticEnabled) {
    const normalized = normalizeSearchTerm(normalizedQuery)
    for (const [concept, synonyms] of Object.entries(semanticDocumentTerms)) {
      if (normalized.includes(concept) || synonyms.some((synonym) => normalized.includes(normalizeSearchTerm(synonym)))) {
        synonyms.forEach((synonym) => terms.add(synonym.toLowerCase()))
      }
    }
  }
  return Array.from(terms)
}

function searchableDocumentText(document: DocumentRow) {
  const riskLabels = documentRiskBadges(document).map((badge) => badge.label.toLowerCase()).join(" ")
  const tags = documentTags(document).join(" ")
  return [
    documentName(document),
    clientName(document.client),
    documentCategory(document),
    documentSubcategory(document),
    documentSource(document),
    documentConfidentiality(document),
    riskLabels,
    tags,
  ].join(" ").toLowerCase()
}

function suggestedDocumentName(document: DocumentRow) {
  const category = documentCategoryLabel(document) ?? documentTypeLabels[documentCategory(document)] ?? "Document"
  const entity = clientName(document.client)
  const date = documentCreatedAt(document)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const status = documentStatusLabels[document.status] ?? document.status
  return `${category} - ${entity} - ${date} - ${status}.pdf`
}

function documentPlacementWarning(document: DocumentRow) {
  if (!documentFolderId(document)) return "Ce document n’est pas encore classé. Sélectionnez un dossier de destination."
  if (document.status === "RECEIVED") return "Ce document doit être vérifié avant validation."
  if (document.status === "REQUIRED" || document.status === "REQUESTED") return "Ce document est en attente de réception."
  return null
}

function documentIsUnclassified(document: DocumentRow) {
  return !documentFolderId(document) || documentCategory(document) === "OTHER" || document.status === "UPLOADED" || document.status === "TO_CLASSIFY"
}

function documentNeedsExtractionValidation(document: DocumentRow) {
  const summary = document.extractionSummary ?? {}
  return document.status === "EXTRACTION_TO_VALIDATE" || summary.status === "TO_VALIDATE" || summary.humanReviewRequired === true
}

function documentIsSensitiveWithoutConsent(document: DocumentRow, settings?: DocumentVaultSettings | null) {
  if (settings && !settings.requireConsentForSensitiveDocuments) return false
  return !document.consentId && (document.sensitivityLevel === "HIGH" || document.sensitivityLevel === "CRITICAL" || document.containsIdentityData === true || document.containsMedicalData === true)
}

function documentIsExternallyShared(document: DocumentRow) {
  return document.externalSharingEnabled === true || document.publicLinkActive === true
}

function documentRetentionDue(document: DocumentRow) {
  if (!document.retentionReviewAt) return false
  const reviewDate = new Date(document.retentionReviewAt)
  return !Number.isNaN(reviewDate.getTime()) && reviewDate <= new Date()
}

function documentMatchesVaultFilter(document: DocumentRow, filter: string, settings?: DocumentVaultSettings | null) {
  if (filter === "REVIEW_REQUIRED") return document.status === "RECEIVED" || document.status === "REJECTED"
  if (filter === "UNCLASSIFIED") return documentIsUnclassified(document)
  if (filter === "EXTRACTION_TO_VALIDATE") return documentNeedsExtractionValidation(document)
  if (filter === "SENSITIVE_WITHOUT_CONSENT") return documentIsSensitiveWithoutConsent(document, settings)
  if (filter === "EXTERNAL_SHARED") return documentIsExternallyShared(document)
  if (filter === "RETENTION_DUE") return documentRetentionDue(document)
  if (filter === "LOCKED") return document.isLocked === true
  return false
}

function documentRiskBadges(document: DocumentRow) {
  const badges: Array<{ label: string; className: string }> = []
  if (isKycSnapshotPdf(document)) badges.push({ label: "Rapport PDF", className: "border-violet-200 bg-violet-50 text-violet-800" })
  if (documentIsUnclassified(document)) badges.push({ label: "À classer", className: "border-amber-200 bg-amber-50 text-amber-800" })
  if (documentNeedsExtractionValidation(document)) badges.push({ label: "IA à valider", className: "border-violet-200 bg-violet-50 text-violet-800" })
  if (documentIsSensitiveWithoutConsent(document)) badges.push({ label: "Consentement requis", className: "border-orange-200 bg-orange-50 text-orange-800" })
  if (documentIsExternallyShared(document)) badges.push({ label: "Partagé", className: "border-cyan-200 bg-cyan-50 text-cyan-800" })
  if (documentRetentionDue(document)) badges.push({ label: "Conservation", className: "border-slate-300 bg-slate-100 text-slate-800" })
  if (document.isLocked) badges.push({ label: "Verrouillé", className: "border-emerald-200 bg-emerald-50 text-emerald-800" })
  return badges
}

function documentAccessRecommendation(document: DocumentRow, settings?: DocumentVaultSettings | null) {
  if (document.containsMedicalData && settings?.restrictMedicalDocuments !== false) return "Accès très restreint recommandé : conseiller responsable et conformité."
  if (document.containsIdentityData && settings?.restrictIdentityDocuments !== false) return "Accès restreint recommandé : identité, téléchargement contrôlé et journalisation."
  if (document.sensitivityLevel === "CRITICAL" && settings?.restrictCriticalDocuments !== false) return "Accès critique recommandé : conformité ou rôle autorisé seulement."
  if (document.sensitivityLevel === "HIGH") return "Accès restreint recommandé : document sensible."
  if (document.containsFinancialData) return "Accès équipe autorisée : données financières."
  return "Accès selon rôle et dossier client."
}

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(new Date(value))
}

function formatBytes(value?: number | null) {
  if (!value) return "En attente"
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`
  return `${(value / 1024 / 1024).toFixed(1)} Mo`
}

function statusTone(status: string) {
  if (status === "VALIDATED") return "emerald"
  if (status === "REJECTED" || status === "EXPIRED") return "rose"
  if (status === "REQUIRED" || status === "REQUESTED") return "amber"
  if (status === "RECEIVED") return "sky"
  return "slate"
}

function clientName(client?: ClientOption | DocumentRow["client"] | null) {
  if (!client) return "Client à préciser"
  return `${client.firstName} ${client.lastName}`.trim()
}

function folderPath(folder: DocumentFolder) {
  return folder.path ?? folder.name
}

function sortedClientFolders(folders: DocumentFolder[], clientId?: string | null) {
  if (!clientId) return []
  return folders
    .filter((folder) => folder.clientId === clientId && folder.status !== "ARCHIVED")
    .sort((first, second) => {
      if (first.type === "CLIENT" && second.type !== "CLIENT") return -1
      if (second.type === "CLIENT" && first.type !== "CLIENT") return 1
      return folderPath(first).localeCompare(folderPath(second), "fr")
    })
}

function clientRootFolder(folders: DocumentFolder[]) {
  return folders.find((folder) => folder.type === "CLIENT") ?? null
}

function clientFolderLabel(folder: DocumentFolder, root: DocumentFolder | null) {
  if (root?.id === folder.id || folder.type === "CLIENT") return "Dossier client principal"
  const path = folderPath(folder)
  const rootPath = root ? folderPath(root) : null
  if (rootPath && path.startsWith(`${rootPath}/`)) return path.slice(rootPath.length + 1)
  return path
}

export function DocumentsPageClient() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get("statusGroup") === "required" ? "OPEN_REQUIRED" : searchParams.get("status") ?? "ALL"
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [missingRequirements, setMissingRequirements] = useState<MissingDocumentRequirement[]>([])
  const [documentSettings, setDocumentSettings] = useState<DocumentVaultSettings | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)

  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null
  const parentFolder = currentFolder ? folders.find((folder) => folder.id === parentId(currentFolder)) ?? null : null

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [folderData, documentData, missingData, settingsData, clientData] = await Promise.all([
        apiRequest<DocumentFolder[]>("/document-folders"),
        apiRequest<{ items: DocumentRow[] }>("/documents?limit=100"),
        apiRequest<{ items: MissingDocumentRequirement[] }>("/documents/missing?limit=150"),
        apiRequest<DocumentVaultSettings>("/documents/settings"),
        apiRequest<ClientOption[]>("/clients?pageSize=100"),
      ])
      setFolders(folderData)
      setDocuments(documentData.items)
      setMissingRequirements(missingData.items)
      setDocumentSettings(settingsData)
      setClients(clientData)
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Chargement impossible." })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const visibleFolders = useMemo(() => {
    return folders
      .filter((folder) => parentId(folder) === currentFolderId)
      .filter((folder) => folder.name.toLowerCase().includes(search.toLowerCase()) || (folder.path ?? "").toLowerCase().includes(search.toLowerCase()))
  }, [folders, currentFolderId, search])

  const visibleDocuments = useMemo(() => {
    const isGlobalFilter = currentFolderId === null && (status !== "ALL" || search.trim().length > 0)
    return documents
      .filter((document) => isGlobalFilter || documentFolderId(document) === currentFolderId)
      .filter((document) => {
        if (status === "ALL") return true
        if (status === "OPEN_REQUIRED") return requiredDocumentStatuses.includes(document.status)
        if (vaultRiskFilters.some((filter) => filter.value === status)) return documentMatchesVaultFilter(document, status, documentSettings)
        return document.status === status
      })
      .filter((document) => {
        const terms = expandedSearchTerms(search, documentSettings?.semanticSearchEnabled)
        if (terms.length === 0) return true
        const searchable = searchableDocumentText(document)
        return terms.some((term) => searchable.includes(term))
      })
  }, [documents, currentFolderId, search, status, documentSettings])

  const metrics = useMemo(() => {
    const reviewCount = documents.filter((document) => document.status === "RECEIVED" || document.status === "REJECTED").length
    const clientFolderCount = folders.filter((folder) => folder.type === "CLIENT" && folder.status !== "ARCHIVED").length
    const classifiedCount = documents.filter((document) => Boolean(documentFolderId(document))).length
    const waitingCount = documents.filter((document) => document.status === "REQUIRED" || document.status === "REQUESTED").length
    const sensitiveWithoutConsentCount = documents.filter((document) => documentIsSensitiveWithoutConsent(document, documentSettings)).length
    const extractionReviewCount = documents.filter(documentNeedsExtractionValidation).length
    const externalShareCount = documents.filter(documentIsExternallyShared).length
    const retentionDueCount = documents.filter(documentRetentionDue).length
    const missingDocumentCount = missingRequirements.length
    return [
      { label: "Dossiers client", value: clientFolderCount, detail: "Structures créées automatiquement", icon: FolderOpen, tone: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-[0_6px_0_#86efac]" },
      { label: "Fichiers classés", value: classifiedCount, detail: `${documents.length} document(s) liés aux clients`, icon: FileText, tone: "bg-sky-50 text-sky-800 border-sky-200 shadow-[0_6px_0_#bae6fd]" },
      { label: "Documents manquants", value: missingDocumentCount, detail: "Détectés par règles CRM", icon: FileWarning, tone: "bg-red-50 text-red-800 border-red-200 shadow-[0_6px_0_#fecaca]" },
      { label: "À vérifier", value: reviewCount, detail: "Revue humaine ou OCR requis", icon: FileSearch, filter: "REVIEW_REQUIRED", tone: "bg-amber-50 text-amber-800 border-amber-200 shadow-[0_6px_0_#fde68a]" },
      { label: "Demandes ouvertes", value: waitingCount, detail: "Pièces encore attendues", icon: FileWarning, filter: "OPEN_REQUIRED", tone: "bg-rose-50 text-rose-800 border-rose-200 shadow-[0_6px_0_#fecdd3]" },
      { label: "IA à valider", value: extractionReviewCount, detail: "Champs extraits en attente humaine", icon: Sparkles, filter: "EXTRACTION_TO_VALIDATE", tone: "bg-violet-50 text-violet-800 border-violet-200 shadow-[0_6px_0_#ddd6fe]" },
      { label: "Sensibles sans consentement", value: sensitiveWithoutConsentCount, detail: "Accès et finalité à régulariser", icon: ShieldCheck, filter: "SENSITIVE_WITHOUT_CONSENT", tone: "bg-orange-50 text-orange-800 border-orange-200 shadow-[0_6px_0_#fed7aa]" },
      { label: "Partagés", value: externalShareCount, detail: "Partage externe ou lien actif", icon: Share2, filter: "EXTERNAL_SHARED", tone: "bg-cyan-50 text-cyan-800 border-cyan-200 shadow-[0_6px_0_#a5f3fc]" },
      { label: "Conservation", value: retentionDueCount, detail: "Revue d’archivage ou destruction", icon: CalendarClock, filter: "RETENTION_DUE", tone: "bg-slate-50 text-slate-800 border-slate-200 shadow-[0_6px_0_#cbd5e1]" },
    ]
  }, [folders, documents, missingRequirements.length, documentSettings])

  const classifiedPercent = useMemo(() => {
    if (documents.length === 0) return 0
    return Math.round((documents.filter((document) => Boolean(documentFolderId(document))).length / documents.length) * 100)
  }, [documents])

  async function createFolder(payload: { name: string; parentId?: string | null; clientId?: string; description?: string; type?: string }) {
    setIsSaving(true)
    try {
      await apiRequest<DocumentFolder>("/document-folders", { method: "POST", body: JSON.stringify(payload) })
      setNotice({ type: "success", message: "Le dossier a été créé avec succès." })
      setFolderModalOpen(false)
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Création impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function renameFolder(folderId: string, name: string) {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await apiRequest<DocumentFolder>(`/document-folders/${folderId}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) })
      setNotice({ type: "success", message: "Le dossier a été renommé." })
      setRenamingFolderId(null)
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Renommage impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function moveDocument(documentId: string, folderId: string | null) {
    setIsSaving(true)
    try {
      await apiRequest<DocumentRow>(`/documents/${documentId}`, { method: "PATCH", body: JSON.stringify({ folderId }) })
      setNotice({ type: "success", message: "Le document a été déplacé avec succès." })
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Déplacement impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function renameDocument(documentId: string, name: string) {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const updated = await apiRequest<DocumentRow>(`/documents/${documentId}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) })
      setSelectedDocument(updated)
      setNotice({ type: "success", message: "Le document a été renommé." })
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Renommage impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function validateDocumentReview(documentId: string, notes?: string) {
    setIsSaving(true)
    try {
      const updated = await apiRequest<DocumentRow>(`/documents/${documentId}/validate`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      })
      setSelectedDocument(updated)
      setNotice({ type: "success", message: "Document validé. Il peut maintenant être utilisé dans le dossier client." })
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Validation impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function rejectDocumentReview(documentId: string, rejectedReason: string, notes?: string) {
    if (!rejectedReason.trim()) {
      setNotice({ type: "error", message: "Ajoutez une raison avant de rejeter le document." })
      return
    }
    setIsSaving(true)
    try {
      const updated = await apiRequest<DocumentRow>(`/documents/${documentId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ rejectedReason, notes }),
      })
      setSelectedDocument(updated)
      setNotice({ type: "success", message: "Document rejeté. Une correction peut maintenant être demandée au client." })
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Rejet impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function runOcr(documentId: string) {
    setIsSaving(true)
    try {
      await apiRequest<{ queued: boolean }>(`/documents/${documentId}/ocr`, { method: "POST", body: JSON.stringify({}) })
      setNotice({ type: "info", message: "OCR lancé. Ouvrez la fiche du document, vérifiez le contenu, puis cliquez sur Valider ou Rejeter." })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "OCR indisponible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function extractPolicy(documentId: string) {
    setIsSaving(true)
    try {
      const result = await apiRequest<{ product: { id: string; productName: string | null }; extraction: { confidence: string; missingFields: string[] } }>(`/documents/${documentId}/extract-policy`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      setNotice({
        type: "success",
        message: `Police extraite en fiche produit à réviser. Confiance: ${result.extraction.confidence}. Champs à valider: ${result.extraction.missingFields.join(", ") || "aucun"}.`,
      })
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Extraction IA indisponible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitUpload(payload: FormData) {
    setIsSaving(true)
    try {
      await uploadDocument<DocumentRow>(payload)
      setNotice({ type: "success", message: "Le document a été ajouté et classé dans le dossier du client." })
      setUploadOpen(false)
      await loadData()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Import impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  function copyDepositEmail() {
    void navigator.clipboard?.writeText("documents@finadvisor.local")
    setNotice({ type: "success", message: "Email de dépôt copié. Les dépôts par email demanderont une validation humaine." })
  }

  function showHumanMessage(action: string) {
    setNotice({ type: "info", message: `${action} sera ajouté au flux de travail avec validation humaine obligatoire.` })
  }

  async function createTaskFromMissingRequirement(requirement: MissingDocumentRequirement) {
    setIsSaving(true)
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (requirement.severity === "CRITICAL" ? 2 : 5))
      await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `Obtenir document - ${requirement.documentName}`,
          description: [
            requirement.reason,
            `Client: ${requirement.clientName}`,
            `Contexte: ${requirement.contextLabel}`,
            `Action recommandée: ${requirement.suggestedAction}`,
            `Règle: ${requirement.ruleKey}`,
          ].join("\n"),
          type: "DOCUMENT",
          priority: requirement.severity === "CRITICAL" ? "HIGH" : "NORMAL",
          status: "TODO",
          dueDate: dueDate.toISOString(),
          clientId: requirement.clientId,
          isAutomated: true,
        }),
      })
      setNotice({ type: "success", message: `Tâche créée pour ${requirement.clientName}: ${requirement.documentName}.` })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Création de tâche impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function createTasksFromMissingRequirements(requirements: MissingDocumentRequirement[]) {
    if (requirements.length === 0) return
    setIsSaving(true)
    try {
      await Promise.all(requirements.map((requirement) => apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `Obtenir document - ${requirement.documentName}`,
          description: `${requirement.reason}\n\nClient: ${requirement.clientName}\nContexte: ${requirement.contextLabel}\nAction suggérée: ${requirement.suggestedAction}\nRègle: ${requirement.ruleKey}`,
          type: "DOCUMENT",
          priority: requirement.severity === "CRITICAL" ? "HIGH" : "NORMAL",
          dueDate: new Date(Date.now() + (requirement.severity === "CRITICAL" ? 2 : 5) * 24 * 60 * 60 * 1000).toISOString(),
          clientId: requirement.clientId,
          isAutomated: true,
        }),
      })))
      setNotice({ type: "success", message: `${requirements.length} tâche${requirements.length > 1 ? "s" : ""} documentaire${requirements.length > 1 ? "s" : ""} créée${requirements.length > 1 ? "s" : ""}.` })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Création des tâches impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell eyebrow="Documents" title="Documents" description="Classement, import, revue humaine et aperçu des fichiers liés aux clients." showIntro={false}>
      {notice ? (
        <div className={notice.type === "error" ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" : notice.type === "success" ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" : "rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800"}>
          {notice.message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-stretch">
            <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Dossier client intelligent</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight">Coffre documentaire relié aux clients</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">Chaque fichier est classé au bon client et reste relié au profil client, à la conformité, à l’analyse des besoins et aux recommandations.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Client", "Profil client / entreprise", "AML", "Analyse", "Recommandation"].map((step) => (
                  <span key={step} className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-black text-white">
                    {step}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void loadData()}><RefreshCw className="size-4" />Rafraîchir</Button>
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={copyDepositEmail}><Mail className="size-4" />Email dépôt</Button>
                <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => setFolderModalOpen(true)}><Folder className="size-4" />Nouveau dossier</Button>
                <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={() => setUploadOpen(true)}><Upload className="size-4" />Importer</Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Classement automatique</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{classifiedPercent}%</p>
              <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${classifiedPercent}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">Les documents téléversés depuis un client ou depuis cette page sont rangés dans le dossier du client.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon
              const isClickable = Boolean(metric.filter)
              const metricClassName = `rounded-[1.5rem] border-2 p-4 text-left transition ${metric.tone} ${isClickable ? "hover:-translate-y-0.5 hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" : ""}`
              const content = (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">{metric.label}</p>
                    <Icon className="size-5" />
                  </div>
                  <p className="mt-3 text-3xl font-black">{metric.value}</p>
                  <p className="mt-1 text-xs font-bold opacity-80">{metric.detail}</p>
                </>
              )
              if (metric.filter) {
                return (
                  <button
                    key={metric.label}
                    type="button"
                    className={metricClassName}
                    onClick={() => {
                      setCurrentFolderId(null)
                      setStatus(metric.filter)
                    }}
                  >
                    {content}
                  </button>
                )
              }
              return (
                <div key={metric.label} className={metricClassName}>
                  {content}
                </div>
              )
            })}
          </div>
          <MissingDocumentsPanel
            requirements={missingRequirements}
            isSaving={isSaving}
            onCreateTask={(requirement) => void createTaskFromMissingRequirement(requirement)}
            onCreateTasks={(requirements) => void createTasksFromMissingRequirements(requirements)}
          />
        </div>

        <div className="min-h-[640px] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {currentFolder ? (
                <Button variant="outline" size="sm" className="rounded-full border-2" onClick={() => setCurrentFolderId(parentId(currentFolder))}>
                  <ArrowLeft className="size-4" />
                  Retour
                </Button>
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Emplacement actuel</p>
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-xl font-black text-slate-950">{currentFolder?.name ?? "Tous les espaces"}</p>
                  {parentFolder ? <><ChevronRight className="size-4 text-slate-300" /><span className="truncate text-sm font-bold text-slate-500">{parentFolder.name}</span></> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="relative min-w-[240px] flex-1 lg:w-80 lg:flex-none">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={documentSettings?.semanticSearchEnabled ? "Recherche avancée: police, hypothèque, fiscal..." : "Rechercher fichiers ou dossiers..."} className="h-11 rounded-full border-2 pl-11 font-semibold" />
              </label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                <option value="ALL">Tous les statuts</option>
                <option value="OPEN_REQUIRED">Documents requis</option>
                <optgroup label="Risques coffre-fort">
                  {vaultRiskFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </optgroup>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <div className="flex rounded-full border-2 border-slate-200 bg-slate-50 p-1">
                <IconButton active={viewMode === "grid"} label="Grille" onClick={() => setViewMode("grid")} icon={Grid3X3} />
                <IconButton active={viewMode === "list"} label="Liste" onClick={() => setViewMode("list")} icon={List} />
              </div>
            </div>
          </div>

          {currentFolder ? (
            <FolderSummaryBar
              folder={currentFolder}
              foldersInCurrentFolder={visibleFolders}
              documentsInCurrentFolder={visibleDocuments}
              onCreateFolder={() => setFolderModalOpen(true)}
              onUpload={() => setUploadOpen(true)}
            />
          ) : null}

          {isLoading ? <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-8 text-sm font-bold text-slate-500">Chargement des documents...</div> : null}

          {!isLoading ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isRenaming={renamingFolderId === folder.id}
                    isSaving={isSaving}
                    onOpen={() => setCurrentFolderId(folder.id)}
                    onStartRename={() => setRenamingFolderId(folder.id)}
                    onRename={(name) => void renameFolder(folder.id, name)}
                  />
                ))}
              </div>

              {viewMode === "grid" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleDocuments.map((document) => (
                    <DocumentGridCard key={document.id} document={document} selected={selectedDocument?.id === document.id} onSelect={() => setSelectedDocument(document)} onOcr={() => void runOcr(document.id)} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                  {visibleDocuments.map((document) => (
                    <DocumentListRow key={document.id} document={document} selected={selectedDocument?.id === document.id} onSelect={() => setSelectedDocument(document)} onOcr={() => void runOcr(document.id)} />
                  ))}
                </div>
              )}

              {visibleFolders.length === 0 && visibleDocuments.length === 0 ? (
                <div className="mt-6 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                  <Inbox className="mx-auto size-10 text-slate-400" />
                  <p className="mt-3 text-lg font-black text-slate-950">Ce dossier est vide.</p>
                  <p className="mt-1 text-sm text-slate-500">Ajoutez un document ou créez un sous-dossier pour organiser cet espace.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {selectedDocument ? (
        <DocumentDetailPanel
          key={selectedDocument.id}
          document={selectedDocument}
          folders={folders}
          settings={documentSettings}
          isSaving={isSaving}
          onClose={() => setSelectedDocument(null)}
          onRename={(name) => void renameDocument(selectedDocument.id, name)}
          onMove={(folderId) => void moveDocument(selectedDocument.id, folderId)}
          onOcr={() => void runOcr(selectedDocument.id)}
          onExtractPolicy={() => void extractPolicy(selectedDocument.id)}
          onValidate={(notes) => void validateDocumentReview(selectedDocument.id, notes)}
          onReject={(reason, notes) => void rejectDocumentReview(selectedDocument.id, reason, notes)}
          onHumanAction={showHumanMessage}
        />
      ) : null}
      {folderModalOpen ? <CreateFolderModal folders={folders} clients={clients} currentFolderId={currentFolderId} isSaving={isSaving} onClose={() => setFolderModalOpen(false)} onCreate={createFolder} /> : null}
      {uploadOpen ? <UploadModal folders={folders} clients={clients} currentFolderId={currentFolderId} isSaving={isSaving} onClose={() => setUploadOpen(false)} onUpload={submitUpload} /> : null}
    </PageShell>
  )
}

function IconButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof Grid3X3; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={active ? "rounded-full bg-white p-2 text-emerald-700 shadow-sm" : "rounded-full p-2 text-slate-400 hover:text-slate-700"}>
      <Icon className="size-4" />
    </button>
  )
}

function requirementSeverityTone(severity: MissingDocumentRequirement["severity"]) {
  if (severity === "CRITICAL") return "rose"
  if (severity === "WARNING") return "amber"
  return "slate"
}

function contextTypeLabel(contextType: MissingDocumentRequirement["contextType"]) {
  if (contextType === "PRODUCT") return "Police / produit"
  if (contextType === "ANALYSIS") return "Analyse"
  if (contextType === "RECOMMENDATION") return "Recommandation"
  return "Client"
}

function MissingDocumentsPanel({ requirements, isSaving, onCreateTask, onCreateTasks }: { requirements: MissingDocumentRequirement[]; isSaving: boolean; onCreateTask: (requirement: MissingDocumentRequirement) => void; onCreateTasks: (requirements: MissingDocumentRequirement[]) => void }) {
  const [query, setQuery] = useState("")
  const [clientFilter, setClientFilter] = useState("ALL")
  const [contextFilter, setContextFilter] = useState("ALL")
  const [severityFilter, setSeverityFilter] = useState("ALL")
  const clients = useMemo(() => Array.from(new Map(requirements.map((requirement) => [requirement.clientId, requirement.clientName])).entries()).sort((first, second) => first[1].localeCompare(second[1], "fr")), [requirements])
  const filteredRequirements = useMemo(() => {
    const terms = expandedSearchTerms(query, true)
    return requirements.filter((requirement) => {
      if (clientFilter !== "ALL" && requirement.clientId !== clientFilter) return false
      if (contextFilter !== "ALL" && requirement.contextType !== contextFilter) return false
      if (severityFilter !== "ALL" && requirement.severity !== severityFilter) return false
      if (terms.length === 0) return true
      const text = [requirement.documentName, requirement.clientName, requirement.contextLabel, requirement.reason, requirement.ruleKey, requirement.suggestedAction, requirement.documentType].join(" ").toLowerCase()
      return terms.some((term) => text.includes(term))
    })
  }, [clientFilter, contextFilter, query, requirements, severityFilter])
  const groupedRequirements = useMemo(() => {
    const groups = new Map<string, MissingDocumentRequirement[]>()
    for (const requirement of filteredRequirements) {
      const key = `${requirement.clientId}:${requirement.contextType}:${requirement.contextId}`
      const current = groups.get(key) ?? []
      current.push(requirement)
      groups.set(key, current)
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items, first: items[0] }))
  }, [filteredRequirements])

  if (requirements.length === 0) {
    return (
      <section className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-white p-2 text-emerald-700"><CheckCircle2 className="size-5" /></span>
          <div>
            <p className="text-sm font-black text-emerald-950">Aucun document manquant critique détecté</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Les règles automatiques n’ont pas trouvé de police, relevé, pièce d’identité, rapport ou preuve attendue manquante.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-5 rounded-[1.5rem] border-2 border-red-100 bg-red-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-red-950">
            <FileWarning className="size-4 text-red-700" />
            Documents manquants détectés
          </p>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-red-900">
            Vue consolidée par client, produit, analyse et recommandation. Ces règles couvrent notamment police déclarée sans document, hypothèque/dette sans relevé, pièce d’identité expirée, rapport d’analyse ou recommandation absent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="rose">{requirements.length} élément{requirements.length > 1 ? "s" : ""}</StatusBadge>
          <StatusBadge tone="amber">{filteredRequirements.length} affiché{filteredRequirements.length > 1 ? "s" : ""}</StatusBadge>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_180px_180px_160px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher: police, hypothèque, rapport..." className="h-11 rounded-2xl border-2 bg-white pl-9 font-semibold" />
        </label>
        <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-11 rounded-2xl border-2 border-red-100 bg-white px-3 text-sm font-black text-slate-700">
          <option value="ALL">Tous les clients</option>
          {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={contextFilter} onChange={(event) => setContextFilter(event.target.value)} className="h-11 rounded-2xl border-2 border-red-100 bg-white px-3 text-sm font-black text-slate-700">
          <option value="ALL">Tous contextes</option>
          <option value="CLIENT">Client</option>
          <option value="PRODUCT">Police / produit</option>
          <option value="ANALYSIS">Analyse</option>
          <option value="RECOMMENDATION">Recommandation</option>
        </select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="h-11 rounded-2xl border-2 border-red-100 bg-white px-3 text-sm font-black text-slate-700">
          <option value="ALL">Toutes priorités</option>
          <option value="CRITICAL">Critique</option>
          <option value="WARNING">Attention</option>
          <option value="INFO">Info</option>
        </select>
        <Button type="button" variant="outline" className="h-11 rounded-2xl border-2 bg-white font-black" disabled={isSaving || filteredRequirements.length === 0} onClick={() => onCreateTasks(filteredRequirements)}>
          <FileWarning className="size-4" />
          Créer tâches
        </Button>
      </div>

      <div className="mt-4 grid gap-4">
        {groupedRequirements.map((group) => (
          <article key={group.key} className="rounded-2xl border border-red-100 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">{group.first.clientName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{group.first.contextLabel} · {contextTypeLabel(group.first.contextType)}</p>
              </div>
              <StatusBadge tone="rose">{group.items.length} document{group.items.length > 1 ? "s" : ""}</StatusBadge>
            </div>
            <div className="mt-3 grid gap-2">
              {group.items.map((requirement) => (
                <div key={requirement.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">{requirement.documentName}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{requirement.reason}</p>
                    </div>
                    <StatusBadge tone={requirementSeverityTone(requirement.severity)}>{requirement.severity === "CRITICAL" ? "Critique" : requirement.severity === "WARNING" ? "Attention" : "Info"}</StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{documentTypeLabels[requirement.documentType] ?? requirement.documentType}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{requirement.suggestedAction}</span>
                    <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" disabled={isSaving} onClick={() => onCreateTask(requirement)}>
                      <FileWarning className="size-4" />
                      Créer tâche
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {filteredRequirements.length === 0 ? <p className="mt-3 text-sm font-bold text-red-800">Aucun document manquant ne correspond aux filtres.</p> : null}
    </section>
  )
}

function FolderCard({ folder, isRenaming, isSaving, onOpen, onStartRename, onRename }: { folder: DocumentFolder; isRenaming: boolean; isSaving: boolean; onOpen: () => void; onStartRename: () => void; onRename: (name: string) => void }) {
  const [name, setName] = useState(folder.name)

  return (
    <article className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="rounded-2xl bg-amber-100 p-3 text-amber-700"><FolderOpen className="size-6" /></span>
          <span className="min-w-0">
            {isRenaming ? (
              <input
                autoFocus
                value={name}
                disabled={isSaving}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => onRename(name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onRename(name)
                  if (event.key === "Escape") setName(folder.name)
                }}
                className="w-full rounded-xl border-2 border-emerald-200 bg-white px-2 py-1 text-sm font-black text-slate-950 outline-none"
              />
            ) : (
              <span className="block truncate text-base font-black text-slate-950">{folder.name}</span>
            )}
            <span className="mt-1 block text-xs font-semibold text-slate-500">{folderDocumentCount(folder)} documents · {folderChildCount(folder)} sous-dossiers</span>
            <span className="mt-1 block text-xs text-slate-400">{folderTypeLabel(folder)} · {folderConfidentiality(folder)}</span>
          </span>
        </button>
        <button type="button" onClick={onStartRename} className="rounded-full p-2 text-slate-400 opacity-100 hover:bg-white hover:text-emerald-700 lg:opacity-0 lg:group-hover:opacity-100" aria-label="Renommer le dossier">
          <Pencil className="size-4" />
        </button>
      </div>
    </article>
  )
}

function DocumentGridCard({ document, selected, onSelect, onOcr }: { document: DocumentRow; selected: boolean; onSelect: () => void; onOcr: () => void }) {
  const riskBadges = documentRiskBadges(document)
  return (
    <article className={selected ? "rounded-[1.5rem] border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm" : "rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"}>
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-2xl bg-sky-50 p-3 text-sky-700"><FileText className="size-6" /></span>
          <StatusBadge tone={statusTone(document.status)}>{documentStatusLabels[document.status] ?? document.status}</StatusBadge>
        </div>
        <h3 className="mt-4 line-clamp-2 text-base font-black leading-5 text-slate-950">{documentName(document)}</h3>
        <p className="mt-2 truncate text-sm font-semibold text-slate-500">{clientName(document.client)}</p>
        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{documentSummary(document)}</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{documentCategoryLabel(document) ?? documentTypeLabels[documentCategory(document)] ?? documentCategory(document)} · {formatBytes(documentFileSize(document))}</p>
        {riskBadges.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {riskBadges.slice(0, 3).map((badge) => (
              <span key={badge.label} className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.className}`}>
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </button>
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 rounded-full border-2" onClick={onSelect}><Eye className="size-4" />Aperçu</Button>
        <Button size="sm" variant="outline" className="rounded-full border-2" onClick={onOcr}><Sparkles className="size-4" />OCR</Button>
      </div>
    </article>
  )
}

function DocumentListRow({ document, selected, onSelect, onOcr }: { document: DocumentRow; selected: boolean; onSelect: () => void; onOcr: () => void }) {
  const riskBadges = documentRiskBadges(document)
  return (
    <div className={selected ? "grid gap-3 border-b border-emerald-100 bg-emerald-50 p-4 md:grid-cols-[1fr_190px_130px_120px]" : "grid gap-3 border-b border-slate-100 p-4 hover:bg-slate-50 md:grid-cols-[1fr_190px_130px_120px]"}>
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <p className="truncate text-sm font-black text-slate-950">{documentName(document)}</p>
        <p className="truncate text-xs font-semibold text-slate-500">{clientName(document.client)}</p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{documentSummary(document)}</p>
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-500">{documentCategoryLabel(document) ?? documentTypeLabels[documentCategory(document)] ?? documentCategory(document)}</p>
        {riskBadges.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {riskBadges.slice(0, 2).map((badge) => (
              <span key={badge.label} className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.className}`}>
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <StatusBadge tone={statusTone(document.status)}>{documentStatusLabels[document.status] ?? document.status}</StatusBadge>
      <Button size="sm" variant="outline" className="rounded-full border-2" onClick={onOcr}><Sparkles className="size-4" />OCR</Button>
    </div>
  )
}

function FolderSummaryBar({ folder, foldersInCurrentFolder, documentsInCurrentFolder, onCreateFolder, onUpload }: { folder: DocumentFolder; foldersInCurrentFolder: DocumentFolder[]; documentsInCurrentFolder: DocumentRow[]; onCreateFolder: () => void; onUpload: () => void }) {
  const waitingDocuments = documentsInCurrentFolder.filter((item) => item.status === "REQUIRED" || item.status === "REQUESTED")
  const reviewDocuments = documentsInCurrentFolder.filter((item) => item.status === "RECEIVED" || item.status === "REJECTED")

  return (
    <section className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-2xl bg-amber-100 p-2 text-amber-700"><FolderOpen className="size-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{folder.path ?? folder.name}</p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{folder.description || folderClassificationRule(folder)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <FolderFact icon={FileText} label="Documents" value={String(documentsInCurrentFolder.length)} />
          <FolderFact icon={Folder} label="Sous-dossiers" value={String(foldersInCurrentFolder.length)} />
          <FolderFact icon={FileWarning} label="En attente" value={String(waitingDocuments.length)} />
          <FolderFact icon={FileSearch} label="À vérifier" value={String(reviewDocuments.length)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={onCreateFolder}><Folder className="size-4" />Créer un sous-dossier</Button>
        <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={onUpload}><Upload className="size-4" />Ajouter un fichier</Button>
      </div>
    </section>
  )
}

function DocumentDetailPanel({ document, folders, settings, isSaving, onClose, onRename, onMove, onOcr, onExtractPolicy, onValidate, onReject, onHumanAction }: { document: DocumentRow; folders: DocumentFolder[]; settings: DocumentVaultSettings | null; isSaving: boolean; onClose: () => void; onRename: (name: string) => void; onMove: (folderId: string | null) => void; onOcr: () => void; onExtractPolicy: () => void; onValidate: (notes?: string) => void; onReject: (reason: string, notes?: string) => void; onHumanAction: (action: string) => void }) {
  const [draftName, setDraftName] = useState(documentName(document))
  const [reviewNote, setReviewNote] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [showReject, setShowReject] = useState(false)
  const [preview, setPreview] = useState<{ status: "loading" | "ready" | "unavailable" | "error"; url?: string; mimeType?: string; message?: string }>({ status: "loading" })
  const [audit, setAudit] = useState<DocumentVaultAudit | null>(null)
  const [auditStatus, setAuditStatus] = useState<"loading" | "ready" | "error">("loading")
  const [shareOpen, setShareOpen] = useState(false)
  const [shareRecipientName, setShareRecipientName] = useState(clientName(document.client))
  const [sharePurpose, setSharePurpose] = useState("Remise sécurisée d’un document lié au dossier client.")
  const [shareMethod, setShareMethod] = useState("PORTAIL")
  const [retentionOpen, setRetentionOpen] = useState(false)
  const retentionOptions = settings?.retentionPolicies?.length ? settings.retentionPolicies : [
    { value: "DEFAULT_CLIENT_DOCUMENTS", label: "Documents client - politique cabinet", description: "Politique générale", duration: "7 ans" },
    { value: "CLIENT_PROFILE_KYC", label: "Profil client / KYC", description: "Profil client", duration: "7 ans" },
    { value: "RECOMMENDATION_EVIDENCE", label: "Recommandations et preuves de conseil", description: "Preuves de conseil", duration: "7 ans" },
    { value: "IDENTITY_DOCUMENTS", label: "Pièces d’identité", description: "Identité", duration: "3 ans" },
    { value: "REJECTED_DOCUMENTS", label: "Documents refusés ou illisibles", description: "Documents rejetés", duration: "30 jours" },
  ]
  const [retentionPolicy, setRetentionPolicy] = useState(retentionOptions[0]?.value ?? "DEFAULT_CLIENT_DOCUMENTS")
  const [retentionReason, setRetentionReason] = useState("Revue périodique de conservation selon la politique documentaire du cabinet.")
  const [retentionAction, setRetentionAction] = useState("REVIEW")
  const placementWarning = documentPlacementWarning(document)
  const documentClientId = document.client?.id ?? document.clientId ?? null
  const clientFolders = sortedClientFolders(folders, documentClientId)
  const rootFolder = clientRootFolder(clientFolders)
  const currentDocumentFolderId = documentFolderId(document)
  const currentFolderOutsideClient = currentDocumentFolderId ? !clientFolders.some((folder) => folder.id === currentDocumentFolderId) : false
  const currentExternalFolder = currentFolderOutsideClient ? folders.find((folder) => folder.id === currentDocumentFolderId) ?? null : null
  const selectedFolderId = currentDocumentFolderId ?? rootFolder?.id ?? ""
  const canExtractPolicy = documentCategory(document) === "POLICY_DOCUMENT" || documentName(document).toLowerCase().includes("police") || documentName(document).toLowerCase().includes("contrat")
  const riskBadges = documentRiskBadges(document)
  const remediationItems = [
    documentIsUnclassified(document)
      ? {
          label: "Classer le document",
          detail: "Associer le fichier au bon dossier client et confirmer sa catégorie avant de l’utiliser comme preuve.",
          actionLabel: "Choisir le dossier plus bas",
          onClick: () => onHumanAction("Classement documentaire"),
        }
      : null,
    documentNeedsExtractionValidation(document)
      ? {
          label: "Valider les données extraites",
          detail: "Les valeurs proposées par l’IA doivent être confirmées ou corrigées par un humain avant synchronisation CRM.",
          actionLabel: "Voir les champs extraits",
          onClick: () => void loadAudit(),
        }
      : null,
    documentIsSensitiveWithoutConsent(document)
      ? {
          label: "Régulariser le consentement",
          detail: "Ce document contient des données sensibles ou d’identité sans consentement lié au coffre documentaire.",
          actionLabel: "Créer une tâche consentement",
          onClick: () => onHumanAction("Consentement documentaire"),
        }
      : null,
    documentIsExternallyShared(document)
      ? {
          label: "Revoir le partage externe",
          detail: "Vérifier la finalité, le destinataire et la trace d’accès du partage documenté.",
          actionLabel: "Actualiser l’historique",
          onClick: () => void loadAudit(),
        }
      : null,
    documentRetentionDue(document)
      ? {
          label: "Décider la conservation",
          detail: "Planifier une revue d’archivage, de destruction ou d’anonymisation selon la politique du cabinet.",
          actionLabel: "Planifier la revue",
          onClick: () => setRetentionOpen(true),
        }
      : null,
    document.isLocked
      ? {
          label: "Preuve verrouillée",
          detail: "Ce document est figé comme preuve. Les modifications doivent passer par une nouvelle version ou une revue conformité.",
          actionLabel: "Voir la preuve",
          onClick: () => void loadAudit(),
        }
      : null,
  ].filter((item): item is { label: string; detail: string; actionLabel: string; onClick: () => void } => Boolean(item))

  const loadPreview = useCallback(async (showLoading = true) => {
    if (showLoading) setPreview({ status: "loading" })
    try {
      const data = await apiRequest<{ url: string; expiresIn: number; mimeType?: string }>(`/documents/${document.id}/preview-url`)
      setPreview({ status: "ready", url: data.url, mimeType: data.mimeType })
    } catch (error) {
      setPreview({
        status: "unavailable",
        message: error instanceof Error ? error.message : "Aperçu non disponible pour ce fichier.",
      })
    }
  }, [document.id])

  useEffect(() => {
    let cancelled = false

    async function fetchInitialPreview() {
      try {
        const data = await apiRequest<{ url: string; expiresIn: number; mimeType?: string }>(`/documents/${document.id}/preview-url`)
        if (!cancelled) setPreview({ status: "ready", url: data.url, mimeType: data.mimeType })
      } catch (error) {
        if (!cancelled) {
          setPreview({
            status: "unavailable",
            message: error instanceof Error ? error.message : "Aperçu non disponible pour ce fichier.",
          })
        }
      }
    }

    void fetchInitialPreview()
    return () => {
      cancelled = true
    }
  }, [document.id])

  const loadAudit = useCallback(async () => {
    setAuditStatus("loading")
    try {
      const data = await apiRequest<DocumentVaultAudit>(`/documents/${document.id}/audit`)
      setAudit(data)
      setAuditStatus("ready")
    } catch {
      setAuditStatus("error")
    }
  }, [document.id])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  async function validateExtractedField(fieldId: string, value: unknown) {
    try {
      await apiRequest(`/documents/${document.id}/extractions/${fieldId}/validate`, {
        method: "PATCH",
        body: JSON.stringify({ value, status: "VALIDATED" }),
      })
      await loadAudit()
    } catch {
      onHumanAction("Validation extraction")
    }
  }

  async function correctExtractedField(field: DocumentVaultAudit["extractions"][number]["fields"][number]) {
    const currentValue = displayExtractedValue(field.validatedValue ?? field.extractedValue)
    const nextValue = window.prompt(`Corriger la valeur pour "${field.fieldLabel}"`, currentValue)
    if (nextValue === null) return
    try {
      await apiRequest(`/documents/${document.id}/extractions/${field.id}/validate`, {
        method: "PATCH",
        body: JSON.stringify({ value: nextValue, status: "CORRECTED", note: "Valeur corrigée manuellement dans le coffre documentaire." }),
      })
      await loadAudit()
    } catch {
      onHumanAction("Correction extraction")
    }
  }

  async function rejectExtractedField(field: DocumentVaultAudit["extractions"][number]["fields"][number]) {
    try {
      await apiRequest(`/documents/${document.id}/extractions/${field.id}/validate`, {
        method: "PATCH",
        body: JSON.stringify({ value: field.validatedValue ?? field.extractedValue, status: "REJECTED", note: "Valeur rejetée manuellement dans le coffre documentaire." }),
      })
      await loadAudit()
    } catch {
      onHumanAction("Rejet extraction")
    }
  }

  async function openDownload() {
    try {
      const data = await apiRequest<{ url: string; expiresIn: number }>(`/documents/${document.id}/download-url`)
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch {
      onHumanAction("Téléchargement")
    }
  }

  async function shareDocument() {
    if (!shareRecipientName.trim() || !sharePurpose.trim()) {
      onHumanAction("Partage sécurisé")
      return
    }
    try {
      await apiRequest(`/documents/${document.id}/share`, {
        method: "POST",
        body: JSON.stringify({
          recipientType: shareMethod === "INTERNE" ? "CONFORMITE" : "CLIENT",
          recipientName: shareRecipientName.trim(),
          deliveryMethod: shareMethod,
          purpose: sharePurpose.trim(),
          allowDownload: false,
        }),
      })
      setShareOpen(false)
      await loadAudit()
    } catch {
      onHumanAction("Partage sécurisé")
    }
  }

  async function scheduleRetentionReview() {
    if (!retentionReason.trim()) {
      onHumanAction("Revue de conservation")
      return
    }
    try {
      await apiRequest(`/documents/${document.id}/retention-review`, {
        method: "POST",
        body: JSON.stringify({
          action: retentionAction,
          policy: retentionPolicy,
          reason: retentionReason.trim(),
        }),
      })
      setRetentionOpen(false)
      await loadAudit()
    } catch {
      onHumanAction("Revue de conservation")
    }
  }

  return (
    <Modal title="Fiche document" subtitle={`${clientName(document.client)} · ${documentStatusLabels[document.status] ?? document.status}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-6 text-center">
            <FileText className="mx-auto size-14 text-sky-500" />
            <p className="mt-4 text-sm font-black text-slate-700">{documentFileType(document)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatBytes(documentFileSize(document))}</p>
          </div>

          <div className="min-w-0">
            <label className="block">
              <span className="sr-only">Nom du document</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => onRename(draftName)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onRename(draftName)
                }}
                className="w-full rounded-xl border-2 border-transparent bg-transparent px-0 py-1 text-xl font-black text-slate-950 outline-none transition focus:border-emerald-200 focus:bg-emerald-50 focus:px-3"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(document.status)}>{documentStatusLabels[document.status] ?? document.status}</StatusBadge>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{documentConfidentiality(document)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{documentVersion(document)}</span>
              {isKycSnapshotPdf(document) ? <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">Rapport PDF</span> : null}
            </div>
            {riskBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {riskBadges.map((badge) => (
                  <span key={badge.label} className={`rounded-full border px-3 py-1 text-xs font-black ${badge.className}`}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
            {placementWarning ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-5 text-amber-900">{placementWarning}</div> : null}
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Résumé documentaire</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{documentSummary(document)}</p>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-[1.5rem] border-2 border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Eye className="size-4 text-emerald-700" />
                Aperçu du contenu
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Vérifiez le document ici avant de le valider. Les liens d’aperçu sont temporaires.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={() => void loadPreview(true)}>
                <RefreshCw className="size-4" />
                Actualiser
              </Button>
              {preview.url ? (
                <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}>
                  <Eye className="size-4" />
                  Ouvrir
                </Button>
              ) : null}
              <Button type="button" size="sm" className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" onClick={() => void openDownload()}>
                <Download className="size-4" />
                Télécharger
              </Button>
            </div>
          </div>

          <div className="bg-slate-100 p-3">
            {preview.status === "loading" ? (
              <div className="grid min-h-[360px] place-items-center rounded-[1.25rem] bg-white text-sm font-black text-slate-500">
                Chargement de l’aperçu...
              </div>
            ) : preview.status === "ready" && preview.url && preview.mimeType === "application/pdf" ? (
              <iframe src={preview.url} title={`Aperçu - ${documentName(document)}`} className="h-[540px] w-full rounded-[1.25rem] border border-slate-200 bg-white" />
            ) : preview.status === "ready" && preview.url && preview.mimeType?.startsWith("image/") ? (
              <div className="grid max-h-[620px] place-items-center overflow-auto rounded-[1.25rem] bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={`Aperçu de ${documentName(document)}`} className="max-h-[580px] max-w-full rounded-xl object-contain" />
              </div>
            ) : (
              <div className="grid min-h-[360px] place-items-center rounded-[1.25rem] border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                <div>
                  <FileWarning className="mx-auto size-10 text-amber-500" />
                  <p className="mt-3 text-base font-black text-slate-950">Aperçu non disponible</p>
                  <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                    {preview.message ?? "Ce format ne peut pas être affiché dans le navigateur. Téléchargez le fichier pour le vérifier avant validation."}
                  </p>
                  <Button type="button" className="mt-4 rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" onClick={() => void openDownload()}>
                    <Download className="size-4" />
                    Télécharger pour vérifier
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-emerald-950">
                <FileSearch className="size-4 text-emerald-700" />
                Validation humaine
              </p>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-emerald-900">
                Vérifiez que le document correspond au bon client, que le type est exact et que les informations OCR peuvent être utilisées dans le profil client, la conformité ou l’analyse.
              </p>
            </div>
            <StatusBadge tone={document.status === "VALIDATED" ? "emerald" : document.status === "REJECTED" ? "rose" : "amber"}>
              {document.status === "VALIDATED" ? "Revue terminée" : document.status === "REJECTED" ? "Correction requise" : "À valider"}
            </StatusBadge>
          </div>

          <textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            rows={3}
            placeholder="Note interne de validation, par exemple: pièce lisible, nom cohérent, document utilisable pour le profil client."
            className="mt-4 w-full rounded-2xl border-2 border-emerald-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />

          {showReject ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-white p-3">
              <label className="grid gap-1.5 text-sm font-black text-rose-800">
                Raison de rejet
                <input
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Ex.: document illisible, mauvais client, pièce expirée"
                  className="h-11 rounded-xl border-2 border-rose-100 px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" className="rounded-full bg-emerald-600 font-black text-white hover:bg-emerald-700" disabled={isSaving} onClick={() => onValidate(reviewNote)}>
              <CheckCircle2 className="size-4" />
              Valider le document
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 border-rose-200 font-black text-rose-700 hover:bg-rose-50" disabled={isSaving} onClick={() => showReject ? onReject(rejectReason, reviewNote) : setShowReject(true)}>
              <XCircle className="size-4" />
              {showReject ? "Confirmer le rejet" : "Rejeter / demander correction"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 bg-white font-black" disabled={isSaving} onClick={onOcr}>
              <Sparkles className="size-4" />
              Relancer OCR
            </Button>
            {canExtractPolicy ? (
              <Button type="button" variant="outline" className="rounded-full border-2 border-violet-200 bg-white font-black text-violet-700 hover:bg-violet-50" disabled={isSaving} onClick={onExtractPolicy}>
                <Sparkles className="size-4" />
                Extraire police
              </Button>
            ) : null}
          </div>
        </section>

        {remediationItems.length > 0 ? (
          <section className="rounded-[1.5rem] border-2 border-orange-100 bg-orange-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-black text-orange-950">
                  <FileWarning className="size-4 text-orange-700" />
                  Actions requises sur ce document
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-orange-900">
                  Ces contrôles évitent qu’un fichier non classé, non validé ou sans consentement soit utilisé dans une analyse ou une recommandation.
                </p>
              </div>
              <StatusBadge tone="amber">{remediationItems.length} action{remediationItems.length > 1 ? "s" : ""}</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {remediationItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-orange-100 bg-white p-3">
                  <p className="text-sm font-black text-slate-950">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3 rounded-full border-2 bg-white" onClick={item.onClick}>
                    {item.actionLabel}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <InfoRow label="Emplacement" value={document.folder?.path ?? document.folder?.name ?? "À classer"} />
          <InfoRow label="Catégorie" value={documentCategoryLabel(document) ?? documentTypeLabels[documentCategory(document)] ?? documentCategory(document)} />
          <InfoRow label="Sous-catégorie" value={documentSubcategory(document)} />
          <InfoRow label="Source" value={documentSource(document)} />
          <InfoRow label="Créé" value={formatDate(documentCreatedAt(document))} />
          <InfoRow label="Modifié" value={formatDate(documentUpdatedAt(document))} />
        </div>

        <section className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">Nommage recommandé</p>
          <p className="mt-2 rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-600">{suggestedDocumentName(document)}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3 rounded-full border-2" onClick={() => setDraftName(suggestedDocumentName(document))}>
            <Pencil className="size-4" />
            Utiliser cette suggestion
          </Button>
        </section>

        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">Tags</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {documentTags(document).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                <Tag className="size-3" />
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
          <p className="text-sm font-black text-slate-950">Accès document</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <ShieldCheck className="size-4 text-emerald-700" />
              <span className="text-sm font-black text-slate-700">Hérite du dossier parent</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <LockKeyhole className="size-4 text-emerald-700" />
              <span className="text-sm font-black text-slate-700">{documentAccessRecommendation(document, settings)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border-2 border-sky-100 bg-sky-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-sky-950">
                <ShieldCheck className="size-4 text-sky-700" />
                Preuve documentaire
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-sky-900">
                Versions, liens métier, extractions et accès sont conservés pour démontrer comment le document est utilisé dans le dossier.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={() => void loadAudit()}>
              <RefreshCw className="size-4" />
              Actualiser preuve
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <VaultMetric label="Versions" value={audit?.versions.length ?? 0} />
            <VaultMetric label="Liens métier" value={audit?.links.length ?? 0} />
            <VaultMetric label="Extractions" value={audit?.extractions.length ?? 0} />
            <VaultMetric label="Accès récents" value={audit?.accessLogs.length ?? 0} />
          </div>
          <div className="mt-3 grid gap-2 text-xs font-bold text-sky-900 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-3">Sensibilité: {documentConfidentiality(document)}</div>
            <div className="rounded-2xl bg-white/80 p-3">Téléchargements: {document.downloadCount ?? 0}</div>
            <div className="rounded-2xl bg-white/80 p-3">Dernier accès: {formatDate(document.lastAccessedAt)}</div>
            <div className="rounded-2xl bg-white/80 p-3">Verrouillage: {document.isLocked ? "Document verrouillé" : "Non verrouillé"}</div>
          </div>
        </section>

        {auditStatus === "loading" ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 text-sm font-black text-slate-500">Chargement des preuves documentaires...</div>
        ) : auditStatus === "error" ? (
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4 text-sm font-black text-amber-800">Preuve documentaire temporairement indisponible.</div>
        ) : audit ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Liens métier</p>
              <div className="mt-3 grid gap-2">
                {audit.links.length ? audit.links.slice(0, 6).map((link) => (
                  <div key={link.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <p className="font-black text-slate-800">{link.label ?? link.linkedEntityType}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{link.relationshipType} · {proofStatusLabel(link.proofStatus)} · {formatDate(link.createdAt)}</p>
                    {link.sourceFieldKey ? (
                      <p className="mt-2 rounded-xl bg-white px-2 py-1 text-xs font-black text-emerald-700">
                        Donnée CRM source : {link.sourceFieldKey}
                      </p>
                    ) : null}
                  </div>
                )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Aucun lien métier avancé.</p>}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Historique d’accès</p>
              <div className="mt-3 grid gap-2">
                {audit.accessLogs.length ? audit.accessLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <p className="font-black text-slate-800">{accessEventLabel(log.eventType)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{log.user?.name ?? "Système"} · {formatDate(log.createdAt)}{log.purpose ? ` · ${log.purpose}` : ""}</p>
                  </div>
                )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Aucun accès récent journalisé.</p>}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 xl:col-span-2">
              <p className="text-sm font-black text-slate-950">Données extraites à valider</p>
              <div className="mt-3 grid gap-3">
                {audit.extractions.length ? audit.extractions.map((extraction) => (
                  <div key={extraction.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-900">{extraction.extractionType} · {extractionStatusLabel(extraction.status)}</p>
                      <StatusBadge tone={extraction.status === "VALIDATED" ? "emerald" : extraction.status === "REJECTED" ? "rose" : "amber"}>
                        {extraction.confidenceScore ? `${extraction.confidenceScore} % confiance` : "Confiance à confirmer"}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {extraction.fields.slice(0, 12).map((field) => (
                        <div key={field.id} className="rounded-xl bg-white p-3">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{field.fieldLabel}</p>
                          <p className="mt-1 text-sm font-black text-slate-800">{displayExtractedValue(field.validatedValue ?? field.extractedValue)}</p>
                          {field.synchronizedFieldKey ? (
                            <p className="mt-2 rounded-xl bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                              Synchronisé vers {field.synchronizedEntityType ?? "CRM"} · {field.synchronizedFieldKey}
                            </p>
                          ) : field.pageNumber ? (
                            <p className="mt-2 rounded-xl bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">
                              Source document : page {field.pageNumber}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-500">{extractionStatusLabel(field.status)}</span>
                            <div className="flex flex-wrap gap-1">
                              {field.status === "PROPOSED" || field.status === "TO_VALIDATE" ? (
                                <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-2 text-xs" disabled={isSaving} onClick={() => void validateExtractedField(field.id, field.extractedValue)}>
                                  Valider
                                </Button>
                              ) : null}
                              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-2 text-xs" disabled={isSaving} onClick={() => void correctExtractedField(field)}>
                                Corriger
                              </Button>
                              {field.status !== "REJECTED" ? (
                                <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-2 border-rose-200 text-xs text-rose-700 hover:bg-rose-50" disabled={isSaving} onClick={() => void rejectExtractedField(field)}>
                                  Rejeter
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Aucune extraction structurée pour ce document.</p>}
              </div>
            </section>
          </div>
        ) : null}

        {shareOpen ? (
          <section className="rounded-[1.5rem] border-2 border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-black text-emerald-950">Partage sécurisé journalisé</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Aucun lien public permanent n’est créé. Le partage est enregistré dans l’historique d’accès du document.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-black text-emerald-950">
                Destinataire
                <Input value={shareRecipientName} onChange={(event) => setShareRecipientName(event.target.value)} className="h-11 rounded-2xl border-2 bg-white font-semibold" />
              </label>
              <label className="grid gap-1.5 text-sm font-black text-emerald-950">
                Méthode
                <select value={shareMethod} onChange={(event) => setShareMethod(event.target.value)} className="h-11 rounded-2xl border-2 border-emerald-100 bg-white px-3 text-sm font-bold">
                  <option value="PORTAIL">Portail client</option>
                  <option value="COURRIEL_SECURISÉ">Courriel sécurisé</option>
                  <option value="INTERNE">Partage interne</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-black text-emerald-950">
                Finalité
                <Input value={sharePurpose} onChange={(event) => setSharePurpose(event.target.value)} className="h-11 rounded-2xl border-2 bg-white font-semibold" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" disabled={isSaving} onClick={() => void shareDocument()}>
                <Share2 className="size-4" />
                Journaliser le partage
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={() => setShareOpen(false)}>
                Annuler
              </Button>
            </div>
          </section>
        ) : null}

        {retentionOpen ? (
          <section className="rounded-[1.5rem] border-2 border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-950">Conservation, archivage ou destruction à revoir</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">Cette action planifie une revue et journalise la décision. Elle ne détruit pas le fichier.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[220px_260px_1fr]">
              <label className="grid gap-1.5 text-sm font-black text-amber-950">
                Action prévue
                <select value={retentionAction} onChange={(event) => setRetentionAction(event.target.value)} className="h-11 rounded-2xl border-2 border-amber-100 bg-white px-3 text-sm font-bold">
                  <option value="REVIEW">Revoir</option>
                  <option value="ARCHIVE">Archiver</option>
                  <option value="DESTROY_REVIEW">Évaluer destruction</option>
                  <option value="ANONYMIZE_REVIEW">Évaluer anonymisation</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-black text-amber-950">
                Politique
                <select value={retentionPolicy} onChange={(event) => setRetentionPolicy(event.target.value)} className="h-11 rounded-2xl border-2 border-amber-100 bg-white px-3 text-sm font-bold">
                  {retentionOptions.map((policy) => (
                    <option key={policy.value} value={policy.value}>{policy.label} ({policy.duration})</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-black text-amber-950">
                Raison
                <Input value={retentionReason} onChange={(event) => setRetentionReason(event.target.value)} className="h-11 rounded-2xl border-2 bg-white font-semibold" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full bg-slate-950 font-black text-white hover:bg-slate-800" disabled={isSaving} onClick={() => void scheduleRetentionReview()}>
                <CalendarClock className="size-4" />
                Planifier la revue
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full border-2 bg-white" onClick={() => setRetentionOpen(false)}>
                Annuler
              </Button>
            </div>
          </section>
        ) : null}

        <label className="grid gap-1.5 text-sm font-black text-slate-700">
          Classer dans
          <select disabled={isSaving || clientFolders.length === 0} value={selectedFolderId} onChange={(event) => onMove(event.target.value || (rootFolder?.id ?? null))} className="h-11 rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-bold">
            {clientFolders.length === 0 ? <option value="">Aucun dossier client disponible</option> : null}
            {clientFolders.map((folder) => <option key={folder.id} value={folder.id}>{clientFolderLabel(folder, rootFolder)}</option>)}
            {currentExternalFolder ? <option value={currentExternalFolder.id}>Emplacement actuel hors dossier client: {folderPath(currentExternalFolder)}</option> : null}
          </select>
          <span className="text-xs font-semibold leading-5 text-slate-500">
            Le menu affiche seulement les dossiers de {clientName(document.client)} pour éviter de chercher parmi tous les clients.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ActionButton icon={Sparkles} label="OCR" onClick={onOcr} />
          {canExtractPolicy ? <ActionButton icon={Sparkles} label="Extraire police" onClick={onExtractPolicy} /> : null}
          <ActionButton icon={MessageSquare} label="Commenter" onClick={() => onHumanAction("Commentaire")} />
          <ActionButton icon={CalendarClock} label="Conservation" onClick={() => setRetentionOpen((value) => !value)} />
          <ActionButton icon={Send} label="Signer" onClick={() => onHumanAction("Signature électronique")} />
          <ActionButton icon={Share2} label="Partager" onClick={() => setShareOpen((value) => !value)} />
          <ActionButton icon={Download} label="Télécharger" onClick={() => void openDownload()} />
        </div>
      </div>
    </Modal>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="truncate text-sm font-black text-slate-700">{value}</span>
    </div>
  )
}

function VaultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-sky-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-sky-950">{value}</p>
    </div>
  )
}

function FolderFact({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon className="size-4" />{label}</span>
      <span className="text-sm font-black text-slate-800">{value}</span>
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Sparkles; label: string; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="justify-start rounded-full border-2" onClick={onClick}>
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

function CreateFolderModal({ folders, clients, currentFolderId, isSaving, onClose, onCreate }: { folders: DocumentFolder[]; clients: ClientOption[]; currentFolderId: string | null; isSaving: boolean; onClose: () => void; onCreate: (payload: { name: string; parentId?: string | null; clientId?: string; description?: string; type?: string }) => Promise<void> }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    void onCreate({
      name: String(formData.get("name") ?? ""),
      parentId: String(formData.get("parentId") ?? "") || null,
      clientId: String(formData.get("clientId") ?? "") || undefined,
      description: String(formData.get("description") ?? "") || undefined,
      type: String(formData.get("type") ?? "") || undefined,
    })
  }

  return (
    <Modal title="Nouveau dossier" subtitle="Créez un dossier principal ou un sous-dossier dans l’espace actuel." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <Input name="name" required placeholder="Nom du dossier" className="h-12 rounded-2xl border-2" />
        <SelectLabel label="Emplacement" name="parentId" defaultValue={currentFolderId ?? ""} options={[{ value: "", label: "Racine" }, ...folders.map((folder) => ({ value: folder.id, label: folder.path ?? folder.name }))]} />
        <SelectLabel label="Client lié" name="clientId" options={[{ value: "", label: "Aucun client" }, ...clients.map((client) => ({ value: client.id, label: clientName(client) }))]} />
        <SelectLabel label="Type de dossier" name="type" defaultValue="CLIENT_SECTION" options={folderTypeOptions} />
        <textarea name="description" rows={3} placeholder="Description ou règle de classement du dossier" className="rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
        <ModalActions isSaving={isSaving} saveLabel="Créer" onClose={onClose} />
      </form>
    </Modal>
  )
}

function UploadModal({ folders, clients, currentFolderId, isSaving, onClose, onUpload }: { folders: DocumentFolder[]; clients: ClientOption[]; currentFolderId: string | null; isSaving: boolean; onClose: () => void; onUpload: (payload: FormData) => Promise<void> }) {
  const [files, setFiles] = useState<FileList | null>(null)
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [folderId, setFolderId] = useState(() => {
    const currentFolder = folders.find((folder) => folder.id === currentFolderId)
    return currentFolder?.clientId === clients[0]?.id ? currentFolderId ?? "" : ""
  })
  const clientFolders = useMemo(() => sortedClientFolders(folders, clientId), [folders, clientId])
  const rootFolder = clientRootFolder(clientFolders)

  function changeClient(nextClientId: string) {
    const currentFolder = folders.find((folder) => folder.id === currentFolderId)
    setClientId(nextClientId)
    setFolderId(currentFolder?.clientId === nextClientId ? currentFolderId ?? "" : "")
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!files?.length || !clientId) return
    Array.from(files).forEach((file) => {
      const payload = new FormData(event.currentTarget)
      payload.set("file", file)
      payload.set("name", file.name)
      payload.set("client_id", clientId)
      payload.set("clientId", clientId)
      if (folderId) {
        payload.set("folder_id", folderId)
        payload.set("folderId", folderId)
      } else {
        payload.delete("folder_id")
        payload.delete("folderId")
      }
      void onUpload(payload)
    })
  }

  return (
    <Modal title="Importer des documents" subtitle="Choisissez le client. Sans sous-dossier précis, FinAdvisor classe automatiquement dans le dossier principal du client." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <SelectLabel label="Client" name="client_id" value={clientId} onChange={changeClient} options={clients.map((client) => ({ value: client.id, label: clientName(client) }))} />
        <SelectLabel
          label="Dossier destination"
          name="folder_id"
          value={folderId}
          onChange={setFolderId}
          options={[
            { value: "", label: rootFolder ? "Automatique - dossier client principal" : "Automatique - créer le dossier client" },
            ...clientFolders.map((folder) => ({ value: folder.id, label: clientFolderLabel(folder, rootFolder) })),
          ]}
        />
        <p className="-mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">
          La liste est limitée au client sélectionné. Vous n’avez pas à chercher parmi tous les dossiers des autres clients.
        </p>
        <SelectLabel label="Catégorie" name="document_category" defaultValue="OTHER" options={categoryOptions.map(([value, label]) => ({ value, label }))} />
        <label className="grid cursor-pointer gap-3 rounded-[1.5rem] border-2 border-dashed border-emerald-200 bg-emerald-50 p-7 text-center text-sm font-black text-emerald-800">
          <Upload className="mx-auto size-9" />
          <span>{files?.length ? `${files.length} fichier(s) sélectionné(s)` : "Glisser-déposer ou sélectionner des fichiers"}</span>
          <input type="file" multiple required className="sr-only" onChange={(event) => setFiles(event.target.files)} />
        </label>
        <ModalActions isSaving={isSaving} saveLabel="Importer" onClose={onClose} />
      </form>
    </Modal>
  )
}

function SelectLabel({ label, name, options, defaultValue, value, onChange }: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-slate-700">
      {label}
      <select name={name} defaultValue={defaultValue} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="h-12 rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-bold">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-500 hover:bg-slate-200">Fermer</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ isSaving, saveLabel, onClose }: { isSaving: boolean; saveLabel: string; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" className="rounded-full border-2" onClick={onClose}>Annuler</Button>
      <Button type="submit" disabled={isSaving} className="rounded-full bg-emerald-500 px-6 font-black text-white shadow-[0_7px_0_#059669] hover:bg-emerald-600">{isSaving ? "En cours..." : saveLabel}</Button>
    </div>
  )
}
