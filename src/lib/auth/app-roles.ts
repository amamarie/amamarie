import type { UserRole } from "@prisma/client"

export type SaasAppRole = "developer" | "advisor" | "client"

export function normalizeSaasAppRole(value: unknown): SaasAppRole {
  if (value === "developer") return "developer"
  if (value === "client") return "client"
  return "advisor"
}

export function userRoleForAppRole(role: SaasAppRole): UserRole {
  if (role === "developer") return "DEVELOPER"
  if (role === "client") return "CLIENT"
  return "OWNER"
}

export function organizationNameForAppRole(role: SaasAppRole, name: string, email: string) {
  const label = name || email.split("@")[0] || "Utilisateur"
  if (role === "developer") return `Espace développeur de ${label}`
  if (role === "client") return `Dossier assurance de ${label}`
  return `Cabinet de ${label}`
}

export function homePathForUserRole(role: UserRole) {
  if (role === "DEVELOPER") return "/developpeur"
  if (role === "CLIENT") return "/espace-client"
  if (role === "COMPLIANCE") return "/compliance"
  return "/dashboard"
}
