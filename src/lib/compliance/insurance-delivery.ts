import type { FinancialProduct, FinancialProductType, InsuranceAnalysisType } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { calculateInsuranceNeedsAnalysis, createInsuranceNeedsAnalysis, generateInsuranceNeedsReport } from "@/lib/insurance-needs/service"
import { prisma } from "@/lib/prisma"

const insuranceTypes = new Set<FinancialProductType>([
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
])

function requiredAnalysisTypes(type: FinancialProductType) {
  if (type === "LIFE_INSURANCE") return ["LIFE", "REPLACEMENT"] as const
  if (type === "DISABILITY_INSURANCE") return ["DISABILITY", "REPLACEMENT"] as const
  if (type === "CRITICAL_ILLNESS") return ["CRITICAL_ILLNESS", "REPLACEMENT"] as const
  return ["LIFE", "DISABILITY", "CRITICAL_ILLNESS", "BUSINESS", "REPLACEMENT"] as const
}

function primaryAnalysisType(type: FinancialProductType): InsuranceAnalysisType {
  if (type === "DISABILITY_INSURANCE") return "DISABILITY"
  if (type === "CRITICAL_ILLNESS") return "CRITICAL_ILLNESS"
  return "LIFE"
}

function deliveryDate(product: Pick<FinancialProduct, "issuedAt" | "effectiveDate" | "updatedAt" | "createdAt">) {
  return product.issuedAt ?? product.effectiveDate ?? product.updatedAt ?? product.createdAt
}

function isInsuranceProduct(product: Pick<FinancialProduct, "category" | "type">) {
  return product.category === "INSURANCE" || insuranceTypes.has(product.type)
}

function isDelivered(product: Pick<FinancialProduct, "status">) {
  return product.status === "ACTIVE"
}

async function prepareAdvisorReport({
  organizationId,
  userId,
  clientId,
  productType,
  productId,
}: {
  organizationId: string
  userId: string
  clientId: string
  productType: FinancialProductType
  productId: string
}) {
  const acceptableTypes = [...requiredAnalysisTypes(productType)]
  const existingAnalysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: {
      organizationId,
      clientId,
      analysisType: { in: acceptableTypes },
      status: { notIn: ["ARCHIVED"] },
      OR: [{ opportunityId: productId }, { opportunityId: null }],
    },
    include: {
      results: { select: { id: true }, take: 1 },
      recommendations: { select: { id: true }, take: 1 },
    },
    orderBy: [{ reportDocumentId: "desc" }, { updatedAt: "desc" }],
  })

  const analysisId = existingAnalysis?.id ?? (await createInsuranceNeedsAnalysis({
      organizationId,
      userId,
      clientId,
      type: primaryAnalysisType(productType),
      opportunityId: productId,
    })).id

  if (!existingAnalysis?.results.length || !existingAnalysis.recommendations.length) {
    await calculateInsuranceNeedsAnalysis({ organizationId, userId, analysisId })
  }

  const latest = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    select: { id: true, reportDocumentId: true },
  })
  if (!latest) throw new Error("ANALYSIS_NOT_FOUND")
  if (latest.reportDocumentId) return { analysisId: latest.id, reportDocumentId: latest.reportDocumentId, createdReport: false }

  const withReport = await generateInsuranceNeedsReport({ organizationId, userId, analysisId: latest.id })
  return { analysisId: withReport.id, reportDocumentId: withReport.reportDocumentId, createdReport: true }
}

