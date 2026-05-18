import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const defaultPrivacyPurposes = [
  {
    code: "client_profile_collection",
    name: "Collecte du profil client",
    description: "Collecter les renseignements nécessaires à l’ouverture et au maintien du dossier client.",
    isRequiredForService: true,
    sensitiveDataAllowed: true,
  },
  {
    code: "kyc_use",
    name: "Utilisation pour profil client",
    description: "Utiliser les renseignements pour connaître le client, ses objectifs, sa situation et son profil de risque.",
    isRequiredForService: true,
    sensitiveDataAllowed: true,
  },
  {
    code: "insurance_needs_analysis",
    name: "Analyse des besoins",
    description: "Utiliser les données et documents afin d’analyser les besoins d’assurance ou de planification.",
    isRequiredForService: true,
    sensitiveDataAllowed: true,
  },
  {
    code: "document_vault",
    name: "Conservation documentaire",
    description: "Conserver les documents dans le coffre documentaire sécurisé du dossier client.",
    isRequiredForService: true,
    sensitiveDataAllowed: true,
  },
  {
    code: "insurer_disclosure",
    name: "Communication à un assureur ou tiers autorisé",
    description: "Communiquer les renseignements nécessaires à une soumission, proposition, mise en vigueur ou suivi.",
    isRequiredForService: false,
    sensitiveDataAllowed: true,
  },
  {
    code: "ai_assistance",
    name: "Assistance technologique / IA",
    description: "Utiliser des outils assistés pour classer, résumer ou extraire des renseignements sous validation humaine.",
    isRequiredForService: false,
    sensitiveDataAllowed: true,
  },
  {
    code: "marketing",
    name: "Communications marketing",
    description: "Envoyer des communications éducatives, promotionnelles ou commerciales distinctes du service.",
    isRequiredForService: false,
    sensitiveDataAllowed: false,
  },
]

export async function ensureDefaultPrivacyPurposes(organizationId: string, userId?: string | null) {
  const purposes = []
  for (const purpose of defaultPrivacyPurposes) {
    const record = await prisma.privacyPurpose.upsert({
      where: { organizationId_code: { organizationId, code: purpose.code } },
      update: {},
      create: { organizationId, ...purpose },
    })
    purposes.push(record)
    const existingTemplate = await prisma.consentTemplate.findFirst({
      where: { organizationId, purposeId: record.id, language: "FR", active: true },
      select: { id: true },
    })
    if (!existingTemplate) {
      await prisma.consentTemplate.create({
        data: {
          organizationId,
          purposeId: record.id,
          createdById: userId ?? undefined,
          version: "1.0",
          language: "FR",
          title: `Consentement - ${record.name}`,
          body: consentBodyForPurpose(record.name, record.description ?? ""),
          requiresExplicitAction: true,
          isSensitive: record.sensitiveDataAllowed,
        },
      })
    }
  }
  return purposes
}

function consentBodyForPurpose(name: string, description: string) {
  return `J’autorise le cabinet et mon conseiller à utiliser mes renseignements personnels pour la finalité suivante : ${name}. ${description} Les renseignements seront utilisés uniquement aux fins indiquées, conservés de façon sécuritaire et traités selon les politiques applicables.`
}

export async function createConsentEvent({
  organizationId,
  consentId,
  eventType,
  actorType = "SYSTEM",
  actorId,
  metadata,
}: {
  organizationId: string
  consentId: string
  eventType: string
  actorType?: string
  actorId?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.consentEvent.create({
    data: {
      organizationId,
      consentId,
      eventType,
      actorType,
      actorId,
      metadata,
    },
  })
}

export async function findActiveConsent({
  organizationId,
  clientId,
  purposeCode,
  type,
}: {
  organizationId: string
  clientId: string
  purposeCode?: string
  type?: string
}) {
  const now = new Date()
  return prisma.clientConsent.findFirst({
    where: {
      organizationId,
      clientId,
      status: "GIVEN",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(purposeCode ? { purpose: { code: purposeCode } } : {}),
      ...(type ? { type } : {}),
    },
    select: { id: true, purposeId: true, type: true },
    orderBy: [{ givenAt: "desc" }, { createdAt: "desc" }],
  })
}

export async function hasActiveConsent(args: {
  organizationId: string
  clientId: string
  purposeCode?: string
  type?: string
}) {
  const consent = await findActiveConsent(args)
  return Boolean(consent)
}

export async function hasActiveAiConsent({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  return hasActiveConsent({ organizationId, clientId, purposeCode: "ai_assistance" })
}

export async function assertActiveAiConsent({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const hasConsent = await hasActiveAiConsent({ organizationId, clientId })
  if (!hasConsent) throw new Error("AI_CONSENT_REQUIRED")
}

export async function assertActivePurposeConsent({
  organizationId,
  clientId,
  purposeCode,
  errorCode = "CONSENT_REQUIRED",
}: {
  organizationId: string
  clientId: string
  purposeCode: string
  errorCode?: string
}) {
  const consent = await findActiveConsent({ organizationId, clientId, purposeCode })
  if (!consent) throw new Error(errorCode)
  return consent
}

export async function assertConsentBelongsToClient({
  organizationId,
  clientId,
  consentId,
  purposeCode,
}: {
  organizationId: string
  clientId: string
  consentId?: string | null
  purposeCode?: string
}) {
  if (!consentId) return null
  const now = new Date()
  const consent = await prisma.clientConsent.findFirst({
    where: {
      id: consentId,
      organizationId,
      clientId,
      status: "GIVEN",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(purposeCode ? { purpose: { code: purposeCode } } : {}),
    },
    select: { id: true },
  })
  if (!consent) throw new Error("CONSENT_NOT_ACTIVE_FOR_CLIENT")
  return consent
}

export async function assertApprovedPia({
  organizationId,
  piaId,
}: {
  organizationId: string
  piaId?: string | null
}) {
  if (!piaId) throw new Error("PIA_REQUIRED")
  const pia = await prisma.privacyImpactAssessment.findFirst({
    where: { id: piaId, organizationId, status: "APPROVED", outsideQuebec: true },
    select: { id: true },
  })
  if (!pia) throw new Error("PIA_NOT_APPROVED")
}

export function privacyRequestDueDate(receivedAt = new Date()) {
  const dueAt = new Date(receivedAt)
  dueAt.setDate(dueAt.getDate() + 30)
  return dueAt
}
