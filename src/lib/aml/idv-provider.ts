import { createHmac, timingSafeEqual } from "crypto"
import type { Prisma } from "@prisma/client"

import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"

type IdvStatus = "PENDING" | "PASSED" | "FAILED" | "REVIEW_REQUIRED" | "EXPIRED"

function providerConfig() {
  const name = process.env.IDV_PROVIDER_NAME ?? "generic"
  const isDidit = name.toLowerCase() === "didit"
  return {
    name,
    apiKey: process.env.IDV_PROVIDER_API_KEY,
    baseUrl: process.env.IDV_PROVIDER_BASE_URL ?? (isDidit ? "https://verification.didit.me" : undefined),
    startPath: process.env.IDV_PROVIDER_START_PATH ?? (isDidit ? "/v3/session/" : "/identity-verifications"),
    workflowId: process.env.IDV_PROVIDER_WORKFLOW_ID,
    webhookSecret: process.env.IDV_PROVIDER_WEBHOOK_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    isDidit,
  }
}

export function getIdvProviderStatus() {
  const config = providerConfig()
  const missing: string[] = []
  if (!config.apiKey) missing.push("IDV_PROVIDER_API_KEY")
  if (!config.baseUrl) missing.push("IDV_PROVIDER_BASE_URL")
  if (config.isDidit && !config.workflowId) missing.push("IDV_PROVIDER_WORKFLOW_ID")

  return {
    name: config.name,
    configured: missing.length === 0,
    hasApiKey: Boolean(config.apiKey),
    hasBaseUrl: Boolean(config.baseUrl),
    hasWorkflowId: Boolean(config.workflowId),
    hasWebhookSecret: Boolean(config.webhookSecret),
    callbackUrlConfigured: Boolean(config.appUrl),
    startPath: config.startPath,
    webhookPath: "/api/aml/idv/webhook",
    missing,
  }
}

function providerUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString()
}

function normalizeResult(status?: string | null): IdvStatus {
  const value = status?.toUpperCase().replace(/[\s-]+/g, "_")
  if (["APPROVED", "VERIFIED", "PASSED", "SUCCESS", "COMPLETED"].includes(value ?? "")) return "PASSED"
  if (["DECLINED", "FAILED", "REJECTED", "ERROR"].includes(value ?? "")) return "FAILED"
  if (["REVIEW", "MANUAL_REVIEW", "NEEDS_REVIEW", "REVIEW_REQUIRED"].includes(value ?? "")) return "REVIEW_REQUIRED"
  if (["EXPIRED", "TIMEOUT", "ABANDONED"].includes(value ?? "")) return "EXPIRED"
  return "PENDING"
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue
}

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${sortedJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function safeCompare(signature: string, expected: string) {
  const normalizedSignature = signature.replace(/^sha256=/i, "")
  const receivedBuffer = Buffer.from(normalizedSignature)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

function diditV2Body(rawBody: string) {
  try {
    return sortedJson(JSON.parse(rawBody))
  } catch {
    return rawBody
  }
}

export function verifyIdvWebhookSignature(request: Request, rawBody: string) {
  const secret = providerConfig().webhookSecret
  if (!secret) return true
  const diditV2 = request.headers.get("x-signature-v2")
  if (diditV2) {
    const expected = createHmac("sha256", secret).update(diditV2Body(rawBody)).digest("hex")
    return safeCompare(diditV2, expected)
  }

  const diditRaw = request.headers.get("x-signature")
  if (diditRaw) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
    return safeCompare(diditRaw, expected)
  }

  const received = request.headers.get("x-idv-signature") ?? request.headers.get("x-finadvisor-idv-signature")
  if (!received) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  return safeCompare(received, expected)
}

function requestIp(request?: Request) {
  return request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request?.headers.get("x-real-ip")
    ?? undefined
}

function diditSessionPayload({
  recordId,
  client,
  profileId,
  organizationId,
  workflowId,
  appUrl,
  request,
}: {
  recordId: string
  client: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    emailPrimary: string | null
    phone: string | null
    phonePrimary: string | null
    dateOfBirth: Date | null
    address: string | null
    addressLine1: string | null
    city: string | null
    province: string | null
    postalCode: string | null
    country: string | null
  }
  profileId: string
  organizationId: string
  workflowId: string
  appUrl?: string
  request?: Request
}) {
  const address = [client.addressLine1 ?? client.address, client.city, client.province, client.postalCode, client.country ?? "Canada"]
    .filter(Boolean)
    .join(", ")
  return {
    workflow_id: workflowId,
    vendor_data: recordId,
    callback: appUrl ? `${appUrl}/clients/${client.id}` : undefined,
    callback_method: "both",
    language: "fr",
    contact_details: {
      email: client.emailPrimary ?? client.email ?? undefined,
      send_notification_emails: false,
      email_lang: "fr",
      phone: client.phonePrimary ?? client.phone ?? undefined,
    },
    expected_details: {
      first_name: client.firstName ?? undefined,
      last_name: client.lastName ?? undefined,
      date_of_birth: client.dateOfBirth?.toISOString().slice(0, 10),
      address: address || undefined,
      ip_address: requestIp(request),
    },
    metadata: JSON.stringify({
      organizationId,
      amlProfileId: profileId,
      amlIdentityVerificationId: recordId,
      source: "finadvisor-crm",
    }),
  }
}

