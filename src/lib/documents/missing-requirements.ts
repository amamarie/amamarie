import type { DocumentStatus, DocumentType, FinancialProductCategory, FinancialProductStatus } from "@prisma/client"

import { documentTypeLabels } from "@/lib/documents/labels"
import { prisma } from "@/lib/prisma"

type RequirementContextType = "CLIENT" | "PRODUCT" | "ANALYSIS" | "RECOMMENDATION"
type RequirementSeverity = "INFO" | "WARNING" | "CRITICAL"

type DocumentLike = {
  id: string
  type: DocumentType
  status: DocumentStatus
  name: string
  expiresAt: Date | null
  productId?: string | null
}

export type MissingDocumentRequirement = {
  id: string
  ruleKey: string
  clientId: string
  clientName: string
  contextType: RequirementContextType
  contextId: string
  contextLabel: string
  documentType: DocumentType
  documentName: string
  reason: string
  severity: RequirementSeverity
  suggestedAction: string
}

const usableStatuses: DocumentStatus[] = ["RECEIVED", "VALIDATED"]
const activeProductStatuses: FinancialProductStatus[] = ["ACTIVE", "PENDING", "UNDER_REVIEW"]
const reportRequiredRecommendationStatuses = [
  "ADVISOR_APPROVED",
  "COMPLIANCE_APPROVED",
  "PRESENTED_TO_CLIENT",
  "CLIENT_ACCEPTED",
  "SIGNED",
  "USED_FOR_PROPOSAL",
  "LOCKED",
]
const reportRequiredAnalysisStatuses = ["RECOMMENDATION_PREPARED", "COMPLETED", "DELIVERED", "USED_FOR_SUBMISSION"]

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function hasUsableDocument(documents: DocumentLike[], type: DocumentType, tokens: string[] = []) {
  return documents.some((document) => {
    if (document.type !== type || !usableStatuses.includes(document.status)) return false
    if (tokens.length === 0) return true
    const name = normalize(document.name)
    return tokens.some((token) => name.includes(normalize(token)))
  })
}

function productLabel(product: { company: string | null; productName: string | null; policyNumber: string | null; contractNumber: string | null; type: string }) {
  return [product.company, product.productName, product.policyNumber ?? product.contractNumber, product.type].filter(Boolean).join(" - ")
}

function requirementId(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":")
}

function addRequirement(target: MissingDocumentRequirement[], requirement: MissingDocumentRequirement) {
  if (target.some((item) => item.id === requirement.id)) return
  target.push(requirement)
}

