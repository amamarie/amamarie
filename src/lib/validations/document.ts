import { z } from "zod"

const optionalString = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().optional())
const optionalDate = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.date().optional())
const optionalBoolean = z.preprocess((value) => (value === "true" ? true : value === "false" ? false : value), z.boolean().optional())

export const documentTypeSchema = z.enum([
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "VOID_CHEQUE",
  "KYC_FORM",
  "RISK_PROFILE",
  "CONSENT_FORM",
  "POLICY_DOCUMENT",
  "PROPOSAL",
  "ILLUSTRATION",
  "INVESTMENT_STATEMENT",
  "INSURANCE_STATEMENT",
  "BENEFICIARY_FORM",
  "SIGNATURE_PAGE",
  "TAX_DOCUMENT",
  "CLIENT_NOTE",
  "OTHER",
])

export const documentStatusSchema = z.enum(["REQUIRED", "REQUESTED", "RECEIVED", "VALIDATED", "REJECTED", "EXPIRED", "WAIVED", "ARCHIVED"])
export const documentVisibilitySchema = z.enum(["INTERNAL", "TEAM", "CLIENT_VISIBLE", "COMPLIANCE_ONLY"])
export const documentLinkEntityTypeSchema = z.enum([
  "CLIENT",
  "LEAD",
  "HOUSEHOLD",
  "BUSINESS",
  "KYC_PROFILE",
  "KYC_VERSION",
  "INSURANCE_ANALYSIS",
  "RECOMMENDATION",
  "OPPORTUNITY",
  "FINANCIAL_PRODUCT",
  "TASK",
  "CONSENT",
  "AUDIT",
  "OTHER",
])
export const documentLinkRelationshipTypeSchema = z.enum([
  "PROOF",
  "SOURCE",
  "DELIVERED_TO_CLIENT",
  "SIGNED_PROOF",
  "ANNEX",
  "SUPPORTING_DOCUMENT",
  "REPLACES",
  "EXTRACTED_FROM",
  "USED_FOR_RECOMMENDATION",
  "OTHER",
])

const documentBaseSchema = z.object({
  clientId: optionalString,
  leadId: optionalString,
  productId: optionalString,
  taskId: optionalString,
  kycProfileId: optionalString,
  folderId: optionalString,
  type: documentTypeSchema.default("OTHER"),
  status: documentStatusSchema.default("REQUIRED"),
  visibility: documentVisibilitySchema.default("TEAM"),
  name: z.string().trim().min(1, "Le nom du document est requis.").max(200),
  description: optionalString,
  fileName: optionalString,
  originalFileName: optionalString,
  fileUrl: optionalString,
  mimeType: optionalString,
  fileSize: z.coerce.number().int().positive().optional(),
  isRequired: optionalBoolean.default(false),
  requiredBy: optionalDate,
  requestedAt: optionalDate,
  receivedAt: optionalDate,
  validatedAt: optionalDate,
  rejectedAt: optionalDate,
  expiresAt: optionalDate,
  rejectedReason: optionalString,
  waiverReason: optionalString,
  notes: optionalString,
})

export const createDocumentSchema = documentBaseSchema.superRefine((data, ctx) => {
  if (!data.clientId && !data.leadId && !data.productId && !data.taskId && !data.kycProfileId) {
    ctx.addIssue({ code: "custom", path: ["clientId"], message: "Liez le document à un client, prospect, produit, profil client ou tâche." })
  }
  if (data.status === "REJECTED" && !data.rejectedReason) {
    ctx.addIssue({ code: "custom", path: ["rejectedReason"], message: "La raison de rejet est requise." })
  }
  if (data.status === "WAIVED" && !data.waiverReason) {
    ctx.addIssue({ code: "custom", path: ["waiverReason"], message: "La justification d’exemption est requise." })
  }
})

export const updateDocumentSchema = documentBaseSchema.partial()

export const updateDocumentStatusSchema = z.object({
  status: documentStatusSchema,
  notes: optionalString,
  expiresAt: optionalDate,
})

export const rejectDocumentSchema = z.object({
  rejectedReason: z.string().trim().min(2, "La raison de rejet est requise."),
  notes: optionalString,
})

export const waiveDocumentSchema = z.object({
  waiverReason: z.string().trim().min(2, "La justification d’exemption est requise."),
  notes: optionalString,
})

