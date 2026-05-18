import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const now = new Date()
    const [
      vendors,
      purposeCounts,
      documentSensitivity,
      documentTypes,
      disclosures,
      incidents,
      openRiskEvents,
      retentionDue,
    ] = await Promise.all([
      prisma.privacyVendor.findMany({
        where: { organizationId },
        orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }],
        take: 50,
      }),
      prisma.clientConsent.groupBy({
        by: ["type", "status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.document.groupBy({
        by: ["sensitivityLevel"],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.document.groupBy({
        by: ["type"],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { type: "desc" } },
        take: 12,
      }),
      prisma.dataDisclosure.groupBy({
        by: ["recipientType", "outsideQuebec"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.privacyIncident.groupBy({
        by: ["riskLevel", "status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.privacyAccessRiskEvent.count({
        where: { organizationId, status: "OPEN", riskLevel: { in: ["HIGH", "CRITICAL"] } },
      }),
      prisma.document.count({
        where: { organizationId, deletedAt: null, retentionReviewAt: { lte: now } },
      }),
    ])

    const vendorFlows = vendors.map((vendor) => {
      const missingPia = vendor.outsideQuebec && !vendor.piaCompleted
      const missingContract = !vendor.contractSigned
      const reviewDue = Boolean(vendor.nextReviewAt && vendor.nextReviewAt <= now)
      const riskFlags = [
        missingPia ? "EFVP manquante" : null,
        missingContract ? "Contrat manquant" : null,
        reviewDue ? "Revue due" : null,
        vendor.riskLevel === "HIGH" || vendor.riskLevel === "CRITICAL" ? "Risque élevé" : null,
      ].filter((item): item is string => Boolean(item))

      return {
        id: vendor.id,
        name: vendor.name,
        serviceType: vendor.serviceType,
        dataCategories: asStringArray(vendor.dataCategories),
        dataLocation: vendor.dataLocation,
        outsideQuebec: vendor.outsideQuebec,
        contractSigned: vendor.contractSigned,
        piaCompleted: vendor.piaCompleted,
        riskLevel: vendor.riskLevel,
        status: vendor.status,
        safeguards: vendor.safeguards,
        nextReviewAt: vendor.nextReviewAt,
        riskFlags,
      }
    })

    const highRiskVendors = vendorFlows.filter((vendor) => vendor.riskFlags.length > 0)
    const outsideQuebecFlows = vendorFlows.filter((vendor) => vendor.outsideQuebec)
    const consentTotals = purposeCounts.reduce((sum, item) => sum + item._count._all, 0)
    const activeConsentTotals = purposeCounts.filter((item) => item.status === "GIVEN").reduce((sum, item) => sum + item._count._all, 0)
    const outsideQuebecDisclosures = disclosures.filter((item) => item.outsideQuebec).reduce((sum, item) => sum + item._count._all, 0)
    const openIncidents = incidents.filter((item) => !["CLOSED", "ARCHIVED"].includes(item.status)).reduce((sum, item) => sum + item._count._all, 0)

    return ok({
      generatedAt: now,
      summary: {
        vendors: vendors.length,
        highRiskVendors: highRiskVendors.length,
        outsideQuebecFlows: outsideQuebecFlows.length,
        consentTotals,
        activeConsentTotals,
        outsideQuebecDisclosures,
        openIncidents,
        openHighRiskAccessEvents: openRiskEvents,
        retentionReviewsDue: retentionDue,
      },
      inventory: {
        documentSensitivity: documentSensitivity.map((item) => ({ sensitivityLevel: item.sensitivityLevel, count: item._count._all })),
        documentTypes: documentTypes.map((item) => ({ type: item.type, count: item._count._all })),
        consentPurposes: purposeCounts.map((item) => ({ type: item.type, status: item.status, count: item._count._all })),
        disclosures: disclosures.map((item) => ({ recipientType: item.recipientType, outsideQuebec: item.outsideQuebec, count: item._count._all })),
        incidents: incidents.map((item) => ({ riskLevel: item.riskLevel, status: item.status, count: item._count._all })),
      },
      vendorFlows,
      riskFindings: [
        ...highRiskVendors.map((vendor) => ({
          id: `vendor-${vendor.id}`,
          title: vendor.name,
          detail: `${vendor.serviceType} · ${vendor.riskFlags.join(", ")}`,
          severity: vendor.riskLevel === "CRITICAL" ? "CRITICAL" : vendor.outsideQuebec && !vendor.piaCompleted ? "HIGH" : "MEDIUM",
        })),
        ...(openRiskEvents > 0 ? [{
          id: "access-risk-open",
          title: "Accès anormaux ouverts",
          detail: `${openRiskEvents} événement(s) à risque élevé ou critique à réviser.`,
          severity: "HIGH",
        }] : []),
        ...(retentionDue > 0 ? [{
          id: "retention-due",
          title: "Conservation à réviser",
          detail: `${retentionDue} document(s) ont atteint leur date de revue de conservation.`,
          severity: "MEDIUM",
        }] : []),
      ],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
