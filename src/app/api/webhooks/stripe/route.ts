import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  organizationTypeForSubscriptionPlan,
  subscriptionPlans,
} from "@/lib/billing/plans"
import { normalizeBillingInterval } from "@/lib/billing/stripe"
import { prisma } from "@/lib/prisma"
import { verifyStripeWebhookSignature } from "@/lib/stripe/client"

type StripeEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function boolValue(value: unknown) {
  return typeof value === "boolean" ? value : false
}

function dateFromUnix(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null
}

function subscriptionPriceId(object: Record<string, unknown>) {
  const defaultPriceId = stringValue(object.default_price)
  if (defaultPriceId) return defaultPriceId

  const items = object.items && typeof object.items === "object" ? object.items as Record<string, unknown> : null
  const data = Array.isArray(items?.data) ? items.data : []
  const firstItem = data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : null
  const price = firstItem?.price && typeof firstItem.price === "object" ? firstItem.price as Record<string, unknown> : null
  return stringValue(price?.id)
}

function stripeObjectMetadata(object: Record<string, unknown>) {
  return object as Prisma.InputJsonValue
}

function metadataFrom(object: Record<string, unknown>) {
  const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata as Record<string, unknown> : {}
  return {
    organizationId: stringValue(metadata.organizationId),
    userId: stringValue(metadata.userId),
    plan: normalizeSubscriptionPlan(metadata.plan),
    pricingMode: normalizeSubscriptionPricingMode(metadata.pricingMode),
    currency: normalizeSubscriptionCurrency(metadata.currency),
    interval: normalizeBillingInterval(metadata.interval),
  }
}

function subscriptionStatusToAppStatus(status: string | null) {
  if (status === "active" || status === "trialing") return status === "trialing" ? "TRIAL" : "ACTIVE"
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "PAST_DUE"
  if (status === "canceled" || status === "paused" || status === "incomplete_expired") return "SUSPENDED"
  return "ACTIVE"
}

async function findOrganization(object: Record<string, unknown>, metadataOrganizationId?: string | null) {
  const subscriptionId = stringValue(object.subscription) ?? stringValue(object.id)
  const customerId = stringValue(object.customer)

  if (metadataOrganizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: metadataOrganizationId } })
    if (organization) return organization
  }
  if (subscriptionId) {
    const organization = await prisma.organization.findUnique({ where: { stripeSubscriptionId: subscriptionId } })
    if (organization) return organization
  }
  if (customerId) {
    const organization = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId } })
    if (organization) return organization
  }
  return null
}

async function activateSubscription(object: Record<string, unknown>) {
  const metadata = metadataFrom(object)
  const organization = await findOrganization(object, metadata.organizationId)
  if (!organization) return

  const subscriptionId = stringValue(object.subscription) ?? stringValue(object.id)
  const customerId = stringValue(object.customer)
  const status = stringValue(object.status)
  const plan = metadata.plan
  const pricingMode = metadata.pricingMode
  const currency = metadata.currency
  const seatLimit = Math.max(subscriptionPlans[plan].defaultSeatLimit, organization.advisorSeatLimit)

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      stripeCustomerId: customerId ?? organization.stripeCustomerId,
      stripeSubscriptionId: subscriptionId ?? organization.stripeSubscriptionId,
      stripeSubscriptionStatus: status ?? organization.stripeSubscriptionStatus,
      stripePriceId: subscriptionPriceId(object) ?? organization.stripePriceId,
      stripeCurrentPeriodEnd: dateFromUnix(object.current_period_end) ?? organization.stripeCurrentPeriodEnd,
      stripeCancelAtPeriodEnd: boolValue(object.cancel_at_period_end),
      organizationType: organizationTypeForSubscriptionPlan(plan),
      subscriptionPlan: plan,
      subscriptionPricingMode: pricingMode,
      subscriptionCurrency: currency,
      subscriptionStatus: subscriptionStatusToAppStatus(status),
      advisorSeatLimit: seatLimit,
      moduleAccess: null,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: metadata.userId,
      action: "STRIPE_SUBSCRIPTION_SYNCED",
      entityType: "Organization",
      entityId: organization.id,
      source: "stripe",
      newValue: {
        subscriptionId,
        customerId,
        status,
        plan,
        pricingMode,
        currency,
        interval: metadata.interval,
      },
    },
  }).catch(() => null)
}

async function syncInvoice(object: Record<string, unknown>) {
  const metadata = metadataFrom(object)
  const organization = await findOrganization(object, metadata.organizationId)
  if (!organization) return

  const invoiceId = stringValue(object.id)
  if (!invoiceId) return

  const amountPaid = typeof object.amount_paid === "number" ? object.amount_paid : typeof object.amount_due === "number" ? object.amount_due : 0
  const status = stringValue(object.status)?.toUpperCase() ?? "OPEN"

  await prisma.saasInvoice.upsert({
    where: { provider_externalInvoiceId: { provider: "stripe", externalInvoiceId: invoiceId } },
    update: {
      amountCents: amountPaid,
      currency: stringValue(object.currency)?.toUpperCase() ?? organization.subscriptionCurrency,
      status,
      billingReason: stringValue(object.billing_reason),
      paidAt: dateFromUnix(object.status_transitions && typeof object.status_transitions === "object" ? (object.status_transitions as Record<string, unknown>).paid_at : null),
      hostedInvoiceUrl: stringValue(object.hosted_invoice_url),
      metadata: stripeObjectMetadata(object),
    },
    create: {
      organizationId: organization.id,
      provider: "stripe",
      externalInvoiceId: invoiceId,
      invoiceNumber: stringValue(object.number),
      amountCents: amountPaid,
      currency: stringValue(object.currency)?.toUpperCase() ?? organization.subscriptionCurrency,
      status,
      billingReason: stringValue(object.billing_reason),
      paidAt: dateFromUnix(object.status_transitions && typeof object.status_transitions === "object" ? (object.status_transitions as Record<string, unknown>).paid_at : null),
      hostedInvoiceUrl: stringValue(object.hosted_invoice_url),
      metadata: stripeObjectMetadata(object),
    },
  })

  if (status === "PAID") {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { subscriptionStatus: "ACTIVE" },
    })
  } else if (status === "OPEN" || status === "UNCOLLECTIBLE") {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { subscriptionStatus: "PAST_DUE" },
    })
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  try {
    verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"))
    const event = JSON.parse(rawBody) as StripeEvent
    const object = event.data.object

    if (event.type === "checkout.session.completed") {
      await activateSubscription(object)
    }
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await activateSubscription(object)
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed" || event.type === "invoice.finalized") {
      await syncInvoice(object)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error({
      action: "stripe_webhook_failed",
      message: error instanceof Error ? error.message : "Unknown Stripe webhook error",
    })
    return NextResponse.json({ error: "Invalid Stripe webhook" }, { status: 400 })
  }
}
