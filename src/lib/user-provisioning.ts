import type { UserRole } from "@prisma/client"

import {
  normalizeSaasAppRole,
  organizationNameForAppRole,
  userRoleForAppRole,
} from "@/lib/auth/app-roles"
import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  organizationTypeForSubscriptionPlan,
  subscriptionPlans,
} from "@/lib/billing/plans"
import { prisma } from "@/lib/prisma"

type ProvisionClerkUserInput = {
  clerkUserId: string
  email: string
  name: string
  avatarUrl?: string | null
  clerkOrganizationId?: string | null
  organizationName?: string
  role?: UserRole
  appRole?: unknown
  subscriptionPlan?: unknown
  subscriptionPricingMode?: unknown
  subscriptionCurrency?: unknown
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)

  return slug || "cabinet"
}

export async function provisionClerkUser({
  clerkUserId,
  email,
  name,
  avatarUrl,
  clerkOrganizationId,
  organizationName,
  role,
  appRole,
  subscriptionPlan,
  subscriptionPricingMode,
  subscriptionCurrency,
}: ProvisionClerkUserInput) {
  const normalizedAppRole = normalizeSaasAppRole(appRole)
  const resolvedRole = role ?? userRoleForAppRole(normalizedAppRole)
  const hasRequestedPlan =
    subscriptionPlan !== undefined ||
    subscriptionPricingMode !== undefined ||
    subscriptionCurrency !== undefined
  const resolvedPlan = normalizedAppRole === "advisor" ? normalizeSubscriptionPlan(subscriptionPlan) : "ESSENTIEL"
  const resolvedPricingMode = normalizedAppRole === "advisor" ? normalizeSubscriptionPricingMode(subscriptionPricingMode) : "standard"
  const resolvedCurrency = normalizedAppRole === "advisor" ? normalizeSubscriptionCurrency(subscriptionCurrency) : "EUR"
  const organizationId = clerkOrganizationId ?? `user-org-${clerkUserId}`
  const resolvedOrganizationName =
    organizationName ?? organizationNameForAppRole(normalizedAppRole, name, email)
  const organizationSlug = clerkOrganizationId
    ? `clerk-${slugify(clerkOrganizationId)}`
    : `cabinet-${slugify(clerkUserId)}`

  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { clerkUserId },
      select: { id: true, organizationId: true },
    })

    if (existingUser) {
      return existingUser
    }

    const organization = await tx.organization.upsert({
      where: { id: organizationId },
      update: {
        name: resolvedOrganizationName,
        clerkOrganizationId,
        ownerClerkUserId: clerkUserId,
        ...(hasRequestedPlan
          ? {
            organizationType: organizationTypeForSubscriptionPlan(resolvedPlan),
            subscriptionPlan: resolvedPlan,
            subscriptionPricingMode: resolvedPricingMode,
            subscriptionCurrency: resolvedCurrency,
            advisorSeatLimit: subscriptionPlans[resolvedPlan].defaultSeatLimit,
            moduleAccess: null,
          }
          : {}),
      },
      create: {
        id: organizationId,
        name: resolvedOrganizationName,
        slug: organizationSlug,
        clerkOrganizationId,
        ownerClerkUserId: clerkUserId,
        organizationType: organizationTypeForSubscriptionPlan(resolvedPlan),
        subscriptionPlan: resolvedPlan,
        subscriptionPricingMode: resolvedPricingMode,
        subscriptionCurrency: resolvedCurrency,
        advisorSeatLimit: subscriptionPlans[resolvedPlan].defaultSeatLimit,
      },
    })

    const existingEmailUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingEmailUser) {
      return tx.user.update({
        where: { id: existingEmailUser.id },
        data: {
          organizationId: organization.id,
          clerkUserId,
          name,
          avatarUrl,
          role: resolvedRole,
        },
        select: { id: true, organizationId: true },
      })
    }

    return tx.user.create({
      data: {
        organizationId: organization.id,
        clerkUserId,
        name,
        email,
        avatarUrl,
        role: resolvedRole,
      },
      select: { id: true, organizationId: true },
    })
  })
}
