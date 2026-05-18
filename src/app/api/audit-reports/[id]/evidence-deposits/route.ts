import type { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplianceEvidenceDeposit, ensureComplianceEvidenceSettings } from "@/lib/compliance/evidence"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const DEPOSIT_TYPES = ["WORM_STORAGE", "CERTIFICATE_SIGNATURE", "TRUSTED_TIMESTAMP", "REGULATORY_PORTAL"] as const

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    return ok(await prisma.complianceEvidenceDeposit.findMany({
      where: { organizationId, auditReportId: id },
      orderBy: { createdAt: "desc" },
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const report = await prisma.auditReport.findFirst({ where: { id, organizationId } })
    if (!report) return fail("NOT_FOUND", "Rapport d’audit introuvable.", 404)
    const settings = await ensureComplianceEvidenceSettings(organizationId)
    const body = await request.json().catch(() => ({}))
    const requestedTypes = Array.isArray(body.depositTypes)
      ? body.depositTypes.filter((type: unknown): type is typeof DEPOSIT_TYPES[number] => typeof type === "string" && DEPOSIT_TYPES.includes(type as typeof DEPOSIT_TYPES[number]))
      : DEPOSIT_TYPES.filter((type) => {
        if (type === "WORM_STORAGE") return settings.wormStorageEnabled
        if (type === "CERTIFICATE_SIGNATURE") return settings.certificateSigningEnabled
        if (type === "TRUSTED_TIMESTAMP") return settings.trustedTimestampEnabled
        if (type === "REGULATORY_PORTAL") return settings.regulatoryPortalEnabled
        return false
      })
    if (requestedTypes.length === 0) return fail("NO_EVIDENCE_PROVIDER_ENABLED", "Aucun fournisseur de preuve externe n’est activé.", 422)

    const payload = {
      auditReportId: report.id,
      reportType: report.reportType,
      title: report.title,
      generatedAt: report.generatedAt.toISOString(),
      signedHash: report.signedHash,
      summary: report.summary,
      providerSettings: {
        wormProvider: settings.wormProvider,
        certificateProvider: settings.certificateProvider,
        timestampProvider: settings.timestampProvider,
        regulatoryPortalProvider: settings.regulatoryPortalProvider,
      },
    } satisfies Prisma.InputJsonObject

    const deposits = []
    for (const type of requestedTypes) {
      const provider = type === "WORM_STORAGE"
        ? settings.wormProvider
        : type === "CERTIFICATE_SIGNATURE"
          ? settings.certificateProvider
          : type === "TRUSTED_TIMESTAMP"
            ? settings.timestampProvider
            : settings.regulatoryPortalProvider
      deposits.push(await createComplianceEvidenceDeposit({
        organizationId,
        userId,
        auditReportId: report.id,
        depositType: type,
        provider,
        payload,
        request,
      }))
    }

    return ok(deposits, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
