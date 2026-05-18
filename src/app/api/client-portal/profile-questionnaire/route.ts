import { fail, handleApiError, ok } from "@/lib/api-response"
import { getClientPortalApiUser, findClientPortalRecord } from "@/lib/client-portal"
import { createAuditLog } from "@/lib/compliance/audit"
import { calculateComplianceScore } from "@/lib/compliance/score"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { prisma } from "@/lib/prisma"

type ProfileBody = Record<string, unknown>

const consentTypes = [
  {
    key: "personalInfoCollectionAccepted",
    type: "PERSONAL_INFO_COLLECTION",
    text: "J’autorise la collecte des renseignements personnels nécessaires à la tenue de mon dossier client.",
  },
  {
    key: "advisorAnalysisUseAccepted",
    type: "ADVISOR_ANALYSIS_USE",
    text: "J’autorise l’utilisation de mes renseignements pour l’analyse de mes besoins, la conformité et le suivi des recommandations.",
  },
  {
    key: "electronicCommunicationAccepted",
    type: "SECURE_ELECTRONIC_COMMUNICATIONS",
    text: "J’accepte que mon conseiller communique avec moi par voie électronique dans le cadre du suivi de mon dossier.",
  },
  {
    key: "documentExchangeAccepted",
    type: "CLIENT_DOCUMENT_EXCHANGE",
    text: "J’autorise l’échange de documents dans mon espace client sécurisé.",
  },
] as const

