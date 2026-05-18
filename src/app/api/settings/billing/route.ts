import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import {
  decodeModuleAccess,
  getSubscriptionPriceSummary,
  moduleCatalog,
  modulesForSubscription,
  normalizeSubscriptionCurrency,
  normalizeOrganizationType,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  normalizeSubscriptionStatus,
  organizationTypeForSubscriptionPlan,
  organizationTypes,
  subscriptionCurrencies,
  subscriptionPlans,
  subscriptionPricingModes,
  subscriptionStatuses,
} from "@/lib/billing/plans"
import { getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

const billingSettingsSchema = z.object({
  subscriptionPlan: z.string().trim().min(1),
  subscriptionPricingMode: z.string().trim().optional().default("standard"),
  subscriptionCurrency: z.string().trim().optional().default("EUR"),
  advisorSeatLimit: z.coerce.number().int().min(1).max(500).optional(),
})

export async function PATCH(request: Request) {
  try {
    const user = await requireOwner()
    const parsed = billingSettingsSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Impossible de modifier le forfait.", 422, parsed.error.flatten())
    }

    const currentOrganization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        subscriptionStatus: true,
        users: { select: { role: true } },
      },
    })

    const plan = normalizeSubscriptionPlan(parsed.data.subscriptionPlan)
    const pricingMode = normalizeSubscriptionPricingMode(parsed.data.subscriptionPricingMode)
    const currency = normalizeSubscriptionCurrency(parsed.data.subscriptionCurrency)
    const organizationType = organizationTypeForSubscriptionPlan(plan)
    const status = normalizeSubscriptionStatus(currentOrganization?.subscriptionStatus)
    const seatsUsed = countAdvisorSeats(currentOrganization?.users ?? [])
    const seatLimit = Math.max(parsed.data.advisorSeatLimit ?? subscriptionPlans[plan].defaultSeatLimit, subscriptionPlans[plan].defaultSeatLimit, seatsUsed)

    const organization = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        organizationType,
        subscriptionPlan: plan,
        subscriptionPricingMode: pricingMode,
        subscriptionCurrency: currency,
        advisorSeatLimit: seatLimit,
        moduleAccess: null,
      },
      select: {
        subscriptionPlan: true,
        organizationType: true,
        subscriptionStatus: true,
        subscriptionPricingMode: true,
        subscriptionCurrency: true,
        advisorSeatLimit: true,
        moduleAccess: true,
        users: { select: { role: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: "SETTINGS_BILLING_UPDATED",
        entityType: "Organization",
        entityId: user.organizationId,
        newValue: {
          organizationType,
          subscriptionPlan: plan,
          subscriptionPricingMode: pricingMode,
          subscriptionCurrency: currency,
          advisorSeatLimit: seatLimit,
        },
      },
    }).catch(() => null)

    const normalizedPlan = normalizeSubscriptionPlan(organization.subscriptionPlan)
    const normalizedOrganizationType = normalizeOrganizationType(organization.organizationType)
    const normalizedStatus = normalizeSubscriptionStatus(organization.subscriptionStatus)
    const normalizedPricingMode = normalizeSubscriptionPricingMode(organization.subscriptionPricingMode)
    const normalizedCurrency = normalizeSubscriptionCurrency(organization.subscriptionCurrency)
    const modules = modulesForSubscription(organization.subscriptionPlan, organization.moduleAccess)
    const moduleLabels = modules.map((moduleKey) => moduleCatalog.find((module) => module.key === moduleKey)?.label ?? moduleKey)
    const priceOverrides = await getSubscriptionPlanPriceOverrides()

    return ok({
      plan: normalizedPlan,
      planLabel: subscriptionPlans[normalizedPlan].label,
      planDescription: subscriptionPlans[normalizedPlan].description,
      organizationType: normalizedOrganizationType,
      organizationTypeLabel: organizationTypes[normalizedOrganizationType].label,
      organizationTypeDescription: organizationTypes[normalizedOrganizationType].description,
      status: normalizedStatus,
      statusLabel: subscriptionStatuses[normalizedStatus],
      pricingMode: normalizedPricingMode,
      pricingModeLabel: subscriptionPricingModes[normalizedPricingMode],
      currency: normalizedCurrency,
      currencyLabel: subscriptionCurrencies[normalizedCurrency],
      priceSummary: getSubscriptionPriceSummary(normalizedPlan, normalizedPricingMode, normalizedCurrency, priceOverrides),
      seatLimit: organization.advisorSeatLimit,
      seatsUsed: countAdvisorSeats(organization.users),
      moduleLabels,
      isCustomAccess: Boolean(decodeModuleAccess(organization.moduleAccess)),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function countAdvisorSeats(users: Array<{ role: string }>) {
  return users.filter((member) => member.role === "OWNER" || member.role === "ADVISOR" || member.role === "ASSISTANT" || member.role === "COMPLIANCE").length
}
