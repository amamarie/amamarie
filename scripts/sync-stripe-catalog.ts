import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import {
  offerableSubscriptionPlanKeys,
  subscriptionAnnualMonthlyRevenue,
  subscriptionCurrencies,
  subscriptionMonthlyRevenue,
  subscriptionPlans,
  subscriptionPricingModes,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
} from "../src/lib/billing/plans"
import { type BillingInterval, stripePriceLookupKey, stripePlanAmountCents } from "../src/lib/billing/stripe"

type StripeList<T> = {
  data: T[]
  has_more?: boolean
}

type StripeProduct = {
  id: string
  name: string
  active: boolean
  metadata?: Record<string, string>
}

type StripePrice = {
  id: string
  active: boolean
  currency: string
  lookup_key: string | null
  unit_amount: number | null
  recurring?: { interval?: string } | null
  metadata?: Record<string, string>
}

const root = process.cwd()

function loadEnvFile(fileName: string) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(root, fileName)
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const [rawKey, ...rawValueParts] = trimmed.split("=")
    const key = rawKey.trim()
    if (process.env[key]) continue
    const rawValue = rawValueParts.join("=").trim()
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "")
  }
}

for (const envFile of process.argv.slice(2)) {
  loadEnvFile(envFile)
}
loadEnvFile(".env.production.local")
loadEnvFile(".env.local")
loadEnvFile(".env")

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_API_KEY?.trim()
}

async function stripeRequest<T>(pathName: string, body?: URLSearchParams, init?: RequestInit): Promise<T> {
  const apiKey = stripeSecretKey()
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY ou STRIPE_API_KEY manquant.")

  const response = await fetch(`https://api.stripe.com/v1${pathName.startsWith("/") ? pathName : `/${pathName}`}`, {
    method: body ? "POST" : "GET",
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init?.headers ?? {}),
    },
    body,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) as unknown : null
  if (!response.ok) {
    const errorMessage = json && typeof json === "object" && "error" in json
      ? JSON.stringify((json as { error?: unknown }).error)
      : text
    throw new Error(`Stripe API ${response.status}: ${errorMessage}`)
  }

  return json as T
}

async function getFinAssuroProducts() {
  const response = await stripeRequest<StripeList<StripeProduct>>("/products?active=true&limit=100")
  return response.data.filter((product) => product.metadata?.app === "finadvisor")
}

async function ensureProduct(plan: SubscriptionPlanKey, existingProducts: StripeProduct[]) {
  const productKey = `finadvisor_${plan.toLowerCase()}`
  const existingProduct = existingProducts.find((product) => product.metadata?.finadvisor_product_key === productKey)
  if (existingProduct) return existingProduct

  const product = subscriptionPlans[plan]
  const params = new URLSearchParams()
  params.set("name", `FinAssuro ${product.label}`)
  params.set("description", product.description)
  params.set("metadata[app]", "finadvisor")
  params.set("metadata[finadvisor_product_key]", productKey)
  params.set("metadata[plan]", plan)
  params.set("metadata[publicKey]", product.publicKey)

  return stripeRequest<StripeProduct>("/products", params)
}

async function getPriceByLookupKey(lookupKey: string) {
  const response = await stripeRequest<StripeList<StripePrice>>(`/prices?active=true&limit=1&lookup_keys[]=${encodeURIComponent(lookupKey)}`)
  return response.data[0] ?? null
}

async function ensurePrice({
  productId,
  plan,
  pricingMode,
  currency,
  interval,
}: {
  productId: string
  plan: SubscriptionPlanKey
  pricingMode: SubscriptionPricingModeKey
  currency: SubscriptionCurrencyKey
  interval: BillingInterval
}) {
  const lookupKey = stripePriceLookupKey({ plan, pricingMode, currency, interval })
  const amountCents = stripePlanAmountCents({ plan, pricingMode, currency, interval })
  const existingPrice = await getPriceByLookupKey(lookupKey)

  if (existingPrice) {
    const expectedInterval = interval === "annual" ? "year" : "month"
    const matches = existingPrice.unit_amount === amountCents
      && existingPrice.currency.toUpperCase() === currency
      && existingPrice.recurring?.interval === expectedInterval

    return {
      id: existingPrice.id,
      lookupKey,
      status: matches ? "existing" : "existing_amount_mismatch",
      amountCents,
    }
  }

  const params = new URLSearchParams()
  params.set("product", productId)
  params.set("currency", currency.toLowerCase())
  params.set("unit_amount", String(amountCents))
  params.set("recurring[interval]", interval === "annual" ? "year" : "month")
  params.set("lookup_key", lookupKey)
  params.set("nickname", `${subscriptionPlans[plan].label} ${subscriptionPricingModes[pricingMode]} ${currency} ${interval === "annual" ? "annuel" : "mensuel"}`)
  params.set("metadata[app]", "finadvisor")
  params.set("metadata[plan]", plan)
  params.set("metadata[pricingMode]", pricingMode)
  params.set("metadata[currency]", currency)
  params.set("metadata[interval]", interval)
  params.set("metadata[monthlyAmount]", String(interval === "annual"
    ? subscriptionAnnualMonthlyRevenue[pricingMode][plan][currency]
    : subscriptionMonthlyRevenue[pricingMode][plan][currency]))

  const createdPrice = await stripeRequest<StripePrice>("/prices", params)

  return {
    id: createdPrice.id,
    lookupKey,
    status: "created",
    amountCents,
  }
}

async function main() {
  const existingProducts = await getFinAssuroProducts()
  const result: Array<{
    mode: SubscriptionPricingModeKey
    plan: SubscriptionPlanKey
    currency: SubscriptionCurrencyKey
    interval: BillingInterval
    lookupKey: string
    priceId: string
    status: string
    amount: string
  }> = []

  for (const plan of offerableSubscriptionPlanKeys) {
    const product = await ensureProduct(plan, existingProducts)

    for (const pricingMode of Object.keys(subscriptionPricingModes) as SubscriptionPricingModeKey[]) {
      for (const currency of Object.keys(subscriptionCurrencies) as SubscriptionCurrencyKey[]) {
        for (const interval of ["monthly", "annual"] as BillingInterval[]) {
          const price = await ensurePrice({ productId: product.id, plan, pricingMode, currency, interval })
          result.push({
            mode: pricingMode,
            plan,
            currency,
            interval,
            lookupKey: price.lookupKey,
            priceId: price.id,
            status: price.status,
            amount: `${(price.amountCents / 100).toFixed(2)} ${currency}`,
          })
        }
      }
    }
  }

  console.table(result)

  const mismatchCount = result.filter((item) => item.status === "existing_amount_mismatch").length
  if (mismatchCount > 0) {
    console.warn(`${mismatchCount} prix Stripe existants ont un montant différent de l’app. Aucun prix existant n’a été modifié.`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
