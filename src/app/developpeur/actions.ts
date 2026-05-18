"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { hashInternalPassword } from "@/lib/auth/internal"
import { requireSaasRole } from "@/lib/auth/roles"
import {
  encodeModuleAccess,
  moduleCatalog,
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  normalizeSubscriptionStatus,
  organizationTypeForSubscriptionPlan,
  subscriptionPlans,
  type ModuleKey,
} from "@/lib/billing/plans"
import {
  generateApiKey,
  generateOAuthClientSecret,
  generateWebhookSecret,
  getQuotaLimits,
  hashSecret,
  permissionsForLevel,
  parseJsonStringArray,
  seedDeveloperSandbox,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { webhookEventLabels } from "@/lib/developer-api/catalog"
import { getConnectorProvider } from "@/lib/developer-api/reference"
import { TEMPORARY_ADVISOR_PASSWORD } from "@/lib/developer-console"
import { setPublicPricingMode, setSubscriptionPlanMonthlyPrice } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

export type DeveloperApiActionState = {
  status: "idle" | "success" | "error"
  message?: string
  secret?: string
}

function normalizePostedModules(modules: FormDataEntryValue[]): ModuleKey[] {
  const validKeys = new Set(moduleCatalog.map((module) => module.key))
  return Array.from(new Set(modules.map(String).filter((module): module is ModuleKey => validKeys.has(module as ModuleKey))))
}

function hasPlanDefaultModules(modules: ModuleKey[], plan: ReturnType<typeof normalizeSubscriptionPlan>) {
  const defaultModules = subscriptionPlans[plan].modules
  const moduleSet = new Set(modules)
  return moduleSet.size === defaultModules.length && defaultModules.every((module) => moduleSet.has(module))
}

export async function updateOrganizationAccess(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  if (!organizationId) redirect("/developpeur/cabinets?access=invalid")

  const plan = normalizeSubscriptionPlan(formData.get("subscriptionPlan"))
  const status = normalizeSubscriptionStatus(formData.get("subscriptionStatus"))
  const pricingMode = normalizeSubscriptionPricingMode(formData.get("subscriptionPricingMode"))
  const currency = normalizeSubscriptionCurrency(formData.get("subscriptionCurrency"))
  const organizationType = organizationTypeForSubscriptionPlan(plan)
  const action = String(formData.get("action") ?? "save")
  const appliesPlanDefaults = action === "applyPlan" || action === "resetModules"
  const submittedSeatLimit = Math.max(1, Number.parseInt(String(formData.get("advisorSeatLimit") ?? "1"), 10) || 1)
  const seatLimit = appliesPlanDefaults ? subscriptionPlans[plan].defaultSeatLimit : submittedSeatLimit
  const postedModules = normalizePostedModules(formData.getAll("modules"))
  const selectedModules = appliesPlanDefaults ? [...subscriptionPlans[plan].modules] : postedModules
  const moduleAccess = hasPlanDefaultModules(selectedModules, plan) ? null : encodeModuleAccess(selectedModules)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      organizationType,
      subscriptionPlan: plan,
      subscriptionStatus: status,
      subscriptionPricingMode: pricingMode,
      subscriptionCurrency: currency,
      advisorSeatLimit: seatLimit,
      moduleAccess,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: currentUser.id,
      action: "SAAS_ACCESS_UPDATED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: {
        organizationType,
        subscriptionPlan: plan,
        subscriptionStatus: status,
        subscriptionPricingMode: pricingMode,
        subscriptionCurrency: currency,
        advisorSeatLimit: seatLimit,
        moduleAccess,
      },
    },
  }).catch(() => null)

  revalidatePath("/developpeur")
  revalidatePath("/developpeur/cabinets")
  revalidatePath(`/developpeur/cabinets/${organizationId}`)
  redirect(`/developpeur/cabinets?cabinetId=${encodeURIComponent(organizationId)}&access=${action === "applyPlan" ? "plan-applied" : "updated"}`)
}

export async function updatePublicPricingMode(formData: FormData) {
  await requireSaasRole(["DEVELOPER"])
  await setPublicPricingMode(formData.get("publicPricingMode"))

  revalidatePath("/")
  revalidatePath("/forfaits")
  revalidatePath("/forfaits-beta")
  revalidatePath("/developpeur")
  revalidatePath("/developpeur/cabinets")
  revalidatePath("/super-admin/parametres")
}

