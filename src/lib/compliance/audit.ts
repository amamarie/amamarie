import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") return undefined
  return value as Prisma.InputJsonValue
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export async function createAuditLog({
  organizationId,
  userId,
  clientId,
  entityType,
  entityId,
  action,
  fieldName,
  oldValue,
  newValue,
  ipAddress,
  userAgent,
  source = "system",
  sensitivityLevel = "MEDIUM",
  reason,
  metadata,
  request,
}: {
  organizationId: string
  userId?: string | null
  clientId?: string | null
  entityType: string
  entityId: string
  action: string
  fieldName?: string | null
  oldValue?: Prisma.InputJsonValue
  newValue?: Prisma.InputJsonValue
  ipAddress?: string | null
  userAgent?: string | null
  source?: string | null
  sensitivityLevel?: string | null
  reason?: string | null
  metadata?: Prisma.InputJsonValue
  request?: Request
}) {
  const requestIp = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request?.headers.get("x-real-ip")
  const requestUserAgent = request?.headers.get("user-agent")
  const previous = await prisma.auditLog.findFirst({
    where: { organizationId },
    select: { eventHash: true },
    orderBy: { createdAt: "desc" },
  })
  const previousHash = previous?.eventHash ?? null
  const eventHash = hashPayload({
    organizationId,
    userId,
    clientId,
    entityType,
    entityId,
    action,
    fieldName,
    oldValue,
    newValue,
    ipAddress: ipAddress ?? requestIp,
    userAgent: userAgent ?? requestUserAgent,
    source: source ?? "system",
    sensitivityLevel: sensitivityLevel ?? "MEDIUM",
    reason,
    metadata,
    previousHash,
  })
  const audit = await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId,
      entityType,
      entityId,
      action,
      fieldName,
      oldValue,
      newValue,
      ipAddress: ipAddress ?? requestIp,
      userAgent: userAgent ?? requestUserAgent,
      source: source ?? "system",
      sensitivityLevel: sensitivityLevel ?? "MEDIUM",
      reason,
      metadata: json(metadata),
      previousHash,
      eventHash,
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    type: "AUDIT_LOG_CREATED",
    title: "Journal d’audit créé",
    description: `${entityType} - ${action}`,
  })

  return audit
}
