import { z } from "zod"
import { Prisma, type PaymentFrequency, type UserRole } from "@prisma/client"

import { runAI } from "@/lib/ai/core/run-ai"
import { createCrmActivity } from "@/lib/crm-events"
import { linkDocumentToEntity } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { assertActiveAiConsent } from "@/lib/privacy/service"

type CurrentUser = { id: string; organizationId: string; role: UserRole }

const policyExtractionSchema = z.object({
  insurer: z.string().nullable().default(null),
  productName: z.string().nullable().default(null),
  policyNumber: z.string().nullable().default(null),
  productType: z.enum([
    "LIFE_INSURANCE",
    "DISABILITY_INSURANCE",
    "CRITICAL_ILLNESS",
    "HEALTH_INSURANCE",
    "GROUP_INSURANCE",
    "LONG_TERM_CARE",
    "TRAVEL_INSURANCE",
    "OTHER_INSURANCE",
  ]).default("OTHER_INSURANCE"),
  coverageAmount: z.number().nullable().default(null),
  premium: z.number().nullable().default(null),
  premiumFrequency: z.enum(["MONTHLY", "ANNUAL", "UNKNOWN"]).default("UNKNOWN"),
  effectiveDate: z.string().nullable().default(null),
  renewalDate: z.string().nullable().default(null),
  primaryBeneficiary: z.string().nullable().default(null),
  exclusions: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  humanReviewNote: z.string().default("Validation humaine requise avant utilisation dans une recommandation."),
})

type PolicyExtraction = z.infer<typeof policyExtractionSchema>

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

type InsuranceProductType = z.infer<typeof policyExtractionSchema>["productType"]

function productTypeFromDocument(documentName: string): InsuranceProductType {
  const text = documentName.toLowerCase()
  if (text.includes("invalid")) return "DISABILITY_INSURANCE"
  if (text.includes("maladie") || text.includes("grave")) return "CRITICAL_ILLNESS"
  if (text.includes("collect")) return "GROUP_INSURANCE"
  if (text.includes("vie") || text.includes("life")) return "LIFE_INSURANCE"
  return "OTHER_INSURANCE"
}

function paymentFrequency(value: PolicyExtraction["premiumFrequency"]): PaymentFrequency {
  if (value === "MONTHLY") return "MONTHLY"
  if (value === "ANNUAL") return "ANNUAL"
  return "UNKNOWN"
}

function extractionContext(document: {
  name: string
  description: string | null
  notes: string | null
  originalFileName: string | null
  type: string
  client?: { firstName: string; lastName: string } | null
}) {
  return {
    documentName: document.name,
    originalFileName: document.originalFileName,
    description: document.description,
    notes: document.notes,
    type: document.type,
    clientName: document.client ? `${document.client.firstName} ${document.client.lastName}`.trim() : null,
  }
}

function confidenceScore(confidence: PolicyExtraction["confidence"]) {
  if (confidence === "HIGH") return 90
  if (confidence === "MEDIUM") return 70
  return 40
}

function extractedFields(extraction: PolicyExtraction) {
  return [
    { fieldKey: "insurer", fieldLabel: "Assureur", extractedValue: extraction.insurer },
    { fieldKey: "productName", fieldLabel: "Produit", extractedValue: extraction.productName },
    { fieldKey: "policyNumber", fieldLabel: "Numéro de police", extractedValue: extraction.policyNumber },
    { fieldKey: "productType", fieldLabel: "Type de produit", extractedValue: extraction.productType },
    { fieldKey: "coverageAmount", fieldLabel: "Montant assuré", extractedValue: extraction.coverageAmount },
    { fieldKey: "premium", fieldLabel: "Prime", extractedValue: extraction.premium },
    { fieldKey: "premiumFrequency", fieldLabel: "Fréquence de prime", extractedValue: extraction.premiumFrequency },
    { fieldKey: "effectiveDate", fieldLabel: "Date d’émission / effet", extractedValue: extraction.effectiveDate },
    { fieldKey: "renewalDate", fieldLabel: "Échéance / renouvellement", extractedValue: extraction.renewalDate },
    { fieldKey: "primaryBeneficiary", fieldLabel: "Bénéficiaire principal", extractedValue: extraction.primaryBeneficiary },
    { fieldKey: "exclusions", fieldLabel: "Exclusions", extractedValue: extraction.exclusions },
  ]
}

