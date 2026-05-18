import { getCurrentUserWithOrg } from "@/lib/auth"
import { DEMO_ORGANIZATION_SLUG } from "@/lib/demo-context"

export const DEFAULT_ORGANIZATION_SLUG = DEMO_ORGANIZATION_SLUG

export class UnauthorizedError extends Error {
  constructor(message = "Authentification requise.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export type TenantContext = {
  organizationId: string
  userId: string
  clerkUserId: string
  role: "DEVELOPER" | "OWNER" | "ADVISOR" | "ASSISTANT" | "COMPLIANCE" | "CLIENT"
}

export async function getTenantContext(): Promise<TenantContext> {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    throw new UnauthorizedError()
  }

  return {
    organizationId: user.organizationId,
    userId: user.id,
    clerkUserId: user.clerkUserId ?? "",
    role: user.role,
  }
}

export async function getDefaultOrganizationId() {
  const { organizationId } = await getTenantContext()
  return organizationId
}
