import { Prisma, type FinancialProductType, type InsuranceAnalysisStatus, type InsuranceAnalysisType } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { assertActiveAiConsent, assertActivePurposeConsent } from "@/lib/privacy/service"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { requestClientDocuments } from "@/lib/services/document-requests"
import { sanitizeFileName } from "@/lib/documents/file-validation"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"
import { createPandaDocDocumentFromPdf, sendPandaDocDocument, waitForPandaDocDraft } from "@/lib/pandadoc/client"

import { calculateInsuranceNeeds, type AnalysisAssumptionMap, type AnalysisInputMap, type InsuranceCalculation } from "./calculations"
import { summarizeInsuranceNeedsWithAI } from "./ai"
import { findPotentialReplacementPolicy, syncOpportunityFromAnalysis } from "./opportunity-sync"
import { getOrganizationInsuranceNeedsSettings } from "./settings"

export const analysisTypeLabels: Record<InsuranceAnalysisType, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Assurance entreprise",
  REPLACEMENT: "Remplacement de contrat",
}

const analysisInclude = {
  advisor: { select: { id: true, name: true, email: true, title: true } },
  reportDocument: true,
  signatureDocument: true,
  opportunity: { select: { id: true, type: true, status: true, company: true, productName: true, policyNumber: true, contractNumber: true } },
  inputs: { orderBy: { inputKey: "asc" as const } },
  assumptions: { orderBy: { assumptionType: "asc" as const } },
  results: { orderBy: { needCategory: "asc" as const } },
  recommendations: { orderBy: { createdAt: "desc" as const } },
  replacementComparisons: true,
}

function valueFromJson(value: unknown) {
  if (value && typeof value === "object" && "value" in value) return (value as { value: unknown }).value
  return value
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function toInputMap(inputs: Array<{ inputKey: string; inputValue: Prisma.JsonValue }>): AnalysisInputMap {
  return Object.fromEntries(inputs.map((input) => [input.inputKey, valueFromJson(input.inputValue)]))
}

function toAssumptionMap(assumptions: Array<{ assumptionType: string; numericValue: number | null; value: string | null }>): AnalysisAssumptionMap {
  return Object.fromEntries(assumptions.map((assumption) => [assumption.assumptionType, assumption.numericValue ?? assumption.value]))
}

function input(inputKey: string, label: string, value: unknown, source: "CRM" | "KYC" | "ADVISOR" | "CLIENT" | "DOCUMENT" | "SYSTEM" = "CRM") {
  return {
    inputKey,
    label,
    source,
    inputValue: { value: toJsonValue(value) },
    isVerified: value !== null && value !== undefined && value !== "",
  }
}

function assumption(assumptionType: string, label: string, numericValue: number, unit: string, reason: string) {
  return { assumptionType, label, numericValue, value: String(numericValue), unit, reason, editableByAdvisor: true }
}

function money(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function textOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length ? text : null
}

function dateLabel(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getClientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function assertAnalysisEditable(analysis: { signedAt?: Date | null; clientConfirmedAt?: Date | null; reportDocument?: { status: string } | null }) {
  if (analysis.signedAt || analysis.reportDocument?.status === "VALIDATED") {
    throw new Error("ANALYSIS_SIGNED_LOCKED")
  }
}

async function assertInsuranceNeedsPurposeConsents({
  organizationId,
  clientId,
  includeAi = false,
  includeDocuments = false,
  includeDelivery = false,
}: {
  organizationId: string
  clientId: string
  includeAi?: boolean
  includeDocuments?: boolean
  includeDelivery?: boolean
}) {
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "insurance_needs_analysis",
    errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED",
  })
  if (includeAi) {
    await assertActiveAiConsent({ organizationId, clientId })
  }
  if (includeDocuments) {
    await assertActivePurposeConsent({
      organizationId,
      clientId,
      purposeCode: "document_vault",
      errorCode: "DOCUMENT_VAULT_CONSENT_REQUIRED",
    })
  }
  if (includeDelivery) {
    await assertActivePurposeConsent({
      organizationId,
      clientId,
      purposeCode: "insurer_disclosure",
      errorCode: "DISCLOSURE_CONSENT_REQUIRED",
    })
  }
}

function getExistingCoverage(products: Array<{ type: string; status: string; coverageAmount: number | null }>, types: string[]) {
  return products
    .filter((product) => product.status !== "ARCHIVED" && types.includes(product.type))
    .reduce((sum, product) => sum + money(product.coverageAmount), 0)
}

function getChildrenSummary(children: Prisma.JsonValue | null | undefined, fallbackDetails?: string | null) {
  const source = typeof children === "string" ? tryParseJson(children) : children
  const list = Array.isArray(source)
    ? source
    : source && typeof source === "object" && !Array.isArray(source) && Array.isArray((source as { children?: unknown }).children)
      ? (source as { children: unknown[] }).children
      : []
  const details = list
    .map((child, index) => {
      if (!child || typeof child !== "object" || Array.isArray(child)) return null
      const item = child as Record<string, unknown>
      const dateOfBirth = typeof item.dateOfBirth === "string" ? item.dateOfBirth : typeof item.birthDate === "string" ? item.birthDate : null
      const age = typeof item.age === "number"
        ? item.age
        : dateOfBirth
          ? calculateAge(dateOfBirth)
          : null
      const gender = typeof item.gender === "string" ? item.gender : null
      return [`Enfant ${index + 1}`, age !== null ? `${age} ans` : null, gender].filter(Boolean).join(" - ")
    })
    .filter(Boolean) as string[]

  return {
    countFromChildren: list.length,
    label: details.length ? details.join("; ") : fallbackDetails ?? null,
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Prisma.JsonValue
  } catch {
    return value
  }
}

function calculateAge(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) age -= 1
  return age >= 0 ? age : null
}

function hasPolicyDocument(documents: Array<{ type: string; name: string; fileName: string | null; status: string }>) {
  return documents.some((document) => {
    if (["REJECTED", "ARCHIVED"].includes(document.status)) return false
    if (["POLICY_DOCUMENT", "INSURANCE_STATEMENT", "BENEFICIARY_FORM"].includes(document.type)) return true
    const label = `${document.name} ${document.fileName ?? ""}`.toLowerCase()
    return label.includes("police") || label.includes("policy") || label.includes("contrat") || label.includes("assurance vie")
  })
}

function getBeneficiaryDetails(products: Array<{ type: string; status: string; primaryBeneficiary: string | null; contingentBeneficiary: string | null; beneficiaryNotes: string | null }>) {
  const lifeProducts = products.filter((product) => product.status !== "ARCHIVED" && ["LIFE_INSURANCE", "GROUP_INSURANCE"].includes(product.type))
  const details = lifeProducts.flatMap((product) => [product.primaryBeneficiary, product.contingentBeneficiary, product.beneficiaryNotes]).filter(Boolean) as string[]
  return {
    confirmed: details.length > 0,
    notes: details.length ? details.join(" | ") : null,
  }
}

function productTypesForAnalysisType(type: InsuranceAnalysisType): FinancialProductType[] {
  if (type === "LIFE") return ["LIFE_INSURANCE", "GROUP_INSURANCE", "LONG_TERM_CARE", "TRAVEL_INSURANCE", "OTHER_INSURANCE"]
  if (type === "DISABILITY") return ["DISABILITY_INSURANCE"]
  if (type === "CRITICAL_ILLNESS") return ["CRITICAL_ILLNESS", "HEALTH_INSURANCE"]
  if (type === "BUSINESS") return ["LIFE_INSURANCE", "DISABILITY_INSURANCE", "CRITICAL_ILLNESS", "OTHER_INSURANCE"]
  return ["LIFE_INSURANCE", "DISABILITY_INSURANCE", "CRITICAL_ILLNESS", "OTHER_INSURANCE"]
}

