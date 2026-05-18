import type { ComplianceAlertSeverity } from "@prisma/client"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"

type ClientLike = {
  id: string
  riskProfile?: string | null
  financialGoals?: string | null
  goals?: string | null
}

type KycLike = {
  id?: string
  status?: string | null
  sourceOfFunds?: string | null
  riskProfileResult?: string | null
  primaryObjective?: string | null
  politicallyExposedPerson?: boolean
  advisorOverride?: boolean
  advisorOverrideReason?: string | null
  nextKycReviewAt?: Date | string | null
  investmentKnowledge?: string | null
  investmentExperience?: string | null
  riskTolerance?: string | null
  riskCapacity?: string | null
  investmentHorizon?: string | null
  liquidityNeeds?: string | null
  borrowingNeeds?: string | null
  annualIncome?: number | null
  incomeRange?: string | null
  netWorth?: number | null
  liquidNetWorth?: number | null
  totalAssets?: number | null
  totalLiabilities?: number | null
  monthlyExpenses?: number | null
  emergencyFund?: number | null
  clientConfirmedNoChange?: boolean | null
  advisorAttestation?: boolean | null
  lastKycReviewAt?: Date | string | null
}

type DocumentLike = { id: string; name: string; type: string; status: string }
type ConsentLike = { id: string; type: string; status: string }
type ProductLike = { id: string; type: string; documentStatus?: string | null }

export type ComplianceAlertCandidate = {
  type: string
  severity: ComplianceAlertSeverity
  title: string
  description: string
  actionLabel?: string
  actionUrl?: string
}

function isPast(value?: Date | string | null) {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

const fulfilledDocumentStatuses = new Set(["RECEIVED", "VALIDATED", "WAIVED"])

function isFulfilledDocument(document: DocumentLike) {
  return fulfilledDocumentStatuses.has(document.status)
}

function hasFulfilledDocumentOfType(documents: DocumentLike[] | undefined, type: string) {
  return (documents ?? []).some((document) => document.type === type && isFulfilledDocument(document))
}

export function generateComplianceAlertCandidates({
  client,
  kyc,
  documents,
  consents,
  products,
}: {
  client: ClientLike
  kyc?: KycLike | null
  documents?: DocumentLike[]
  consents?: ConsentLike[]
  products?: ProductLike[]
}): ComplianceAlertCandidate[] {
  const alerts: ComplianceAlertCandidate[] = []

  if (!kyc || ["NOT_STARTED", "IN_PROGRESS", "REJECTED", "NEEDS_UPDATE"].includes(kyc.status ?? "NOT_STARTED")) {
    alerts.push({
      type: "KYC_INCOMPLETE",
      severity: "HIGH",
      title: "Profil client incomplet",
      description: "Le profil client n’est pas complet ou doit être mis à jour.",
      actionLabel: "Compléter le profil client",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (kyc?.status === "EXPIRED") {
    alerts.push({
      type: "KYC_EXPIRED",
      severity: "HIGH",
      title: "Profil client expiré",
      description: "Le profil client est expiré et doit être révisé.",
      actionLabel: "Planifier une révision",
      actionUrl: `/clients/${client.id}`,
    })
  }

  documents?.forEach((document) => {
    if (["REQUIRED", "REQUESTED"].includes(document.status)) {
      if (hasFulfilledDocumentOfType(documents, document.type)) return
      alerts.push({
        type: "DOCUMENT_MISSING",
        severity: "MEDIUM",
        title: "Document requis manquant",
        description: `${document.name} est requis pour le dossier.`,
        actionLabel: "Demander le document",
        actionUrl: `/clients/${client.id}`,
      })
    }
    if (document.status === "EXPIRED") {
      alerts.push({
        type: "DOCUMENT_EXPIRED",
        severity: "HIGH",
        title: "Document expiré",
        description: `${document.name} est expiré.`,
        actionLabel: "Demander une mise à jour",
        actionUrl: `/clients/${client.id}`,
      })
    }
  })

  if (!consents?.some((consent) => consent.status === "GIVEN")) {
    alerts.push({
      type: "CONSENT_MISSING",
      severity: "MEDIUM",
      title: "Consentement manquant",
      description: "Aucun consentement actif n’est enregistré dans le dossier.",
      actionLabel: "Ajouter un consentement",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (consents?.some((consent) => consent.status === "REVOKED")) {
    alerts.push({
      type: "CONSENT_REVOKED",
      severity: "HIGH",
      title: "Consentement révoqué",
      description: "Un consentement a été révoqué et doit être vérifié avant de poursuivre.",
      actionLabel: "Réviser le consentement",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!kyc?.riskProfileResult || kyc.riskProfileResult === "UNKNOWN" || client.riskProfile === "UNKNOWN") {
    alerts.push({
      type: "RISK_PROFILE_UNKNOWN",
      severity: "MEDIUM",
      title: "Profil de risque inconnu",
      description: "Le profil de risque n’est pas suffisamment documenté.",
      actionLabel: "Compléter le profil de risque",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!kyc?.primaryObjective && !client.financialGoals && !client.goals) {
    alerts.push({
      type: "OBJECTIVES_MISSING",
      severity: "MEDIUM",
      title: "Objectifs financiers manquants",
      description: "Les objectifs financiers du client ne sont pas documentés.",
      actionLabel: "Ajouter les objectifs",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!kyc?.sourceOfFunds || kyc.sourceOfFunds === "UNKNOWN") {
    alerts.push({
      type: "SOURCE_OF_FUNDS_MISSING",
      severity: "MEDIUM",
      title: "Source des fonds à confirmer",
      description: "La source des fonds n’est pas renseignée.",
      actionLabel: "Compléter la source des fonds",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (kyc?.politicallyExposedPerson) {
    alerts.push({
      type: "PEP_REVIEW_REQUIRED",
      severity: "CRITICAL",
      title: "Révision PEP requise",
      description: "Le client est indiqué comme personne politiquement exposée. Une vérification conformité est requise.",
      actionLabel: "Réviser le dossier",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (isPast(kyc?.nextKycReviewAt)) {
    alerts.push({
      type: "ANNUAL_REVIEW_OVERDUE",
      severity: "HIGH",
      title: "Révision annuelle en retard",
      description: "La prochaine révision du profil client est dépassée.",
      actionLabel: "Compléter la révision",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (kyc?.advisorOverride && !kyc.advisorOverrideReason) {
    alerts.push({
      type: "ADVISOR_OVERRIDE_MISSING_REASON",
      severity: "HIGH",
      title: "Justification de dérogation manquante",
      description: "Une dérogation conseiller est indiquée sans justification.",
      actionLabel: "Ajouter la justification",
      actionUrl: `/clients/${client.id}`,
    })
  }

  const kycEvaluation = evaluateKycProfile(kyc)
  kycEvaluation.alerts.forEach((alert) => {
    if (alerts.some((existing) => existing.type === alert.type)) return
    alerts.push({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      actionLabel: "Ouvrir le profil client",
      actionUrl: `/clients/${client.id}?tab=compliance&focus=kyc`,
    })
  })

  products?.forEach((product) => {
    if (["REQUIRED", "MISSING"].includes(product.documentStatus ?? "")) {
      alerts.push({
        type: "PRODUCT_WITHOUT_DOCUMENT",
        severity: "MEDIUM",
        title: "Produit sans document lié",
        description: "Un produit financier indique un document requis ou manquant.",
        actionLabel: "Ajouter le document",
        actionUrl: `/clients/${client.id}`,
      })
    }
  })

  return alerts
}
