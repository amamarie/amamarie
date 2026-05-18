import type { Document, DocumentVaultSettings, UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type RetentionPolicyOption = {
  value: string
  label: string
  description: string
  duration: string
}

export async function ensureDocumentVaultSettings(organizationId: string) {
  return prisma.documentVaultSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  })
}

export function documentRetentionPolicyOptions(settings: DocumentVaultSettings): RetentionPolicyOption[] {
  return [
    {
      value: "DEFAULT_CLIENT_DOCUMENTS",
      label: "Documents client - politique cabinet",
      description: "Politique générale appliquée aux documents actifs du dossier client.",
      duration: `${settings.defaultRetentionYears} ans`,
    },
    {
      value: "CLIENT_PROFILE_KYC",
      label: "Profil client / connaissance client",
      description: "Documents utilisés pour le profil client, la situation financière et les confirmations.",
      duration: `${settings.kycRetentionYears} ans`,
    },
    {
      value: "RECOMMENDATION_EVIDENCE",
      label: "Recommandations et preuves de conseil",
      description: "Rapports, documents remis, signatures, options analysées et preuves d’explication.",
      duration: `${settings.recommendationRetentionYears} ans`,
    },
    {
      value: "IDENTITY_DOCUMENTS",
      label: "Pièces d’identité",
      description: "Pièces d’identité, vérifications et documents sensibles d’identification.",
      duration: `${settings.identityRetentionYears} ans`,
    },
    {
      value: "REJECTED_DOCUMENTS",
      label: "Documents refusés ou illisibles",
      description: "Documents rejetés, remplacés ou inutilisables à revoir rapidement.",
      duration: `${settings.rejectedDocumentRetentionDays} jours`,
    },
  ]
}

export function documentAccessPolicySummary(settings: DocumentVaultSettings, document: Pick<Document, "containsMedicalData" | "containsIdentityData" | "containsFinancialData" | "sensitivityLevel">) {
  if (settings.restrictMedicalDocuments && document.containsMedicalData) {
    return "Accès très restreint: conseiller responsable, conformité et journalisation détaillée."
  }
  if (settings.restrictIdentityDocuments && document.containsIdentityData) {
    return "Accès restreint: identité, téléchargement contrôlé et journalisation obligatoire."
  }
  if (settings.restrictCriticalDocuments && document.sensitivityLevel === "CRITICAL") {
    return "Accès critique: conformité ou rôle autorisé seulement."
  }
  if (document.sensitivityLevel === "HIGH" || document.containsFinancialData) {
    return "Accès équipe autorisée: données financières sensibles."
  }
  return "Accès selon rôle et dossier client."
}

export function canAccessDocumentContent({
  settings,
  role,
  document,
}: {
  settings: DocumentVaultSettings
  role: UserRole
  document: Pick<Document, "containsMedicalData" | "containsIdentityData" | "sensitivityLevel">
}) {
  const isOwnerOrCompliance = role === "OWNER" || role === "COMPLIANCE" || role === "DEVELOPER"
  const isAdvisor = role === "ADVISOR"
  if (settings.restrictMedicalDocuments && document.containsMedicalData) return isOwnerOrCompliance || isAdvisor
  if (settings.restrictIdentityDocuments && document.containsIdentityData) return isOwnerOrCompliance || isAdvisor
  if (settings.restrictCriticalDocuments && document.sensitivityLevel === "CRITICAL") return isOwnerOrCompliance
  return true
}