function genericSessionPayload({
  recordId,
  clientId,
  profileId,
  organizationId,
  client,
  appUrl,
}: {
  recordId: string
  clientId: string
  profileId: string
  organizationId: string
  client: {
    firstName: string | null
    lastName: string | null
    email: string | null
    emailPrimary: string | null
    phone: string | null
    phonePrimary: string | null
    dateOfBirth: Date | null
    address: string | null
    addressLine1: string | null
    city: string | null
    province: string | null
    postalCode: string | null
    country: string | null
  }
  appUrl?: string
}) {
  return {
    referenceId: recordId,
    clientId,
    callbackUrl: appUrl ? `${appUrl}/api/aml/idv/webhook` : undefined,
    person: {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.emailPrimary ?? client.email,
      phone: client.phonePrimary ?? client.phone,
      dateOfBirth: client.dateOfBirth?.toISOString().slice(0, 10),
      address: {
        line1: client.addressLine1 ?? client.address,
        city: client.city,
        province: client.province,
        postalCode: client.postalCode,
        country: client.country ?? "Canada",
      },
    },
    metadata: {
      organizationId,
      amlProfileId: profileId,
      amlIdentityVerificationId: recordId,
    },
  }
}

function providerHeaders(config: ReturnType<typeof providerConfig>): Record<string, string> {
  if (config.isDidit) {
    return {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
    }
  }
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  }
}

