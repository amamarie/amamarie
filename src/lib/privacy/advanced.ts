import { Prisma, type PrivacySettings, type UserRole } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { createNotification } from "@/lib/services/notifications"
import { prisma } from "@/lib/prisma"

export async function ensurePrivacySettings(organizationId: string, userId?: string | null) {
  return prisma.privacySettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, updatedById: userId ?? undefined },
  })
}

export function booleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true
    if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false
  }
  return fallback
}

export function numberSetting(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function maskValue(value: unknown, mode: "PARTIAL" | "FULL" = "PARTIAL") {
  if (value === null || value === undefined) return value
  const text = String(value)
  if (!text) return text
  if (mode === "FULL" || text.length <= 4) return "••••"
  return `${text.slice(0, 2)}${"•".repeat(Math.min(8, Math.max(2, text.length - 4)))}${text.slice(-2)}`
}

export function maskSensitiveRecord<T extends Record<string, unknown>>({
  record,
  settings,
  role,
}: {
  record: T
  settings: PrivacySettings
  role?: UserRole | null
}) {
  if (!settings.defaultPrivacyMode || role === "OWNER" || role === "COMPLIANCE") return record
  const masked = { ...record }
  const shouldMask = (keys: string[], enabled: boolean) => {
    if (!enabled) return
    for (const key of keys) {
      if (key in masked) masked[key as keyof T] = maskValue(masked[key as keyof T]) as T[keyof T]
    }
  }
  shouldMask(["phone", "phonePrimary", "phoneSecondary"], settings.maskPhone)
  shouldMask(["email", "emailPrimary", "emailSecondary"], settings.maskEmail)
  shouldMask(["address", "addressLine1", "city", "postalCode"], settings.maskAddress)
  shouldMask(["annualIncome", "netWorth", "liquidAssets", "liabilities", "premium", "coverageAmount", "accountValue"], settings.maskFinancialValues)
  shouldMask(["dateOfBirth"], settings.maskDateOfBirth)
  shouldMask(["sin", "taxNumber", "socialInsuranceNumber"], settings.maskTaxIdentifiers)
  shouldMask(["medicalNotes", "healthData"], settings.maskHealthData)
  return masked
}

function riskLevel(score: number) {
  if (score >= 85) return "CRITICAL"
  if (score >= 70) return "HIGH"
  if (score >= 45) return "MEDIUM"
  return "LOW"
}

export async function logPrivacyAccessRisk({
  organizationId,
  userId,
  clientId,
  documentId,
  eventType,
  request,
  metadata,
}: {
  organizationId: string
  userId?: string | null
  clientId?: string | null
  documentId?: string | null
  eventType: string
  request?: Request
  metadata?: Prisma.InputJsonValue
}) {
  const settings = await ensurePrivacySettings(organizationId, userId)
  if (!settings.anomalyDetectionEnabled) return null

  const ipAddress = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request?.headers.get("x-real-ip") ?? null
  const userAgent = request?.headers.get("user-agent") ?? null
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentEvents = userId
    ? await prisma.privacyAccessRiskEvent.count({ where: { organizationId, userId, createdAt: { gte: oneHourAgo } } })
    : 0
  const hour = new Date().getHours()
  const reasons: string[] = []
  let score = 10

  if (["DOWNLOAD", "EXPORT", "MASS_EXPORT"].includes(eventType)) {
    score += eventType === "MASS_EXPORT" ? 55 : 30
    reasons.push(eventType === "MASS_EXPORT" ? "Export massif ou portabilité" : "Téléchargement/export de données")
  }
  if (documentId) {
    score += 15
    reasons.push("Document client consulté")
  }
  if (recentEvents >= 10) {
    score += 25
    reasons.push("Volume d’accès inhabituel dans la dernière heure")
  }
  if (hour < 6 || hour > 22) {
    score += 15
    reasons.push("Accès hors heures normales")
  }
  if (!ipAddress) {
    score += 5
    reasons.push("Adresse IP non disponible")
  }

  const finalScore = Math.min(100, score)
  const level = riskLevel(finalScore)
  const event = await prisma.privacyAccessRiskEvent.create({
    data: {
      organizationId,
      userId: userId ?? undefined,
      clientId: clientId ?? undefined,
      documentId: documentId ?? undefined,
      eventType,
      riskScore: finalScore,
      riskLevel: level,
      reason: reasons.join("; ") || "Accès normal journalisé",
      ipAddress,
      userAgent,
      metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      status: finalScore >= settings.anomalyRiskThreshold ? "OPEN" : "INFO",
    },
  })

  if (finalScore >= settings.anomalyRiskThreshold) {
    await createNotification({
      organizationId,
      type: "ALERT",
      priority: level === "CRITICAL" ? "URGENT" : "HIGH",
      title: "Accès aux renseignements à vérifier",
      message: `${event.eventType} avec score ${event.riskScore}/100. ${event.reason ?? ""}`,
      clientId: clientId ?? undefined,
      documentId: documentId ?? undefined,
      entityType: "PrivacyAccessRiskEvent",
      entityId: event.id,
      actionLabel: "Ouvrir conformité",
      actionUrl: "/compliance",
    })
  }

  return event
}

export async function reviewPrivacyAccessRiskEvent({
  organizationId,
  userId,
  eventId,
  status = "REVIEWED",
}: {
  organizationId: string
  userId: string
  eventId: string
  status?: string
}) {
  const event = await prisma.privacyAccessRiskEvent.update({
    where: { id: eventId },
    data: { status, reviewedAt: new Date(), reviewedById: userId },
  })
  await createAuditLog({ organizationId, userId, entityType: "PrivacyAccessRiskEvent", entityId: event.id, action: "PRIVACY_ACCESS_RISK_REVIEWED", newValue: { status } })
  return event
}