async function resolveOpportunityId({
  organizationId,
  clientId,
  type,
  opportunityId,
}: {
  organizationId: string
  clientId: string
  type: InsuranceAnalysisType
  opportunityId?: string | null
}) {
  if (opportunityId) {
    const product = await prisma.financialProduct.findFirst({
      where: { id: opportunityId, organizationId, clientId, category: "INSURANCE", status: { not: "ARCHIVED" } },
      select: { id: true },
    })
    if (!product) throw new Error("OPPORTUNITY_NOT_FOUND")
    return product.id
  }

  const product = await prisma.financialProduct.findFirst({
    where: {
      organizationId,
      clientId,
      category: "INSURANCE",
      status: { in: ["PENDING", "UNDER_REVIEW"] },
      type: { in: productTypesForAnalysisType(type) },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  })
  return product?.id ?? null
}

function pdfEscape(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function createSimplePdf(lines: string[]) {
  const lineHeight = 13
  const linesPerPage = 54
  const chunks: string[][] = []
  for (let index = 0; index < lines.length; index += linesPerPage) {
    chunks.push(lines.slice(index, index + linesPerPage))
  }
  const pageCount = Math.max(1, chunks.length)
  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2)
  const contentObjectIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2)
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`,
  ]
  chunks.forEach((chunk, pageIndex) => {
    const pageId = pageObjectIds[pageIndex]
    const contentId = contentObjectIds[pageIndex]
    const body = chunk.map((line) => {
      const isSection = line === line.toUpperCase() && line.length > 0 && !line.includes("---")
      const font = isSection ? "/F2 11 Tf" : "/F1 9 Tf"
      return `${font}\n(${pdfEscape(line).slice(0, 118)}) Tj T*`
    }).join("\n")
    const stream = [
      "BT",
      "/F2 13 Tf",
      "50 805 Td",
      "15 TL",
      `(FINASSURO CRM - Rapport d'analyse des besoins) Tj T*`,
      "/F1 8 Tf",
      `(Page ${pageIndex + 1} / ${pageCount}) Tj T*`,
      "0 -14 Td",
      `${lineHeight} TL`,
      body,
      "ET",
    ].join("\n")
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${pageCount * 2 + 3} 0 R /F2 ${pageCount * 2 + 4} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)
    objects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`)
  })
  objects.push(`${pageCount * 2 + 3} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)
  objects.push(`${pageCount * 2 + 4} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += object
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, "utf8")
}

function section(title: string, lines: Array<string | null | undefined>) {
  return [
    "",
    "------------------------------------------------------------",
    title.toUpperCase(),
    "------------------------------------------------------------",
    ...lines.filter(Boolean).map((line) => String(line)),
  ]
}

function formatCurrency(value: number | null | undefined) {
  return `${Math.round(value ?? 0).toLocaleString("fr-CA")} $`
}

function statusLabelsForReport(status: InsuranceAnalysisStatus) {
  const labels: Record<InsuranceAnalysisStatus, string> = {
    NOT_STARTED: "Non commencee",
    DRAFT: "Brouillon",
    MISSING_DATA: "Donnees manquantes",
    IN_ANALYSIS: "En analyse",
    ADVISOR_REVIEW: "Revision conseiller",
    RECOMMENDATION_PREPARED: "Recommandation preparee",
    WAITING_CLIENT: "En attente client",
    COMPLETED: "Completee",
    DELIVERED: "Remise au client",
    USED_FOR_SUBMISSION: "Utilisee pour soumission",
    ARCHIVED: "Archivee",
    NEEDS_UPDATE: "A mettre a jour",
  }
  return labels[status] ?? status
}

function inputValue(inputs: Array<{ inputKey: string; inputValue: Prisma.JsonValue }>, key: string) {
  return valueFromJson(inputs.find((input) => input.inputKey === key)?.inputValue)
}

function formatInputLine(inputs: Array<{ inputKey: string; label: string | null; inputValue: Prisma.JsonValue; source: string; isVerified: boolean }>, key: string) {
  const input = inputs.find((item) => item.inputKey === key)
  if (!input) return null
  const value = valueFromJson(input.inputValue)
  return `${input.label ?? input.inputKey}: ${value === null || value === undefined || value === "" ? "Non documente" : String(value)} (${input.source}${input.isVerified ? ", verifie" : ", a confirmer"})`
}

async function buildPrefill({ organizationId, clientId, type }: { organizationId: string; clientId: string; type: InsuranceAnalysisType }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      advisor: true,
      products: true,
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      kycProfile: true,
      kybProfile: true,
      kycSnapshots: { orderBy: { version: "desc" }, take: 1 },
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const annualIncome = client.annualIncome ?? client.approximateIncome ?? null
  const childrenSummary = getChildrenSummary(client.children, client.dependentsDetails)
  const childrenCount = client.dependentsCount ?? client.dependents ?? childrenSummary.countFromChildren ?? (client.hasChildren ? 1 : 0)
  const sourceKycSnapshotId = client.kycSnapshots[0]?.id ?? null
  const existingPersonalLifeCoverage = getExistingCoverage(client.products, ["LIFE_INSURANCE"])
  const groupLifeCoverage = getExistingCoverage(client.products, ["GROUP_INSURANCE"])
  const existingLifeCoverage = existingPersonalLifeCoverage + groupLifeCoverage
  const existingDisabilityBenefit = getExistingCoverage(client.products, ["DISABILITY_INSURANCE"])
  const existingCriticalIllnessCoverage = getExistingCoverage(client.products, ["CRITICAL_ILLNESS"])
  const existingCorporateCoverage = getExistingCoverage(client.products, ["LIFE_INSURANCE", "DISABILITY_INSURANCE", "CRITICAL_ILLNESS"])
  const beneficiaryDetails = getBeneficiaryDetails(client.products)
  const policyDocumented = existingLifeCoverage > 0 ? hasPolicyDocument(client.documents) : null
  const individualDisabilityBenefit = getExistingCoverage(client.products, ["DISABILITY_INSURANCE"])
  const groupDisabilityBenefit = getExistingCoverage(client.products, ["GROUP_INSURANCE"])
  const settings = await getOrganizationInsuranceNeedsSettings(organizationId)
  const clientAge = client.dateOfBirth ? calculateAge(client.dateOfBirth.toISOString()) : null

  const commonInputs = [
    input("clientAge", "Âge du client", clientAge, clientAge !== null ? "CRM" : "ADVISOR"),
    input("annualIncome", "Revenu annuel", annualIncome),
    input("monthlyGrossIncome", "Revenu mensuel brut", annualIncome ? Math.round(annualIncome / 12) : null),
    input("spouseIncome", "Revenu du conjoint", null, "ADVISOR"),
    input("monthlyNetIncome", "Revenu mensuel net estimé", annualIncome ? Math.round(annualIncome / 12 * 0.68) : null),
    input("monthlyExpenses", "Dépenses mensuelles estimées", annualIncome ? Math.round(annualIncome / 12 * 0.55) : null, "SYSTEM"),
    input("housingPayment", "Hypothèque ou loyer mensuel", null, "ADVISOR"),
    input("monthlyDebtPayments", "Paiements mensuels de dettes", null, "ADVISOR"),
    input("childrenCount", "Nombre d’enfants ou personnes à charge", childrenCount),
    input("dependentsCount", "Personnes à charge", client.dependentsCount ?? client.dependents ?? childrenCount),
    input("childrenAges", "Âge et détails des enfants", childrenSummary.label, childrenSummary.label ? "CRM" : "ADVISOR"),
    input("liabilities", "Dettes personnelles", client.liabilities),
    input("liquidAssets", "Actifs liquides", client.liquidAssets),
    input("mortgageBalance", "Solde hypothécaire", null, "ADVISOR"),
    input("familyStatus", "Situation familiale", client.familyStatus),
    input("riskProfile", "Profil de risque", client.riskProfile),
    input("primaryGoal", "Objectif principal", client.primaryGoal ?? client.goals),
    input("selfEmployed", "Travailleur autonome ou incorporé", client.isSelfEmployed || ["SELF_EMPLOYED", "INCORPORATED", "AUTONOME"].includes(String(client.employmentStatus ?? "").toUpperCase()), "CRM"),
  ]

  const typeInputs = {
    LIFE: [
      input("existingLifeCoverage", "Assurance vie existante", existingLifeCoverage, "CRM"),
      input("existingPersonalLifeCoverage", "Assurance vie personnelle existante", existingPersonalLifeCoverage, "CRM"),
      input("groupLifeCoverage", "Assurance vie collective", groupLifeCoverage, "CRM"),
      input("beneficiariesConfirmed", "Bénéficiaires confirmés", beneficiaryDetails.confirmed, beneficiaryDetails.confirmed ? "CRM" : "ADVISOR"),
      input("beneficiaryNotes", "Bénéficiaires actuels / notes", beneficiaryDetails.notes, beneficiaryDetails.notes ? "CRM" : "ADVISOR"),
      input("policyDocumented", "Police existante documentée", policyDocumented, policyDocumented === null ? "ADVISOR" : "DOCUMENT"),
      input("estateLiquidityNeed", "Impôts et liquidités successorales", null, "ADVISOR"),
      input("legacyGoal", "Objectif de legs", null, "ADVISOR"),
      input("premiumBudgetMonthly", "Budget mensuel de prime à respecter", null, "ADVISOR"),
      input("clientCoverageDecision", "Décision client sur la protection suffisante", "PENDING", "ADVISOR"),
    ],
    DISABILITY: [
      input("existingDisabilityBenefit", "Prestation invalidité mensuelle existante", existingDisabilityBenefit, "CRM"),
      input("existingIndividualDisabilityBenefit", "Prestation invalidité individuelle", individualDisabilityBenefit, "CRM"),
      input("groupDisabilityBenefit", "Prestation invalidité collective", groupDisabilityBenefit, "CRM"),
      input("groupCoveragePercentage", "Pourcentage couvert par le régime collectif", null, "ADVISOR"),
      input("groupBenefitTaxable", "Prestation collective imposable", null, "ADVISOR"),
      input("groupBenefitMaxMonthly", "Maximum mensuel du régime collectif", null, "ADVISOR"),
      input("waitingPeriodDays", "Délai de carence en jours", null, "ADVISOR"),
      input("benefitDurationMonths", "Durée de prestation en mois", null, "ADVISOR"),
      input("emergencyFundMonths", "Fonds d’urgence en mois", client.liquidAssets && annualIncome ? Math.round(client.liquidAssets / (annualIncome / 12 * 0.55)) : null, "SYSTEM"),
      input("businessOverhead", "Frais généraux d’entreprise", null, "ADVISOR"),
      input("occupationRisk", "Risque professionnel", client.occupation ?? null, client.occupation ? "CRM" : "ADVISOR"),
      input("dividendIncome", "Revenu en dividendes à valider", null, "ADVISOR"),
    ],
    CRITICAL_ILLNESS: [
      input("existingCriticalIllnessCoverage", "Assurance maladies graves existante", existingCriticalIllnessCoverage, "CRM"),
      input("criticalIllnessPolicyDocumented", "Police maladies graves documentée", existingCriticalIllnessCoverage > 0 ? hasPolicyDocument(client.documents) : null, existingCriticalIllnessCoverage > 0 ? "DOCUMENT" : "ADVISOR"),
      input("disabilityCoverageAvailable", "Protection invalidité disponible", existingDisabilityBenefit, "CRM"),
      input("mortgageProtectionGoal", "Remboursement hypothécaire visé", null, "ADVISOR"),
      input("medicalLiquidityNeed", "Liquidités médicales et adaptation", null, "ADVISOR"),
      input("homeAdaptationNeed", "Adaptation domicile ou soins non couverts", null, "ADVISOR"),
      input("familySupportNeed", "Fonds familial de sécurité", null, "ADVISOR"),
      input("criticalIllnessObjective", "Objectif client maladies graves", client.primaryGoal ?? client.goals ?? null, client.primaryGoal || client.goals ? "CRM" : "ADVISOR"),
    ],
    BUSINESS: [
      input("businessName", "Nom de l’entreprise", client.kybProfile?.legalName ?? client.kybProfile?.tradeName ?? null, client.kybProfile?.legalName || client.kybProfile?.tradeName ? "KYC" : "ADVISOR"),
      input("businessType", "Type d’entreprise", client.kybProfile?.entityType ?? null, client.kybProfile?.entityType ? "KYC" : "ADVISOR"),
      input("businessActivity", "Activités de l’entreprise", client.kybProfile?.businessActivity ?? client.kybProfile?.industry ?? null, client.kybProfile?.businessActivity || client.kybProfile?.industry ? "KYC" : "ADVISOR"),
      input("annualBusinessRevenue", "Revenus annuels de l’entreprise", client.kybProfile?.annualRevenue ?? null, client.kybProfile?.annualRevenue ? "KYC" : "ADVISOR"),
      input("shareholderCount", "Nombre d’actionnaires", client.kybProfile?.shareholdersDocumented ? 2 : null, client.kybProfile?.shareholdersDocumented ? "KYC" : "ADVISOR"),
      input("previousShareholderCount", "Ancien nombre d’actionnaires", null, "ADVISOR"),
      input("previousOwnershipPercentage", "Ancien pourcentage de détention", null, "ADVISOR"),
      input("shareholdersChangedSinceLastReview", "Actionnariat modifié depuis la dernière revue", false, "ADVISOR"),
      input("hasShareholdersAgreement", "Convention entre actionnaires", client.kybProfile?.shareholdersDocumented ? true : null, client.kybProfile?.shareholdersDocumented ? "KYC" : "ADVISOR"),
      input("shareholdersAgreementUpdated", "Convention mise à jour après changement", null, "ADVISOR"),
      input("agreementFunded", "Convention financée par assurance", null, "ADVISOR"),
      input("businessValue", "Valeur estimée de l’entreprise", null, "ADVISOR"),
      input("ownershipPercentage", "Pourcentage de détention", null, "ADVISOR"),
      input("keyPersonRevenueImpact", "Perte de revenus estimée - personne clé", null, "ADVISOR"),
      input("keyPersonReplacementCost", "Coût de remplacement - personne clé", null, "ADVISOR"),
      input("keyPersonTransitionCost", "Frais de transition - personne clé", null, "ADVISOR"),
      input("corporateDebt", "Dettes commerciales", null, "ADVISOR"),
      input("personalGuaranteesAmount", "Garanties personnelles", null, "ADVISOR"),
      input("monthlyOperatingNeed", "Besoin mensuel de continuité", null, "ADVISOR"),
      input("existingCorporateCoverage", "Protection corporative existante", existingCorporateCoverage, "CRM"),
      input("policyOwnedByCorrectEntity", "Titulaire de police corporative validé", null, "ADVISOR"),
      input("beneficiaryStructureReviewed", "Bénéficiaire corporatif validé", null, "ADVISOR"),
      input("ownershipStructureNotes", "Notes sur l’actionnariat et les pourcentages", client.kybProfile?.ownershipStructureNotes ?? null, client.kybProfile?.ownershipStructureNotes ? "KYC" : "ADVISOR"),
      input("corporateDocumentsCollected", "Documents corporatifs collectés", client.kybProfile?.corporateDocumentsCollected ?? false, "KYC"),
      input("beneficialOwnersDocumented", "Bénéficiaires effectifs documentés", client.kybProfile?.beneficialOwnersDocumented ?? false, "KYC"),
    ],
    REPLACEMENT: [
      input("existingCoverage", "Montant assuré contrat existant", existingLifeCoverage, "CRM"),
      input("proposedCoverage", "Montant assuré proposé", null, "ADVISOR"),
      input("existingPremium", "Prime actuelle", null, "ADVISOR"),
      input("proposedPremium", "Prime proposée", null, "ADVISOR"),
      input("existingCarrier", "Assureur actuel", null, "ADVISOR"),
      input("proposedCarrier", "Assureur proposé", null, "ADVISOR"),
      input("existingProductType", "Produit actuel", null, "ADVISOR"),
      input("proposedProductType", "Produit proposé", null, "ADVISOR"),
      input("existingPolicyNumber", "Numéro de police actuel", null, "ADVISOR"),
      input("proposedPolicyNumber", "Numéro de police proposé", null, "ADVISOR"),
      input("existingIssueDate", "Date d’émission actuelle", null, "ADVISOR"),
      input("proposedIssueDate", "Date d’émission proposée ou prévue", null, "ADVISOR"),
      input("existingTerm", "Durée / structure actuelle", null, "ADVISOR"),
      input("proposedTerm", "Durée / structure proposée", null, "ADVISOR"),
      input("existingRiders", "Avenants actuels", null, "ADVISOR"),
      input("proposedRiders", "Avenants proposés", null, "ADVISOR"),
      input("existingPremiumGuarantee", "Garantie de prime actuelle", null, "ADVISOR"),
      input("proposedPremiumGuarantee", "Garantie de prime proposée", null, "ADVISOR"),
      input("existingContestabilityPeriod", "Contestabilité actuelle", null, "ADVISOR"),
      input("proposedContestabilityPeriod", "Nouvelle contestabilité", null, "ADVISOR"),
      input("existingFeesOrSurrenderCharges", "Frais / pertes / charges actuels", null, "ADVISOR"),
      input("proposedFeesOrCharges", "Frais / charges proposés", null, "ADVISOR"),
      input("existingOwner", "Titulaire actuel", null, "ADVISOR"),
      input("proposedOwner", "Titulaire proposé", null, "ADVISOR"),
      input("existingBeneficiaries", "Bénéficiaires actuels détaillés", null, "ADVISOR"),
      input("proposedBeneficiaries", "Bénéficiaires proposés détaillés", null, "ADVISOR"),
      input("underwritingRisks", "Risques de souscription et conséquences", null, "ADVISOR"),
      input("existingExclusions", "Exclusions actuelles", null, "ADVISOR"),
      input("newExclusions", "Nouvelles exclusions ou restrictions", null, "ADVISOR"),
      input("lostBenefits", "Garanties ou bénéfices perdus", null, "ADVISOR"),
      input("cashValueSurrendered", "Valeur de rachat abandonnée", null, "ADVISOR"),
      input("replacementAdvantages", "Avantages du nouveau contrat", null, "ADVISOR"),
      input("replacementDisadvantages", "Désavantages du remplacement", null, "ADVISOR"),
      input("replacementJustification", "Justification écrite du remplacement", null, "ADVISOR"),
      input("replacementNoticeCompleted", "Préavis de remplacement complété", false, "ADVISOR"),
      input("replacementComparisonExplained", "Comparaison expliquée au client", false, "ADVISOR"),
      input("replacementClientAcknowledged", "Reconnaissance client du remplacement", false, "ADVISOR"),
      input("replacementRequired", "Remplacement potentiel", true, "SYSTEM"),
    ],
  } satisfies Record<InsuranceAnalysisType, ReturnType<typeof input>[]>

  const typeAssumptions = {
    LIFE: [
      assumption("incomeReplacementYears", "Années de revenu à remplacer", settings.life.incomeReplacementYears, "années", "Hypothèse cabinet configurable à valider."),
      assumption("finalExpenses", "Frais finaux", settings.life.finalExpenses, "CAD", "Frais funéraires et coûts finaux estimés."),
      assumption("educationPerChild", "Études par enfant", settings.life.educationPerChild, "CAD", "Montant indicatif pour objectifs d’études."),
      assumption("emergencyMonths", "Fonds d’urgence familial", settings.life.emergencyMonths, "mois", "Réserve familiale pendant la transition."),
    ],
    DISABILITY: [
      assumption("minimumEmergencyMonths", "Fonds d’urgence minimum", settings.disability.minimumEmergencyMonths, "mois", "Seuil de liquidités à documenter."),
    ],
    CRITICAL_ILLNESS: [
      assumption("mortgageProtectionPortion", "Portion hypothèque à protéger", settings.criticalIllness.mortgageProtectionPortion, "CAD", "Scénario de remboursement partiel."),
      assumption("medicalLiquidity", "Liquidités médicales et adaptation", settings.criticalIllness.medicalLiquidity, "CAD", "Liquidités non couvertes par les régimes publics ou privés."),
      assumption("incomeReplacementMonths", "Revenu temporaire à remplacer", settings.criticalIllness.incomeReplacementMonths, "mois", "Temps de récupération ou pause de travail."),
      assumption("familyReserve", "Réserve familiale", settings.criticalIllness.familyReserve, "CAD", "Fonds de sécurité du ménage."),
    ],
    BUSINESS: [
      assumption("continuityMonths", "Continuité d’exploitation", settings.business.continuityMonths, "mois", "Mois nécessaires pour stabiliser l’entreprise."),
    ],
    REPLACEMENT: [],
  } satisfies Record<InsuranceAnalysisType, ReturnType<typeof assumption>[]>

  return {
    client,
    sourceKycSnapshotId,
    inputs: [...commonInputs, ...typeInputs[type]],
    assumptions: typeAssumptions[type],
  }
}

export async function listInsuranceNeedsAnalyses({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  await ensureAnalysisInputBackfill({ organizationId, clientId })
  return prisma.insuranceNeedsAnalysis.findMany({
    where: { organizationId, clientId },
    include: analysisInclude,
    orderBy: [{ analysisDate: "desc" }, { createdAt: "desc" }],
  })
}

async function ensureAnalysisInputBackfill({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const analyses = await prisma.insuranceNeedsAnalysis.findMany({
    where: { organizationId, clientId, analysisType: { in: ["LIFE", "DISABILITY", "CRITICAL_ILLNESS", "BUSINESS", "REPLACEMENT"] }, status: { not: "ARCHIVED" } },
    select: { id: true, analysisType: true, inputs: { select: { inputKey: true } } },
  })
  if (!analyses.length) return

  for (const analysis of analyses) {
    const prefill = await buildPrefill({ organizationId, clientId, type: analysis.analysisType })
    const existingKeys = new Set(analysis.inputs.map((input) => input.inputKey))
    const missingInputs = prefill.inputs.filter((input) => !existingKeys.has(input.inputKey))
    if (!missingInputs.length) continue
    await prisma.insuranceAnalysisInput.createMany({
      data: missingInputs.map((input) => ({
        analysisId: analysis.id,
        ...input,
      })),
      skipDuplicates: true,
    })
  }
}

export async function createInsuranceNeedsAnalysis({
  organizationId,
  userId,
  clientId,
  type,
  opportunityId,
}: {
  organizationId: string
  userId: string
  clientId: string
  type: InsuranceAnalysisType
  opportunityId?: string | null
}) {
  const prefill = await buildPrefill({ organizationId, clientId, type })
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "insurance_needs_analysis",
    errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED",
  })
  const label = analysisTypeLabels[type]
  const resolvedOpportunityId = await resolveOpportunityId({ organizationId, clientId, type, opportunityId })

  const analysis = await prisma.insuranceNeedsAnalysis.create({
    data: {
      organizationId,
      clientId,
      advisorId: prefill.client.advisorId ?? userId,
      sourceKycSnapshotId: prefill.sourceKycSnapshotId,
      opportunityId: resolvedOpportunityId,
      analysisType: type,
      status: "DRAFT",
      objective: prefill.client.primaryGoal ?? prefill.client.goals ?? `Analyser le besoin: ${label}`,
      inputs: { create: prefill.inputs },
      assumptions: { create: prefill.assumptions },
    },
    include: analysisInclude,
  })

  const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const existingTask = await prisma.task.findFirst({
    where: {
      organizationId,
      clientId,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
      title: `Compléter l’analyse ${label}`,
    },
  })
  if (!existingTask) {
    const task = await prisma.task.create({
      data: {
        organizationId,
        clientId,
        assignedToId: analysis.advisorId ?? userId,
        createdById: userId,
        type: "COMPLIANCE",
        priority: "HIGH",
        status: "TODO",
        title: `Compléter l’analyse ${label}`,
        description: "Valider les données préremplies, documenter les hypothèses et préparer la recommandation.",
        dueDate,
        isAutomated: true,
      },
    })
    await createCrmActivity({
      organizationId,
      userId,
      clientId,
      taskId: task.id,
      type: "TASK_CREATED",
      title: "Tâche d’analyse créée",
      description: task.title,
      source: "AUTOMATION",
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
    })
  }

  await prisma.auditLog.create({
    data: { organizationId, userId, clientId, entityType: "InsuranceNeedsAnalysis", entityId: analysis.id, action: "CREATED", newValue: { analysisType: type, opportunityId: resolvedOpportunityId } },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    type: "RECOMMENDATION_CREATED",
    title: "Analyse des besoins créée",
    description: label,
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
  })

  return analysis
}

export async function ensureReplacementAnalysisForOpportunity({
  organizationId,
  userId,
  productId,
}: {
  organizationId: string
  userId: string
  productId: string
}) {
  const product = await prisma.financialProduct.findFirst({
    where: { id: productId, organizationId, category: "INSURANCE", status: { not: "ARCHIVED" } },
    select: {
      id: true,
      clientId: true,
      advisorId: true,
      type: true,
      status: true,
      company: true,
      productName: true,
      policyNumber: true,
      contractNumber: true,
      premium: true,
      coverageAmount: true,
      issuedAt: true,
      effectiveDate: true,
      primaryBeneficiary: true,
      contingentBeneficiary: true,
      beneficiaryNotes: true,
      notes: true,
      complianceNotes: true,
    },
  })
  if (!product || !["PENDING", "UNDER_REVIEW"].includes(product.status)) return null

  const existingPolicy = await findPotentialReplacementPolicy({
    organizationId,
    clientId: product.clientId,
    productType: product.type,
    proposedProductId: product.id,
  })
  if (!existingPolicy) return null

  let analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: {
      organizationId,
      clientId: product.clientId,
      analysisType: "REPLACEMENT",
      status: { not: "ARCHIVED" },
      OR: [{ opportunityId: product.id }, { opportunityId: null }],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: { inputs: true },
  })

  if (!analysis) {
    analysis = await createInsuranceNeedsAnalysis({
      organizationId,
      userId,
      clientId: product.clientId,
      type: "REPLACEMENT",
      opportunityId: product.id,
    })
  } else if (analysis.opportunityId !== product.id) {
    analysis = await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: { opportunityId: product.id },
      include: { inputs: true },
    })
  }

  const beneficiarySummary = [existingPolicy.primaryBeneficiary, existingPolicy.contingentBeneficiary, existingPolicy.beneficiaryNotes].filter(Boolean).join(" | ")
  const proposedBeneficiarySummary = [product.primaryBeneficiary, product.contingentBeneficiary, product.beneficiaryNotes].filter(Boolean).join(" | ")
  const replacements = new Map<string, { value: unknown; source: "CRM" | "SYSTEM" }>([
    ["existingCoverage", { value: existingPolicy.coverageAmount, source: "CRM" }],
    ["proposedCoverage", { value: product.coverageAmount, source: "CRM" }],
    ["existingPremium", { value: existingPolicy.premium, source: "CRM" }],
    ["proposedPremium", { value: product.premium, source: "CRM" }],
    ["existingCarrier", { value: existingPolicy.company, source: "CRM" }],
    ["proposedCarrier", { value: product.company, source: "CRM" }],
    ["existingProductType", { value: existingPolicy.productName ?? product.type, source: "CRM" }],
    ["proposedProductType", { value: product.productName ?? product.type, source: "CRM" }],
    ["existingPolicyNumber", { value: existingPolicy.policyNumber ?? existingPolicy.contractNumber, source: "CRM" }],
    ["proposedPolicyNumber", { value: product.policyNumber ?? product.contractNumber, source: "CRM" }],
    ["existingIssueDate", { value: dateLabel(existingPolicy.issuedAt ?? existingPolicy.effectiveDate), source: "CRM" }],
    ["proposedIssueDate", { value: dateLabel(product.issuedAt ?? product.effectiveDate), source: "CRM" }],
    ["existingBeneficiaries", { value: beneficiarySummary || null, source: "CRM" }],
    ["proposedBeneficiaries", { value: proposedBeneficiarySummary || null, source: "CRM" }],
    ["existingExclusions", { value: existingPolicy.complianceNotes ?? existingPolicy.notes, source: "CRM" }],
    ["newExclusions", { value: product.complianceNotes ?? product.notes, source: "CRM" }],
    ["replacementRequired", { value: true, source: "SYSTEM" }],
  ])

  for (const input of analysis.inputs) {
    const replacement = replacements.get(input.inputKey)
    if (!replacement) continue
    const value = textOrNull(replacement.value) ?? (typeof replacement.value === "number" ? replacement.value : null)
    if (value === null || value === undefined) continue
    await prisma.insuranceAnalysisInput.update({
      where: { id: input.id },
      data: {
        inputValue: { value: toJsonValue(value) } as Prisma.InputJsonObject,
        source: replacement.source,
        isVerified: true,
      },
    })
  }

  const existingAlert = await prisma.complianceAlert.findFirst({
    where: {
      organizationId,
      clientId: product.clientId,
      type: "REPLACEMENT_POTENTIAL_DETECTED",
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    select: { id: true },
  })
  const alertData = {
    severity: "CRITICAL" as const,
    status: "OPEN" as const,
    title: "Remplacement potentiel détecté",
    description: "Une police existante semblable est au dossier. L’analyse de remplacement doit être complétée avant la soumission.",
    actionLabel: "Ouvrir l’analyse de remplacement",
    actionUrl: `/clients/${product.clientId}?tab=needs&analysisId=${analysis.id}`,
  }
  const alert = existingAlert
    ? await prisma.complianceAlert.update({
      where: { id: existingAlert.id },
      data: alertData,
    })
    : await prisma.complianceAlert.create({
      data: {
        ...alertData,
      organizationId,
      clientId: product.clientId,
      type: "REPLACEMENT_POTENTIAL_DETECTED",
      },
    })

  const taskExists = await prisma.task.findFirst({
    where: { organizationId, clientId: product.clientId, alertId: alert.id, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
    select: { id: true },
  })
  if (!taskExists) {
    await prisma.task.create({
      data: {
        organizationId,
        clientId: product.clientId,
        alertId: alert.id,
        assignedToId: product.advisorId ?? analysis.advisorId ?? userId,
        createdById: userId,
        type: "COMPLIANCE",
        priority: "HIGH",
        status: "TODO",
        title: "Compléter l’analyse de remplacement",
        description: "Une police similaire existe déjà au dossier. Comparer ancien contrat et nouveau contrat avant toute soumission.",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isAutomated: true,
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: product.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "REPLACEMENT_DETECTED",
      newValue: { opportunityId: product.id, existingPolicyId: existingPolicy.id, productType: product.type },
    },
  })

  return analysis
}

export async function createInsuranceNeedsAnalysisVersion({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const source = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: {
      inputs: true,
      assumptions: true,
      client: { select: { advisorId: true } },
    },
  })
  if (!source) throw new Error("ANALYSIS_NOT_FOUND")
  await assertActivePurposeConsent({
    organizationId,
    clientId: source.clientId,
    purposeCode: "insurance_needs_analysis",
    errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED",
  })

  const nextVersion = (source.analysisVersion ?? 1) + 1
  const analysis = await prisma.insuranceNeedsAnalysis.create({
    data: {
      organizationId,
      clientId: source.clientId,
      advisorId: source.advisorId ?? source.client.advisorId ?? userId,
      sourceKycSnapshotId: source.sourceKycSnapshotId,
      opportunityId: source.opportunityId,
      analysisType: source.analysisType,
      status: "DRAFT",
      analysisVersion: nextVersion,
      objective: source.objective,
      summary: null,
      aiSummary: null,
      advisorNotes: source.advisorNotes,
      inputs: {
        create: source.inputs.map((input) => ({
          inputKey: input.inputKey,
          label: input.label,
          inputValue: input.inputValue ?? Prisma.JsonNull,
          source: input.source,
          sourceDocumentId: input.sourceDocumentId,
          isVerified: input.isVerified,
          validatedById: null,
          validatedAt: null,
        })),
      },
      assumptions: {
        create: source.assumptions.map((assumption) => ({
          assumptionType: assumption.assumptionType,
          label: assumption.label,
          numericValue: assumption.numericValue,
          value: assumption.value,
          unit: assumption.unit,
          reason: assumption.reason,
          editableByAdvisor: assumption.editableByAdvisor,
        })),
      },
    },
    include: analysisInclude,
  })

  await prisma.insuranceNeedsAnalysis.update({
    where: { id: source.id },
    data: { status: source.status === "ARCHIVED" ? source.status : "NEEDS_UPDATE" },
  })
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: source.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "NEW_VERSION_CREATED",
      newValue: { sourceAnalysisId: source.id, analysisVersion: nextVersion },
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: source.clientId,
    type: "RECOMMENDATION_CREATED",
    title: "Nouvelle version d’analyse créée",
    description: `Version v${nextVersion} créée à partir de la version v${source.analysisVersion ?? 1}. L’ancienne version est conservée comme preuve.`,
    source: "USER",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: { sourceAnalysisId: source.id, analysisVersion: nextVersion },
  })

  return analysis
}

export async function calculateInsuranceNeedsAnalysis({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: {
      client: true,
      reportDocument: true,
      inputs: true,
      assumptions: true,
      recommendations: true,
      results: true,
    },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  assertAnalysisEditable(analysis)

  const inputMap = toInputMap(analysis.inputs)
  const assumptionMap = toAssumptionMap(analysis.assumptions)
  const calculation = calculateInsuranceNeeds({ type: analysis.analysisType, inputs: inputMap, assumptions: assumptionMap })
  const status: InsuranceAnalysisStatus = calculation.missingData.length ? "MISSING_DATA" : "RECOMMENDATION_PREPARED"
  const clientName = getClientName(analysis.client)
  const recommendation = {
    recommendedProductType: calculation.recommendedProductType,
    recommendedAmount: calculation.recommendedAmount,
    recommendedTerm: calculation.recommendedTerm,
    reasoning: calculation.reasoning,
    alternativesConsidered: calculation.alternativesConsidered,
  }

  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId, includeAi: true })
  const ai = await summarizeInsuranceNeedsWithAI({
    organizationId,
    userId,
    context: {
      analysisType: analysisTypeLabels[analysis.analysisType],
      clientName,
      results: calculation.results,
      recommendation,
      missingData: calculation.missingData,
      inputs: inputMap,
    },
  })

  await prisma.$transaction([
    prisma.insuranceAnalysisResult.deleteMany({ where: { analysisId } }),
    prisma.insuranceAnalysisRecommendation.deleteMany({ where: { analysisId } }),
    prisma.insuranceNeedsAnalysis.update({
      where: { id: analysisId },
      data: {
        status,
        summary: ai.summary,
        aiSummary: JSON.stringify(ai),
      },
    }),
    ...calculation.results.map((result) =>
      prisma.insuranceAnalysisResult.create({
        data: { analysisId, ...result },
      })
    ),
    prisma.insuranceAnalysisRecommendation.create({
      data: { analysisId, ...recommendation },
    }),
  ])

  const ruleKey = `insurance-needs:${analysis.id}`
  const existingRecommendation = await prisma.productRecommendation.findFirst({ where: { organizationId, clientId: analysis.clientId, ruleKey } })
  const productRecommendationData = {
    organizationId,
    clientId: analysis.clientId,
    advisorId: analysis.advisorId ?? userId,
    type: "PROTECTION" as const,
    priority: calculation.missingData.length ? "HIGH" as const : "MEDIUM" as const,
    status: "OPEN" as const,
    title: `Analyse ${analysisTypeLabels[analysis.analysisType]} à valider`,
    description: `${ai.summary} Validation humaine obligatoire avant présentation au client.`,
    rationale: calculation.reasoning,
    actionLabel: "Ouvrir l’analyse des besoins",
    actionUrl: `/clients/${analysis.clientId}?tab=needs&analysisId=${analysis.id}`,
    ruleKey,
    confidence: calculation.missingData.length ? 0.72 : 0.86,
    metadata: { analysisId: analysis.id, analysisType: analysis.analysisType, missingData: calculation.missingData },
  }
  if (existingRecommendation) {
    await prisma.productRecommendation.update({ where: { id: existingRecommendation.id }, data: productRecommendationData })
  } else {
    await prisma.productRecommendation.create({ data: productRecommendationData })
  }

  if (calculation.missingData.length) {
    await ensureMissingDataTask({ organizationId, userId, clientId: analysis.clientId, advisorId: analysis.advisorId, analysisId, label: analysisTypeLabels[analysis.analysisType], missingData: calculation.missingData })
  }
  if (analysis.analysisType === "LIFE") {
    await syncLifeInsuranceAnalysisAlerts({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      inputMap,
      calculation,
    })
  }
  if (analysis.analysisType === "DISABILITY") {
    await syncDisabilityAnalysisAlerts({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      inputMap,
      calculation,
    })
  }
  if (analysis.analysisType === "CRITICAL_ILLNESS") {
    await syncCriticalIllnessAnalysisAlerts({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      inputMap,
      calculation,
    })
  }
  if (analysis.analysisType === "BUSINESS") {
    await syncBusinessAnalysisAlerts({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      inputMap,
      calculation,
    })
  }
  if (analysis.analysisType === "REPLACEMENT") {
    await syncReplacementAnalysisArtifacts({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      inputMap,
      calculation,
    })
  }

  await prisma.auditLog.create({
    data: { organizationId, userId, clientId: analysis.clientId, entityType: "InsuranceNeedsAnalysis", entityId: analysis.id, action: "CALCULATED", newValue: { status, missingData: calculation.missingData } },
  })
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: analysis.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "AI_SUGGESTIONS_GENERATED",
      newValue: {
        riskLevel: ai.riskLevel,
        riskScore: ai.riskScore,
        attentionPoints: ai.advisorAttentionPoints.length,
        documentSuggestions: ai.documentsToRequest.length,
        nextActions: ai.nextBestActions.length,
      },
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    type: "RECOMMENDATIONS_GENERATED",
    title: "Analyse des besoins recalculée",
    description: `${analysisTypeLabels[analysis.analysisType]}: ${calculation.recommendedAmount.toLocaleString("fr-CA")} $ à valider.`,
    source: "AI",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: { missingData: calculation.missingData },
  })
  await syncOpportunityFromAnalysis({ organizationId, userId, analysisId })

  return getInsuranceNeedsAnalysis({ organizationId, analysisId })
}

async function ensureMissingDataTask({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  label,
  missingData,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  label: string
  missingData: string[]
}) {
  const title = `Documenter les données manquantes - ${label}`
  const existing = await prisma.task.findFirst({
    where: { organizationId, clientId, title, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
  })
  if (existing) return
  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId,
      assignedToId: advisorId ?? userId,
      createdById: userId,
      type: "COMPLIANCE",
      priority: "HIGH",
      status: "TODO",
      title,
      description: `À valider avant recommandation: ${missingData.join(", ")}.`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isAutomated: true,
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    taskId: task.id,
    type: "TASK_CREATED",
    title: "Tâche conformité créée",
    description: task.title,
    source: "AUTOMATION",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysisId,
  })
}

function inputNumber(inputs: AnalysisInputMap, key: string) {
  const value = inputs[key]
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""))
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  }
  return 0
}

function inputBoolean(inputs: AnalysisInputMap, key: string) {
  const value = inputs[key]
  return value === true || value === "true" || value === "oui" || value === "yes"
}

async function syncLifeInsuranceAnalysisAlerts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  inputMap,
  calculation,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  inputMap: AnalysisInputMap
  calculation: InsuranceCalculation
}) {
  const result = calculation.results[0]
  const annualIncome = inputNumber(inputMap, "annualIncome")
  const childrenCount = inputNumber(inputMap, "childrenCount")
  const mortgage = inputNumber(inputMap, "mortgageBalance")
  const existingCoverage = inputNumber(inputMap, "existingLifeCoverage")
  const existingPersonalLifeCoverage = inputNumber(inputMap, "existingPersonalLifeCoverage")
  const groupLifeCoverage = inputNumber(inputMap, "groupLifeCoverage")
  const premiumBudgetMonthly = inputNumber(inputMap, "premiumBudgetMonthly")
  const beneficiariesConfirmed = inputBoolean(inputMap, "beneficiariesConfirmed")
  const policyDocumented = inputBoolean(inputMap, "policyDocumented")
  const clientCoverageDecision = String(inputMap.clientCoverageDecision ?? "").toUpperCase()
  const netNeed = result?.netNeed ?? 0
  const settings = await getOrganizationInsuranceNeedsSettings(organizationId)

  const alertCandidates = [
    {
      type: "LIFE_FAMILY_PROTECTION_GAP",
      active: childrenCount > 0 && netNeed > 0 && existingCoverage < Math.max(100000, netNeed * settings.life.familyCoverageGapRatio),
      severity: "HIGH" as const,
      title: "Protection familiale possiblement insuffisante",
      description: "Le client a des enfants ou personnes à charge et l’écart de protection vie semble important. Le conseiller doit valider le besoin et documenter la recommandation.",
      taskTitle: "Valider l’écart de protection familiale",
    },
    {
      type: "LIFE_MORTGAGE_UNPROTECTED",
      active: mortgage >= settings.life.highMortgageThreshold && existingPersonalLifeCoverage === 0,
      severity: "HIGH" as const,
      title: "Dette hypothécaire non protégée",
      description: "Le solde hypothécaire est élevé et aucune assurance vie personnelle n’est documentée. La protection de la dette doit être analysée.",
      taskTitle: "Documenter la protection de la dette hypothécaire",
    },
    {
      type: "LIFE_GROUP_ONLY",
      active: groupLifeCoverage > 0 && existingPersonalLifeCoverage === 0,
      severity: "MEDIUM" as const,
      title: "Protection dépendante de l’emploi",
      description: "La protection vie connue semble venir seulement de l’assurance collective. Le conseiller doit expliquer la dépendance à l’emploi et valider une protection personnelle.",
      taskTitle: "Revoir la dépendance à l’assurance collective",
    },
    {
      type: "LIFE_BENEFICIARY_REVIEW",
      active: existingCoverage > 0 && !beneficiariesConfirmed,
      severity: "MEDIUM" as const,
      title: "Bénéficiaires à confirmer",
      description: "Une protection vie existe, mais les bénéficiaires ne sont pas confirmés au dossier. Une revue bénéficiaire est recommandée.",
      taskTitle: "Confirmer les bénéficiaires d’assurance vie",
    },
    {
      type: "LIFE_POLICY_DOCUMENT_REQUIRED",
      active: existingCoverage > 0 && !policyDocumented,
      severity: "HIGH" as const,
      title: "Police existante à obtenir",
      description: "Une protection vie existante est déclarée, mais aucun document de police ou relevé d’assurance n’est classé au dossier.",
      taskTitle: "Demander la copie de police d’assurance vie",
    },
    {
      type: "LIFE_BUDGET_ASSUMPTIONS_REVIEW",
      active: netNeed > 0 && annualIncome > 0 && (netNeed > annualIncome * 15 || (premiumBudgetMonthly > 0 && netNeed > premiumBudgetMonthly * 900)),
      severity: "MEDIUM" as const,
      title: "Hypothèses à revoir avec le budget",
      description: "Le besoin calculé est élevé par rapport aux données de revenu ou au budget de prime indiqué. Le conseiller doit valider les hypothèses et les options.",
      taskTitle: "Revoir les hypothèses et le budget de prime",
    },
    {
      type: "LIFE_CLIENT_REFUSAL_TO_DOCUMENT",
      active: clientCoverageDecision === "DECLINED" && netNeed > 0,
      severity: "HIGH" as const,
      title: "Refus client à documenter",
      description: "Le client refuse ou reporte une protection suffisante malgré un écart calculé. La justification et le refus doivent être conservés au dossier.",
      taskTitle: "Documenter le refus de protection",
    },
  ]

  const managedTypes = alertCandidates.map((candidate) => candidate.type)
  for (const candidate of alertCandidates) {
    const existing = await prisma.complianceAlert.findFirst({
      where: { organizationId, clientId, type: candidate.type, status: { in: ["OPEN", "IN_PROGRESS"] } },
    })
    if (!candidate.active) {
      if (existing) {
        await prisma.complianceAlert.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
        })
      }
      continue
    }

    const alert = existing
      ? await prisma.complianceAlert.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse vie",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })
      : await prisma.complianceAlert.create({
        data: {
          organizationId,
          clientId,
          type: candidate.type,
          severity: candidate.severity,
          status: "OPEN",
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse vie",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })

    const taskExists = await prisma.task.findFirst({
      where: { organizationId, clientId, alertId: alert.id, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
      select: { id: true },
    })
    if (!taskExists) {
      await prisma.task.create({
        data: {
          organizationId,
          clientId,
          alertId: alert.id,
          assignedToId: advisorId ?? userId,
          createdById: userId,
          type: "COMPLIANCE",
          priority: candidate.severity === "HIGH" ? "HIGH" : "NORMAL",
          status: "TODO",
          title: candidate.taskTitle,
          description: `${candidate.description} Analyse liée: ${analysisId}.`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isAutomated: true,
        },
      })
    }

    if (!existing) {
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        alertId: alert.id,
        type: "COMPLIANCE_ALERT_CREATED",
        title: candidate.title,
        description: candidate.description,
        source: "AUTOMATION",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysisId,
      })
    }
  }

  await prisma.complianceAlert.updateMany({
    where: {
      organizationId,
      clientId,
      type: { in: managedTypes },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      NOT: { type: { in: alertCandidates.filter((candidate) => candidate.active).map((candidate) => candidate.type) } },
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
  })
}

async function syncDisabilityAnalysisAlerts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  inputMap,
  calculation,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  inputMap: AnalysisInputMap
  calculation: InsuranceCalculation
}) {
  const result = calculation.results[0]
  const annualIncome = inputNumber(inputMap, "annualIncome")
  const clientAge = inputNumber(inputMap, "clientAge")
  const monthlyNetIncome = inputNumber(inputMap, "monthlyNetIncome")
  const selfEmployed = inputBoolean(inputMap, "selfEmployed")
  const groupBenefit = inputNumber(inputMap, "groupDisabilityBenefit")
  const individualBenefit = inputNumber(inputMap, "existingIndividualDisabilityBenefit")
  const existingBenefit = inputNumber(inputMap, "existingDisabilityBenefit") || groupBenefit + individualBenefit
  const groupBenefitMaxMonthly = inputNumber(inputMap, "groupBenefitMaxMonthly")
  const groupCoveragePercentage = inputNumber(inputMap, "groupCoveragePercentage")
  const emergencyMonths = inputNumber(inputMap, "emergencyFundMonths")
  const groupBenefitTaxable = inputBoolean(inputMap, "groupBenefitTaxable")
  const dividendIncome = inputNumber(inputMap, "dividendIncome")
  const occupationRisk = String(inputMap.occupationRisk ?? "").toLowerCase()
  const netGap = result?.netNeed ?? 0
  const settings = await getOrganizationInsuranceNeedsSettings(organizationId)

  const alertCandidates = [
    {
      type: "DISABILITY_SELF_EMPLOYED_NO_COVERAGE",
      active: selfEmployed && existingBenefit === 0,
      severity: "HIGH" as const,
      title: "Travail autonome sans invalidité documentée",
      description: "Le client semble travailleur autonome ou incorporé et aucune protection invalidité n’est documentée. Le revenu et les frais professionnels doivent être protégés ou le refus doit être justifié.",
      taskTitle: "Valider le besoin invalidité du travailleur autonome",
    },
    {
      type: "DISABILITY_HIGH_INCOME_GROUP_CAP",
      active: annualIncome >= settings.disability.highIncomeThreshold && (groupBenefit > 0 || groupCoveragePercentage > 0) && (groupBenefitMaxMonthly > 0 ? groupBenefitMaxMonthly < monthlyNetIncome * settings.disability.groupCoverageRatioWarning : groupBenefit < monthlyNetIncome * settings.disability.groupCoverageRatioWarning),
      severity: "MEDIUM" as const,
      title: "Protection collective possiblement plafonnée",
      description: "Le revenu est élevé et la protection collective semble plafonnée ou insuffisante. Le conseiller doit calculer l’écart net réel.",
      taskTitle: "Revoir le plafond de la protection collective",
    },
    {
      type: "DISABILITY_LOW_EMERGENCY_FUND",
      active: emergencyMonths > 0 && emergencyMonths < settings.disability.minimumEmergencyMonths,
      severity: "MEDIUM" as const,
      title: "Fonds d’urgence inférieur à 3 mois",
      description: "Les liquidités disponibles couvrent moins de trois mois de dépenses estimées. Le risque de liquidité en cas d’invalidité doit être documenté.",
      taskTitle: "Documenter le fonds d’urgence invalidité",
    },
    {
      type: "DISABILITY_TAXABLE_GROUP_BENEFIT",
      active: groupBenefit > 0 && groupBenefitTaxable,
      severity: "MEDIUM" as const,
      title: "Prestation collective imposable",
      description: "La prestation collective est indiquée comme imposable. Le calcul net doit être revu avant recommandation.",
      taskTitle: "Valider le montant net de prestation collective",
    },
    {
      type: "DISABILITY_DIVIDEND_INCOME_REVIEW",
      active: dividendIncome > 0,
      severity: "MEDIUM" as const,
      title: "Revenu en dividendes à valider",
      description: "Un revenu en dividendes est indiqué. Le conseiller doit confirmer le revenu assurable et l’admissibilité auprès de l’assureur.",
      taskTitle: "Valider le revenu assurable en dividendes",
    },
    {
      type: "DISABILITY_PHYSICAL_OCCUPATION_REVIEW",
      active: ["construction", "chantier", "physique", "manuel", "chauffeur", "camion", "usine"].some((keyword) => occupationRisk.includes(keyword)),
      severity: "MEDIUM" as const,
      title: "Risque professionnel à surveiller",
      description: "L’occupation semble physique ou plus exposée. La souscription, la définition d’invalidité et les exclusions doivent être validées.",
      taskTitle: "Valider le risque professionnel invalidité",
    },
    {
      type: "DISABILITY_NEAR_RETIREMENT_REVIEW",
      active: clientAge >= 58,
      severity: "MEDIUM" as const,
      title: "Durée de prestation à adapter avant la retraite",
      description: "Le client approche de la retraite. La durée de prestation, le délai de carence et l’admissibilité doivent être adaptés à son horizon de travail.",
      taskTitle: "Adapter l’analyse invalidité à l’horizon de retraite",
    },
    {
      type: "DISABILITY_INCOME_GAP",
      active: netGap > 0 && existingBenefit > 0,
      severity: "HIGH" as const,
      title: "Écart mensuel d’invalidité détecté",
      description: "Le calcul indique un écart mensuel entre les obligations essentielles et les protections invalidité connues.",
      taskTitle: "Valider l’écart mensuel d’invalidité",
    },
  ]

  const managedTypes = alertCandidates.map((candidate) => candidate.type)
  for (const candidate of alertCandidates) {
    const existing = await prisma.complianceAlert.findFirst({
      where: { organizationId, clientId, type: candidate.type, status: { in: ["OPEN", "IN_PROGRESS"] } },
    })
    if (!candidate.active) {
      if (existing) {
        await prisma.complianceAlert.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
        })
      }
      continue
    }

    const alert = existing
      ? await prisma.complianceAlert.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse invalidité",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })
      : await prisma.complianceAlert.create({
        data: {
          organizationId,
          clientId,
          type: candidate.type,
          severity: candidate.severity,
          status: "OPEN",
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse invalidité",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })

    const taskExists = await prisma.task.findFirst({
      where: { organizationId, clientId, alertId: alert.id, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
      select: { id: true },
    })
    if (!taskExists) {
      await prisma.task.create({
        data: {
          organizationId,
          clientId,
          alertId: alert.id,
          assignedToId: advisorId ?? userId,
          createdById: userId,
          type: "COMPLIANCE",
          priority: candidate.severity === "HIGH" ? "HIGH" : "NORMAL",
          status: "TODO",
          title: candidate.taskTitle,
          description: `${candidate.description} Analyse liée: ${analysisId}.`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isAutomated: true,
        },
      })
    }

    if (!existing) {
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        alertId: alert.id,
        type: "COMPLIANCE_ALERT_CREATED",
        title: candidate.title,
        description: candidate.description,
        source: "AUTOMATION",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysisId,
      })
    }
  }

  await prisma.complianceAlert.updateMany({
    where: {
      organizationId,
      clientId,
      type: { in: managedTypes },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      NOT: { type: { in: alertCandidates.filter((candidate) => candidate.active).map((candidate) => candidate.type) } },
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
  })
}

async function syncCriticalIllnessAnalysisAlerts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  inputMap,
  calculation,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  inputMap: AnalysisInputMap
  calculation: InsuranceCalculation
}) {
  const result = calculation.results[0]
  const mortgage = inputNumber(inputMap, "mortgageBalance")
  const liquidAssets = inputNumber(inputMap, "liquidAssets")
  const annualIncome = inputNumber(inputMap, "annualIncome")
  const existingCoverage = inputNumber(inputMap, "existingCriticalIllnessCoverage")
  const disabilityCoverage = inputNumber(inputMap, "disabilityCoverageAvailable")
  const emergencyMonths = inputNumber(inputMap, "emergencyFundMonths")
  const selfEmployed = inputBoolean(inputMap, "selfEmployed")
  const policyDocumented = inputBoolean(inputMap, "criticalIllnessPolicyDocumented")
  const objective = String(inputMap.criticalIllnessObjective ?? "").toLowerCase()
  const netGap = result?.netNeed ?? 0
  const settings = await getOrganizationInsuranceNeedsSettings(organizationId)

  const alertCandidates = [
    {
      type: "CI_MORTGAGE_NO_COVERAGE",
      active: mortgage >= settings.life.highMortgageThreshold && existingCoverage === 0,
      severity: "HIGH" as const,
      title: "Hypothèque importante sans maladies graves",
      description: "Le client a une hypothèque importante et aucune protection maladies graves documentée. Le besoin de liquidité en cas de diagnostic doit être analysé.",
      taskTitle: "Analyser la protection maladies graves liée à l’hypothèque",
    },
    {
      type: "CI_SELF_EMPLOYED_LOW_LIQUIDITY",
      active: selfEmployed && liquidAssets < Math.max(10000, annualIncome / 12 * 3),
      severity: "HIGH" as const,
      title: "Travail autonome avec liquidités limitées",
      description: "Le client est travailleur autonome ou incorporé avec peu de liquidités disponibles. Un diagnostic grave pourrait créer un choc financier rapide.",
      taskTitle: "Valider les liquidités maladies graves du travailleur autonome",
    },
    {
      type: "CI_LOW_EMERGENCY_FUND",
      active: emergencyMonths > 0 && emergencyMonths < settings.criticalIllness.minimumEmergencyMonths,
      severity: "MEDIUM" as const,
      title: "Fonds d’urgence faible",
      description: "Le fonds d’urgence couvre moins de trois mois de dépenses estimées. Le besoin de liquidités en cas de maladie grave doit être revu.",
      taskTitle: "Revoir le fonds d’urgence maladies graves",
    },
    {
      type: "CI_DISABILITY_MISSING",
      active: disabilityCoverage === 0,
      severity: "MEDIUM" as const,
      title: "Assurance invalidité à comparer",
      description: "Aucune protection invalidité n’est disponible dans les données utilisées. Le conseiller doit comparer le rôle de l’invalidité et des maladies graves.",
      taskTitle: "Comparer invalidité et maladies graves",
    },
    {
      type: "CI_POLICY_DOCUMENT_REQUIRED",
      active: existingCoverage > 0 && !policyDocumented,
      severity: "HIGH" as const,
      title: "Police maladies graves à obtenir",
      description: "Une protection maladies graves est déclarée, mais aucun document de police ou relevé n’est classé au dossier.",
      taskTitle: "Demander la police maladies graves existante",
    },
    {
      type: "CI_MORTGAGE_ONLY_SCENARIO",
      active: objective.includes("hypoth") || objective.includes("mortgage"),
      severity: "MEDIUM" as const,
      title: "Scénarios maladies graves à comparer",
      description: "L’objectif semble centré sur l’hypothèque. Le conseiller devrait comparer le remboursement de dette avec les besoins de liquidités, soins, revenu temporaire et soutien familial.",
      taskTitle: "Comparer les scénarios maladies graves",
    },
    {
      type: "CI_PROTECTION_GAP",
      active: netGap > 0 && existingCoverage > 0,
      severity: "HIGH" as const,
      title: "Écart maladies graves détecté",
      description: "Le calcul indique un écart entre le besoin estimé et les protections maladies graves connues.",
      taskTitle: "Valider l’écart maladies graves",
    },
  ]

  const managedTypes = alertCandidates.map((candidate) => candidate.type)
  for (const candidate of alertCandidates) {
    const existing = await prisma.complianceAlert.findFirst({
      where: { organizationId, clientId, type: candidate.type, status: { in: ["OPEN", "IN_PROGRESS"] } },
    })
    if (!candidate.active) {
      if (existing) {
        await prisma.complianceAlert.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
        })
      }
      continue
    }

    const alert = existing
      ? await prisma.complianceAlert.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse maladies graves",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })
      : await prisma.complianceAlert.create({
        data: {
          organizationId,
          clientId,
          type: candidate.type,
          severity: candidate.severity,
          status: "OPEN",
          title: candidate.title,
          description: candidate.description,
          actionLabel: "Ouvrir l’analyse maladies graves",
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })

    const taskExists = await prisma.task.findFirst({
      where: { organizationId, clientId, alertId: alert.id, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
      select: { id: true },
    })
    if (!taskExists) {
      await prisma.task.create({
        data: {
          organizationId,
          clientId,
          alertId: alert.id,
          assignedToId: advisorId ?? userId,
          createdById: userId,
          type: "COMPLIANCE",
          priority: candidate.severity === "HIGH" ? "HIGH" : "NORMAL",
          status: "TODO",
          title: candidate.taskTitle,
          description: `${candidate.description} Analyse liée: ${analysisId}.`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isAutomated: true,
        },
      })
    }

    if (!existing) {
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        alertId: alert.id,
        type: "COMPLIANCE_ALERT_CREATED",
        title: candidate.title,
        description: candidate.description,
        source: "AUTOMATION",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysisId,
      })
    }
  }

  await prisma.complianceAlert.updateMany({
    where: {
      organizationId,
      clientId,
      type: { in: managedTypes },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      NOT: { type: { in: alertCandidates.filter((candidate) => candidate.active).map((candidate) => candidate.type) } },
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
  })
}

async function syncBusinessAnalysisAlerts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  inputMap,
  calculation,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  inputMap: AnalysisInputMap
  calculation: InsuranceCalculation
}) {
  const result = calculation.results[0]
  const shareholderCount = inputNumber(inputMap, "shareholderCount")
  const ownershipPercentage = inputNumber(inputMap, "ownershipPercentage")
  const previousShareholderCount = inputNumber(inputMap, "previousShareholderCount")
  const previousOwnershipPercentage = inputNumber(inputMap, "previousOwnershipPercentage")
  const manualOwnershipChange = inputBoolean(inputMap, "shareholdersChangedSinceLastReview")
  const hasShareholdersAgreement = inputBoolean(inputMap, "hasShareholdersAgreement")
  const shareholdersAgreementUpdated = inputBoolean(inputMap, "shareholdersAgreementUpdated")
  const agreementFunded = inputBoolean(inputMap, "agreementFunded")
  const corporateDebt = inputNumber(inputMap, "corporateDebt")
  const personalGuaranteesAmount = inputNumber(inputMap, "personalGuaranteesAmount")
  const keyPersonNeed = inputNumber(result?.calculationDetails as AnalysisInputMap, "keyPersonNeed")
  const existingCorporateCoverage = inputNumber(inputMap, "existingCorporateCoverage")
  const policyOwnedByCorrectEntity = inputBoolean(inputMap, "policyOwnedByCorrectEntity")
  const beneficiaryStructureReviewed = inputBoolean(inputMap, "beneficiaryStructureReviewed")
  const netGap = result?.netNeed ?? 0
  const previousSnapshot = await getPreviousBusinessOwnershipSnapshot({ organizationId, clientId, analysisId })
  const historicalOwnershipChange = Boolean(previousSnapshot && (
    (shareholderCount > 0 && previousSnapshot.shareholderCount > 0 && shareholderCount !== previousSnapshot.shareholderCount)
    || (ownershipPercentage > 0 && previousSnapshot.ownershipPercentage > 0 && Math.abs(ownershipPercentage - previousSnapshot.ownershipPercentage) >= 1)
  ))
  const manualPreviousOwnershipChange = (previousShareholderCount > 0 && shareholderCount > 0 && previousShareholderCount !== shareholderCount)
    || (previousOwnershipPercentage > 0 && ownershipPercentage > 0 && Math.abs(previousOwnershipPercentage - ownershipPercentage) >= 1)
  const ownershipChanged = manualOwnershipChange || manualPreviousOwnershipChange || historicalOwnershipChange

  const alertCandidates = [
    {
      type: "BUSINESS_OWNERSHIP_CHANGED",
      active: ownershipChanged && (!shareholdersAgreementUpdated || !policyOwnedByCorrectEntity || !beneficiaryStructureReviewed),
      severity: "HIGH" as const,
      title: "Actionnariat modifié à revoir",
      description: "Un changement d’actionnariat est détecté ou déclaré. La convention entre actionnaires, les pourcentages, les polices, le titulaire et les bénéficiaires doivent être revus.",
      taskTitle: "Revoir actionnariat, convention et polices",
    },
    {
      type: "BUSINESS_SHAREHOLDER_AGREEMENT_MISSING",
      active: shareholderCount > 1 && !hasShareholdersAgreement,
      severity: "HIGH" as const,
      title: "Convention entre actionnaires manquante",
      description: "L’entreprise semble avoir plusieurs actionnaires, mais aucune convention entre actionnaires n’est confirmée au dossier.",
      taskTitle: "Demander la convention entre actionnaires",
    },
    {
      type: "BUSINESS_AGREEMENT_UNFUNDED",
      active: hasShareholdersAgreement && !agreementFunded,
      severity: "HIGH" as const,
      title: "Convention non financée",
      description: "Une convention entre actionnaires existe, mais son financement par assurance n’est pas confirmé.",
      taskTitle: "Analyser le financement de la convention",
    },
    {
      type: "BUSINESS_DEBT_PERSONAL_GUARANTEE",
      active: corporateDebt > 0 && personalGuaranteesAmount > 0,
      severity: "HIGH" as const,
      title: "Dette commerciale avec garantie personnelle",
      description: "Des dettes commerciales et garanties personnelles sont indiquées. Une protection de dette corporative doit être validée.",
      taskTitle: "Valider la protection des dettes commerciales",
    },
    {
      type: "BUSINESS_KEY_PERSON_RISK",
      active: keyPersonNeed > 0,
      severity: "MEDIUM" as const,
      title: "Besoin personne clé à analyser",
      description: "Le calcul contient un besoin personne clé. Le conseiller doit valider la dépendance au fondateur ou à l’employé clé.",
      taskTitle: "Documenter le besoin personne clé",
    },
    {
      type: "BUSINESS_ENTITY_STRUCTURE_REVIEW",
      active: existingCorporateCoverage > 0 && (!policyOwnedByCorrectEntity || !beneficiaryStructureReviewed),
      severity: "HIGH" as const,
      title: "Structure de police corporative à revoir",
      description: "Une protection corporative existe, mais le titulaire ou le bénéficiaire n’est pas validé.",
      taskTitle: "Revoir titulaire et bénéficiaire corporatifs",
    },
    {
      type: "BUSINESS_PROTECTION_GAP",
      active: netGap > 0 && existingCorporateCoverage > 0,
      severity: "HIGH" as const,
      title: "Écart de protection corporative",
      description: "Le calcul indique un écart entre les besoins corporatifs estimés et les protections connues.",
      taskTitle: "Valider l’écart de protection entreprise",
    },
  ]

  await syncAnalysisAlerts({
    organizationId,
    userId,
    clientId,
    advisorId,
    analysisId,
    actionLabel: "Ouvrir l’analyse entreprise",
    candidates: alertCandidates,
  })
}

async function getPreviousBusinessOwnershipSnapshot({
  organizationId,
  clientId,
  analysisId,
}: {
  organizationId: string
  clientId: string
  analysisId: string
}) {
  const current = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId, clientId },
    select: { createdAt: true },
  })
  if (!current) return null
  const previous = await prisma.insuranceNeedsAnalysis.findFirst({
    where: {
      organizationId,
      clientId,
      analysisType: "BUSINESS",
      status: { not: "ARCHIVED" },
      id: { not: analysisId },
      createdAt: { lt: current.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: { inputs: { select: { inputKey: true, inputValue: true } } },
  })
  if (!previous) return null
  const previousMap = toInputMap(previous.inputs)
  return {
    shareholderCount: inputNumber(previousMap, "shareholderCount"),
    ownershipPercentage: inputNumber(previousMap, "ownershipPercentage"),
  }
}

async function syncReplacementAnalysisArtifacts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  inputMap,
  calculation,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  inputMap: AnalysisInputMap
  calculation: InsuranceCalculation
}) {
  const replacementRequired = inputBoolean(inputMap, "replacementRequired")
  const noticeCompleted = inputBoolean(inputMap, "replacementNoticeCompleted")
  const comparisonExplained = inputBoolean(inputMap, "replacementComparisonExplained")
  const clientAcknowledged = inputBoolean(inputMap, "replacementClientAcknowledged")
  const justification = String(inputMap.replacementJustification ?? "").trim()
  const lostBenefits = String(inputMap.lostBenefits ?? "").trim()
  const newExclusions = String(inputMap.newExclusions ?? "").trim()
  const advantages = String(inputMap.replacementAdvantages ?? "").trim()
  const disadvantages = String(inputMap.replacementDisadvantages ?? "").trim()
  const proposedPremium = inputNumber(inputMap, "proposedPremium")
  const existingPremium = inputNumber(inputMap, "existingPremium")
  const existingPolicyNumber = String(inputMap.existingPolicyNumber ?? "").trim()
  const proposedPolicyNumber = String(inputMap.proposedPolicyNumber ?? "").trim()
  const existingIssueDate = String(inputMap.existingIssueDate ?? "").trim()
  const proposedIssueDate = String(inputMap.proposedIssueDate ?? "").trim()
  const existingRiders = String(inputMap.existingRiders ?? "").trim()
  const proposedRiders = String(inputMap.proposedRiders ?? "").trim()
  const existingPremiumGuarantee = String(inputMap.existingPremiumGuarantee ?? "").trim()
  const proposedPremiumGuarantee = String(inputMap.proposedPremiumGuarantee ?? "").trim()
  const existingContestabilityPeriod = String(inputMap.existingContestabilityPeriod ?? "").trim()
  const proposedContestabilityPeriod = String(inputMap.proposedContestabilityPeriod ?? "").trim()
  const existingFeesOrSurrenderCharges = String(inputMap.existingFeesOrSurrenderCharges ?? "").trim()
  const proposedFeesOrCharges = String(inputMap.proposedFeesOrCharges ?? "").trim()
  const existingOwner = String(inputMap.existingOwner ?? "").trim()
  const proposedOwner = String(inputMap.proposedOwner ?? "").trim()
  const existingBeneficiaries = String(inputMap.existingBeneficiaries ?? "").trim()
  const proposedBeneficiaries = String(inputMap.proposedBeneficiaries ?? "").trim()
  const underwritingRisks = String(inputMap.underwritingRisks ?? "").trim()

  await prisma.insuranceReplacementComparison.deleteMany({ where: { analysisId } })
  await prisma.insuranceReplacementComparison.create({
    data: {
      analysisId,
      replacementRequired,
      advantages: { value: advantages || null },
      disadvantages: { value: disadvantages || null },
      lostBenefits: { value: lostBenefits || null },
      newExclusions: { value: newExclusions || null },
      justification: justification || null,
      existingPolicyId: existingPolicyNumber || null,
      proposedPolicyId: proposedPolicyNumber || null,
      noticeDocumentId: inputMap.replacementNoticeDocumentId ? String(inputMap.replacementNoticeDocumentId) : null,
      clientAcknowledgedAt: clientAcknowledged ? new Date() : null,
    },
  })

  const alertCandidates = [
    {
      type: "REPLACEMENT_NOTICE_REQUIRED",
      active: replacementRequired && !noticeCompleted,
      severity: "CRITICAL" as const,
      title: "Préavis de remplacement requis",
      description: "Un remplacement potentiel est détecté et le préavis de remplacement n’est pas complété. La recommandation finale doit rester bloquée.",
      taskTitle: "Compléter le préavis de remplacement",
    },
    {
      type: "REPLACEMENT_JUSTIFICATION_REQUIRED",
      active: replacementRequired && !justification,
      severity: "CRITICAL" as const,
      title: "Justification du remplacement manquante",
      description: "La preuve que le remplacement est dans l’intérêt du client n’est pas documentée.",
      taskTitle: "Rédiger la justification du remplacement",
    },
    {
      type: "REPLACEMENT_COMPARISON_NOT_EXPLAINED",
      active: replacementRequired && !comparisonExplained,
      severity: "HIGH" as const,
      title: "Comparaison non expliquée au client",
      description: "La comparaison ancien contrat / nouveau contrat doit être expliquée et conservée au dossier.",
      taskTitle: "Expliquer la comparaison au client",
    },
    {
      type: "REPLACEMENT_LOST_BENEFITS_REVIEW",
      active: replacementRequired && (!lostBenefits || !newExclusions),
      severity: "HIGH" as const,
      title: "Garanties perdues ou exclusions à documenter",
      description: "Les garanties perdues, exclusions, restrictions ou nouvelle période de contestabilité doivent être documentées.",
      taskTitle: "Documenter garanties perdues et exclusions",
    },
    {
      type: "REPLACEMENT_CONTESTABILITY_REVIEW",
      active: replacementRequired && (!existingContestabilityPeriod || !proposedContestabilityPeriod || !underwritingRisks),
      severity: "HIGH" as const,
      title: "Contestabilité et souscription à documenter",
      description: "La nouvelle période de contestabilité et les risques de souscription doivent être explicitement comparés avant la recommandation.",
      taskTitle: "Documenter contestabilité et souscription",
    },
    {
      type: "REPLACEMENT_OWNER_BENEFICIARY_REVIEW",
      active: replacementRequired && (!existingOwner || !proposedOwner || !existingBeneficiaries || !proposedBeneficiaries),
      severity: "HIGH" as const,
      title: "Titulaire et bénéficiaires à valider",
      description: "Le titulaire et les bénéficiaires du contrat actuel et du contrat proposé doivent être comparés et confirmés.",
      taskTitle: "Valider titulaire et bénéficiaires",
    },
    {
      type: "REPLACEMENT_FEES_LOSSES_REVIEW",
      active: replacementRequired && (!existingFeesOrSurrenderCharges || !proposedFeesOrCharges),
      severity: "HIGH" as const,
      title: "Frais, pertes ou charges à documenter",
      description: "Les frais de rachat, pertes potentielles et charges du nouveau contrat doivent être documentés.",
      taskTitle: "Documenter frais et pertes",
    },
    {
      type: "REPLACEMENT_RIDERS_REVIEW",
      active: replacementRequired && (!existingRiders || !proposedRiders || !existingPremiumGuarantee || !proposedPremiumGuarantee || !existingIssueDate || !proposedIssueDate),
      severity: "MEDIUM" as const,
      title: "Avenants, garanties et dates à compléter",
      description: "Les avenants, garanties de prime et dates d’émission sont nécessaires pour une comparaison complète.",
      taskTitle: "Compléter les détails contractuels",
    },
    {
      type: "REPLACEMENT_PREMIUM_INCREASE",
      active: proposedPremium > existingPremium && existingPremium > 0,
      severity: "MEDIUM" as const,
      title: "Prime proposée plus élevée",
      description: "La nouvelle prime est plus élevée que la prime actuelle. La valeur du remplacement doit être justifiée clairement.",
      taskTitle: "Justifier l’augmentation de prime",
    },
    {
      type: "REPLACEMENT_CLIENT_ACK_REQUIRED",
      active: replacementRequired && !clientAcknowledged,
      severity: "HIGH" as const,
      title: "Reconnaissance client requise",
      description: "Le client n’a pas encore reconnu la comparaison et les conséquences du remplacement.",
      taskTitle: "Obtenir la reconnaissance client",
    },
  ]

  await syncAnalysisAlerts({
    organizationId,
    userId,
    clientId,
    advisorId,
    analysisId,
    actionLabel: "Ouvrir l’analyse de remplacement",
    candidates: alertCandidates,
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId,
      entityType: "InsuranceReplacementComparison",
      entityId: analysisId,
      action: "REPLACEMENT_COMPARISON_UPDATED",
      newValue: { replacementRequired, noticeCompleted, comparisonExplained, clientAcknowledged, missingData: calculation.missingData },
    },
  })
}

async function syncAnalysisAlerts({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  actionLabel,
  candidates,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  actionLabel: string
  candidates: Array<{ type: string; active: boolean; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; title: string; description: string; taskTitle: string }>
}) {
  const managedTypes = candidates.map((candidate) => candidate.type)
  for (const candidate of candidates) {
    const existing = await prisma.complianceAlert.findFirst({
      where: { organizationId, clientId, type: candidate.type, status: { in: ["OPEN", "IN_PROGRESS"] } },
    })
    if (!candidate.active) {
      if (existing) {
        await prisma.complianceAlert.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
        })
      }
      continue
    }

    const alert = existing
      ? await prisma.complianceAlert.update({
        where: { id: existing.id },
        data: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          actionLabel,
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })
      : await prisma.complianceAlert.create({
        data: {
          organizationId,
          clientId,
          type: candidate.type,
          severity: candidate.severity,
          status: "OPEN",
          title: candidate.title,
          description: candidate.description,
          actionLabel,
          actionUrl: `/clients/${clientId}?tab=needs&analysisId=${analysisId}`,
        },
      })

    const taskExists = await prisma.task.findFirst({
      where: { organizationId, clientId, alertId: alert.id, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
      select: { id: true },
    })
    if (!taskExists) {
      await prisma.task.create({
        data: {
          organizationId,
          clientId,
          alertId: alert.id,
          assignedToId: advisorId ?? userId,
          createdById: userId,
          type: "COMPLIANCE",
          priority: candidate.severity === "CRITICAL" || candidate.severity === "HIGH" ? "HIGH" : "NORMAL",
          status: "TODO",
          title: candidate.taskTitle,
          description: `${candidate.description} Analyse liée: ${analysisId}.`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isAutomated: true,
        },
      })
    }

    if (!existing) {
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        alertId: alert.id,
        type: "COMPLIANCE_ALERT_CREATED",
        title: candidate.title,
        description: candidate.description,
        source: "AUTOMATION",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysisId,
      })
    }
  }

  await prisma.complianceAlert.updateMany({
    where: {
      organizationId,
      clientId,
      type: { in: managedTypes },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      NOT: { type: { in: candidates.filter((candidate) => candidate.active).map((candidate) => candidate.type) } },
    },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
  })
}

export async function getInsuranceNeedsAnalysis({ organizationId, analysisId }: { organizationId: string; analysisId: string }) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: analysisInclude,
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  return analysis
}

type InsuranceNeedsSmartAction = {
  label: string
  reason: string
  priority?: "LOW" | "MEDIUM" | "HIGH"
}

type InsuranceNeedsDocumentSuggestion = {
  name: string
  reason: string
  priority?: "LOW" | "MEDIUM" | "HIGH"
}

function parseInsuranceNeedsAiSummary(value: string | null): {
  nextBestActions?: InsuranceNeedsSmartAction[]
  documentsToRequest?: InsuranceNeedsDocumentSuggestion[]
} {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as {
      nextBestActions?: InsuranceNeedsSmartAction[]
      documentsToRequest?: InsuranceNeedsDocumentSuggestion[]
    }
    return {
      nextBestActions: Array.isArray(parsed.nextBestActions) ? parsed.nextBestActions : [],
      documentsToRequest: Array.isArray(parsed.documentsToRequest) ? parsed.documentsToRequest : [],
    }
  } catch {
    return {}
  }
}

function smartPriority(priority?: "LOW" | "MEDIUM" | "HIGH") {
  if (priority === "HIGH") return "HIGH" as const
  if (priority === "LOW") return "LOW" as const
  return "NORMAL" as const
}

function smartDueDate(priority?: "LOW" | "MEDIUM" | "HIGH") {
  const date = new Date()
  date.setDate(date.getDate() + (priority === "HIGH" ? 1 : priority === "LOW" ? 7 : 3))
  return date
}

function inferDocumentType(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes("police") || normalized.includes("contrat") || normalized.includes("assurance")) return "POLICY_DOCUMENT" as const
  if (normalized.includes("identité") || normalized.includes("identite") || normalized.includes("permis") || normalized.includes("passeport")) return "GOVERNMENT_ID" as const
  if (normalized.includes("adresse")) return "PROOF_OF_ADDRESS" as const
  if (normalized.includes("consent")) return "CONSENT_FORM" as const
  if (normalized.includes("bénéficiaire") || normalized.includes("beneficiaire")) return "BENEFICIARY_FORM" as const
  if (normalized.includes("relevé") || normalized.includes("releve")) return "INSURANCE_STATEMENT" as const
  return "OTHER" as const
}

async function createSmartTaskIfMissing({
  organizationId,
  userId,
  clientId,
  advisorId,
  analysisId,
  title,
  description,
  type,
  priority,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId: string | null
  analysisId: string
  title: string
  description: string
  type: "COMPLIANCE" | "DOCUMENT"
  priority?: "LOW" | "MEDIUM" | "HIGH"
}) {
  const existing = await prisma.task.findFirst({
    where: {
      organizationId,
      clientId,
      title,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })
  if (existing) return { created: false, taskId: existing.id }

  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId,
      assignedToId: advisorId ?? userId,
      createdById: userId,
      type,
      priority: smartPriority(priority),
      status: "TODO",
      title,
      description: `${description}\n\nSource: aide intelligente de l’analyse des besoins ${analysisId}. Validation humaine obligatoire.`,
      dueDate: smartDueDate(priority),
      isAutomated: true,
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    taskId: task.id,
    type: "TASK_CREATED",
    title: "Tâche créée depuis l’aide intelligente",
    description: task.title,
    source: "AI",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysisId,
    metadata: { smartAction: true, priority },
  })
  return { created: true, taskId: task.id }
}

export async function applyInsuranceNeedsSmartActions({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    select: {
      id: true,
      clientId: true,
      advisorId: true,
      analysisType: true,
      aiSummary: true,
      summary: true,
    },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  if (!analysis.aiSummary) throw new Error("AI_SUMMARY_MISSING")
  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId, includeAi: true })

  const ai = parseInsuranceNeedsAiSummary(analysis.aiSummary)
  const actions = (ai.nextBestActions ?? []).slice(0, 6)
  const documents = (ai.documentsToRequest ?? []).slice(0, 8)
  if (!actions.length && !documents.length) throw new Error("AI_ACTIONS_EMPTY")

  const createdTasks: string[] = []
  const reusedTasks: string[] = []

  for (const action of actions) {
    const label = action.label?.trim()
    if (!label) continue
    const result = await createSmartTaskIfMissing({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      title: `Analyse ${analysisTypeLabels[analysis.analysisType]} - ${label}`,
      description: action.reason || "Action proposée par l’aide intelligente. Validation humaine obligatoire.",
      type: "COMPLIANCE",
      priority: action.priority,
    })
    ;(result.created ? createdTasks : reusedTasks).push(result.taskId)
  }

  for (const document of documents) {
    const name = document.name?.trim()
    if (!name) continue
    const result = await createSmartTaskIfMissing({
      organizationId,
      userId,
      clientId: analysis.clientId,
      advisorId: analysis.advisorId,
      analysisId,
      title: `Demander document - ${name}`,
      description: document.reason || "Document proposé par l’aide intelligente. Le conseiller doit valider avant de contacter le client.",
      type: "DOCUMENT",
      priority: document.priority,
    })
    ;(result.created ? createdTasks : reusedTasks).push(result.taskId)
  }

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: analysis.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "AI_SMART_ACTIONS_APPLIED",
      newValue: { createdTasks, reusedTasks },
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    type: "AI_CALL_TASKS_CREATED",
    title: "Actions intelligentes préparées",
    description: `${createdTasks.length} tâche(s) créée(s) depuis l’aide intelligente. ${reusedTasks.length} déjà existante(s).`,
    source: "AI",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: { createdTasks, reusedTasks },
  })

  return {
    created: createdTasks.length,
    reused: reusedTasks.length,
    createdTasks,
    reusedTasks,
    analysis: await getInsuranceNeedsAnalysis({ organizationId, analysisId }),
  }
}

export async function sendInsuranceNeedsSmartDocumentRequests({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const [user, analysis] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: { id: userId, organizationId },
      select: { id: true, organizationId: true, role: true, name: true, email: true },
    }),
    prisma.insuranceNeedsAnalysis.findFirst({
      where: { id: analysisId, organizationId },
      select: { id: true, clientId: true, analysisType: true, aiSummary: true },
    }),
  ])
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  if (!analysis.aiSummary) throw new Error("AI_SUMMARY_MISSING")
  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId, includeAi: true, includeDocuments: true })

  const suggestions = (parseInsuranceNeedsAiSummary(analysis.aiSummary).documentsToRequest ?? [])
    .filter((document) => document.name?.trim())
    .slice(0, 8)
  if (!suggestions.length) throw new Error("AI_DOCUMENTS_EMPTY")

  const dueDate = smartDueDate(suggestions.some((document) => document.priority === "HIGH") ? "HIGH" : "MEDIUM")
  const result = await requestClientDocuments({
    user,
    clientId: analysis.clientId,
    data: {
      channel: "AUTO",
      dueDate,
      message: [
        "Bonjour,",
        "Afin de compléter l’analyse de votre dossier, pourriez-vous transmettre les documents indiqués dans votre espace client sécurisé?",
        "Cette demande est administrative et sera révisée par votre conseiller.",
      ].join("\n"),
      documents: suggestions.map((document) => ({
        type: inferDocumentType(document.name),
        name: document.name,
        description: `${document.reason} Source: aide intelligente FinAssuro. Validation humaine obligatoire.`,
      })),
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: analysis.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "AI_DOCUMENT_REQUESTS_SENT",
      newValue: {
        documentIds: result.documents.map((document) => document.id),
        documentNames: result.documents.map((document) => document.name),
        channel: result.delivery?.channel ?? null,
      },
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    type: "DOCUMENT_STATUS_CHANGED",
    title: "Documents IA demandés au client",
    description: `${result.documents.length} document(s) demandé(s) depuis l’aide intelligente après validation conseiller.`,
    source: "AI",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: {
      documentIds: result.documents.map((document) => document.id),
      channel: result.delivery?.channel ?? null,
    },
  })

  return {
    requested: result.documents.length,
    documentIds: result.documents.map((document) => document.id),
    delivery: result.delivery,
    analysis: await getInsuranceNeedsAnalysis({ organizationId, analysisId }),
  }
}

export async function updateInsuranceNeedsInput({
  organizationId,
  userId,
  analysisId,
  inputKey,
  value,
}: {
  organizationId: string
  userId: string
  analysisId: string
  inputKey: string
  value: unknown
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    select: { id: true, clientId: true, signedAt: true, reportDocument: { select: { status: true } } },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId, includeDocuments: true })
  assertAnalysisEditable(analysis)
  await prisma.insuranceAnalysisInput.updateMany({
    where: { analysisId, inputKey },
    data: { inputValue: { value: toJsonValue(value) }, source: "ADVISOR", isVerified: value !== null && value !== undefined && value !== "" },
  })
  await prisma.auditLog.create({
    data: { organizationId, userId, clientId: analysis.clientId, entityType: "InsuranceNeedsAnalysis", entityId: analysisId, action: "INPUT_UPDATED", fieldName: inputKey, newValue: { value: toJsonValue(value) } },
  })
  return getInsuranceNeedsAnalysis({ organizationId, analysisId })
}

export async function linkInsuranceNeedsAnalysisToOpportunity({
  organizationId,
  userId,
  analysisId,
  opportunityId,
}: {
  organizationId: string
  userId: string
  analysisId: string
  opportunityId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId, status: { not: "ARCHIVED" } },
    select: { id: true, clientId: true, analysisType: true, opportunityId: true },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  if (analysis.opportunityId && analysis.opportunityId !== opportunityId) throw new Error("ANALYSIS_ALREADY_LINKED")

  const opportunity = await prisma.financialProduct.findFirst({
    where: {
      id: opportunityId,
      organizationId,
      clientId: analysis.clientId,
      category: "INSURANCE",
      status: { not: "ARCHIVED" },
    },
    select: { id: true, type: true, productName: true, company: true },
  })
  if (!opportunity) throw new Error("OPPORTUNITY_NOT_FOUND")
  if (!productTypesForAnalysisType(analysis.analysisType).includes(opportunity.type)) throw new Error("OPPORTUNITY_TYPE_INCOMPATIBLE")

  if (analysis.opportunityId !== opportunityId) {
    await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: { opportunityId },
    })
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        clientId: analysis.clientId,
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        action: "OPPORTUNITY_LINKED",
        newValue: { opportunityId, productType: opportunity.type },
      },
    })
    await createCrmActivity({
      organizationId,
      userId,
      clientId: analysis.clientId,
      productId: opportunity.id,
      type: "PRODUCT_UPDATED",
      title: "Analyse liée à l’opportunité",
      description: `${analysisTypeLabels[analysis.analysisType]} liée à ${opportunity.productName ?? opportunity.company ?? "l’opportunité d’assurance"}.`,
      source: "USER",
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      metadata: { analysisId: analysis.id, opportunityId, productType: opportunity.type },
    })
  }

  await syncOpportunityFromAnalysis({ organizationId, userId, analysisId: analysis.id })
  return getInsuranceNeedsAnalysis({ organizationId, analysisId: analysis.id })
}

export async function generateInsuranceNeedsReport({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: { client: true, advisor: true, reportDocument: true, results: true, recommendations: true, inputs: true, assumptions: true },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  assertAnalysisEditable(analysis)
  if (analysis.reportDocument?.status === "REQUESTED") throw new Error("REPORT_ALREADY_SENT")
  if (analysis.reportDocument?.status === "VALIDATED" || analysis.clientConfirmedAt || analysis.signedAt) throw new Error("REPORT_ALREADY_CONFIRMED")
  if (analysis.status === "MISSING_DATA") throw new Error("ANALYSIS_MISSING_DATA")
  const label = analysisTypeLabels[analysis.analysisType]
  const clientName = getClientName(analysis.client)
  const recommendation = analysis.recommendations[0]
  const result = analysis.results[0]
  if (!recommendation || !result) throw new Error("ANALYSIS_NOT_CALCULATED")
  const nextAnalysisVersion = analysis.reportDocumentId ? analysis.analysisVersion + 1 : analysis.analysisVersion

  const alternatives = Array.isArray(recommendation.alternativesConsidered)
    ? recommendation.alternativesConsidered as Array<{ label?: string; amount?: number; note?: string }>
    : []
  const replacementLines = analysis.analysisType === "REPLACEMENT"
    ? section("Comparaison de remplacement", [
      "Tableau ancien contrat / nouveau contrat:",
      `Assureur: ${inputValue(analysis.inputs, "existingCarrier") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedCarrier") ?? "A confirmer"}`,
      `Produit: ${inputValue(analysis.inputs, "existingProductType") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedProductType") ?? "A confirmer"}`,
      `Numero de police: ${inputValue(analysis.inputs, "existingPolicyNumber") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedPolicyNumber") ?? "A confirmer"}`,
      `Montant assure: ${formatCurrency(Number(inputValue(analysis.inputs, "existingCoverage") ?? 0))} | ${formatCurrency(Number(inputValue(analysis.inputs, "proposedCoverage") ?? 0))}`,
      `Prime: ${formatCurrency(Number(inputValue(analysis.inputs, "existingPremium") ?? 0))} | ${formatCurrency(Number(inputValue(analysis.inputs, "proposedPremium") ?? 0))}`,
      `Date d'emission: ${inputValue(analysis.inputs, "existingIssueDate") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedIssueDate") ?? "A confirmer"}`,
      `Duree / structure: ${inputValue(analysis.inputs, "existingTerm") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedTerm") ?? "A confirmer"}`,
      `Avenants: ${inputValue(analysis.inputs, "existingRiders") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedRiders") ?? "A confirmer"}`,
      `Garantie de prime: ${inputValue(analysis.inputs, "existingPremiumGuarantee") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedPremiumGuarantee") ?? "A confirmer"}`,
      `Contestabilite: ${inputValue(analysis.inputs, "existingContestabilityPeriod") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedContestabilityPeriod") ?? "A confirmer"}`,
      `Frais / pertes / charges: ${inputValue(analysis.inputs, "existingFeesOrSurrenderCharges") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedFeesOrCharges") ?? "A confirmer"}`,
      `Titulaire: ${inputValue(analysis.inputs, "existingOwner") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedOwner") ?? "A confirmer"}`,
      `Beneficiaires: ${inputValue(analysis.inputs, "existingBeneficiaries") ?? "A confirmer"} | ${inputValue(analysis.inputs, "proposedBeneficiaries") ?? "A confirmer"}`,
      `Exclusions: ${inputValue(analysis.inputs, "existingExclusions") ?? "A confirmer"} | ${inputValue(analysis.inputs, "newExclusions") ?? "A confirmer"}`,
      "",
      "Consequences et justification:",
      `Garanties ou benefices perdus: ${inputValue(analysis.inputs, "lostBenefits") ?? "A confirmer"}`,
      `Valeur de rachat abandonnee: ${formatCurrency(Number(inputValue(analysis.inputs, "cashValueSurrendered") ?? 0))}`,
      `Risques de souscription: ${inputValue(analysis.inputs, "underwritingRisks") ?? "A confirmer"}`,
      `Avantages documentes: ${inputValue(analysis.inputs, "replacementAdvantages") ?? "A confirmer"}`,
      `Desavantages documentes: ${inputValue(analysis.inputs, "replacementDisadvantages") ?? "A confirmer"}`,
      `Justification: ${inputValue(analysis.inputs, "replacementJustification") ?? "A confirmer"}`,
      `Preavis complete: ${inputValue(analysis.inputs, "replacementNoticeCompleted") ? "Oui" : "Non"}`,
      `Comparaison expliquee au client: ${inputValue(analysis.inputs, "replacementComparisonExplained") ? "Oui" : "Non"}`,
      `Reconnaissance client: ${inputValue(analysis.inputs, "replacementClientAcknowledged") ? "Oui" : "Non"}`,
    ])
    : []

  const reportText = [
    "FINASSURO CRM",
    `RAPPORT D'ANALYSE DES BESOINS - ${label.toUpperCase()}`,
    `Document date: ${new Intl.DateTimeFormat("fr-CA").format(new Date())}`,
    `Version analyse: v${nextAnalysisVersion}`,
    `Identifiant analyse: ${analysis.id}`,
    ...section("Resume executif", [
      `Type d'analyse: ${label}`,
      `Statut conseiller: ${statusLabelsForReport(analysis.status)}`,
      `Besoin net estime: ${formatCurrency(result.netNeed)}`,
      `Montant de travail recommande: ${formatCurrency(recommendation.recommendedAmount)}`,
      `Ce document est prepare pour validation conseiller et preuve au dossier. Il ne remplace pas la presentation professionnelle au client.`,
    ]),
    ...section("Identification", [
      `Client: ${clientName}`,
      `Conseiller: ${analysis.advisor?.name ?? "A confirmer"}`,
      `Objectif: ${analysis.objective ?? "A confirmer avec le client."}`,
      `Source profil client: ${analysis.sourceKycSnapshotId ? `Version ${analysis.sourceKycSnapshotId}` : "Profil client courant"}`,
    ]),
    ...section("Donnees utilisees", [
      formatInputLine(analysis.inputs, "annualIncome"),
      formatInputLine(analysis.inputs, "monthlyGrossIncome"),
      formatInputLine(analysis.inputs, "clientAge"),
      formatInputLine(analysis.inputs, "spouseIncome"),
      formatInputLine(analysis.inputs, "monthlyNetIncome"),
      formatInputLine(analysis.inputs, "monthlyExpenses"),
      formatInputLine(analysis.inputs, "housingPayment"),
      formatInputLine(analysis.inputs, "monthlyDebtPayments"),
      formatInputLine(analysis.inputs, "familyStatus"),
      formatInputLine(analysis.inputs, "childrenCount"),
      formatInputLine(analysis.inputs, "dependentsCount"),
      formatInputLine(analysis.inputs, "childrenAges"),
      formatInputLine(analysis.inputs, "mortgageBalance"),
      formatInputLine(analysis.inputs, "liabilities"),
      formatInputLine(analysis.inputs, "liquidAssets"),
      formatInputLine(analysis.inputs, "existingPersonalLifeCoverage"),
      formatInputLine(analysis.inputs, "groupLifeCoverage"),
      formatInputLine(analysis.inputs, "existingIndividualDisabilityBenefit"),
      formatInputLine(analysis.inputs, "groupDisabilityBenefit"),
      formatInputLine(analysis.inputs, "groupCoveragePercentage"),
      formatInputLine(analysis.inputs, "groupBenefitTaxable"),
      formatInputLine(analysis.inputs, "waitingPeriodDays"),
      formatInputLine(analysis.inputs, "benefitDurationMonths"),
      formatInputLine(analysis.inputs, "businessOverhead"),
      formatInputLine(analysis.inputs, "emergencyFundMonths"),
      formatInputLine(analysis.inputs, "existingCriticalIllnessCoverage"),
      formatInputLine(analysis.inputs, "criticalIllnessPolicyDocumented"),
      formatInputLine(analysis.inputs, "disabilityCoverageAvailable"),
      formatInputLine(analysis.inputs, "mortgageProtectionGoal"),
      formatInputLine(analysis.inputs, "medicalLiquidityNeed"),
      formatInputLine(analysis.inputs, "homeAdaptationNeed"),
      formatInputLine(analysis.inputs, "familySupportNeed"),
      formatInputLine(analysis.inputs, "criticalIllnessObjective"),
      formatInputLine(analysis.inputs, "beneficiariesConfirmed"),
      formatInputLine(analysis.inputs, "policyDocumented"),
      formatInputLine(analysis.inputs, "riskProfile"),
      formatInputLine(analysis.inputs, "primaryGoal"),
      formatInputLine(analysis.inputs, "estateLiquidityNeed"),
      formatInputLine(analysis.inputs, "legacyGoal"),
      formatInputLine(analysis.inputs, "businessName"),
      formatInputLine(analysis.inputs, "businessType"),
      formatInputLine(analysis.inputs, "shareholderCount"),
      formatInputLine(analysis.inputs, "previousShareholderCount"),
      formatInputLine(analysis.inputs, "previousOwnershipPercentage"),
      formatInputLine(analysis.inputs, "shareholdersChangedSinceLastReview"),
      formatInputLine(analysis.inputs, "hasShareholdersAgreement"),
      formatInputLine(analysis.inputs, "shareholdersAgreementUpdated"),
      formatInputLine(analysis.inputs, "agreementFunded"),
      formatInputLine(analysis.inputs, "businessValue"),
      formatInputLine(analysis.inputs, "ownershipPercentage"),
      formatInputLine(analysis.inputs, "keyPersonRevenueImpact"),
      formatInputLine(analysis.inputs, "keyPersonReplacementCost"),
      formatInputLine(analysis.inputs, "keyPersonTransitionCost"),
      formatInputLine(analysis.inputs, "corporateDebt"),
      formatInputLine(analysis.inputs, "personalGuaranteesAmount"),
      formatInputLine(analysis.inputs, "monthlyOperatingNeed"),
      formatInputLine(analysis.inputs, "existingCorporateCoverage"),
      formatInputLine(analysis.inputs, "ownershipStructureNotes"),
    ]),
    ...section("Hypotheses et calculs", [
      `Besoin brut: ${formatCurrency(result.grossNeed)}`,
      `Protections existantes: ${formatCurrency(result.existingCoverage)}`,
      `Actifs deduits: ${formatCurrency(result.availableAssetsOffset)}`,
      `Besoin net estime: ${formatCurrency(result.netNeed)}`,
      `Ecart de protection: ${formatCurrency(result.gapAmount)}`,
    ]),
    ...section("Options analysees", alternatives.length
      ? alternatives.map((item) => `${item.label ?? "Option"}: ${formatCurrency(item.amount)} - ${item.note ?? "A valider"}`)
      : ["Options a documenter avec le conseiller."]),
    ...section("Recommandation de travail", [
      `Produit / analyse: ${recommendation.recommendedProductType}`,
      `Montant a valider: ${formatCurrency(recommendation.recommendedAmount)}`,
      `Duree / structure: ${recommendation.recommendedTerm ?? "A valider"}`,
      recommendation.reasoning ?? analysis.summary ?? "A completer.",
    ]),
    ...replacementLines,
    ...section("Preuve conformite", [
      `Rapport genere: ${new Intl.DateTimeFormat("fr-CA").format(new Date())}`,
      `Version analyse: v${nextAnalysisVersion}`,
      `Document PDF lie au dossier client: oui`,
      `Signature client: a obtenir avant verrouillage final`,
      `Utilisation pour soumission: seulement apres confirmation client et validation conseiller`,
      `Historique: actions conservees dans l'audit trail du dossier`,
    ]),
    ...section("Remise et limites", [
      "Ce rapport est une base de discussion et de preuve au dossier.",
      "La recommandation finale doit etre validee et presentee par un conseiller autorise.",
      "Le client doit confirmer la reception du rapport dans son espace client.",
      "",
      "Signature client PandaDoc:",
      "[signature:client:client_signature________________]",
      "Date de signature:",
      "[date:client:client_signed_at________]",
    ]),
  ].join("\n")
  const fileName = sanitizeFileName(`rapport-analyse-besoins-${clientName}-${analysis.id}.pdf`)
  const storagePath = `${organizationId}/clients/${analysis.clientId}/analyses/${fileName}`
  const pdfBuffer = createSimplePdf(reportText.split("\n"))
  const bucket = getDocumentsBucket()
  const { error: uploadError } = await getSupabaseServerClient()
    .storage
    .from(bucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })
  if (uploadError) throw new Error(uploadError.message)

  await ensureClientFolderStructure({ organizationId, clientId: analysis.clientId, userId })
  const clientFolder = await prisma.documentFolder.findFirst({
    where: { organizationId, clientId: analysis.clientId, name: "Documents signés", status: "ACTIVE" },
    select: { id: true },
  })

  const document = await prisma.document.create({
    data: {
      organizationId,
      clientId: analysis.clientId,
      uploadedById: userId,
      type: "PROPOSAL",
      status: "RECEIVED",
      visibility: "TEAM",
      folderId: clientFolder?.id,
      name: `Rapport analyse des besoins - ${label}`,
      description: reportText,
      fileName,
      originalFileName: `Rapport analyse des besoins - ${clientName}.pdf`,
      storageBucket: bucket,
      storagePath,
      storageProvider: "SUPABASE",
      mimeType: "application/pdf",
      fileSize: pdfBuffer.byteLength,
      receivedAt: new Date(),
      notes: JSON.stringify({
        review: {
          status: "ADVISOR_REVIEW",
          generatedAt: new Date().toISOString(),
          message: "Rapport préparé pour révision conseiller avant envoi au client.",
        },
      }),
    },
  })
  if (analysis.reportDocumentId) {
    await prisma.document.update({
      where: { id: analysis.reportDocumentId },
      data: {
        status: "ARCHIVED",
        visibility: "TEAM",
        archivedAt: new Date(),
        notes: JSON.stringify({
          ...parseDocumentNotes(analysis.reportDocument?.notes ?? null),
          replacedByDocumentId: document.id,
          archivedReason: "Rapport régénéré avant envoi au client.",
        }),
      },
    })
  }

  const updated = await prisma.insuranceNeedsAnalysis.update({
    where: { id: analysis.id },
    data: {
      reportDocumentId: document.id,
      signatureDocumentId: null,
      signedAt: null,
      deliveredAt: null,
      analysisVersion: nextAnalysisVersion,
      status: "ADVISOR_REVIEW",
    },
    include: analysisInclude,
  })

  await prisma.auditLog.create({
    data: { organizationId, userId, clientId: analysis.clientId, entityType: "InsuranceNeedsAnalysis", entityId: analysis.id, action: "REPORT_GENERATED", newValue: { documentId: document.id, analysisVersion: nextAnalysisVersion } },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    documentId: document.id,
    type: "DOCUMENT_STATUS_CHANGED",
    title: "Rapport d’analyse préparé pour révision",
    description: "Le rapport est prêt côté conseiller et n’est pas encore visible dans l’espace client.",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
  })

  return updated
}

