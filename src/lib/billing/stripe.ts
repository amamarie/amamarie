import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  organizationTypeForSubscriptionPlan,
  subscriptionAnnualMonthlyRevenue,
  subscriptionMonthlyRevenue,
  subscriptionPlans,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
} from "@/lib/billing/plans"

export type BillingInterval = "monthly" | "annual"

export function normalizeBillingInterval(value: unknown): BillingInterval {
  const normalized = String(value ?? "").trim().toLowerCase()
  return normalized === "annual" || normalized === "yearly" || normalized === "annuel" ? "annual" : "monthly"
}

export function stripePlanAmountCents({
  plan,
  pricingMode,
  currency,
  interval,
}: {
  plan: SubscriptionPlanKey
  pricingMode: SubscriptionPricingModeKey
  currency: SubscriptionCurrencyKey
  interval: BillingInterval
}) {
  const monthlyAmount = interval === "annual"
    ? subscriptionAnnualMonthlyRevenue[pricingMode][plan][currency]
    : subscriptionMonthlyRevenue[pricingMode][plan][currency]
  const multiplier = interval === "annual" ? 12 : 1
  return Math.round(monthlyAmount * multiplier * 100)
}

export function stripePlanMetadata(input: {
  organizationId: string
  userId?: string
  plan: unknown
  pricingMode: unknown
  currency: unknown
  interval: unknown
}) {
  const plan = normalizeSubscriptionPlan(input.plan)
  const pricingMode = normalizeSubscriptionPricingMode(input.pricingMode)
  const currency = normalizeSubscriptionCurrency(input.currency)
  const interval = normalizeBillingInterval(input.interval)

  return {
    organizationId: input.organizationId,
    userId: input.userId ?? "",
    plan,
    pricingMode,
    currency,
    interval,
    organizationType: organizationTypeForSubscriptionPlan(plan),
  }
}

export function stripePlanLabel(plan: SubscriptionPlanKey, interval: BillingInterval) {
  return `FinAdvisor ${subscriptionPlans[plan].label} (${interval === "annual" ? "annuel" : "mensuel"})`
}