export async function updateSubscriptionPlanPrice(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const plan = normalizeSubscriptionPlan(formData.get("plan"))
  const pricingMode = normalizeSubscriptionPricingMode(formData.get("pricingMode"))
  const currency = normalizeSubscriptionCurrency(formData.get("currency"))
  const monthlyAmount = Number.parseFloat(String(formData.get("monthlyAmount") ?? "0").replace(",", "."))

  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    redirect("/super-admin/parametres?price=invalid")
  }

  const updatedPrice = await setSubscriptionPlanMonthlyPrice({
    plan,
    pricingMode,
    currency,
    monthlyAmount,
  })

  await prisma.auditLog.create({
    data: {
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "SAAS_PLAN_PRICE_UPDATED",
      entityType: "PlatformSetting",
      entityId: `${pricingMode}:${plan}:${currency}`,
      newValue: updatedPrice,
    },
  }).catch(() => null)

  revalidatePath("/")
  revalidatePath("/forfaits")
  revalidatePath("/forfaits-beta")
  revalidatePath("/developpeur")
  revalidatePath("/developpeur/cabinets")
  revalidatePath("/developpeur/plans")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/clients")
  revalidatePath("/super-admin/finance")
  revalidatePath("/super-admin/parametres")
}

export async function resetUserPassword(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const userId = String(formData.get("userId") ?? "")
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      internalCredential: { select: { id: true } },
    },
  })

  if (!targetUser || targetUser.role === "DEVELOPER" || targetUser.role === "CLIENT") {
    redirect("/developpeur/cabinets?passwordReset=forbidden")
  }

  const passwordPayload = await hashInternalPassword(TEMPORARY_ADVISOR_PASSWORD)

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      internalCredential: targetUser.internalCredential
        ? { update: { ...passwordPayload, passwordUpdatedAt: new Date() } }
        : { create: passwordPayload },
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: targetUser.organizationId,
      userId: currentUser.id,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: targetUser.id,
      newValue: {
        email: targetUser.email,
        role: targetUser.role,
        resetBy: currentUser.email,
      },
    },
  }).catch(() => null)

  revalidatePath("/developpeur")
  revalidatePath("/developpeur/cabinets")
  redirect(`/developpeur/cabinets?passwordReset=${encodeURIComponent(targetUser.email)}`)
}