export async function getMissingDocumentRequirements({
  organizationId,
  clientId,
  limit = 150,
}: {
  organizationId: string
  clientId?: string | null
  limit?: number
}) {
  const now = new Date()
  const clients = await prisma.client.findMany({
    where: {
      organizationId,
      ...(clientId ? { id: clientId } : {}),
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      identityVerified: true,
      kycCompleted: true,
      liabilities: true,
      documents: {
        where: { deletedAt: null, status: { not: "ARCHIVED" } },
        select: { id: true, type: true, status: true, name: true, expiresAt: true, productId: true },
      },
      products: {
        where: { status: { in: activeProductStatuses } },
        select: {
          id: true,
          category: true,
          type: true,
          status: true,
          company: true,
          productName: true,
          policyNumber: true,
          contractNumber: true,
          documentStatus: true,
          missingDocuments: true,
          documents: {
            where: { deletedAt: null, status: { not: "ARCHIVED" } },
            select: { id: true, type: true, status: true, name: true, expiresAt: true, productId: true },
          },
        },
      },
      insuranceNeedsAnalyses: {
        select: { id: true, analysisType: true, status: true, objective: true, reportDocumentId: true },
      },
      productRecommendations: {
        select: {
          id: true,
          title: true,
          status: true,
          reportDocumentId: true,
          documents: { select: { documentId: true, deliveredToClient: true, documentType: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })

  const requirements: MissingDocumentRequirement[] = []

  for (const client of clients) {
    const name = clientName(client)
    const documents = client.documents

    for (const document of documents) {
      if (!["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"].includes(document.status)) continue
      addRequirement(requirements, {
        id: requirementId(["document", document.id]),
        ruleKey: `existing_document_${document.status.toLowerCase()}`,
        clientId: client.id,
        clientName: name,
        contextType: "CLIENT",
        contextId: client.id,
        contextLabel: "Dossier client",
        documentType: document.type,
        documentName: document.name || documentTypeLabels[document.type] || "Document requis",
        reason: document.status === "EXPIRED" ? "Document expiré à renouveler." : document.status === "REJECTED" ? "Document rejeté ou illisible à remplacer." : "Document demandé, mais pas encore reçu et validé.",
        severity: document.status === "EXPIRED" || document.status === "REJECTED" ? "CRITICAL" : "WARNING",
        suggestedAction: "Créer une tâche de suivi documentaire.",
      })
    }

    const governmentId = documents.find((document) => document.type === "GOVERNMENT_ID" && usableStatuses.includes(document.status))
    if (!client.identityVerified && !governmentId) {
      addRequirement(requirements, {
        id: requirementId(["client", client.id, "government_id"]),
        ruleKey: "identity_not_verified_missing_government_id",
        clientId: client.id,
        clientName: name,
        contextType: "CLIENT",
        contextId: client.id,
        contextLabel: "Identité client",
        documentType: "GOVERNMENT_ID",
        documentName: "Pièce d’identité valide",
        reason: "L’identité n’est pas vérifiée et aucune pièce d’identité validée n’est liée au dossier.",
        severity: "CRITICAL",
        suggestedAction: "Demander une pièce d’identité au client.",
      })
    }
    if (governmentId?.expiresAt && governmentId.expiresAt <= now) {
      addRequirement(requirements, {
        id: requirementId(["client", client.id, "government_id_expired", governmentId.id]),
        ruleKey: "government_id_expired",
        clientId: client.id,
        clientName: name,
        contextType: "CLIENT",
        contextId: client.id,
        contextLabel: "Identité client",
        documentType: "GOVERNMENT_ID",
        documentName: "Pièce d’identité renouvelée",
        reason: "La pièce d’identité au dossier est expirée.",
        severity: "CRITICAL",
        suggestedAction: "Demander une nouvelle pièce d’identité.",
      })
    }

    if (!client.kycCompleted && !hasUsableDocument(documents, "KYC_FORM")) {
      addRequirement(requirements, {
        id: requirementId(["client", client.id, "kyc_form"]),
        ruleKey: "kyc_not_completed_missing_form",
        clientId: client.id,
        clientName: name,
        contextType: "CLIENT",
        contextId: client.id,
        contextLabel: "Profil client",
        documentType: "KYC_FORM",
        documentName: "Questionnaire profil client confirmé",
        reason: "Le profil client n’est pas complété et aucun questionnaire validé n’est lié au dossier.",
        severity: "WARNING",
        suggestedAction: "Faire compléter ou confirmer le profil client.",
      })
    }

    if ((client.liabilities ?? 0) >= 100000 && !hasUsableDocument(documents, "OTHER", ["hypothe", "mortgage"]) && !hasUsableDocument(documents, "PROOF_OF_ADDRESS", ["hypothe", "mortgage"])) {
      addRequirement(requirements, {
        id: requirementId(["client", client.id, "mortgage_statement"]),
        ruleKey: "large_liabilities_missing_mortgage_statement",
        clientId: client.id,
        clientName: name,
        contextType: "CLIENT",
        contextId: client.id,
        contextLabel: "Dette / hypothèque",
        documentType: "OTHER",
        documentName: "Relevé hypothécaire ou dette importante",
        reason: "Le dossier indique des dettes importantes, mais aucun relevé hypothécaire ou document de dette validé n’est lié.",
        severity: "WARNING",
        suggestedAction: "Demander un relevé hypothécaire ou une preuve de dette.",
      })
    }

    for (const product of client.products) {
      const productDocuments = [...documents.filter((document) => document.productId === product.id), ...product.documents]
      const productName = productLabel(product)
      const productNeedsDocument = ["MISSING", "REQUIRED", "PENDING"].includes(product.documentStatus ?? "") || Boolean(product.missingDocuments?.trim())
      const hasPolicyDocument = hasUsableDocument(productDocuments, "POLICY_DOCUMENT") || hasUsableDocument(productDocuments, "INSURANCE_STATEMENT")
      const hasInvestmentStatement = hasUsableDocument(productDocuments, "INVESTMENT_STATEMENT")

      if ((product.category as FinancialProductCategory) === "INSURANCE" && (productNeedsDocument || !hasPolicyDocument)) {
        addRequirement(requirements, {
          id: requirementId(["product", product.id, "policy_document"]),
          ruleKey: "insurance_policy_missing_document",
          clientId: client.id,
          clientName: name,
          contextType: "PRODUCT",
          contextId: product.id,
          contextLabel: productName || "Produit d’assurance",
          documentType: "POLICY_DOCUMENT",
          documentName: product.missingDocuments?.trim() || "Police ou contrat d’assurance",
          reason: "Une police d’assurance est active ou déclarée, mais aucun document de police validé n’est lié au produit.",
          severity: "CRITICAL",
          suggestedAction: "Demander ou classer la police existante.",
        })
      }

      if ((product.category as FinancialProductCategory) === "INVESTMENT" && (productNeedsDocument || !hasInvestmentStatement)) {
        addRequirement(requirements, {
          id: requirementId(["product", product.id, "investment_statement"]),
          ruleKey: "investment_statement_missing_document",
          clientId: client.id,
          clientName: name,
          contextType: "PRODUCT",
          contextId: product.id,
          contextLabel: productName || "Produit de placement",
          documentType: "INVESTMENT_STATEMENT",
          documentName: product.missingDocuments?.trim() || "Relevé de placement récent",
          reason: "Un compte ou produit de placement est actif, mais aucun relevé de placement validé n’est lié.",
          severity: "WARNING",
          suggestedAction: "Demander le relevé de placement le plus récent.",
        })
      }
    }

    for (const analysis of client.insuranceNeedsAnalyses) {
      if (!reportRequiredAnalysisStatuses.includes(analysis.status) || analysis.reportDocumentId) continue
      addRequirement(requirements, {
        id: requirementId(["analysis", analysis.id, "report"]),
        ruleKey: "insurance_analysis_report_missing",
        clientId: client.id,
        clientName: name,
        contextType: "ANALYSIS",
        contextId: analysis.id,
        contextLabel: `${analysis.analysisType}${analysis.objective ? ` - ${analysis.objective}` : ""}`,
        documentType: "CLIENT_NOTE",
        documentName: "Rapport d’analyse des besoins",
        reason: "L’analyse est assez avancée pour exiger un rapport, mais aucun PDF n’est lié.",
        severity: "CRITICAL",
        suggestedAction: "Générer et archiver le rapport d’analyse.",
      })
    }

    for (const recommendation of client.productRecommendations) {
      const deliveredReport = recommendation.documents.some((document) => document.deliveredToClient && ["RECOMMENDATION_REPORT", "SUITABILITY_REPORT"].includes(document.documentType))
      if (!reportRequiredRecommendationStatuses.includes(recommendation.status) || recommendation.reportDocumentId || deliveredReport) continue
      addRequirement(requirements, {
        id: requirementId(["recommendation", recommendation.id, "report"]),
        ruleKey: "recommendation_report_missing",
        clientId: client.id,
        clientName: name,
        contextType: "RECOMMENDATION",
        contextId: recommendation.id,
        contextLabel: recommendation.title,
        documentType: "CLIENT_NOTE",
        documentName: "Rapport de recommandation documentée",
        reason: "La recommandation est approuvée, présentée ou verrouillée, mais aucun rapport remis au client n’est lié.",
        severity: "CRITICAL",
        suggestedAction: "Générer le rapport de recommandation et le lier au dossier.",
      })
    }
  }

  return requirements.sort((first, second) => {
    const severityOrder: Record<RequirementSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 }
    return severityOrder[first.severity] - severityOrder[second.severity] || first.clientName.localeCompare(second.clientName, "fr")
  })
}
