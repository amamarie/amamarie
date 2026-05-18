import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
} from "@/lib/billing/plans"
import {
  normalizeBillingInterval,
  stripePriceLookupKey,
  stripePlanAmountCents,
  stripePlanLabel,
  stripePlanMetadata,
} from "@/lib/billing/stripe"
import { prisma } from "@/lib/prisma"
import { isStripeConfigured, stripeRequest } from "@/lib/stripe/client"

const checkoutSchema = z.object({
  plan: z.string().trim().min(1),
  pricingMode: z.string().trim().optional().default("standard"),
  currency: z.string().trim().optional().default("EUR"),
  interval: z.string().trim().optional().default("monthly"),
})

type StripeCustomer = {
  id: string
}

type StripeCheckoutSession = {
  id: string
  url: string | null
}

type StripePrice = {
  id: string
  active: boolean
}

type StripeList<T> = {
  data: T[]
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

function appendMetadata(params: URLSearchParams, prefix: string, metadata: Record<string, string>) {
  Object.entries(metadata).forEach(([key, value]) => {
    params.set(`${prefix}[${key}]`, value)
  })
}

async function getOrCreateStripeCustomer({
  organizationId,
  organizationName,
  userEmail,
  existingCustomerId,
}: {
  organizationId: string
  organizationName: string
  userEmail: string
  existingCustomerId?: string | null
}) {
  if (existingCustomerId) return existingCustomerId

  const params = new URLSearchParams()
  params.set("name", organizationName)
  params.set("email", userEmail)
  params.set("metadata[organizationId]", organizationId)

  const customer = await stripeRequest<StripeCustomer>("/customers", params)

  await prisma.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

async function getStripeCatalogPriceId({
  plan,
  pricingMode,
  currency,
  interval,
}: {
  plan: ReturnType<typeof normalizeSubscriptionPlan>
  pricingMode: ReturnType<typeof normalizeSubscriptionPricingMode>
  currency: ReturnType<typeof normalizeSubscriptionCurrency>
  interval: ReturnType<typeof normalizeBillingInterval>
}) {
  const lookupKey = stripePriceLookupKey({ plan, pricingMode, currency, interval })
  const response = await stripeRequest<StripeList<StripePrice>>(
    `/prices?active=true&limit=1&lookup_keys[]=${encodeURIComponent(lookupKey)}`,
    undefined,
    { method: "GET" },
  )
  return response.data[0]?.id ?? null
}

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) return fail("STRIPE_NOT_CONFIGURED", "Stripe n’est pas configuré.", 503)

    const user = await requireOwner()
    const body = checkoutSchema.parse(await request.json().catch(() => null))
    const plan = normalizeSubscriptionPlan(body.plan)
    const pricingMode = normalizeSubscriptionPricingMode(body.pricingMode)
    const currency = normalizeSubscriptionCurrency(body.currency)
    const interval = normalizeBillingInterval(body.interval)

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
      },
    })
    if (!organization) return fail("ORGANIZATION_NOT_FOUND", "Cabinet introuvable.", 404)

    const customerId = await getOrCreateStripeCustomer({
      organizationId: organization.id,
      organizationName: organization.name,
      userEmail: user.email,
      existingCustomerId: organization.stripeCustomerId,
    })
    const metadata = stripePlanMetadata({
      organizationId: organization.id,
      userId: user.id,
      plan,
      pricingMode,
      currency,
      interval,
    })
    const baseUrl = appUrl()
    const params = new URLSearchParams()

    params.set("mode", "subscription")
    params.set("customer", customerId)
    params.set("client_reference_id", organization.id)
    params.set("success_url", `${baseUrl}/parametres?billing=stripe-success&session_id={CHECKOUT_SESSION_ID}`)
    params.set("cancel_url", `${baseUrl}/forfaits?billing=stripe-cancelled`)
    params.set("allow_promotion_codes", "true")
    params.set("line_items[0][quantity]", "1")

    const catalogPriceId = await getStripeCatalogPriceId({ plan, pricingMode, currency, interval }).catch(() => null)
    if (catalogPriceId) {
      params.set("line_items[0][price]", catalogPriceId)
    } else {
      params.set("line_items[0][price_data][currency]", currency.toLowerCase())
      params.set("line_items[0][price_data][unit_amount]", String(stripePlanAmountCents({ plan, pricingMode, currency, interval })))
      params.set("line_items[0][price_data][recurring][interval]", interval === "annual" ? "year" : "month")
      params.set("line_items[0][price_data][product_data][name]", stripePlanLabel(plan, interval))
      params.set("line_items[0][price_data][product_data][metadata][plan]", plan)
      params.set("line_items[0][price_data][product_data][metadata][pricingMode]", pricingMode)
    }
    appendMetadata(params, "metadata", metadata)
    appendMetadata(params, "subscription_data[metadata]", metadata)

    const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", params)
    if (!session.url) return fail("STRIPE_SESSION_INVALID", "Stripe n’a pas retourné d’URL de paiement.", 502)

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        action: "STRIPE_CHECKOUT_CREATED",
        entityType: "Organization",
        entityId: organization.id,
        source: "stripe",
        newValue: {
          sessionId: session.id,
          plan,
          pricingMode,
          currency,
          interval,
        },
      },
    }).catch(() => null)

    return ok({ url: session.url, sessionId: session.id })
  } catch (error) {
    return handleApiError(error)
  }
}
