import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { type NextRequest, NextResponse } from "next/server"

import { provisionClerkUser } from "@/lib/user-provisioning"

type ClerkEmailAddress = {
  id: string
  email_address: string
}

type ClerkUserPayload = {
  id: string
  first_name?: string | null
  last_name?: string | null
  image_url?: string | null
  unsafe_metadata?: {
    appRole?: unknown
    subscriptionPlan?: unknown
    subscriptionPricingMode?: unknown
    subscriptionCurrency?: unknown
  } | null
  primary_email_address_id?: string | null
  email_addresses?: ClerkEmailAddress[]
}

function getPrimaryEmail(user: ClerkUserPayload) {
  const primaryEmail = user.email_addresses?.find(
    (email) => email.id === user.primary_email_address_id
  )

  return primaryEmail?.email_address ?? user.email_addresses?.[0]?.email_address
}

function getDisplayName(user: ClerkUserPayload, email: string) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()

  return name || email.split("@")[0] || "Conseiller"
}

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request)

    if (event.type !== "user.created" && event.type !== "user.updated") {
      return NextResponse.json({ received: true })
    }

    const user = event.data as ClerkUserPayload
    const email = getPrimaryEmail(user)

    if (!email) {
      return NextResponse.json(
        { error: "Adresse courriel Clerk introuvable." },
        { status: 422 }
      )
    }

    const dbUser = await provisionClerkUser({
      clerkUserId: user.id,
      email,
      name: getDisplayName(user, email),
      avatarUrl: user.image_url,
      appRole: user.unsafe_metadata?.appRole,
      subscriptionPlan: user.unsafe_metadata?.subscriptionPlan,
      subscriptionPricingMode: user.unsafe_metadata?.subscriptionPricingMode,
      subscriptionCurrency: user.unsafe_metadata?.subscriptionCurrency,
    })

    return NextResponse.json({
      received: true,
      organizationId: dbUser.organizationId,
    })
  } catch (error) {
    console.error({
      action: "clerk_webhook_failed",
      name: error instanceof Error ? error.name : "UnknownError",
    })
    return NextResponse.json(
      { error: "Webhook Clerk invalide." },
      { status: 400 }
    )
  }
}
