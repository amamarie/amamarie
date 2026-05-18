import type { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { ensureComplianceEvidenceSettings } from "@/lib/compliance/evidence"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const BOOLEAN_KEYS = [
  "wormStorageEnabled",
  "certificateSigningEnabled",
  "trustedTimestampEnabled",
  "regulatoryPortalEnabled",
  "requireExternalDepositForInspectionExport",
] as const

const STRING_KEYS = [
  "wormProvider",
  "wormBucket",
  "certificateProvider",
  "certificateKeyReference",
  "timestampProvider",
  "regulatoryPortalProvider",
  "regulatoryPortalReference",
] as const

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await ensureComplianceEvidenceSettings(organizationId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const current = await ensureComplianceEvidenceSettings(organizationId)
    const body = await request.json()
    const data: Record<string, unknown> = {}
    for (const key of BOOLEAN_KEYS) {
      if (typeof body[key] === "boolean") data[key] = body[key]
    }
    for (const key of STRING_KEYS) {
      if (typeof body[key] === "string") data[key] = body[key].trim() || null
    }
    if (Number.isFinite(Number(body.wormRetentionYears))) data.wormRetentionYears = Math.max(1, Math.min(50, Number(body.wormRetentionYears)))
    if (body.metadata && typeof body.metadata === "object") data.metadata = body.metadata

    const settings = await prisma.complianceEvidenceSettings.update({
      where: { organizationId },
      data,
    })
    await createAuditLog({
      organizationId,
      userId,
      entityType: "ComplianceEvidenceSettings",
      entityId: settings.id,
      action: "COMPLIANCE_EVIDENCE_SETTINGS_UPDATED",
      oldValue: {
        wormStorageEnabled: current.wormStorageEnabled,
        certificateSigningEnabled: current.certificateSigningEnabled,
        trustedTimestampEnabled: current.trustedTimestampEnabled,
        regulatoryPortalEnabled: current.regulatoryPortalEnabled,
      },
      newValue: data as Prisma.InputJsonObject,
      source: "api",
      sensitivityLevel: "HIGH",
      request,
    })
    return ok(settings)
  } catch (error) {
    return handleApiError(error)
  }
}
