import { currentUser } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { provisionClerkUser } from "@/lib/user-provisioning"
import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import { getInternalSessionUser } from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"

export async function getCurrentUserWithOrg() {
  if (isInternalAuthEnabled()) {
    return getInternalSessionUser()
  }

  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    return null
  }

  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId: clerkUser.id },
  })

  if (existingUser) {
    return existingUser
  }

  const name =
    clerkUser.fullName ??
    clerkUser.firstName ??
    email.split("@")[0] ??
    "Conseiller"
  const appRole = normalizeSaasAppRole(clerkUser.unsafeMetadata?.appRole)
  const subscriptionPlan = clerkUser.unsafeMetadata?.subscriptionPlan
  const subscriptionPricingMode = clerkUser.unsafeMetadata?.subscriptionPricingMode
  const subscriptionCurrency = clerkUser.unsafeMetadata?.subscriptionCurrency

  const provisionedUser = await provisionClerkUser({
    clerkUserId: clerkUser.id,
    email,
    name,
    avatarUrl: clerkUser.imageUrl,
    appRole,
    subscriptionPlan,
    subscriptionPricingMode,
    subscriptionCurrency,
  })

  return prisma.user.findUnique({
    where: { id: provisionedUser.id },
  })
}

export class ForbiddenError extends Error {
  constructor(message = "Access denied") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export async function requireOwner() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    throw new Error("Unauthorized")
  }

  if (user.role !== "OWNER") {
    throw new ForbiddenError()
  }

  return user
}