export async function ensureInsuranceNeedsDeliveredBeforePolicy({
  organizationId,
  userId,
  productId,
}: {
  organizationId: string
  userId?: string | null
  productId: string
}) {
  const product = await prisma.financialProduct.findFirst({
    where: { id: productId, organizationId },
    include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } },
  })
  if (!product || !isInsuranceProduct(product) || !isDelivered(product)) return { checked: false, reason: "NOT_DELIVERED_INSURANCE_PRODUCT" }

  const deliveredAt = deliveryDate(product)
  const acceptableStatuses = ["DELIVERED", "COMPLETED", "USED_FOR_SUBMISSION"] as const
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: {
      organizationId,
      clientId: product.clientId,
      analysisType: { in: [...requiredAnalysisTypes(product.type)] },
      status: { in: [...acceptableStatuses] },
      reportDocumentId: { not: null },
      signedAt: { not: null },
      deliveredAt: { not: null },
    },
    orderBy: [{ signedAt: "desc" }, { deliveredAt: "desc" }, { analysisDate: "desc" }],
  })
  const analysisValid = Boolean(analysis && analysis.deliveredAt && analysis.signedAt && analysis.deliveredAt.getTime() <= deliveredAt.getTime())
  const alertType = "INSURANCE_NEEDS_ANALYSIS_NOT_DELIVERED"
  const existingAlert = await prisma.complianceAlert.findFirst({
    where: {
      organizationId,
      clientId: product.clientId,
      type: alertType,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
  })

  if (analysisValid) {
    if (analysis && analysis.opportunityId !== product.id) {
      await prisma.insuranceNeedsAnalysis.update({
        where: { id: analysis.id },
        data: { opportunityId: product.id },
      })
    }
    if (existingAlert) {
      await prisma.complianceAlert.update({
        where: { id: existingAlert.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: userId ?? product.advisorId ?? product.client.advisorId ?? null,
        },
      })
      await createCrmActivity({
        organizationId,
        userId,
        clientId: product.clientId,
        productId: product.id,
        alertId: existingAlert.id,
        type: "COMPLIANCE_ALERT_RESOLVED",
        title: "Preuve d’analyse des besoins validée",
        description: "Le rapport daté et confirmé par le client est présent avant la livraison de la police.",
        source: "AUTOMATION",
        entityType: "FinancialProduct",
        entityId: product.id,
      })
    }
    return { checked: true, compliant: true, analysisId: analysis?.id }
  }

  const clientName = `${product.client.firstName} ${product.client.lastName}`.trim()
  const productLabel = [product.company, product.productName, product.policyNumber ?? product.contractNumber, product.type].filter(Boolean).join(" - ")
  const actorId = userId ?? product.advisorId ?? product.client.advisorId ?? null
  let preparedReport: Awaited<ReturnType<typeof prepareAdvisorReport>> | null = null
  if (actorId) {
    try {
      preparedReport = await prepareAdvisorReport({
        organizationId,
        userId: actorId,
        clientId: product.clientId,
        productType: product.type,
        productId: product.id,
      })
    } catch (error) {
      console.warn({
        action: "insurance_delivery_prepare_report_failed",
        productId: product.id,
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }
  const description = `Avant la livraison d’une police, les renseignements recueillis et l’analyse des besoins doivent être consignés dans un document daté remis au client. Aucun rapport signé/remis avant le ${deliveredAt.toLocaleDateString("fr-CA")} n’est lié à ce dossier. Produit: ${productLabel}.`
  const alert = existingAlert ?? await prisma.complianceAlert.create({
    data: {
      organizationId,
      clientId: product.clientId,
      type: alertType,
      severity: "CRITICAL",
      status: "OPEN",
      title: "Analyse des besoins non remise avant livraison",
      description: preparedReport?.reportDocumentId
        ? `${description} Un rapport a été préparé automatiquement pour révision conseiller et envoi au client.`
        : description,
      actionLabel: "Ouvrir l’analyse des besoins",
      actionUrl: preparedReport?.analysisId ? `/clients/${product.clientId}?tab=needs&analysisId=${preparedReport.analysisId}` : `/clients/${product.clientId}?tab=needs`,
    },
  })
  if (existingAlert) {
    await prisma.complianceAlert.update({
      where: { id: existingAlert.id },
      data: {
        severity: "CRITICAL",
        title: "Analyse des besoins non remise avant livraison",
        description: preparedReport?.reportDocumentId
          ? `${description} Un rapport a été préparé automatiquement pour révision conseiller et envoi au client.`
          : description,
        actionUrl: preparedReport?.analysisId ? `/clients/${product.clientId}?tab=needs&analysisId=${preparedReport.analysisId}` : `/clients/${product.clientId}?tab=needs`,
      },
    })
  }

  const taskTitle = preparedReport?.reportDocumentId ? "Réviser et envoyer l’analyse des besoins au client" : "Remettre l’analyse des besoins avant livraison"
  const existingTask = await prisma.task.findFirst({
    where: {
      organizationId,
      clientId: product.clientId,
      productId: product.id,
      title: taskTitle,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
  })
  const task = existingTask ?? await prisma.task.create({
    data: {
      organizationId,
      clientId: product.clientId,
      productId: product.id,
      assignedToId: product.advisorId ?? product.client.advisorId ?? userId ?? undefined,
      createdById: userId ?? product.advisorId ?? product.client.advisorId ?? undefined,
      alertId: alert.id,
      type: "COMPLIANCE",
      priority: "URGENT",
      status: "TODO",
      isAutomated: true,
      dueDate: new Date(),
      title: taskTitle,
      description: preparedReport?.reportDocumentId
        ? `Client: ${clientName}. Le rapport d’analyse des besoins a été préparé automatiquement. Révisez les données, puis cliquez sur Envoyer au client dans l’onglet Analyse des besoins.`
        : `Client: ${clientName}. Générer ou faire signer le rapport d’analyse des besoins, puis classer la preuve au dossier avant de finaliser la livraison.`,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: userId ?? product.advisorId ?? product.client.advisorId ?? null,
      clientId: product.clientId,
      entityType: "FinancialProduct",
      entityId: product.id,
      action: "INSURANCE_DELIVERY_ANALYSIS_CHECK",
      newValue: {
        compliant: false,
        productId: product.id,
        alertId: alert.id,
        taskId: task.id,
        preparedAnalysisId: preparedReport?.analysisId,
        preparedReportDocumentId: preparedReport?.reportDocumentId,
        requiredAnalysisTypes: requiredAnalysisTypes(product.type),
      },
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: product.clientId,
    productId: product.id,
    taskId: task.id,
    alertId: alert.id,
    type: "COMPLIANCE_ALERT_CREATED",
    title: "Blocage conformité livraison police",
    description: preparedReport?.reportDocumentId
      ? "Rapport d’analyse préparé automatiquement; envoi au client requis par le conseiller."
      : "Analyse des besoins datée/remise au client manquante avant livraison.",
    source: "AUTOMATION",
    entityType: "FinancialProduct",
    entityId: product.id,
  })

  return { checked: true, compliant: false, alertId: alert.id, taskId: task.id, preparedReport }
}