export async function extractPolicyFromDocument({ user, documentId }: { user: CurrentUser; documentId: string }) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId },
    include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } },
  })
  if (!document) throw new Error("DOCUMENT_NOT_FOUND")
  if (!document.clientId || !document.client) throw new Error("CLIENT_REQUIRED")
  await assertActiveAiConsent({ organizationId: user.organizationId, clientId: document.clientId })
  if (document.type !== "POLICY_DOCUMENT" && !document.name.toLowerCase().includes("police") && !document.name.toLowerCase().includes("contrat")) {
    throw new Error("POLICY_DOCUMENT_REQUIRED")
  }

  const context = extractionContext(document)
  const extraction = await runAI({
    organizationId: user.organizationId,
    userId: user.id,
    feature: "policy-document-extraction",
    prompt: [
      "Extrais les informations d'une police ou d'un contrat d'assurance.",
      "Retourne seulement du JSON valide.",
      "Si une information n'est pas visible dans le contexte, mets null et ajoute-la dans missingFields.",
      "Ne devine pas les montants. Validation humaine obligatoire.",
    ].join("\n"),
    schema: policyExtractionSchema,
    context,
    fallback: () => ({
      insurer: null,
      productName: document.name,
      policyNumber: null,
      productType: productTypeFromDocument(document.name),
      coverageAmount: null,
      premium: null,
      premiumFrequency: "UNKNOWN" as const,
      effectiveDate: null,
      renewalDate: null,
      primaryBeneficiary: null,
      exclusions: [],
      missingFields: ["Montant assuré", "Prime", "Numéro de police", "Bénéficiaire"],
      confidence: "LOW" as const,
      humanReviewNote: "Extraction locale basée sur le nom du document seulement. Validation humaine requise.",
    }),
  })

  const product = await prisma.financialProduct.create({
    data: {
      organizationId: user.organizationId,
      clientId: document.clientId,
      advisorId: document.client.advisorId,
      category: "INSURANCE",
      type: extraction.productType,
      status: "UNDER_REVIEW",
      company: extraction.insurer,
      productName: extraction.productName ?? document.name,
      policyNumber: extraction.policyNumber,
      premium: extraction.premium,
      premiumFrequency: paymentFrequency(extraction.premiumFrequency),
      coverageAmount: extraction.coverageAmount,
      primaryBeneficiary: extraction.primaryBeneficiary,
      effectiveDate: parseDate(extraction.effectiveDate),
      renewalAt: parseDate(extraction.renewalDate),
      documentStatus: "AI_EXTRACTED_REVIEW_REQUIRED",
      complianceNotes: extraction.humanReviewNote,
      notes: JSON.stringify({
        source: "AI_POLICY_EXTRACTION",
        documentId: document.id,
        confidence: extraction.confidence,
        missingFields: extraction.missingFields,
        exclusions: extraction.exclusions,
      } satisfies Prisma.InputJsonObject),
    },
  })
  const documentExtraction = await prisma.documentExtraction.create({
    data: {
      organizationId: user.organizationId,
      documentId: document.id,
      clientId: document.clientId,
      extractionType: "POLICY",
      status: "TO_VALIDATE",
      extractedData: extraction as Prisma.InputJsonObject,
      confidenceScore: confidenceScore(extraction.confidence),
      modelVersion: "policy-document-extraction-v1",
      method: "AI_ASSISTED",
      humanReviewNote: extraction.humanReviewNote,
      fields: {
        create: extractedFields(extraction).map((field) => ({
          organizationId: user.organizationId,
          documentId: document.id,
          clientId: document.clientId,
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          extractedValue: field.extractedValue === undefined ? Prisma.JsonNull : field.extractedValue as Prisma.InputJsonValue,
          confidenceScore: field.extractedValue === null || field.extractedValue === undefined ? 25 : confidenceScore(extraction.confidence),
          status: field.extractedValue === null || field.extractedValue === undefined ? "TO_VALIDATE" : "PROPOSED",
        })),
      },
    },
  })

  const updatedDocument = await prisma.document.update({
    where: { id: document.id },
    data: {
      productId: product.id,
      status: "RECEIVED",
      extractionSummary: {
        extractionId: documentExtraction.id,
        extractionType: "POLICY",
        status: "TO_VALIDATE",
        confidence: extraction.confidence,
        confidenceScore: confidenceScore(extraction.confidence),
        missingFields: extraction.missingFields,
        productId: product.id,
      },
      notes: [
        document.notes,
        `Extraction IA police: fiche produit ${product.id} créée avec confiance ${extraction.confidence}. Validation humaine requise.`,
      ].filter(Boolean).join("\n\n"),
    },
  })
  await linkDocumentToEntity({
    user,
    document: updatedDocument,
    linkedEntityType: "FINANCIAL_PRODUCT",
    linkedEntityId: product.id,
    relationshipType: "EXTRACTED_FROM",
    label: "Produit créé depuis extraction documentaire",
    proofStatus: "EXTRACTION_TO_VALIDATE",
    metadata: { extractionId: documentExtraction.id, confidence: extraction.confidence },
  })

  await createCrmActivity({
    organizationId: user.organizationId,
    userId: user.id,
    clientId: document.clientId,
    documentId: document.id,
    type: "DOCUMENT_UPDATED",
    title: "Police extraite par IA",
    description: `${product.productName ?? "Produit d’assurance"} créé en revue humaine.`,
    entityType: "FinancialProduct",
    entityId: product.id,
    metadata: { extraction, extractionId: documentExtraction.id, productId: product.id, documentId: document.id },
  })

  await prisma.task.create({
    data: {
      organizationId: user.organizationId,
      assignedToId: document.client.advisorId ?? user.id,
      createdById: user.id,
      clientId: document.clientId,
      productId: product.id,
      type: "DOCUMENT",
      priority: extraction.confidence === "LOW" ? "HIGH" : "NORMAL",
      status: "TODO",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      title: "Valider extraction de police d’assurance",
      description: `Document: ${document.name}\nConfiance: ${extraction.confidence}\nChamps manquants: ${extraction.missingFields.join(", ") || "Aucun déclaré"}`,
      isAutomated: true,
    },
  })

  return { extraction, extractionRecord: documentExtraction, product, document: updatedDocument }
}
