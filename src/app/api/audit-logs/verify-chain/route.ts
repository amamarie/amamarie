import { createHash } from "crypto"

import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const logs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 10000,
    })

    let verified = 0
    let unsigned = 0
    const broken: Array<{ id: string; action: string; reason: string }> = []
    let previousHash: string | null = null

    for (const log of logs) {
      if (!log.eventHash) {
        unsigned += 1
        previousHash = log.eventHash ?? previousHash
        continue
      }

      if (log.previousHash !== previousHash) {
        broken.push({ id: log.id, action: log.action, reason: "previousHash ne correspond pas au hash précédent." })
      }

      const canonicalPayload = {
        organizationId: log.organizationId,
        userId: log.userId,
        clientId: log.clientId,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        fieldName: log.fieldName,
        oldValue: log.oldValue,
        newValue: log.newValue,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        source: log.source,
        sensitivityLevel: log.sensitivityLevel,
        reason: log.reason,
        metadata: log.metadata,
        previousHash: log.previousHash,
      }
      const legacyPayload = {
        organizationId: log.organizationId,
        userId: log.userId,
        clientId: log.clientId,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        fieldName: log.fieldName,
        oldValue: log.oldValue ?? undefined,
        newValue: log.newValue ?? undefined,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        source: log.source,
        sensitivityLevel: log.sensitivityLevel,
        reason: log.reason ?? undefined,
        metadata: log.metadata ?? undefined,
        previousHash: log.previousHash,
      }

      if (hashPayload(canonicalPayload) !== log.eventHash && hashPayload(legacyPayload) !== log.eventHash) {
        broken.push({ id: log.id, action: log.action, reason: "eventHash ne correspond pas au contenu du log." })
      } else {
        verified += 1
      }
      previousHash = log.eventHash
    }

    const result = {
      scanned: logs.length,
      verified,
      unsigned,
      brokenCount: broken.length,
      broken: broken.slice(0, 50),
      verifiedAt: new Date().toISOString(),
    }

    await createAuditLog({
      organizationId,
      userId,
      entityType: "AuditLog",
      entityId: organizationId,
      action: "AUDIT_LOG_HASH_CHAIN_VERIFIED",
      newValue: result,
      source: "api",
      sensitivityLevel: broken.length > 0 ? "HIGH" : "MEDIUM",
      request,
    })

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
