import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { ensureKycPolicySettings } from "@/lib/compliance/kyc-advanced"
import { assertCanManageKycPolicy } from "@/lib/compliance/permissions"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const editableFields = [
  "reviewCadenceMonths",
  "managedAccountReviewMonths",
  "completionThreshold",
  "freshnessThreshold",
  "coherenceThreshold",
  "blockRecommendations",
  "blockExpiredKyc",
  "requireClientConfirmation",
  "requireAdvisorAttestation",
  "allowAdvisorOverride",
  "requireOverrideJustification",
  "retentionYears",
  "maskingEnabled",
  "accessLogEnabled",
  "clientExportEnabled",
  "deletionPolicy",
  "residencyPolicy",
  "exceptionPolicy",
] as const

function coerceSettingsPayload(payload: unknown) {
  const data: Record<string, string | number | boolean | null> = {}
  if (!payload || typeof payload !== "object") return data
  for (const field of editableFields) {
    if (!(field in payload)) continue
    const value = (payload as Record<string, unknown>)[field]
    if (typeof value === "boolean") data[field] = value
    else if (typeof value === "number") data[field] = value
    else if (typeof value === "string") {
      if (["true", "false"].includes(value)) data[field] = value === "true"
      else if (/Months|Threshold|Years/.test(field)) data[field] = Number(value)
      else data[field] = value.trim() || null
    }
  }
  return data
}

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    const { organizationId } = await getTenantContext()
    return ok(await ensureKycPolicySettings(organizationId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanManageKycPolicy(user)
    const { organizationId } = await getTenantContext()
    await ensureKycPolicySettings(organizationId)
    const data = coerceSettingsPayload(await request.json())
    const settings = await prisma.kycPolicySettings.update({ where: { organizationId }, data })
    await createAuditLog({
      organizationId,
      userId: user.id,
      entityType: "KycPolicySettings",
      entityId: settings.id,
      action: "KYC_POLICY_SETTINGS_UPDATED",
      newValue: data,
    })
    return ok(settings)
  } catch (error) {
    return handleApiError(error)
  }
}
