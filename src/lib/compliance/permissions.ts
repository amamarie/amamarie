import type { UserRole } from "@prisma/client"

type UserLike = { role: UserRole; id: string }

export function canApproveKyc(user: UserLike) {
  return user.role === "OWNER" || user.role === "COMPLIANCE"
}

export function canRejectKyc(user: UserLike) {
  return canApproveKyc(user)
}

export function canViewAuditLog(user: UserLike) {
  return user.role === "OWNER" || user.role === "COMPLIANCE" || user.role === "ADVISOR"
}

export function canViewKyc(user: UserLike) {
  return ["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE", "DEVELOPER"].includes(user.role)
}

export function canEditKyc(user: UserLike) {
  return ["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"].includes(user.role)
}

export function canValidateKyc(user: UserLike) {
  return ["OWNER", "ADVISOR", "COMPLIANCE"].includes(user.role)
}

export function canExportKyc(user: UserLike) {
  return ["OWNER", "ADVISOR", "COMPLIANCE"].includes(user.role)
}

export function canManageKycPolicy(user: UserLike) {
  return ["OWNER", "COMPLIANCE", "DEVELOPER"].includes(user.role)
}

export function canManageDocumentVaultPolicy(user: UserLike) {
  return ["OWNER", "COMPLIANCE", "DEVELOPER"].includes(user.role)
}

export function canArchiveKyc(user: UserLike) {
  return ["OWNER", "COMPLIANCE"].includes(user.role)
}

export function assertCanApproveKyc(user: UserLike) {
  if (!canApproveKyc(user)) {
    throw new Error("Accès refusé: seuls les propriétaires et la conformité peuvent approuver le profil client.")
  }
}

export function assertCanEditKyc(user: UserLike) {
  if (!canEditKyc(user)) {
    throw new Error("Accès refusé.")
  }
}

export function assertCanManageKycPolicy(user: UserLike) {
  if (!canManageKycPolicy(user)) {
    throw new Error("Accès refusé: seuls le propriétaire, la conformité ou le développeur peuvent modifier les règles du profil client.")
  }
}

export function assertCanManageDocumentVaultPolicy(user: UserLike) {
  if (!canManageDocumentVaultPolicy(user)) {
    throw new Error("Accès refusé: seuls le propriétaire, la conformité ou le développeur peuvent modifier les règles documentaires.")
  }
}