function clientEmail(client: { emailPrimary: string | null; email: string | null; emailSecondary: string | null }) {
  return client.emailPrimary?.trim() || client.email?.trim() || client.emailSecondary?.trim() || null
}

function parseDocumentNotes(notes: string | null) {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { note: notes }
  } catch {
    return { note: notes }
  }
}

export async function sendInsuranceNeedsReportForSignature({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: {
      client: true,
      advisor: true,
      reportDocument: true,
    },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId, includeDocuments: true, includeDelivery: true })
  if (!analysis.reportDocument) throw new Error("REPORT_REQUIRED")
  assertAnalysisEditable(analysis)
  if (analysis.reportDocument.status === "REQUESTED") throw new Error("REPORT_ALREADY_SENT")
  if (analysis.reportDocument.status === "VALIDATED" || analysis.clientConfirmedAt || analysis.signedAt) throw new Error("REPORT_ALREADY_CONFIRMED")
  const email = clientEmail(analysis.client)
  if (!email) throw new Error("CLIENT_EMAIL_REQUIRED")
  if (!analysis.reportDocument.storageBucket || !analysis.reportDocument.storagePath) throw new Error("REPORT_FILE_REQUIRED")

  const { data, error } = await getSupabaseServerClient()
    .storage
    .from(analysis.reportDocument.storageBucket)
    .download(analysis.reportDocument.storagePath)
  if (error || !data) throw new Error(error?.message ?? "REPORT_DOWNLOAD_FAILED")

  const pdfBuffer = Buffer.from(await data.arrayBuffer())
  const clientName = getClientName(analysis.client)
  const label = analysisTypeLabels[analysis.analysisType]
  const documentName = `Signature - ${label} - ${clientName}`
  const created = await createPandaDocDocumentFromPdf({
    name: documentName,
    pdfBuffer,
    fileName: analysis.reportDocument.fileName ?? `rapport-${analysis.id}.pdf`,
    recipient: {
      email,
      firstName: analysis.client.firstName,
      lastName: analysis.client.lastName,
      role: "client",
    },
    metadata: {
      organizationId,
      clientId: analysis.clientId,
      analysisId: analysis.id,
      reportDocumentId: analysis.reportDocument.id,
    },
  })
  const draft = await waitForPandaDocDraft(created.id)
  if (draft.status !== "document.draft") throw new Error(`PANDADOC_NOT_READY:${draft.status ?? "unknown"}`)
  const sent = await sendPandaDocDocument(created.id, {
    subject: `Signature requise - ${label}`,
    message: `Bonjour ${analysis.client.firstName},\n\nVotre conseiller vous transmet le rapport ${label} pour signature électronique sécurisée.\n\nMerci.`,
  })
  const pandaDocStatus = sent.status ?? "document.sent"
  const sentAt = new Date()
  const pandaDocProof = {
    provider: "PANDADOC",
    documentId: created.id,
    status: pandaDocStatus,
    sentAt: sentAt.toISOString(),
    recipientEmail: email,
  }

  const updatedDocument = await prisma.document.update({
    where: { id: analysis.reportDocument.id },
    data: {
      status: "REQUESTED",
      visibility: "CLIENT_VISIBLE",
      requestedAt: new Date(),
      notes: JSON.stringify({ ...parseDocumentNotes(analysis.reportDocument.notes), pandaDoc: pandaDocProof }),
    },
  })
  const updatedAnalysis = await prisma.insuranceNeedsAnalysis.update({
    where: { id: analysis.id },
    data: {
      status: "WAITING_CLIENT",
      deliveredAt: sentAt,
      signatureDocumentId: analysis.reportDocument.id,
    },
    include: analysisInclude,
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: analysis.clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysis.id,
      action: "PANDADOC_SIGNATURE_SENT",
      newValue: pandaDocProof,
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    documentId: updatedDocument.id,
    type: "EMAIL_SENT",
    title: "Rapport envoyé à signature PandaDoc",
    description: `${label} envoyé à ${email}.`,
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: pandaDocProof,
  })

  return updatedAnalysis
}