export async function createDeveloperApiKeyAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const environment = String(formData.get("environment") ?? "production") === "sandbox" ? "sandbox" : "production"
  const permissionLevel = String(formData.get("permissionLevel") ?? "read_create")
  const permissions = permissionsForLevel(permissionLevel, formData.getAll("permissions").map(String))
  const allowedIps = String(formData.get("allowedIps") ?? "").trim() || null
  const allowedDomains = String(formData.get("allowedDomains") ?? "").trim() || null
  const quotaMonthly = Math.max(0, Number.parseInt(String(formData.get("quotaMonthly") ?? "0"), 10) || 0) || null
  const expiration = String(formData.get("expiration") ?? "never")

  if (!organizationId || !name) return { status: "error", message: "Organisation et nom de clé requis." }
  if (permissions.length === 0) return { status: "error", message: "Sélectionne au moins une permission." }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscriptionPlan: true, name: true },
  })
  if (!organization) return { status: "error", message: "Cabinet introuvable." }

  const limits = await getQuotaLimits(organizationId)
  if (environment === "sandbox" && !limits.sandbox) {
    return { status: "error", message: "La sandbox n’est pas incluse dans le forfait actuel." }
  }

  const activeCount = await prisma.developerApiKey.count({
    where: { organizationId, status: "ACTIVE" },
  })
  if (activeCount >= limits.activeApiKeys) {
    return { status: "error", message: `Limite atteinte: ${limits.activeApiKeys} clé(s) active(s) pour ce forfait.` }
  }

  const expiresAt = getExpirationDate(expiration)
  const generated = generateApiKey(environment)

  const apiKey = await prisma.developerApiKey.create({
    data: {
      organizationId,
      createdById: currentUser.id,
      name,
      description,
      environment,
      permissionLevel,
      permissions,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      allowedIps,
      allowedDomains,
      quotaMonthly,
      expiresAt,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_API_KEY_CREATED",
      entityType: "DeveloperApiKey",
      entityId: apiKey.id,
      newValue: {
        name,
        environment,
        permissionLevel,
        permissions,
        keyPrefix: generated.keyPrefix,
        expiresAt,
      },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
  return {
    status: "success",
    message: `Clé API créée pour ${organization.name}. Copie-la maintenant, elle ne sera plus affichée.`,
    secret: generated.key,
  }
}

export async function revokeDeveloperApiKey(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const apiKeyId = String(formData.get("apiKeyId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  const apiKey = await prisma.developerApiKey.findUnique({ where: { id: apiKeyId } })
  if (!apiKey) return
  if (confirmation !== "REVOQUER") {
    redirect("/developpeur/api?confirmation=required")
  }

  await prisma.developerApiKey.update({
    where: { id: apiKeyId },
    data: { status: "REVOKED", revokedAt: new Date() },
  })
  await prisma.auditLog.create({
    data: {
      organizationId: apiKey.organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_API_KEY_REVOKED",
      entityType: "DeveloperApiKey",
      entityId: apiKey.id,
      oldValue: { status: apiKey.status },
      newValue: { status: "REVOKED" },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
}

export async function regenerateDeveloperApiKeyAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const apiKeyId = String(formData.get("apiKeyId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  const apiKey = await prisma.developerApiKey.findUnique({ where: { id: apiKeyId } })
  if (!apiKey) return { status: "error", message: "Clé introuvable." }
  if (confirmation !== "REGENERER") return { status: "error", message: "Tape REGENERER pour confirmer la régénération." }

  const generated = generateApiKey(apiKey.environment)
  await prisma.developerApiKey.update({
    where: { id: apiKey.id },
    data: {
      keyHash: generated.keyHash,
      keyPrefix: generated.keyPrefix,
      status: "ACTIVE",
      revokedAt: null,
      lastUsedAt: null,
    },
  })
  await prisma.auditLog.create({
    data: {
      organizationId: apiKey.organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_API_KEY_REGENERATED",
      entityType: "DeveloperApiKey",
      entityId: apiKey.id,
      newValue: { keyPrefix: generated.keyPrefix },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
  return {
    status: "success",
    message: `Clé régénérée pour ${apiKey.name}. L’ancienne clé est invalidée.`,
    secret: generated.key,
  }
}

export async function createDeveloperWebhookAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const url = String(formData.get("url") ?? "").trim()
  const environment = String(formData.get("environment") ?? "production") === "sandbox" ? "sandbox" : "production"
  const events = formData.getAll("events").map(String).filter((event) => event in webhookEventLabels)

  if (!organizationId || !name || !url) return { status: "error", message: "Organisation, nom et URL requis." }
  if (!url.startsWith("https://")) return { status: "error", message: "L’URL webhook doit commencer par https://." }
  if (events.length === 0) return { status: "error", message: "Sélectionne au moins un événement." }

  const limits = await getQuotaLimits(organizationId)
  if (environment === "sandbox" && !limits.sandbox) {
    return { status: "error", message: "La sandbox n’est pas incluse dans le forfait actuel." }
  }

  const activeCount = await prisma.developerWebhook.count({ where: { organizationId, status: "ACTIVE" } })
  if (activeCount >= limits.activeWebhooks) {
    return { status: "error", message: `Limite atteinte: ${limits.activeWebhooks} webhook(s) actif(s) pour ce forfait.` }
  }

  const generated = generateWebhookSecret()
  const webhook = await prisma.developerWebhook.create({
    data: {
      organizationId,
      createdById: currentUser.id,
      name,
      url,
      environment,
      events,
      secretPrefix: generated.secretPrefix,
      secretHash: generated.secretHash,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_WEBHOOK_CREATED",
      entityType: "DeveloperWebhook",
      entityId: webhook.id,
      newValue: { name, url, environment, events },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
  return {
    status: "success",
    message: "Webhook créé. Copie le secret maintenant, il ne sera plus affiché.",
    secret: generated.secret,
  }
}

export async function revokeDeveloperWebhook(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const webhookId = String(formData.get("webhookId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  const webhook = await prisma.developerWebhook.findUnique({ where: { id: webhookId } })
  if (!webhook) return
  if (confirmation !== "REVOQUER") {
    redirect("/developpeur/api?confirmation=required")
  }

  await prisma.developerWebhook.update({
    where: { id: webhook.id },
    data: { status: "REVOKED" },
  })
  await prisma.auditLog.create({
    data: {
      organizationId: webhook.organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_WEBHOOK_REVOKED",
      entityType: "DeveloperWebhook",
      entityId: webhook.id,
      oldValue: { status: webhook.status },
      newValue: { status: "REVOKED" },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
}

export async function testDeveloperWebhookAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  await requireSaasRole(["DEVELOPER"])
  const webhookId = String(formData.get("webhookId") ?? "")
  const event = String(formData.get("event") ?? "contact.created")
  const webhook = await prisma.developerWebhook.findUnique({ where: { id: webhookId } })
  if (!webhook) return { status: "error", message: "Webhook introuvable." }
  if (!parseJsonStringArray(webhook.events).includes(event)) {
    return { status: "error", message: "Cet événement n’est pas activé sur ce webhook." }
  }

  const startedAt = Date.now()
  const payload = {
    id: `evt_test_${Date.now()}`,
    event,
    created_at: new Date().toISOString(),
    environment: webhook.environment,
    data: {
      contact_id: "contact_test_001",
      first_name: "Jean",
      last_name: "Martin",
      source: "sandbox",
    },
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-finadvisor-event": event,
        "x-finadvisor-test": "true",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    })
    const latencyMs = Date.now() - startedAt
    await prisma.developerWebhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastStatusCode: response.status,
        failureCount: response.ok ? 0 : { increment: 1 },
        successRate: response.ok ? 100 : Math.max(0, webhook.successRate - 10),
      },
    })
    await writeDeveloperApiLog({
      organizationId: webhook.organizationId,
      webhookId: webhook.id,
      type: "Webhook",
      method: "POST",
      endpoint: event,
      environment: webhook.environment,
      statusCode: response.status,
      latencyMs,
      responseBody: { test: true, ok: response.ok },
    })
    revalidatePath("/developpeur/api")

    return {
      status: response.ok ? "success" : "error",
      message: response.ok ? `Test envoyé avec succès. Code HTTP ${response.status}, ${latencyMs} ms.` : `Le webhook a répondu ${response.status} en ${latencyMs} ms.`,
    }
  } catch (error) {
    await writeDeveloperApiLog({
      organizationId: webhook.organizationId,
      webhookId: webhook.id,
      type: "Webhook",
      method: "POST",
      endpoint: event,
      environment: webhook.environment,
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      errorCode: "webhook_test_failed",
      errorMessage: error instanceof Error ? error.message : "Webhook test failed",
    })

    return { status: "error", message: error instanceof Error ? error.message : "Test webhook impossible." }
  }
}

export async function seedDeveloperSandboxAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  if (!organizationId) return { status: "error", message: "Cabinet requis." }

  const limits = await getQuotaLimits(organizationId)
  if (!limits.sandbox) return { status: "error", message: "La sandbox n’est pas disponible pour ce forfait." }

  const result = await seedDeveloperSandbox(organizationId)
  revalidatePath("/developpeur/api")
  return {
    status: "success",
    message: `Sandbox générée: ${result.contacts} contacts, ${result.deals} opportunités, ${result.tasks} tâches, ${result.appointments} rendez-vous, ${result.campaigns} campagnes, ${result.documents} documents.`,
  }
}

export async function resetDeveloperSandboxAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  if (!organizationId) return { status: "error", message: "Cabinet requis." }
  if (confirmation !== "REINITIALISER") return { status: "error", message: "Tape REINITIALISER pour confirmer la réinitialisation." }

  await prisma.developerSandboxRecord.deleteMany({ where: { organizationId } })
  revalidatePath("/developpeur/api")
  return { status: "success", message: "Sandbox réinitialisée." }
}

export async function createDeveloperOAuthClientAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const permissionLevel = String(formData.get("permissionLevel") ?? "read_create")
  const permissions = permissionsForLevel(permissionLevel, formData.getAll("permissions").map(String))
  const redirectUris = String(formData.get("redirectUris") ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!organizationId || !name) return { status: "error", message: "Cabinet et nom du client OAuth requis." }
  if (permissions.length === 0) return { status: "error", message: "Sélectionne au moins une permission." }

  const generated = generateOAuthClientSecret()
  const client = await prisma.developerOAuthClient.create({
    data: {
      organizationId,
      name,
      clientId: generated.clientId,
      clientSecretHash: generated.clientSecretHash,
      clientSecretPrefix: generated.clientSecretPrefix,
      redirectUris,
      permissions,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_OAUTH_CLIENT_CREATED",
      entityType: "DeveloperOAuthClient",
      entityId: client.id,
      newValue: { name, clientId: generated.clientId, permissions, redirectUris },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
  return {
    status: "success",
    message: "Client OAuth créé. Copie le secret maintenant, il ne sera plus affiché.",
    secret: `${generated.clientId}\n${generated.clientSecret}`,
  }
}

export async function revokeDeveloperOAuthClient(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const clientId = String(formData.get("clientId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  const client = await prisma.developerOAuthClient.findUnique({ where: { id: clientId } })
  if (!client) return
  if (confirmation !== "REVOQUER") {
    redirect("/developpeur/api?confirmation=required")
  }

  await prisma.developerOAuthClient.update({ where: { id: client.id }, data: { status: "REVOKED" } })
  await prisma.developerOAuthAccessToken.updateMany({ where: { clientId: client.id }, data: { status: "REVOKED" } })
  await prisma.auditLog.create({
    data: {
      organizationId: client.organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_OAUTH_CLIENT_REVOKED",
      entityType: "DeveloperOAuthClient",
      entityId: client.id,
      oldValue: { status: client.status },
      newValue: { status: "REVOKED" },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
}

export async function upsertDeveloperIntegrationAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const provider = String(formData.get("provider") ?? "").trim()
  const providerConfig = getConnectorProvider(provider)
  const category = String(formData.get("category") ?? providerConfig.category).trim() || providerConfig.category
  const externalAccount = String(formData.get("externalAccount") ?? "").trim()
  const connectionUrl = String(formData.get("connectionUrl") ?? "").trim()
  const secret = String(formData.get("secret") ?? "")

  if (!organizationId || !provider || !category) return { status: "error", message: "Cabinet, fournisseur et catégorie requis." }
  if (providerConfig.testMode === "webhook_post" && connectionUrl && !connectionUrl.startsWith("https://")) {
    return { status: "error", message: "L’URL de test doit commencer par https://." }
  }

  const setupStatus =
    providerConfig.testMode === "webhook_post"
      ? connectionUrl
        ? "READY_TO_TEST"
        : "NEEDS_WEBHOOK_URL"
      : providerConfig.testMode === "api_key_present"
        ? secret
          ? "READY_TO_TEST"
          : "NEEDS_API_KEY"
        : "NEEDS_OAUTH_CONNECTION"
  const status = setupStatus === "READY_TO_TEST" ? "CONNECTED" : "NEEDS_CONFIGURATION"

  await prisma.developerIntegrationConnection.upsert({
    where: { organizationId_provider: { organizationId, provider } },
    create: {
      organizationId,
      provider,
      category,
      status,
      config: {
        externalAccount,
        connectionUrl,
        authMethod: providerConfig.authMethod,
        testMode: providerConfig.testMode,
        setupStatus,
        setupHint: providerConfig.setupHint,
        lastDiagnostic: setupStatus === "READY_TO_TEST" ? "Configuration prête pour test." : providerConfig.setupHint,
      },
      secretHash: secret ? hashSecret(secret) : null,
      lastSyncAt: status === "CONNECTED" ? new Date() : null,
    },
    update: {
      category,
      status,
      config: {
        externalAccount,
        connectionUrl,
        authMethod: providerConfig.authMethod,
        testMode: providerConfig.testMode,
        setupStatus,
        setupHint: providerConfig.setupHint,
        lastDiagnostic: setupStatus === "READY_TO_TEST" ? "Configuration prête pour test." : providerConfig.setupHint,
      },
      ...(secret ? { secretHash: hashSecret(secret) } : {}),
      lastSyncAt: status === "CONNECTED" ? new Date() : null,
    },
  })

  revalidatePath("/developpeur/api")
  return { status: "success", message: `${providerConfig.name} est configuré pour ce cabinet. Statut: ${setupStatus}.` }
}

export async function testDeveloperIntegrationAction(_state: DeveloperApiActionState, formData: FormData): Promise<DeveloperApiActionState> {
  await requireSaasRole(["DEVELOPER"])
  const integrationId = String(formData.get("integrationId") ?? "")
  const integration = await prisma.developerIntegrationConnection.findUnique({
    where: { id: integrationId },
    include: { organization: { select: { name: true } } },
  })
  if (!integration) return { status: "error", message: "Connecteur introuvable." }

  const providerConfig = getConnectorProvider(integration.provider)
  const config = integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {}

  if (providerConfig.testMode === "webhook_post") {
    const connectionUrl = String(config.connectionUrl ?? "")
    if (!connectionUrl.startsWith("https://")) {
      await prisma.developerIntegrationConnection.update({
        where: { id: integration.id },
        data: {
          status: "NEEDS_CONFIGURATION",
          config: { ...config, lastDiagnostic: "URL webhook HTTPS manquante.", lastTestAt: new Date().toISOString() },
        },
      })
      revalidatePath("/developpeur/api")
      return { status: "error", message: "URL webhook HTTPS manquante." }
    }

    const startedAt = Date.now()
    try {
      const response = await fetch(connectionUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-finadvisor-integration-test": "true",
        },
        body: JSON.stringify({
          event: "integration.test",
          provider: integration.provider,
          organization: integration.organization.name,
          created_at: new Date().toISOString(),
          data: {
            contact_id: "contact_test_001",
            first_name: "Jean",
            last_name: "Martin",
          },
        }),
        signal: AbortSignal.timeout(8_000),
      })
      const latencyMs = Date.now() - startedAt
      await prisma.developerIntegrationConnection.update({
        where: { id: integration.id },
        data: {
          status: response.ok ? "CONNECTED" : "ERROR",
          lastSyncAt: new Date(),
          config: {
            ...config,
            lastTestAt: new Date().toISOString(),
            lastStatusCode: response.status,
            lastLatencyMs: latencyMs,
            lastDiagnostic: response.ok ? `Test reçu par ${providerConfig.name}.` : `${providerConfig.name} a répondu HTTP ${response.status}.`,
          },
        },
      })
      revalidatePath("/developpeur/api")
      return {
        status: response.ok ? "success" : "error",
        message: response.ok ? `Test ${providerConfig.name} réussi: HTTP ${response.status}, ${latencyMs} ms.` : `Test ${providerConfig.name}: HTTP ${response.status}, ${latencyMs} ms.`,
      }
    } catch (error) {
      await prisma.developerIntegrationConnection.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          config: {
            ...config,
            lastTestAt: new Date().toISOString(),
            lastDiagnostic: error instanceof Error ? error.message : "Test connecteur impossible.",
          },
        },
      })
      revalidatePath("/developpeur/api")
      return { status: "error", message: error instanceof Error ? error.message : "Test connecteur impossible." }
    }
  }

  const hasSecret = Boolean(integration.secretHash)
  const status = providerConfig.testMode === "api_key_present"
    ? hasSecret ? "CONNECTED" : "NEEDS_CONFIGURATION"
    : "NEEDS_CONFIGURATION"
  const diagnostic = providerConfig.testMode === "api_key_present"
    ? hasSecret ? "Clé API enregistrée sous forme hachée. Aucun appel externe n’est lancé sans secret en clair." : "Clé API manquante."
    : providerConfig.setupHint

  await prisma.developerIntegrationConnection.update({
    where: { id: integration.id },
    data: {
      status,
      config: {
        ...config,
        lastTestAt: new Date().toISOString(),
        lastDiagnostic: diagnostic,
      },
    },
  })
  revalidatePath("/developpeur/api")
  return { status: status === "CONNECTED" ? "success" : "error", message: diagnostic }
}

export async function disconnectDeveloperIntegration(formData: FormData) {
  await requireSaasRole(["DEVELOPER"])
  const integrationId = String(formData.get("integrationId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  if (confirmation !== "DESACTIVER") redirect("/developpeur/api?confirmation=required")

  await prisma.developerIntegrationConnection.update({
    where: { id: integrationId },
    data: { status: "DISCONNECTED" },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
}

export async function updateDeveloperPartnerRequestStatus(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const requestId = String(formData.get("requestId") ?? "")
  const status = String(formData.get("status") ?? "IN_REVIEW")
  const internalNotes = String(formData.get("internalNotes") ?? "").trim() || null
  const allowedStatuses = new Set(["NEW", "IN_REVIEW", "APPROVED", "REJECTED"])
  if (!requestId || !allowedStatuses.has(status)) return

  const request = await prisma.developerPartnerRequest.update({
    where: { id: requestId },
    data: {
      status,
      internalNotes,
      reviewedAt: status === "NEW" ? null : new Date(),
    },
  }).catch(() => null)
  if (!request) return

  await prisma.auditLog.create({
    data: {
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "DEVELOPER_PARTNER_REQUEST_UPDATED",
      entityType: "DeveloperPartnerRequest",
      entityId: request.id,
      newValue: {
        companyName: request.companyName,
        email: request.email,
        status,
        internalNotes,
      },
    },
  }).catch(() => null)

  revalidatePath("/developpeur/api")
}

export async function createSuperAdminTicket(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const subject = String(formData.get("subject") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const priority = String(formData.get("priority") ?? "NORMAL")
  const module = String(formData.get("module") ?? "").trim() || null
  if (!organizationId || !subject) return

  const ticket = await prisma.superAdminTicket.create({
    data: { organizationId, createdById: currentUser.id, subject, description, priority, module, status: "OPEN" },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "SUPER_ADMIN_TICKET_CREATED", "SuperAdminTicket", ticket.id, { subject, priority, module })
  revalidateSuperAdminPaths(organizationId)
}

export async function resolveSuperAdminTicket(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const ticketId = String(formData.get("ticketId") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim()
  if (confirmation !== "RESOUDRE") return
  const ticket = await prisma.superAdminTicket.update({
    where: { id: ticketId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  }).catch(() => null)
  if (!ticket) return
  await writeSuperAdminAudit(ticket.organizationId, currentUser.id, "SUPER_ADMIN_TICKET_RESOLVED", "SuperAdminTicket", ticket.id, { subject: ticket.subject })
  revalidateSuperAdminPaths(ticket.organizationId)
}

export async function createSuperAdminNote(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const content = String(formData.get("content") ?? "").trim()
  const category = String(formData.get("category") ?? "GENERAL")
  const nextAction = String(formData.get("nextAction") ?? "").trim() || null
  if (!organizationId || !content) return

  const note = await prisma.superAdminNote.create({
    data: { organizationId, authorId: currentUser.id, content, category, nextAction },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "SUPER_ADMIN_NOTE_CREATED", "SuperAdminNote", note.id, { category, nextAction })
  revalidateSuperAdminPaths(organizationId)
}

export async function createSaasInvoice(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const amountCents = parseCurrencyCents(formData.get("amount"))
  const currency = normalizeSubscriptionCurrency(formData.get("currency"))
  const status = String(formData.get("status") ?? "DRAFT")
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim() || null
  if (!organizationId || amountCents <= 0) return

  const invoice = await prisma.saasInvoice.create({
    data: { organizationId, amountCents, currency, status, invoiceNumber, provider: "manual", billingReason: "super_admin" },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "SAAS_INVOICE_CREATED", "SaasInvoice", invoice.id, { amountCents, currency, status })
  revalidateSuperAdminPaths(organizationId)
}

export async function recordSaasPayment(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const invoiceId = String(formData.get("invoiceId") ?? "").trim() || null
  const amountCents = parseCurrencyCents(formData.get("amount"))
  const currency = normalizeSubscriptionCurrency(formData.get("currency"))
  const status = String(formData.get("status") ?? "PAID")
  if (!organizationId || amountCents <= 0) return

  const payment = await prisma.saasPayment.create({
    data: { organizationId, invoiceId, amountCents, currency, status, provider: "manual", paidAt: status === "PAID" ? new Date() : null },
  })
  if (invoiceId && status === "PAID") {
    await prisma.saasInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }).catch(() => null)
  }
  await writeSuperAdminAudit(organizationId, currentUser.id, "SAAS_PAYMENT_RECORDED", "SaasPayment", payment.id, { amountCents, currency, status })
  revalidateSuperAdminPaths(organizationId)
}

export async function createSaasAddOn(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const key = String(formData.get("key") ?? "").trim().toLowerCase().replaceAll(" ", "_")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const priceCents = parseCurrencyCents(formData.get("price"))
  const currency = normalizeSubscriptionCurrency(formData.get("currency"))
  if (!key || !name || priceCents <= 0) return

  const addOn = await prisma.saasAddOn.upsert({
    where: { key },
    create: { key, name, description, priceCents, currency },
    update: { name, description, priceCents, currency, status: "ACTIVE" },
  })
  await writeSuperAdminAudit(currentUser.organizationId, currentUser.id, "SAAS_ADD_ON_UPSERTED", "SaasAddOn", addOn.id, { key, name, priceCents, currency })
  revalidatePath("/developpeur/plans")
  revalidatePath("/developpeur")
  revalidatePath("/super-admin/parametres")
  revalidatePath("/super-admin/produit")
  revalidatePath("/super-admin/finance")
}

export async function attachOrganizationAddOn(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const addOnId = String(formData.get("addOnId") ?? "")
  const quantity = Math.max(1, Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1)
  if (!organizationId || !addOnId) return

  const attached = await prisma.organizationAddOn.upsert({
    where: { organizationId_addOnId: { organizationId, addOnId } },
    create: { organizationId, addOnId, quantity, status: "ACTIVE" },
    update: { quantity, status: "ACTIVE", endedAt: null },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "ORGANIZATION_ADD_ON_ATTACHED", "OrganizationAddOn", attached.id, { addOnId, quantity })
  revalidateSuperAdminPaths(organizationId)
}

export async function createFeatureFlag(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const key = String(formData.get("key") ?? "").trim().toLowerCase().replaceAll(" ", "_")
  const publicName = String(formData.get("publicName") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const status = String(formData.get("status") ?? "DISABLED")
  const beta = formData.get("beta") === "on"
  if (!key || !publicName) return

  const flag = await prisma.featureFlag.upsert({
    where: { key },
    create: { key, publicName, description, status, beta, activatedAt: status === "ACTIVE" ? new Date() : null },
    update: { publicName, description, status, beta, activatedAt: status === "ACTIVE" ? new Date() : null },
  })
  await writeSuperAdminAudit(currentUser.organizationId, currentUser.id, "FEATURE_FLAG_UPSERTED", "FeatureFlag", flag.id, { key, status, beta })
  revalidatePath("/developpeur/plans")
  revalidatePath("/super-admin/parametres")
  revalidatePath("/super-admin/produit")
}

export async function overrideFeatureFlagForOrganization(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const featureFlagId = String(formData.get("featureFlagId") ?? "")
  const enabled = formData.get("enabled") !== "false"
  const reason = String(formData.get("reason") ?? "").trim() || null
  if (!organizationId || !featureFlagId) return

  const override = await prisma.featureFlagOverride.upsert({
    where: { organizationId_featureFlagId: { organizationId, featureFlagId } },
    create: { organizationId, featureFlagId, enabled, reason },
    update: { enabled, reason },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "FEATURE_FLAG_OVERRIDE_UPDATED", "FeatureFlagOverride", override.id, { featureFlagId, enabled, reason })
  revalidateSuperAdminPaths(organizationId)
}

export async function startAssistanceSession(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()
  const mode = String(formData.get("mode") ?? "READ_ONLY")
  if (!organizationId || !reason) return

  const session = await prisma.assistanceSession.create({
    data: {
      organizationId,
      adminUserId: currentUser.id,
      reason,
      mode,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  })
  await writeSuperAdminAudit(organizationId, currentUser.id, "ASSISTANCE_SESSION_STARTED", "AssistanceSession", session.id, { reason, mode })
  revalidateSuperAdminPaths(organizationId)
}

export async function updateOrganizationSensitiveStatus(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const action = String(formData.get("sensitiveAction") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase()
  const reason = String(formData.get("reason") ?? "").trim() || null
  if (!organizationId) return

  const actionConfig = {
    SUSPEND: {
      expected: "SUSPENDRE",
      status: "SUSPENDED",
      audit: "SAAS_ACCOUNT_SUSPENDED",
    },
    REACTIVATE: {
      expected: "REACTIVER",
      status: "ACTIVE",
      audit: "SAAS_ACCOUNT_REACTIVATED",
    },
    PAST_DUE: {
      expected: "IMPAYE",
      status: "PAST_DUE",
      audit: "SAAS_ACCOUNT_MARKED_PAST_DUE",
    },
    CANCEL: {
      expected: "ANNULER",
      status: "SUSPENDED",
      audit: "SAAS_SUBSCRIPTION_CANCELLED",
    },
  } as const

  const config = actionConfig[action as keyof typeof actionConfig]
  if (!config || confirmation !== config.expected) return

  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { subscriptionStatus: config.status },
    select: { id: true, name: true, subscriptionStatus: true },
  }).catch(() => null)
  if (!organization) return

  await writeSuperAdminAudit(organizationId, currentUser.id, config.audit, "Organization", organizationId, {
    name: organization.name,
    subscriptionStatus: config.status,
    reason,
  })
  revalidateSuperAdminPaths(organizationId)
}

export async function createPlatformIncident(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const module = String(formData.get("module") ?? "Technique").trim()
  const priority = String(formData.get("priority") ?? "NORMAL")
  const description = String(formData.get("description") ?? "").trim() || null
  if (!title) return

  const incident = await prisma.platformIncident.create({ data: { title, module, priority, description, status: "OPEN" } })
  if (organizationId) {
    await prisma.platformIncidentImpact.create({
      data: { incidentId: incident.id, organizationId, impactLevel: priority === "CRITICAL" ? "HIGH" : "MEDIUM" },
    }).catch(() => null)
  }
  await writeSuperAdminAudit(organizationId || currentUser.organizationId, currentUser.id, "PLATFORM_INCIDENT_CREATED", "PlatformIncident", incident.id, { title, module, priority })
  revalidatePath("/developpeur")
  revalidatePath("/developpeur/plans")
  if (organizationId) revalidateSuperAdminPaths(organizationId)
}

export async function createProductAnnouncement(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const organizationId = String(formData.get("organizationId") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  const status = String(formData.get("status") ?? "DRAFT")
  if (!title || !body) return

  const announcement = await prisma.productAnnouncement.create({
    data: { createdById: currentUser.id, title, body, status, sentAt: status === "SENT" ? new Date() : null, target: organizationId ? { organizationId } : { audience: "all" } },
  })
  if (organizationId) {
    await prisma.productAnnouncementDelivery.create({
      data: { announcementId: announcement.id, organizationId, status: status === "SENT" ? "DELIVERED" : "PENDING", deliveredAt: status === "SENT" ? new Date() : null },
    }).catch(() => null)
  }
  await writeSuperAdminAudit(organizationId || currentUser.organizationId, currentUser.id, "PRODUCT_ANNOUNCEMENT_CREATED", "ProductAnnouncement", announcement.id, { title, status })
  revalidatePath("/developpeur")
  if (organizationId) revalidateSuperAdminPaths(organizationId)
}

export async function upsertInternalAdminProfile(formData: FormData) {
  const currentUser = await requireSaasRole(["DEVELOPER"])
  const userId = String(formData.get("userId") ?? "")
  const internalRole = String(formData.get("internalRole") ?? "SUPPORT_N1")
  const status = String(formData.get("status") ?? "ACTIVE")
  const twoFactorRequired = formData.get("twoFactorRequired") === "on"
  const ipAllowlist = String(formData.get("ipAllowlist") ?? "").trim() || null
  if (!userId) return

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!targetUser || targetUser.role !== "DEVELOPER") return

  const profile = await prisma.internalAdminProfile.upsert({
    where: { userId },
    create: {
      userId,
      internalRole,
      status,
      twoFactorRequired,
      ipAllowlist,
    },
    update: {
      internalRole,
      status,
      twoFactorRequired,
      ipAllowlist,
    },
  })

  await writeSuperAdminAudit(currentUser.organizationId, currentUser.id, "INTERNAL_ADMIN_PROFILE_UPDATED", "InternalAdminProfile", profile.id, {
    targetUser: targetUser.email,
    internalRole,
    status,
    twoFactorRequired,
    ipAllowlist: ipAllowlist ? "configured" : "empty",
  })
  revalidatePath("/super-admin/equipe")
  revalidatePath("/super-admin/securite")
  revalidatePath("/super-admin/logs")
  revalidatePath("/super-admin/parametres")
}

function getExpirationDate(value: string) {
  const now = new Date()
  if (value === "30d") return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (value === "90d") return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  if (value === "1y") return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  return null
}

function parseCurrencyCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "0").replace(",", ".")
  const amount = Number.parseFloat(normalized)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

function revalidateSuperAdminPaths(organizationId: string) {
  revalidatePath("/developpeur")
  revalidatePath("/developpeur/cabinets")
  revalidatePath(`/developpeur/cabinets/${organizationId}`)
  revalidatePath("/developpeur/plans")
  revalidatePath("/super-admin")
  revalidatePath("/super-admin/clients")
  revalidatePath(`/super-admin/clients/${organizationId}`)
  revalidatePath("/super-admin/finance")
  revalidatePath("/super-admin/produit")
  revalidatePath("/super-admin/support")
  revalidatePath("/super-admin/technique")
  revalidatePath("/super-admin/securite")
  revalidatePath("/super-admin/logs")
  revalidatePath("/super-admin/parametres")
}

async function writeSuperAdminAudit(organizationId: string, userId: string, action: string, entityType: string, entityId: string, newValue?: object) {
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action,
      entityType,
      entityId,
      newValue,
    },
  }).catch(() => null)
}
