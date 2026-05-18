import { Prisma, type ProductRecommendation } from "@prisma/client"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { createAuditLog } from "@/lib/compliance/audit"
import { ensureKycVersionForRecommendation } from "@/lib/compliance/kyc-advanced"
import { assertKycReadyForRecommendation, evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { createCrmActivity } from "@/lib/crm-events"
import { sanitizeFileName } from "@/lib/documents/file-validation"
import { createPandaDocDocumentFromPdf, sendPandaDocDocument, waitForPandaDocDraft } from "@/lib/pandadoc/client"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"

type JsonRecord = Record<string, unknown>

function toJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

function clientEmail(client: { emailPrimary?: string | null; email?: string | null; emailSecondary?: string | null }) {
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

function formatMoney(value?: number | null) {
  if (typeof value !== "number") return "Non défini"
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
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
  const contentLines = lines.slice(0, 82).map((line) => `(${pdfEscape(line).slice(0, 112)}) Tj T*`).join("\n")
  const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${contentLines}\nET`
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += object
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

function section(title: string, lines: Array<string | null | undefined>) {
  return ["", title.toUpperCase(), ...lines.filter(Boolean).map(String)]
}

async function recommendationWithContext(id: string, organizationId: string) {
  return prisma.productRecommendation.findFirst({
    where: { id, organizationId },
    include: {
      client: {
        include: {
          kycProfile: true,
          investmentProfile: true,
          financialGoalItems: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
          products: true,
          documents: true,
          insuranceNeedsAnalyses: { include: { results: true, recommendations: true }, orderBy: { updatedAt: "desc" }, take: 4 },
        },
      },
      advisor: true,
      relatedProduct: true,
      sourceKycVersion: true,
      options: { orderBy: { createdAt: "asc" } },
      documents: { include: { document: true }, orderBy: { createdAt: "asc" } },
      risks: { orderBy: { createdAt: "asc" } },
      versions: { orderBy: { versionNumber: "desc" } },
    },
  })
}

function selectedAnalysis(recommendation: NonNullable<Awaited<ReturnType<typeof recommendationWithContext>>>) {
  const metadata = asRecord(recommendation.metadata)
  const metadataAnalysisId = typeof metadata.analysisId === "string" ? metadata.analysisId : null
  return recommendation.client.insuranceNeedsAnalyses.find((analysis) => analysis.id === recommendation.sourceNeedsAnalysisId || analysis.id === metadataAnalysisId)
    ?? recommendation.client.insuranceNeedsAnalyses[0]
    ?? null
}

function buildOptions(recommendation: NonNullable<Awaited<ReturnType<typeof recommendationWithContext>>>) {
  const productLabel = recommendation.relatedProduct?.productName ?? recommendation.relatedProduct?.type ?? recommendation.title
  if (recommendation.type === "INVESTMENT" || recommendation.type === "INVESTMENT_REVIEW") {
    return [
      { optionName: "Portefeuille conservateur", optionType: "STRATEGY" as const, advantages: ["Moins volatil", "Protection du capital"], limitations: ["Croissance plus faible"], isSelected: false, reasonNotSelected: "Peut limiter l’atteinte de l’objectif si l’horizon est long." },
      { optionName: "Portefeuille équilibré", optionType: "STRATEGY" as const, advantages: ["Compromis croissance/risque", "Cohérent avec un profil modéré"], limitations: ["Volatilité possible"], isSelected: true, notes: "Option à valider avec le profil de risque final." },
      { optionName: "Portefeuille croissance", optionType: "STRATEGY" as const, advantages: ["Potentiel de croissance supérieur"], limitations: ["Volatilité plus élevée"], isSelected: false, reasonNotSelected: "À éviter si la capacité de risque est inférieure à la tolérance." },
      { optionName: "CPG ou équivalent garanti", optionType: "STRATEGY" as const, advantages: ["Capital protégé"], limitations: ["Rendement et flexibilité limités"], isSelected: false, reasonNotSelected: "Non retenu comme stratégie principale si l’objectif exige de la croissance." },
    ]
  }
  return [
    { optionName: "Ne rien changer", optionType: "NO_ACTION" as const, advantages: ["Aucun coût additionnel"], limitations: ["La lacune identifiée demeure"], isSelected: false, reasonNotSelected: "Le dossier indique un besoin ou un risque à traiter." },
    { optionName: `${productLabel} - solution réduite`, optionType: "PRODUCT" as const, advantages: ["Coût initial potentiellement plus bas"], limitations: ["Protection ou portée possiblement insuffisante"], isSelected: false, reasonNotSelected: "Moins cohérent avec le besoin calculé ou l’objectif documenté." },
    { optionName: productLabel, optionType: "PRODUCT" as const, advantages: ["Répond à l’objectif principal", "Compatible avec les données analysées"], limitations: ["Doit être validé par le conseiller et accepté par le client"], isSelected: true, notes: "Option de travail recommandée, non présentée automatiquement comme conseil final." },
    { optionName: "Solution permanente ou plus complète", optionType: "STRATEGY" as const, advantages: ["Protection plus durable ou couverture élargie"], limitations: ["Coût et complexité supérieurs"], isSelected: false, reasonNotSelected: "À considérer seulement si l’objectif et le budget le justifient." },
  ]
}

function buildRisks(recommendation: NonNullable<Awaited<ReturnType<typeof recommendationWithContext>>>) {
  if (recommendation.type === "INVESTMENT" || recommendation.type === "INVESTMENT_REVIEW") {
    return [
      { riskType: "VOLATILITY" as const, description: "La valeur du portefeuille peut fluctuer et une perte est possible.", explainedToClient: false },
      { riskType: "LIQUIDITY" as const, description: "Le besoin de liquidité doit rester compatible avec la stratégie retenue.", explainedToClient: false },
      { riskType: "FEES" as const, description: "Les frais de gestion ou de transaction doivent être expliqués au client.", explainedToClient: false },
      { riskType: "TAX" as const, description: "Les impacts fiscaux varient selon le compte utilisé et la situation du client.", explainedToClient: false },
    ]
  }
  return [
    { riskType: "UNDERWRITING" as const, description: "La protection finale dépend de la tarification et de l’acceptation de l’assureur.", explainedToClient: false },
    { riskType: "EXCLUSIONS" as const, description: "Les exclusions, limitations et conditions du contrat doivent être expliquées.", explainedToClient: false },
    { riskType: "BUDGET" as const, description: "La prime doit rester compatible avec le budget afin de réduire le risque de résiliation.", explainedToClient: false },
    { riskType: "BENEFICIARY" as const, description: "Les bénéficiaires et titulaires doivent être confirmés et revus périodiquement.", explainedToClient: false },
  ]
}

function buildDraftText({
  recommendation,
  analysis,
}: {
  recommendation: NonNullable<Awaited<ReturnType<typeof recommendationWithContext>>>
  analysis: ReturnType<typeof selectedAnalysis>
}) {
  const client = recommendation.client
  const clientName = `${client.firstName} ${client.lastName}`.trim()
  const objective = client.investmentProfile?.primaryObjective ?? client.kycProfile?.primaryObjective ?? client.primaryGoal ?? client.goals ?? "objectif à confirmer"
  const netNeed = analysis?.results[0]?.netNeed ?? null
  const gap = analysis?.results[0]?.gapAmount ?? null
  const solution = recommendation.relatedProduct?.productName ?? recommendation.title
  return [
    `Le conseiller prépare une recommandation documentée pour ${clientName}.`,
    `La recommandation proposée est ${solution}. Elle est liée à l’objectif suivant: ${objective}.`,
    netNeed ? `L’analyse des besoins indique un besoin net estimé de ${formatMoney(Number(netNeed))}.` : null,
    gap ? `L’écart identifié au dossier est de ${formatMoney(Number(gap))}.` : null,
    "Cette recommandation demeure un brouillon de travail. Le conseiller doit réviser les données, les options analysées, les risques, les limites et les documents remis avant toute présentation au client.",
  ].filter(Boolean).join("\n\n")
}

async function writeRecommendationAudit({
  recommendation,
  organizationId,
  userId,
  eventType,
  oldValue,
  newValue,
  metadata,
}: {
  recommendation: Pick<ProductRecommendation, "id" | "clientId">
  organizationId: string
  userId?: string | null
  eventType: string
  oldValue?: unknown
  newValue?: unknown
  metadata?: unknown
}) {
  await prisma.recommendationAuditLog.create({
    data: {
      organizationId,
      recommendationId: recommendation.id,
      clientId: recommendation.clientId,
      userId,
      eventType,
      oldValue: oldValue === undefined ? undefined : toJson(oldValue),
      newValue: newValue === undefined ? undefined : toJson(newValue),
      metadata: metadata === undefined ? undefined : toJson(metadata),
    },
  })
}

async function assertRecommendationPurposeConsents({
  organizationId,
  clientId,
  includeDocuments = false,
  includeDelivery = false,
}: {
  organizationId: string
  clientId: string
  includeDocuments?: boolean
  includeDelivery?: boolean
}) {
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "kyc_use",
    errorCode: "KYC_USE_CONSENT_REQUIRED",
  })
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "insurance_needs_analysis",
    errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED",
  })
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

export async function generateDocumentedRecommendationDraft({
  id,
  organizationId,
  userId,
}: {
  id: string
  organizationId: string
  userId?: string | null
}) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  await assertRecommendationPurposeConsents({ organizationId, clientId: recommendation.clientId })
  assertKycReadyForRecommendation(recommendation.client.kycProfile)
  const kycVersion = recommendation.sourceKycVersion ?? await ensureKycVersionForRecommendation({ organizationId, clientId: recommendation.clientId, userId })
  const analysis = selectedAnalysis(recommendation)
  const kycEvaluation = evaluateKycProfile(recommendation.client.kycProfile)
  const options = buildOptions(recommendation)
  const risks = buildRisks(recommendation)
  const draftText = buildDraftText({ recommendation, analysis })
  const status = !analysis && ["PROTECTION", "LIFE_INSURANCE", "DISABILITY_INSURANCE", "CRITICAL_ILLNESS", "BUSINESS_INSURANCE", "REPLACEMENT"].includes(recommendation.type)
    ? "MISSING_DATA"
    : "ADVISOR_REVIEW"

  const currentSituation = {
    age: recommendation.client.dateOfBirth ? Math.floor((Date.now() - new Date(recommendation.client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
    familyStatus: recommendation.client.familyStatus,
    dependents: recommendation.client.dependentsCount ?? recommendation.client.dependents,
    annualIncome: recommendation.client.annualIncome ?? recommendation.client.approximateIncome,
    netWorth: recommendation.client.netWorth,
    liabilities: recommendation.client.liabilities,
    riskProfile: recommendation.client.investmentProfile?.finalRiskProfile ?? recommendation.client.kycProfile?.riskProfileResult ?? recommendation.client.riskProfile,
  }
  const objectives = {
    primary: recommendation.client.investmentProfile?.primaryObjective ?? recommendation.client.kycProfile?.primaryObjective ?? recommendation.client.primaryGoal,
    goals: recommendation.client.financialGoalItems.map((goal) => ({
      name: goal.goalName,
      type: goal.goalType,
      priority: goal.priority,
      targetAmount: goal.targetAmount,
      horizonYears: goal.timeHorizonYears,
    })),
  }
  const gaps = {
    missingFields: kycEvaluation.missingFields,
    analysisId: analysis?.id ?? null,
    analysisStatus: analysis?.status ?? null,
    gapAmount: analysis?.results[0]?.gapAmount ?? null,
    netNeed: analysis?.results[0]?.netNeed ?? null,
  }
  const recommendedSolution = {
    type: recommendation.type,
    title: recommendation.title,
    productOrStrategy: recommendation.relatedProduct?.productName ?? recommendation.relatedProduct?.type ?? recommendation.title,
    relatedProductId: recommendation.relatedProductId,
    amount: recommendation.relatedProduct?.coverageAmount ?? analysis?.recommendations[0]?.recommendedAmount ?? null,
    term: analysis?.recommendations[0]?.recommendedTerm ?? null,
    premiumEstimate: recommendation.relatedProduct?.premium ?? analysis?.recommendations[0]?.premiumEstimate ?? null,
  }
  const complianceFlags = {
    advisorValidationRequired: true,
    complianceReviewRequired: recommendation.priority === "CRITICAL" || recommendation.type === "REPLACEMENT" || kycEvaluation.alerts.some((alert) => alert.severity === "CRITICAL" || alert.severity === "HIGH"),
    missingInsuranceAnalysis: !analysis && ["PROTECTION", "LIFE_INSURANCE", "DISABILITY_INSURANCE", "CRITICAL_ILLNESS", "BUSINESS_INSURANCE", "REPLACEMENT"].includes(recommendation.type),
    kycVersionId: kycVersion?.id ?? null,
  }

  await prisma.$transaction([
    prisma.recommendationOption.deleteMany({ where: { recommendationId: recommendation.id, organizationId } }),
    prisma.recommendationRisk.deleteMany({ where: { recommendationId: recommendation.id, organizationId } }),
    prisma.recommendationOption.createMany({
      data: options.map((option) => ({
        organizationId,
        recommendationId: recommendation.id,
        clientId: recommendation.clientId,
        createdById: userId,
        optionName: option.optionName,
        optionType: option.optionType,
        advantages: toJson(option.advantages),
        limitations: toJson(option.limitations),
        isSelected: option.isSelected,
        reasonNotSelected: option.reasonNotSelected,
        notes: option.notes,
      })),
    }),
    prisma.recommendationRisk.createMany({
      data: risks.map((risk) => ({
        organizationId,
        recommendationId: recommendation.id,
        clientId: recommendation.clientId,
        createdById: userId,
        riskType: risk.riskType,
        description: risk.description,
        explainedToClient: risk.explainedToClient,
      })),
    }),
  ])

  const updated = await prisma.productRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status,
      sourceKycVersionId: kycVersion?.id ?? recommendation.sourceKycVersionId,
      sourceNeedsAnalysisId: analysis?.id ?? recommendation.sourceNeedsAnalysisId,
      opportunityId: recommendation.relatedProductId ?? recommendation.opportunityId,
      currentSituation: toJson(currentSituation),
      objectives: toJson(objectives),
      gaps: toJson(gaps),
      optionsSummary: toJson(options),
      recommendedSolution: toJson(recommendedSolution),
      recommendationReasoning: recommendation.rationale ?? draftText,
      risksAndLimits: toJson(risks),
      generatedDraft: draftText,
      finalText: recommendation.finalText ?? draftText,
      complianceFlags: toJson(complianceFlags),
      metadata: toJson({ ...asRecord(recommendation.metadata), documentedRecommendation: true, generatedAt: new Date().toISOString() }),
    },
    include: { options: true, risks: true, documents: true, versions: true },
  })

  const version = await prisma.recommendationVersion.create({
    data: {
      organizationId,
      recommendationId: recommendation.id,
      clientId: recommendation.clientId,
      versionNumber: recommendation.recommendationVersion,
      snapshotData: toJson({ currentSituation, objectives, gaps, options, recommendedSolution, risks, complianceFlags }),
      generatedText: draftText,
      editedText: updated.finalText,
      changedById: userId,
      changeReason: "Brouillon structuré généré depuis les données CRM.",
    },
  })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "BROUILLON_GENERE", newValue: { status, versionId: version.id, complianceFlags } })
  await createCrmActivity({ organizationId, userId, clientId: recommendation.clientId, type: "RECOMMENDATION_CREATED", title: "Brouillon de recommandation généré", description: recommendation.title })
  return updated
}

export async function validateDocumentedRecommendation({ id, organizationId, userId }: { id: string; organizationId: string; userId?: string | null }) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  await assertRecommendationPurposeConsents({ organizationId, clientId: recommendation.clientId })
  if (recommendation.lockedAt) throw new Error("La recommandation est verrouillée. Créez une nouvelle version.")
  assertKycReadyForRecommendation(recommendation.client.kycProfile)
  if (!recommendation.finalText && !recommendation.recommendationReasoning) throw new Error("Justification obligatoire avant validation.")
  if (recommendation.options.length === 0) throw new Error("Options analysées obligatoires avant validation.")
  if (!recommendation.options.some((option) => option.isSelected)) throw new Error("Une option retenue doit être indiquée.")
  if (recommendation.risks.length === 0) throw new Error("Risques, limites et exclusions obligatoires avant validation.")
  const missingAnalysis = asRecord(recommendation.complianceFlags).missingInsuranceAnalysis === true
  if (missingAnalysis) throw new Error("Analyse des besoins requise avant recommandation finale.")
  const [criticalAlerts, openIncidents, openComplaints, blockingChecklistItems, pendingExceptions] = await Promise.all([
    prisma.complianceAlert.count({ where: { organizationId, clientId: recommendation.clientId, status: { in: ["OPEN", "IN_PROGRESS"] }, severity: "CRITICAL" } }),
    prisma.complianceIncident.count({ where: { organizationId, clientId: recommendation.clientId, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.complaint.count({ where: { organizationId, clientId: recommendation.clientId, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.clientChecklistResult.count({ where: { organizationId, clientId: recommendation.clientId, status: { in: ["NOT_STARTED", "TO_REVIEW", "EXCEPTION"] }, item: { is: { blocking: true } } } }),
    prisma.complianceException.count({ where: { organizationId, clientId: recommendation.clientId, status: { in: ["REQUESTED", "IN_REVIEW"] } } }),
  ])
  if (criticalAlerts > 0) throw new Error("Alerte critique ouverte: validation bloquée jusqu’à résolution ou approbation conformité.")
  if (openIncidents > 0) throw new Error("Incident ouvert lié au dossier: revue conformité requise avant recommandation finale.")
  if (openComplaints > 0) throw new Error("Plainte ouverte liée au dossier: revue conformité requise avant recommandation finale.")
  if (blockingChecklistItems > 0) throw new Error("Checklist produit incomplète: des items bloquants restent à traiter.")
  if (pendingExceptions > 0) throw new Error("Exception conformité en attente: approbation requise avant validation finale.")
  const complianceRequired = asRecord(recommendation.complianceFlags).complianceReviewRequired === true
  const status = complianceRequired ? "COMPLIANCE_REVIEW_REQUIRED" : "ADVISOR_REVIEW"
  const updated = await prisma.productRecommendation.update({ where: { id }, data: { status } })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "VALIDATION_EXECUTEE", newValue: { status } })
  return updated
}

export async function approveRecommendationByAdvisor({ id, organizationId, userId }: { id: string; organizationId: string; userId?: string | null }) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  if (recommendation.lockedAt) throw new Error("La recommandation est verrouillée.")
  await validateDocumentedRecommendation({ id, organizationId, userId })
  const complianceRequired = asRecord(recommendation.complianceFlags).complianceReviewRequired === true
  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: { status: complianceRequired ? "COMPLIANCE_REVIEW_REQUIRED" : "ADVISOR_APPROVED", advisorApprovedAt: new Date(), reviewedAt: new Date() },
  })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "APPROUVEE_CONSEILLER", newValue: { status: updated.status } })
  await createCrmActivity({ organizationId, userId, clientId: recommendation.clientId, type: "RECOMMENDATION_REVIEWED", title: "Recommandation approuvée par le conseiller", description: recommendation.title })
  return updated
}

export async function approveRecommendationByCompliance({ id, organizationId, userId }: { id: string; organizationId: string; userId?: string | null }) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  if (!recommendation.advisorApprovedAt) throw new Error("Approbation conseiller requise avant conformité.")
  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: { status: "COMPLIANCE_APPROVED", complianceApprovedAt: new Date() },
  })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "APPROUVEE_CONFORMITE", newValue: { status: updated.status } })
  return updated
}

export async function recordClientRecommendationDecision({
  id,
  organizationId,
  userId,
  decision,
  note,
}: {
  id: string
  organizationId: string
  userId?: string | null
  decision: "ACCEPTED" | "DECLINED" | "PARTIAL" | "DEFERRED" | "NO_RESPONSE"
  note?: string
}) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  const status = decision === "ACCEPTED" ? "CLIENT_ACCEPTED" : decision === "DECLINED" ? "CLIENT_DECLINED" : "PRESENTED_TO_CLIENT"
  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: {
      status,
      clientDecision: decision,
      clientDecisionAt: new Date(),
      presentedToClientAt: recommendation.presentedToClientAt ?? new Date(),
      metadata: toJson({ ...asRecord(recommendation.metadata), clientDecisionNote: note ?? null }),
    },
  })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "DECISION_CLIENT", newValue: { decision, note } })
  if (decision === "DECLINED" && !note) throw new Error("Une note de refus client est obligatoire.")
  return updated
}

export async function lockDocumentedRecommendation({ id, organizationId, userId }: { id: string; organizationId: string; userId?: string | null }) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  if (!recommendation.advisorApprovedAt) throw new Error("Approbation conseiller obligatoire avant verrouillage.")
  if (asRecord(recommendation.complianceFlags).complianceReviewRequired === true && !recommendation.complianceApprovedAt) {
    throw new Error("Approbation conformité obligatoire avant verrouillage.")
  }
  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: { status: "LOCKED", lockedAt: new Date(), completedAt: new Date() },
  })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "VERROUILLEE", newValue: { lockedAt: updated.lockedAt } })
  return updated
}

export async function generateDocumentedRecommendationReport({ id, organizationId, userId }: { id: string; organizationId: string; userId?: string | null }) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  await assertRecommendationPurposeConsents({ organizationId, clientId: recommendation.clientId, includeDocuments: true })
  if (!recommendation.advisorApprovedAt) throw new Error("Approbation conseiller requise avant rapport final.")
  const clientName = `${recommendation.client.firstName} ${recommendation.client.lastName}`.trim()
  const generatedAt = new Date()
  const currentSituation = asRecord(recommendation.currentSituation)
  const recommendedSolution = asRecord(recommendation.recommendedSolution)
  const lines = [
    "FINADVISOR CRM",
    "RAPPORT DE RECOMMANDATION DOCUMENTEE",
    `Document date: ${new Intl.DateTimeFormat("fr-CA").format(generatedAt)}`,
    `Version recommandation: v${recommendation.recommendationVersion}`,
    `Client: ${clientName}`,
    `Conseiller: ${recommendation.advisor?.name ?? "Non assigne"}`,
    `Statut: ${recommendation.status}`,
    ...section("Situation actuelle", [
      `Revenu annuel: ${formatMoney(currentSituation.annualIncome as number | null)}`,
      `Passifs: ${formatMoney(currentSituation.liabilities as number | null)}`,
      `Personnes a charge: ${currentSituation.dependents ?? "Non defini"}`,
      `Profil de risque: ${currentSituation.riskProfile ?? "Non defini"}`,
    ]),
    ...section("Objectifs et lacunes", [
      `Objectifs: ${JSON.stringify(recommendation.objectives ?? {})}`,
      `Lacunes: ${JSON.stringify(recommendation.gaps ?? {})}`,
    ]),
    ...section("Options analysees", recommendation.options.map((option) => `${option.isSelected ? "[Retenue]" : "[Non retenue]"} ${option.optionName}: ${option.reasonNotSelected ?? option.notes ?? "A valider"}`)),
    ...section("Solution recommandee", [
      `Solution: ${recommendedSolution.productOrStrategy ?? recommendation.title}`,
      `Montant: ${formatMoney(recommendedSolution.amount as number | null)}`,
      `Prime estimee: ${formatMoney(recommendedSolution.premiumEstimate as number | null)}`,
      `Justification: ${recommendation.finalText ?? recommendation.recommendationReasoning ?? recommendation.rationale ?? recommendation.description}`,
    ]),
    ...section("Risques, limites et exclusions", recommendation.risks.map((risk) => `${risk.riskType}: ${risk.description}`)),
    ...section("Documents remis", recommendation.documents.length ? recommendation.documents.map((document) => `${document.documentType}: ${document.deliveredToClient ? "Remis" : "A remettre"}`) : ["Aucun document remis lie explicitement."]),
    ...section("Decision client et audit", [
      `Decision client: ${recommendation.clientDecision}`,
      `Approbation conseiller: ${recommendation.advisorApprovedAt ? "Oui" : "Non"}`,
      `Approbation conformite: ${recommendation.complianceApprovedAt ? "Oui" : "Non / non requise"}`,
      `Signature client: ${recommendation.clientSignedAt ? "Oui" : "Non"}`,
    ]),
  ]
  await ensureClientFolderStructure({ organizationId, clientId: recommendation.clientId, userId })
  const fileName = sanitizeFileName(`rapport-recommandation-${clientName}-${generatedAt.toISOString().slice(0, 10)}.pdf`)
  const pdfBuffer = createSimplePdf(lines)
  const hasSupabaseStorage = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  const bucket = hasSupabaseStorage ? getDocumentsBucket() : null
  const storagePath = hasSupabaseStorage
    ? `${organizationId}/clients/${recommendation.clientId}/recommendations/${fileName}`
    : null
  let fileUrl: string | null = null

  if (hasSupabaseStorage && bucket && storagePath) {
    const { error: uploadError } = await getSupabaseServerClient().storage.from(bucket).upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true })
    if (uploadError) throw new Error(uploadError.message)
  } else {
    const publicDir = path.join(process.cwd(), "public", "generated", "recommendations")
    await mkdir(publicDir, { recursive: true })
    await writeFile(path.join(publicDir, fileName), pdfBuffer)
    fileUrl = `/generated/recommendations/${fileName}`
  }
  const document = await prisma.document.create({
    data: {
      organizationId,
      clientId: recommendation.clientId,
      uploadedById: userId,
      type: "PROPOSAL",
      status: "RECEIVED",
      visibility: "TEAM",
      name: `Rapport de recommandation - ${clientName}`,
      description: lines.join("\n"),
      fileName,
      originalFileName: fileName,
      fileUrl,
      url: fileUrl,
      storageBucket: bucket,
      storagePath,
      storageProvider: hasSupabaseStorage ? "SUPABASE" : "LOCAL_PUBLIC",
      mimeType: "application/pdf",
      fileSize: pdfBuffer.byteLength,
      receivedAt: generatedAt,
      notes: JSON.stringify({ recommendationId: recommendation.id }),
    },
  })
  await prisma.recommendationDocument.create({
    data: {
      organizationId,
      recommendationId: recommendation.id,
      clientId: recommendation.clientId,
      documentId: document.id,
      documentType: "RECOMMENDATION_REPORT",
      deliveredToClient: false,
    },
  })
  const updated = await prisma.productRecommendation.update({
    where: { id: recommendation.id },
    data: { reportDocumentId: document.id, status: recommendation.status === "ADVISOR_APPROVED" ? "PRESENTED_TO_CLIENT" : recommendation.status },
  })
  await createAuditLog({ organizationId, userId, clientId: recommendation.clientId, entityType: "ProductRecommendation", entityId: recommendation.id, action: "RECOMMENDATION_REPORT_GENERATED", newValue: { documentId: document.id } })
  await writeRecommendationAudit({ recommendation, organizationId, userId, eventType: "RAPPORT_GENERE", newValue: { documentId: document.id } })
  return { recommendation: updated, document }
}

async function loadRecommendationReportPdf(document: {
  storageBucket: string | null
  storagePath: string | null
  storageProvider: string | null
  fileUrl: string | null
  url: string | null
}) {
  if (document.storageBucket && document.storagePath) {
    const { data, error } = await getSupabaseServerClient()
      .storage
      .from(document.storageBucket)
      .download(document.storagePath)
    if (error || !data) throw new Error(error?.message ?? "REPORT_DOWNLOAD_FAILED")
    return Buffer.from(await data.arrayBuffer())
  }

  const localUrl = document.fileUrl ?? document.url
  if (localUrl?.startsWith("/generated/")) {
    return readFile(path.join(process.cwd(), "public", localUrl))
  }

  throw new Error("REPORT_FILE_REQUIRED")
}

export async function sendDocumentedRecommendationForSignature({
  id,
  organizationId,
  userId,
}: {
  id: string
  organizationId: string
  userId?: string | null
}) {
  const recommendation = await recommendationWithContext(id, organizationId)
  if (!recommendation) throw new Error("RECOMMENDATION_NOT_FOUND")
  await assertRecommendationPurposeConsents({ organizationId, clientId: recommendation.clientId, includeDocuments: true, includeDelivery: true })
  if (!recommendation.reportDocumentId) throw new Error("REPORT_REQUIRED")
  if (recommendation.lockedAt) throw new Error("RECOMMENDATION_LOCKED")
  if (recommendation.clientSignedAt) throw new Error("RECOMMENDATION_ALREADY_SIGNED")

  const reportDocument = await prisma.document.findFirst({
    where: { id: recommendation.reportDocumentId, organizationId },
  })
  if (!reportDocument) throw new Error("REPORT_REQUIRED")
  if (reportDocument.status === "REQUESTED") throw new Error("REPORT_ALREADY_SENT")
  if (reportDocument.status === "VALIDATED") throw new Error("RECOMMENDATION_ALREADY_SIGNED")

  const email = clientEmail(recommendation.client)
  if (!email) throw new Error("CLIENT_EMAIL_REQUIRED")

  const pdfBuffer = await loadRecommendationReportPdf(reportDocument)
  const clientName = `${recommendation.client.firstName} ${recommendation.client.lastName}`.trim()
  const documentName = `Signature - Recommandation - ${clientName}`
  const created = await createPandaDocDocumentFromPdf({
    name: documentName,
    pdfBuffer,
    fileName: reportDocument.fileName ?? `recommandation-${recommendation.id}.pdf`,
    recipient: {
      email,
      firstName: recommendation.client.firstName,
      lastName: recommendation.client.lastName,
      role: "client",
    },
    metadata: {
      organizationId,
      clientId: recommendation.clientId,
      recommendationId: recommendation.id,
      reportDocumentId: reportDocument.id,
    },
  })
  const draft = await waitForPandaDocDraft(created.id)
  if (draft.status !== "document.draft") throw new Error(`PANDADOC_NOT_READY:${draft.status ?? "unknown"}`)

  const sent = await sendPandaDocDocument(created.id, {
    subject: "Signature requise - recommandation documentée",
    message: `Bonjour ${recommendation.client.firstName},\n\nVotre conseiller vous transmet le rapport de recommandation documentée pour signature électronique sécurisée.\n\nMerci.`,
  })
  const sentAt = new Date()
  const pandaDocProof = {
    provider: "PANDADOC",
    documentId: created.id,
    status: sent.status ?? "document.sent",
    sentAt: sentAt.toISOString(),
    recipientEmail: email,
    recommendationId: recommendation.id,
  }

  const updatedDocument = await prisma.document.update({
    where: { id: reportDocument.id },
    data: {
      status: "REQUESTED",
      visibility: "CLIENT_VISIBLE",
      requestedAt: sentAt,
      notes: JSON.stringify({
        ...parseDocumentNotes(reportDocument.notes),
        categoryLabel: "Recommandation documentée à signer",
        recommendationId: recommendation.id,
        pandaDoc: pandaDocProof,
      }),
    },
  })

  await prisma.recommendationDocument.updateMany({
    where: { organizationId, recommendationId: recommendation.id, documentId: reportDocument.id },
    data: {
      deliveredToClient: true,
      deliveredAt: sentAt,
      deliveryMethod: "SECURE_EMAIL",
      notes: JSON.stringify({ pandaDoc: pandaDocProof }),
    },
  })

  const updated = await prisma.productRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status: "PRESENTED_TO_CLIENT",
      presentedToClientAt: recommendation.presentedToClientAt ?? sentAt,
      deliveredDocuments: toJson({
        ...asRecord(recommendation.deliveredDocuments),
        reportDocumentId: reportDocument.id,
        deliveredAt: sentAt.toISOString(),
        deliveryMethod: "PANDADOC",
      }),
      metadata: toJson({
        ...asRecord(recommendation.metadata),
        pandaDoc: pandaDocProof,
      }),
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    entityType: "ProductRecommendation",
    entityId: recommendation.id,
    action: "RECOMMENDATION_SIGNATURE_SENT",
    newValue: pandaDocProof,
  })
  await writeRecommendationAudit({
    recommendation,
    organizationId,
    userId,
    eventType: "ENVOYEE_SIGNATURE_PANDADOC",
    newValue: pandaDocProof,
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    documentId: updatedDocument.id,
    type: "EMAIL_SENT",
    title: "Recommandation envoyée à signature PandaDoc",
    description: `Recommandation envoyée à ${email}.`,
    entityType: "ProductRecommendation",
    entityId: recommendation.id,
    metadata: pandaDocProof,
  })

  return { recommendation: updated, document: updatedDocument, pandaDoc: pandaDocProof }
}
