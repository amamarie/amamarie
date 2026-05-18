import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { booleanSetting, ensurePrivacySettings, numberSetting } from "@/lib/privacy/advanced"
import { getTenantContext } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

const booleanFields = [
  "defaultPrivacyMode",
  "screenShareMaskingDefault",
  "shareWithSpouseDefault",
  "externalDocumentSharingDefault",
  "marketingDefault",
  "aiAssistanceDefault",
  "assistantSensitiveDocsDefault",
  "massExportDefault",
  "publicLinksAllowed",
  "indefiniteRetentionAllowed",
  "productAnalyticsDefault",
  "requireMfaForPortal",
  "requireApprovalExternalSharing",
  "requireApprovalMassExport",
  "anomalyDetectionEnabled",
  "maskPhone",
  "maskEmail",
  "maskAddress",
  "maskFinancialValues",
  "maskDateOfBirth",
  "maskTaxIdentifiers",
  "maskHealthData",
] as const

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    return ok(await ensurePrivacySettings(organizationId, userId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const current = await ensurePrivacySettings(organizationId, userId)
    const body = await request.json()
    const data: Record<string, boolean | number | string> = { updatedById: userId }
    for (const field of booleanFields) {
      if (field in body) data[field] = booleanSetting(body[field], current[field])
    }
    if ("anomalyRiskThreshold" in body) data.anomalyRiskThreshold = Math.min(100, Math.max(1, numberSetting(body.anomalyRiskThreshold, current.anomalyRiskThreshold)))
    const settings = await prisma.privacySettings.update({ where: { organizationId }, data })
    await createAuditLog({ organizationId, userId, entityType: "PrivacySettings", entityId: settings.id, action: "PRIVACY_SETTINGS_UPDATED", newValue: data })
    return ok(settings)
  } catch (error) {
    return handleApiError(error)
  }
}