export async function startProviderIdentityVerification({
  organizationId,
  clientId,
  userId,
  request,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  request?: Request
}) {
  const config = providerConfig()
  const profile = await ensureAmlProfile({ organizationId, clientId, userId, request })
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailPrimary: true,
      phone: true,
      phonePrimary: true,
      dateOfBirth: true,
      address: true,
      addressLine1: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      profileType: true,
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const record = await prisma.amlIdentityVerification.create({
    data: {
      organizationId,
      clientId,
      amlProfileId: profile.id,
      verificationRequired: true,
      reason: "Vérification d'identité par fournisseur IDV",
      personType: client.profileType === "BUSINESS" ? "ENTITY_REPRESENTATIVE" : "INDIVIDUAL",
      method: "IDV_PROVIDER",
      provider: config.name,
      result: "PENDING",
      notes: "Session IDV créée depuis le CRM.",
      metadata: { provider: config.name, providerConfigured: Boolean(config.apiKey && config.baseUrl), workflowIdConfigured: Boolean(config.workflowId) },
    },
  })

  if (!config.apiKey || !config.baseUrl || (config.isDidit && !config.workflowId)) {
    await createAuditLog({
      organizationId,
      userId,
      clientId,
      entityType: "AmlIdentityVerification",
      entityId: record.id,
      action: "AML_IDV_PROVIDER_CONFIGURATION_MISSING",
      newValue: { provider: config.name, recordId: record.id, missing: getIdvProviderStatus().missing },
      source: "system",
      sensitivityLevel: "HIGH",
      request,
    })
    return { record, providerConfigured: false, providerResponse: null }
  }

  const body = config.isDidit && config.workflowId
    ? diditSessionPayload({
      recordId: record.id,
      client,
      profileId: profile.id,
      organizationId,
      workflowId: config.workflowId,
      appUrl: config.appUrl,
      request,
    })
    : genericSessionPayload({
      recordId: record.id,
      clientId,
      profileId: profile.id,
      organizationId,
      client,
      appUrl: config.appUrl,
    })
  const response = await fetch(providerUrl(config.baseUrl, config.startPath), {
    method: "POST",
    headers: providerHeaders(config),
    body: JSON.stringify(body),
  })

  const providerResponse = await response.json().catch(() => ({ statusText: response.statusText }))
  const externalId = providerResponse?.session_id ?? providerResponse?.id ?? providerResponse?.verificationId ?? providerResponse?.sessionId ?? providerResponse?.reference
  const verificationUrl = providerResponse?.url ?? providerResponse?.verification_url
  const updated = await prisma.amlIdentityVerification.update({
    where: { id: record.id },
    data: {
      result: response.ok ? "PENDING" : "REVIEW_REQUIRED",
      metadata: safeJson({
        provider: config.name,
        providerConfigured: true,
        providerStatus: response.status,
        externalId,
        verificationUrl,
        providerResponse,
      }),
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AmlIdentityVerification",
    entityId: updated.id,
    action: "AML_IDV_PROVIDER_STARTED",
    newValue: { provider: config.name, providerStatus: response.status, externalId, verificationUrl: Boolean(verificationUrl) },
    source: "system",
    sensitivityLevel: "HIGH",
    request,
  })

  await recalculateAmlRisk({ organizationId, clientId, userId, request })
  return { record: updated, providerConfigured: true, providerResponse }
}

export async function applyProviderIdentityVerificationWebhook({
  payload,
  request,
}: {
  payload: Record<string, unknown>
  request?: Request
}) {
  let metadata = payload.metadata as Record<string, unknown> | undefined
  if (typeof payload.metadata === "string") {
    try {
      metadata = JSON.parse(payload.metadata || "{}") as Record<string, unknown>
    } catch {
      metadata = undefined
    }
  }
  const referenceId = payload.referenceId
    ?? payload.clientReferenceId
    ?? payload.client_reference_id
    ?? payload.vendor_data
    ?? metadata?.amlIdentityVerificationId
  if (typeof referenceId !== "string") throw new Error("IDV_REFERENCE_REQUIRED")

  const record = await prisma.amlIdentityVerification.findUnique({ where: { id: referenceId } })
    ?? await prisma.amlIdentityVerification.findFirst({
      where: {
        metadata: {
          path: ["externalId"],
          equals: referenceId,
        },
      },
    })
  if (!record) throw new Error("IDV_RECORD_NOT_FOUND")

  const rawStatus = typeof payload.status === "string"
    ? payload.status
    : typeof payload.result === "string"
      ? payload.result
      : undefined
  const result = normalizeResult(rawStatus)
  const updated = await prisma.amlIdentityVerification.update({
    where: { id: record.id },
    data: {
      result,
      verifiedAt: result === "PASSED" ? new Date() : record.verifiedAt,
      notes: result === "PASSED" ? "Vérification IDV réussie par webhook fournisseur." : record.notes,
      metadata: safeJson({
        ...(record.metadata as Record<string, unknown> | null ?? {}),
        webhookPayload: payload,
        webhookReceivedAt: new Date().toISOString(),
      }),
    },
  })

  await createAuditLog({
    organizationId: record.organizationId,
    userId: null,
    clientId: record.clientId,
    entityType: "AmlIdentityVerification",
    entityId: record.id,
    action: "AML_IDV_PROVIDER_WEBHOOK_APPLIED",
    oldValue: { result: record.result },
    newValue: { result: updated.result },
    source: "webhook",
    sensitivityLevel: "HIGH",
    request,
  })

  await recalculateAmlRisk({ organizationId: record.organizationId, clientId: record.clientId, userId: null, request })
  return updated
}