export async function lockInsuranceNeedsAnalysis({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId: string
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    include: { reportDocument: true },
  })
  if (!analysis) throw new Error("ANALYSIS_NOT_FOUND")
  await assertInsuranceNeedsPurposeConsents({ organizationId, clientId: analysis.clientId })
  if (!analysis.reportDocumentId) throw new Error("REPORT_REQUIRED")
  if (!analysis.clientConfirmedAt) throw new Error("CLIENT_CONFIRMATION_REQUIRED")
  const updated = await prisma.insuranceNeedsAnalysis.update({
    where: { id: analysisId },
    data: { status: "COMPLETED", advisorValidatedAt: new Date(), usedForRecommendation: true, lockedAt: new Date(), deliveredAt: analysis.deliveredAt ?? analysis.clientConfirmedAt },
    include: analysisInclude,
  })
  await prisma.auditLog.create({
    data: { organizationId, userId, clientId: analysis.clientId, entityType: "InsuranceNeedsAnalysis", entityId: analysis.id, action: "LOCKED", newValue: { status: "COMPLETED" } },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    type: "RECOMMENDATION_COMPLETED",
    title: "Analyse des besoins verrouillée",
    description: "Version finale utilisable pour recommandation.",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
  })
  await syncOpportunityFromAnalysis({ organizationId, userId, analysisId })
  return updated
}
