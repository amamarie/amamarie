import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createAuditLog } from "@/lib/compliance/audit"
import { assertCanManageDocumentVaultPolicy } from "@/lib/compliance/permissions"
import { ensureDocumentVaultSettings, documentRetentionPolicyOptions } from "@/lib/documents/settings"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const numericFields = [
  "defaultRetentionYears",
  "kycRetentionYears",
  "recommendationRetentionYears",
  "identityRetentionYears",
  "rejectedDocumentRetentionDays",
  "unclassifiedReviewDays",
  "expiryReminderDays",
] as const

const booleanFields = [
  "requireConsentForSensitiveDocuments",
  "requireHumanValidationForExtractions",
  "blockRecommendationWithUnvalidatedData",
  "createTaskForMissingDocuments",
  "createTaskForExpiredDocuments",
  "restrictIdentityDocuments",
  "restrictMedicalDocuments",
  "restrictCriticalDocuments",
  "allowExternalSharing",
  "requireComplianceApprovalForExternalSharing",
  "accessLogEnabled",
  "clientUploadEnabled",
  "semanticSearchEnabled",
] as const

const textFields = [
  "defaultStorageResidency",
  "deletionPolicy",
  "externalSharingPolicy",
] as const

function serializeSettings(settings: Awaited<ReturnType<typeof ensureDocumentVaultSettings>>) {
  return {
    ...settings,
    retentionPolicies: documentRetentionPolicyOptions(settings),
  }
}

function coercePayload(payload: unknown) {
  const data: Record<string, string | number | boolean> = {}
  if (!payload || typeof payload !== "object") return data
  const source = payload as Record<string, unknown>
  for (const field of numericFields) {
    if (!(field in source)) continue
    const value = source[field]
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
    if (Number.isFinite(numberValue)) data[field] = Math.max(0, Math.round(numberValue))
  }
  for (const field of booleanFields) {
    if (!(field in source)) continue
    const value = source[field]
    if (typeof value === "boolean") data[field] = value
    else if (value === "true" || value === "false") data[field] = value === "true"
  }
  for (const field of textFields) {
    if (!(field in source)) continue
    const value = source[field]
    if (typeof value === "string") data[field] = value.trim()
  }
  return data
}

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    const { organizationId } = await getTenantContext()
    const settings = await ensureDocumentVaultSettings(organizationId)
    return ok(serializeSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanManageDocumentVaultPolicy(user)
    const { organizationId } = await getTenantContext()
    await ensureDocumentVaultSettings(organizationId)
    const data = coercePayload(await request.json())
    const settings = await prisma.documentVaultSettings.update({ where: { organizationId }, data })
    await createAuditLog({
      organizationId,
      userId: user.id,
      entityType: "DocumentVaultSettings",
      entityId: settings.id,
      action: "DOCUMENT_VAULT_SETTINGS_UPDATED",
      newValue: data,
    })
    return ok(serializeSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}