export const documentQuerySchema = z.object({
  search: optionalString,
  clientId: optionalString,
  leadId: optionalString,
  productId: optionalString,
  taskId: optionalString,
  kycProfileId: optionalString,
  folderId: optionalString,
  type: documentTypeSchema.optional(),
  status: documentStatusSchema.optional(),
  visibility: documentVisibilitySchema.optional(),
  isRequired: optionalBoolean,
  expiresSoon: optionalBoolean,
  expired: optionalBoolean,
  dateFrom: optionalDate,
  dateTo: optionalDate,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

export const createDocumentFolderSchema = z.object({
  name: z.string().trim().min(1, "Le nom du dossier est requis.").max(120),
  parentId: optionalString,
  clientId: optionalString,
  leadId: optionalString,
  description: optionalString,
  type: optionalString,
})

export const updateDocumentFolderSchema = createDocumentFolderSchema.partial().extend({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
})

export const documentFolderQuerySchema = z.object({
  parentId: optionalString,
  clientId: optionalString,
  leadId: optionalString,
  search: optionalString,
  includeArchived: optionalBoolean.default(false),
})

export const moveDocumentSchema = z.object({
  folderId: optionalString,
})

export const moveDocumentFolderSchema = z.object({
  parentId: optionalString,
})

export const linkDocumentSchema = z.object({
  linkedEntityType: documentLinkEntityTypeSchema,
  linkedEntityId: z.string().trim().min(1, "L’objet lié est requis."),
  relationshipType: documentLinkRelationshipTypeSchema.default("SUPPORTING_DOCUMENT"),
  label: optionalString,
  sourceFieldKey: optionalString,
  proofStatus: optionalString,
  metadata: z.record(z.string(), z.unknown()).optional(),
  lockDocument: optionalBoolean.default(false),
})

export const lockDocumentSchema = z.object({
  reason: optionalString,
})

export const shareDocumentSchema = z.object({
  recipientType: z.enum(["CLIENT", "CONJOINT", "ASSUREUR", "MGA", "COMPTABLE", "CONFORMITE", "AUTRE"]).default("CLIENT"),
  recipientName: z.string().trim().min(2, "Le nom du destinataire est requis.").max(160),
  recipientEmail: z.string().trim().email("Adresse courriel invalide.").optional(),
  deliveryMethod: z.enum(["PORTAIL", "COURRIEL_SECURISÉ", "LIEN_TEMPORAIRE", "INTERNE"]).default("PORTAIL"),
  purpose: z.string().trim().min(5, "La finalité du partage est requise.").max(500),
  expiresAt: optionalDate,
  allowDownload: optionalBoolean.default(false),
  consentId: optionalString,
  outsideQuebec: optionalBoolean.default(false),
  piaId: optionalString,
  contractReference: optionalString,
})

export const retentionReviewDocumentSchema = z.object({
  retentionReviewAt: optionalDate,
  policy: z.string().trim().min(2, "La politique de conservation est requise.").max(160).default("Politique cabinet"),
  action: z.enum(["REVIEW", "ARCHIVE", "DESTROY_REVIEW", "ANONYMIZE_REVIEW"]).default("REVIEW"),
  reason: z.string().trim().min(5, "La raison de conservation est requise.").max(800),
})

const requestDocumentItemSchema = z.object({
  documentId: optionalString,
  type: documentTypeSchema.default("OTHER"),
  name: z.string().trim().min(2, "Le nom du document est requis.").max(200),
  description: optionalString,
})

const requestMessageFieldsSchema = z.object({
  channel: z.enum(["SMS", "EMAIL", "AUTO"]).default("AUTO"),
  message: z.string().trim().min(10, "Le message doit contenir au moins 10 caractères.").max(1500).optional(),
  dueDate: optionalDate,
})

function validateAdministrativeMessage(data: { message?: string }, ctx: z.RefinementCtx) {
  const forbidden = [
    /rendement garanti/i,
    /vous devez acheter/i,
    /je recommande le produit/i,
    /couverture de\s+\d/i,
    /montant de couverture/i,
    /investir dans/i,
  ]
  if (data.message && forbidden.some((pattern) => pattern.test(data.message ?? ""))) {
    ctx.addIssue({ code: "custom", path: ["message"], message: "Le message doit rester administratif et ne pas contenir de conseil financier." })
  }
}

export const requestClientDocumentSchema = requestDocumentItemSchema.merge(requestMessageFieldsSchema).superRefine((data, ctx) => {
  validateAdministrativeMessage(data, ctx)
})

export const requestClientDocumentsSchema = requestMessageFieldsSchema.extend({
  documents: z.array(requestDocumentItemSchema).min(1, "Sélectionnez au moins un document à demander.").max(20, "Limite de 20 documents par demande."),
}).superRefine((data, ctx) => {
  validateAdministrativeMessage(data, ctx)
})