function text(body: ProfileBody, key: string, max = 2000) {
  const value = body[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function bool(body: ProfileBody, key: string) {
  return body[key] === true || body[key] === "true"
}

function numberValue(body: ProfileBody, key: string) {
  const value = body[key]
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function intValue(body: ProfileBody, key: string) {
  const value = numberValue(body, key)
  return value === null ? null : Math.max(0, Math.round(value))
}

function dateValue(body: ProfileBody, key: string) {
  const value = text(body, key, 20)
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function phoneValue(body: ProfileBody, key: string) {
  const value = text(body, key, 40)
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function emailValue(body: ProfileBody, key: string) {
  const value = text(body, key, 180)?.toLowerCase() ?? null
  if (!value) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "__INVALID_EMAIL__"
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
}

function collectMissing(body: ProfileBody, submit: boolean) {
  const missing = [
    !text(body, "legalFirstName") ? "Prénom légal" : null,
    !text(body, "legalLastName") ? "Nom légal" : null,
    !dateValue(body, "dateOfBirth") ? "Date de naissance" : null,
    !phoneValue(body, "phonePrimary") ? "Téléphone principal" : null,
    !emailValue(body, "emailPrimary") || emailValue(body, "emailPrimary") === "__INVALID_EMAIL__" ? "Courriel principal valide" : null,
    !text(body, "addressLine1") ? "Adresse résidentielle" : null,
    !text(body, "city") ? "Ville" : null,
    !text(body, "province") ? "Province" : null,
    !text(body, "postalCode") ? "Code postal" : null,
    !text(body, "familyStatus") ? "Situation familiale" : null,
    !text(body, "employmentStatus") ? "Statut d’emploi" : null,
    !text(body, "occupation") ? "Occupation" : null,
    numberValue(body, "annualIncome") === null && !text(body, "incomeRange") ? "Revenu annuel ou fourchette de revenu" : null,
    !text(body, "primaryGoal") ? "Objectif financier principal" : null,
    !text(body, "riskProfile") ? "Profil de risque" : null,
    !text(body, "riskTolerance") ? "Tolérance au risque" : null,
    !text(body, "riskCapacity") ? "Capacité de risque" : null,
    !text(body, "investmentKnowledge") ? "Connaissances financières" : null,
    !text(body, "investmentExperience") ? "Expérience de placement" : null,
    !text(body, "liquidityNeeds") ? "Besoins de liquidité" : null,
    !text(body, "borrowingNeeds") ? "Levier financier" : null,
    !text(body, "sourceOfFunds") ? "Source des fonds" : null,
    !text(body, "sourceOfWealth") ? "Source de la richesse" : null,
    submit && !bool(body, "personalInfoCollectionAccepted") ? "Consentement à la collecte des renseignements" : null,
    submit && !bool(body, "advisorAnalysisUseAccepted") ? "Consentement à l’analyse des besoins" : null,
    submit && !bool(body, "electronicCommunicationAccepted") ? "Consentement aux communications électroniques" : null,
    submit && !bool(body, "documentExchangeAccepted") ? "Consentement à l’échange de documents" : null,
  ].filter((item): item is string => Boolean(item))

  return missing
}

async function syncMissingWork({
  organizationId,
  clientId,
  advisorId,
  userId,
  missing,
}: {
  organizationId: string
  clientId: string
  advisorId: string | null
  userId: string
  missing: string[]
}) {
  if (missing.length === 0) return

  const description = `Informations manquantes dans le profil client sécurisé: ${missing.join(", ")}.`
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 2)

  const alert = await prisma.complianceAlert.findFirst({
    where: {
      organizationId,
      clientId,
      type: "CLIENT_SECURE_PROFILE_INCOMPLETE",
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    select: { id: true },
  })

  const alertRecord = alert ?? await prisma.complianceAlert.create({
    data: {
      organizationId,
      clientId,
      type: "CLIENT_SECURE_PROFILE_INCOMPLETE",
      severity: "MEDIUM",
      status: "OPEN",
      title: "Profil client sécurisé incomplet",
      description,
      actionLabel: "Ouvrir le profil",
      actionUrl: `/clients/${clientId}?tab=profile`,
    },
    select: { id: true },
  })

  const existingTask = await prisma.task.findFirst({
    where: {
      organizationId,
      clientId,
      type: "KYC",
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
      title: "Compléter le profil client sécurisé",
    },
    select: { id: true },
  })

  if (!existingTask) {
    await prisma.task.create({
      data: {
        organizationId,
        clientId,
        assignedToId: advisorId,
        createdById: userId,
        alertId: alertRecord.id,
        type: "KYC",
        title: "Compléter le profil client sécurisé",
        description,
        status: "TODO",
        priority: "HIGH",
        dueDate,
        isAutomated: true,
      },
    })
  }
}

async function saveProfile(request: Request, submit: boolean) {
  const user = await getClientPortalApiUser()
  const client = await findClientPortalRecord(user.email)
  if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

  const body = await request.json().catch(() => ({})) as ProfileBody
  const missing = collectMissing(body, submit)
  const emailPrimary = emailValue(body, "emailPrimary")
  const phonePrimary = phoneValue(body, "phonePrimary")
  const phoneSecondary = phoneValue(body, "phoneSecondary")
  const emailSecondary = emailValue(body, "emailSecondary")

  if (emailPrimary === "__INVALID_EMAIL__" || emailSecondary === "__INVALID_EMAIL__") {
    return fail("INVALID_EMAIL", "Un courriel inscrit n’a pas un format valide.", 422)
  }
  if ((phonePrimary && phonePrimary.length !== 10) || (phoneSecondary && phoneSecondary.length !== 10)) {
    return fail("INVALID_PHONE", "Les numéros de téléphone doivent contenir 10 chiffres.", 422)
  }

  if (submit && missing.length > 0) {
    await syncMissingWork({
      organizationId: client.organizationId,
      clientId: client.id,
      advisorId: client.advisorId,
      userId: user.id,
      missing,
    })
    return fail("PROFILE_INCOMPLETE", "Le profil client doit être complété avant la soumission.", 422, { missing })
  }

  const now = new Date()
  const nextReview = new Date(now)
  nextReview.setFullYear(nextReview.getFullYear() + 1)
  const annualIncome = numberValue(body, "annualIncome")
  const dependentsCount = intValue(body, "dependentsCount")
  const protectionNotes = text(body, "protectionNeeds", 4000)

  const updatedClient = await prisma.client.update({
    where: { id: client.id },
    data: {
      firstName: text(body, "legalFirstName", 120) ?? client.firstName,
      lastName: text(body, "legalLastName", 120) ?? client.lastName,
      dateOfBirth: dateValue(body, "dateOfBirth") ?? client.dateOfBirth,
      phone: phonePrimary ?? client.phone,
      phonePrimary: phonePrimary ?? client.phonePrimary,
      phoneSecondary,
      email: emailPrimary ?? client.email,
      emailPrimary: emailPrimary ?? client.emailPrimary,
      emailSecondary,
      addressLine1: text(body, "addressLine1", 250),
      addressLine2: text(body, "addressLine2", 250),
      city: text(body, "city", 120),
      province: text(body, "province", 80),
      postalCode: text(body, "postalCode", 20),
      country: text(body, "country", 80) ?? "Canada",
      familyStatus: text(body, "familyStatus", 80),
      spouseName: text(body, "spouseName", 160),
      dependentsCount,
      dependents: dependentsCount,
      dependentsDetails: text(body, "dependentsDetails", 4000),
      hasChildren: (dependentsCount ?? 0) > 0,
      occupation: text(body, "occupation", 160),
      employer: text(body, "employer", 160),
      employmentStatus: text(body, "employmentStatus", 80),
      yearsAtJob: intValue(body, "yearsAtJob"),
      annualIncome: annualIncome === null ? null : Math.round(annualIncome),
      approximateIncome: annualIncome === null ? null : Math.round(annualIncome),
      incomeRange: text(body, "incomeRange", 80),
      netWorth: numberValue(body, "netWorth"),
      liquidAssets: numberValue(body, "liquidAssets"),
      liabilities: numberValue(body, "liabilities"),
      primaryGoal: text(body, "primaryGoal", 200),
      financialGoals: text(body, "financialGoals", 4000),
      riskProfile: text(body, "riskProfile", 80),
      investmentHorizon: text(body, "investmentHorizon", 80),
      protectionNeeds: Boolean(protectionNotes),
      kycCompleted: submit ? true : client.kycCompleted,
      kycDate: submit ? now : client.kycDate,
      consentGiven: submit ? true : client.consentGiven,
      nextReviewDate: submit ? (client.nextReviewDate ?? nextReview) : client.nextReviewDate,
    },
  })

  const kyc = await prisma.clientKycProfile.upsert({
    where: { clientId: client.id },
    create: {
      organizationId: client.organizationId,
      clientId: client.id,
      status: submit ? "PENDING_REVIEW" : "IN_PROGRESS",
      legalFirstName: updatedClient.firstName,
      legalLastName: updatedClient.lastName,
      dateOfBirth: updatedClient.dateOfBirth,
      provinceOfResidence: updatedClient.province,
      countryOfResidence: updatedClient.country,
      maritalStatus: updatedClient.familyStatus,
      dependentsCount: updatedClient.dependentsCount,
      occupation: updatedClient.occupation,
      employer: updatedClient.employer,
      employmentStatus: updatedClient.employmentStatus,
      annualIncome: updatedClient.annualIncome,
      incomeRange: updatedClient.incomeRange,
      netWorth: updatedClient.netWorth,
      liquidNetWorth: updatedClient.liquidAssets,
      totalAssets: numberValue(body, "totalAssets") ?? updatedClient.netWorth,
      totalLiabilities: updatedClient.liabilities,
      monthlyExpenses: numberValue(body, "monthlyExpenses"),
      emergencyFund: numberValue(body, "emergencyFund"),
      primaryObjective: updatedClient.primaryGoal,
      investmentHorizon: updatedClient.investmentHorizon,
      investmentKnowledge: text(body, "investmentKnowledge", 80),
      investmentExperience: text(body, "investmentExperience", 250),
      liquidityNeeds: text(body, "liquidityNeeds", 80),
      borrowingNeeds: text(body, "borrowingNeeds", 500),
      riskTolerance: text(body, "riskTolerance", 80),
      riskCapacity: text(body, "riskCapacity", 80),
      riskProfileResult: updatedClient.riskProfile,
      financialGoals: updatedClient.financialGoals,
      sourceOfFunds: text(body, "sourceOfFunds", 2000),
      sourceOfWealth: text(body, "sourceOfWealth", 2000),
      protectionNeeds: protectionNotes,
      notes: text(body, "additionalNotes", 4000),
      lastKycReviewAt: submit ? now : client.kycProfile?.lastKycReviewAt,
      nextKycReviewAt: submit ? nextReview : client.kycProfile?.nextKycReviewAt,
      reviewStatus: submit ? "CLIENT_SUBMITTED" : "CLIENT_DRAFT",
      reviewNotes: JSON.stringify({ dependentsDetails: updatedClient.dependentsDetails, submittedFrom: "client_portal", submit }),
      complianceScore: 0,
    },
    update: {
      status: submit ? "PENDING_REVIEW" : "IN_PROGRESS",
      legalFirstName: updatedClient.firstName,
      legalLastName: updatedClient.lastName,
      dateOfBirth: updatedClient.dateOfBirth,
      provinceOfResidence: updatedClient.province,
      countryOfResidence: updatedClient.country,
      maritalStatus: updatedClient.familyStatus,
      dependentsCount: updatedClient.dependentsCount,
      occupation: updatedClient.occupation,
      employer: updatedClient.employer,
      employmentStatus: updatedClient.employmentStatus,
      annualIncome: updatedClient.annualIncome,
      incomeRange: updatedClient.incomeRange,
      netWorth: updatedClient.netWorth,
      liquidNetWorth: updatedClient.liquidAssets,
      totalAssets: numberValue(body, "totalAssets") ?? updatedClient.netWorth,
      totalLiabilities: updatedClient.liabilities,
      monthlyExpenses: numberValue(body, "monthlyExpenses"),
      emergencyFund: numberValue(body, "emergencyFund"),
      primaryObjective: updatedClient.primaryGoal,
      investmentHorizon: updatedClient.investmentHorizon,
      investmentKnowledge: text(body, "investmentKnowledge", 80),
      investmentExperience: text(body, "investmentExperience", 250),
      liquidityNeeds: text(body, "liquidityNeeds", 80),
      borrowingNeeds: text(body, "borrowingNeeds", 500),
      riskTolerance: text(body, "riskTolerance", 80),
      riskCapacity: text(body, "riskCapacity", 80),
      riskProfileResult: updatedClient.riskProfile,
      financialGoals: updatedClient.financialGoals,
      sourceOfFunds: text(body, "sourceOfFunds", 2000),
      sourceOfWealth: text(body, "sourceOfWealth", 2000),
      protectionNeeds: protectionNotes,
      notes: text(body, "additionalNotes", 4000),
      lastKycReviewAt: submit ? now : client.kycProfile?.lastKycReviewAt,
      nextKycReviewAt: submit ? nextReview : client.kycProfile?.nextKycReviewAt,
      reviewStatus: submit ? "CLIENT_SUBMITTED" : "CLIENT_DRAFT",
      reviewNotes: JSON.stringify({ dependentsDetails: updatedClient.dependentsDetails, submittedFrom: "client_portal", submit }),
      complianceScore: client.kycProfile?.complianceScore ?? 0,
    },
  })

  const refreshedKyc = await prisma.clientKycProfile.findUnique({ where: { id: kyc.id } })
  const complianceScore = calculateComplianceScore(refreshedKyc, [], client.consents)
  const scoredKyc = await prisma.clientKycProfile.update({
    where: { id: kyc.id },
    data: { complianceScore: submit ? Math.max(complianceScore, 70) : Math.max(complianceScore, 35) },
  })

  if (submit) {
    await Promise.all(
      consentTypes.map((consent) =>
        prisma.clientConsent.create({
          data: {
            organizationId: client.organizationId,
            clientId: client.id,
            capturedById: user.id,
            type: consent.type,
            status: "GIVEN",
            consentText: consent.text,
            version: "client-profile-v1",
            givenAt: now,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
          },
        })
      )
    )
  }

  await prisma.activity.create({
    data: {
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      type: "KYC_UPDATED",
      title: submit ? "Profil client soumis" : "Brouillon du profil client sauvegardé",
      description: submit
        ? "Le client a soumis son profil client sécurisé depuis le portail."
        : "Le client a sauvegardé un brouillon du profil client sécurisé depuis le portail.",
      source: "CLIENT_PORTAL",
      entityType: "KYC",
      entityId: kyc.id,
    },
  })

  await createAuditLog({
    organizationId: client.organizationId,
    userId: user.id,
    clientId: client.id,
    entityType: "KYC",
    entityId: kyc.id,
    action: submit ? "CLIENT_PROFILE_SUBMITTED" : "CLIENT_PROFILE_DRAFT_SAVED",
    newValue: { status: kyc.status, missing },
  })

  await generateComplianceAlertsForClient({ organizationId: client.organizationId, clientId: client.id, userId: user.id })

  if (missing.length > 0) {
    await syncMissingWork({
      organizationId: client.organizationId,
      clientId: client.id,
      advisorId: client.advisorId,
      userId: user.id,
      missing,
    })
  }

  if (submit && client.advisorId) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1)
    await prisma.task.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        assignedToId: client.advisorId,
        createdById: user.id,
        type: "KYC",
        title: "Réviser le profil client soumis",
        description: "Le client a complété son profil client sécurisé. Vérifier les données, les documents requis et préparer le snapshot au besoin.",
        status: "TODO",
        priority: "HIGH",
        dueDate,
        isAutomated: true,
      },
    })

    await prisma.notification.create({
      data: {
        organizationId: client.organizationId,
        userId: client.advisorId,
        type: "INFO",
        priority: "HIGH",
        status: "UNREAD",
        title: "Profil client soumis",
        message: `${updatedClient.firstName} ${updatedClient.lastName} a complété son profil client sécurisé.`,
        actionLabel: "Réviser le profil",
        actionUrl: `/clients/${client.id}?tab=profile`,
        href: `/clients/${client.id}?tab=profile`,
        entityType: "CLIENT",
        entityId: client.id,
        clientId: client.id,
      },
    })
  }

  return ok({ client: updatedClient, kyc: scoredKyc, missing, status: submit ? "submitted" : "draft" })
}

export async function PATCH(request: Request) {
  try {
    return await saveProfile(request, false)
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    return await saveProfile(request, true)
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
