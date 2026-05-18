import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  type PlanMonthlyPriceOverrides,
  type SubscriptionPricingModeKey,
} from "@/lib/billing/plans"

export const PUBLIC_PRICING_MODE_KEY = "publicPricingMode"
export const SUBSCRIPTION_PLAN_PRICE_OVERRIDES_KEY = "subscriptionPlanPriceOverrides"

type PlatformSettingDelegate = {
  findUnique: (args: {
    where: { key: string }
    select: { value: true }
  }) => Promise<{ value: string } | null>
  upsert: (args: {
    where: { key: string }
    create: { key: string; value: string }
    update: { value: string }
  }) => Promise<unknown>
}

function getPlatformSettingDelegate() {
  return (prisma as unknown as { platformSetting?: PlatformSettingDelegate }).platformSetting
}

async function readPlatformSettingValue(key: string) {
  const platformSetting = getPlatformSettingDelegate()
  const setting = platformSetting
    ? await platformSetting.findUnique({
        where: { key },
        select: { value: true },
      }).catch(() => null)
    : await prisma.$queryRaw<Array<{ value: string }>>(Prisma.sql`
        SELECT "value"
        FROM "PlatformSetting"
        WHERE "key" = ${key}
        LIMIT 1
      `).then((rows) => rows[0] ?? null).catch(() => null)

  return setting?.value ?? null
}

async function writePlatformSettingValue(key: string, value: string) {
  const platformSetting = getPlatformSettingDelegate()

  if (platformSetting) {
    await platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
    return
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
    VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE
    SET "value" = ${value}, "updatedAt" = CURRENT_TIMESTAMP
  `)
}

export async function getPublicPricingMode(): Promise<SubscriptionPricingModeKey> {
  return normalizeSubscriptionPricingMode(await readPlatformSettingValue(PUBLIC_PRICING_MODE_KEY))
}

export async function setPublicPricingMode(value: unknown) {
  const pricingMode = normalizeSubscriptionPricingMode(value)
  await writePlatformSettingValue(PUBLIC_PRICING_MODE_KEY, pricingMode)
  return pricingMode
}

function parsePlanPriceOverrides(value: string | null): PlanMonthlyPriceOverrides {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const overrides: PlanMonthlyPriceOverrides = {}

    for (const [modeKey, modeValue] of Object.entries(parsed)) {
      const mode = normalizeSubscriptionPricingMode(modeKey)
      if (!modeValue || typeof modeValue !== "object") continue
      const modeRecord = modeValue as Record<string, unknown>
      overrides[mode] ??= {}

      for (const [planKey, planValue] of Object.entries(modeRecord)) {
        const plan = normalizeSubscriptionPlan(planKey)
        if (!planValue || typeof planValue !== "object") continue
        const planRecord = planValue as Record<string, unknown>
        overrides[mode]![plan] ??= {}

        for (const [currencyKey, amountValue] of Object.entries(planRecord)) {
          const currency = normalizeSubscriptionCurrency(currencyKey)
          const amount = typeof amountValue === "number" ? amountValue : Number.parseFloat(String(amountValue).replace(",", "."))
          if (Number.isFinite(amount) && amount >= 0) {
            overrides[mode]![plan]![currency] = Math.round(amount * 100) / 100
          }
        }
      }
    }

    return overrides
  } catch {
    return {}
  }
}

export async function getSubscriptionPlanPriceOverrides(): Promise<PlanMonthlyPriceOverrides> {
  return parsePlanPriceOverrides(await readPlatformSettingValue(SUBSCRIPTION_PLAN_PRICE_OVERRIDES_KEY))
}

export async function setSubscriptionPlanMonthlyPrice(input: {
  plan: unknown
  pricingMode: unknown
  currency: unknown
  monthlyAmount: unknown
}) {
  const plan = normalizeSubscriptionPlan(input.plan)
  const pricingMode = normalizeSubscriptionPricingMode(input.pricingMode)
  const currency = normalizeSubscriptionCurrency(input.currency)
  const amount = typeof input.monthlyAmount === "number"
    ? input.monthlyAmount
    : Number.parseFloat(String(input.monthlyAmount ?? "0").replace(",", "."))

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Prix de forfait invalide.")
  }

  const overrides = await getSubscriptionPlanPriceOverrides()
  overrides[pricingMode] ??= {}
  overrides[pricingMode]![plan] ??= {}
  overrides[pricingMode]![plan]![currency] = Math.round(amount * 100) / 100

  await writePlatformSettingValue(SUBSCRIPTION_PLAN_PRICE_OVERRIDES_KEY, JSON.stringify(overrides))

  return {
    plan,
    pricingMode,
    currency,
    monthlyAmount: overrides[pricingMode]![plan]![currency]!,
  }
}
