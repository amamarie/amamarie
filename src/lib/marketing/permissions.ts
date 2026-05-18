import { ForbiddenError } from "@/lib/auth"
import type { TenantContext } from "@/lib/tenant"

type MarketingPermission =
  | "view"
  | "draft"
  | "send"
  | "approve"
  | "automation"

type Role = TenantContext["role"]

const permissionRoles: Record<MarketingPermission, Role[]> = {
  view: ["DEVELOPER", "OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"],
  draft: ["DEVELOPER", "OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"],
  send: ["DEVELOPER", "OWNER", "ADVISOR"],
  approve: ["DEVELOPER", "OWNER", "COMPLIANCE"],
  automation: ["DEVELOPER", "OWNER", "ADVISOR"],
}

export function canUseMarketing(role: Role, permission: MarketingPermission) {
  return permissionRoles[permission].includes(role)
}

export function assertMarketingPermission(role: Role, permission: MarketingPermission) {
  if (!canUseMarketing(role, permission)) {
    throw new ForbiddenError("Action marketing non autorisée pour ce rôle.")
  }
}
