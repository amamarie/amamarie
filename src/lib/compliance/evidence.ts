import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"

export async function ensureComplianceEvidenceSettings(organizationId: string) {
  return prisma.complianceEvidenceSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  })
}

export function hashEvidencePayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export async function createComplianceEvidenceDeposit({
  organizationId,
  userId,
  auditReportId,
  depositType,
  provider,
  payload,
  request,
}: {
  organizationId: string
  userId?: string | null
  auditReportId?: string | null
  depositType: "WORM_STORAGE" | "CERTIFICATE_SIGNATURE" | "TRUSTED_TIMESTAMP" | "REGULATORY_PORTAL"
  provider?: string | null
  payload: Prisma.InputJsonValue
  request?: Request
}) {
  const contentHash = hashEvidencePayload(payload)
  const externalReference = `${depositType.toLowerCase()}_${contentHash.slice(0, 16)}`
  const now = new Date()

  const deposit = await prisma.complianceEvidenceDeposit.create({
    data: {
      organizationId,
      auditReportId,
      createdById: userId,
      depositType,
      provider: provider ?? null,
      status: "RECORDED",
      contentHash,
      externalReference,
      certificateSerial: depositType === "CERTIFICATE_SIGNATURE" ? `cert-${contentHash.slice(0, 12)}` : null,
      timestampToken: depositType === "TRUSTED_TIMESTAMP" ? `ts-${now.getTime()}-${contentHash.slice(0, 12)}` : null,
      portalSubmissionId: depositType === "REGULATORY_PORTAL" ? `portal-${now.getTime()}-${contentHash.slice(0, 8)}` : null,
      evidenceManifest: payload,
      depositedAt: now,
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    entityType: "ComplianceEvidenceDeposit",
    entityId: deposit.id,
    action: `COMPLIANCE_EVIDENCE_${depositType}_RECORDED`,
    newValue: {
      auditReportId,
      depositType,
      provider,
      contentHash,
      externalReference,
      status: deposit.status,
    },
    source: "api",
    sensitivityLevel: "HIGH",
    request,
  })

  return deposit
}
