import { fail, handleApiError, ok } from "@/lib/api-response"
import { getClientPortalApiUser, findClientPortalRecord } from "@/lib/client-portal"
import { createAuditLog } from "@/lib/compliance/audit"
import { createKycSnapshot } from "@/lib/compliance/snapshots"
import { prisma } from "@/lib/prisma"

const confirmationText =
  "Je confirme que les renseignements affichés dans mon dossier client sont exacts et complets à ma connaissance. J’autorise mon conseiller à les utiliser pour le suivi administratif, la conformité et l’analyse de mes besoins."

const portalConsentTypes = [
  {
    key: "personalInfoCollectionAccepted",
    type: "PERSONAL_INFO_COLLECTION",
    text: "J’autorise la collecte des renseignements personnels nécessaires à la tenue de mon dossier client.",
  },
  {
    key: "advisorAnalysisUseAccepted",
    type: "ADVISOR_ANALYSIS_USE",
    text: "J’autorise l’utilisation de mes renseignements pour l’analyse de mes besoins, la conformité et le suivi de mes recommandations.",
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

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
}

function typedSignature(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 160) : ""
}

export async function POST(request: Request) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.accepted !== true) return fail("CONSENT_REQUIRED", "La confirmation explicite est requise.", 422)
    const signature = typedSignature(body.typedSignature)
    if (signature.length < 2) return fail("SIGNATURE_REQUIRED", "La signature électronique par nom tapé est requise.", 422)
    const missingConsent = portalConsentTypes.find((consent) => body[consent.key] !== true)
    if (missingConsent) {
      return fail("CONSENT_REQUIRED", "Tous les consentements nécessaires doivent être cochés avant la confirmation.", 422)
    }

    const now = new Date()
    const nextReview = new Date(now)
    nextReview.setFullYear(nextReview.getFullYear() + 1)

    const kyc = await prisma.clientKycProfile.upsert({
      where: { clientId: client.id },
      create: {
        organizationId: client.organizationId,
        clientId: client.id,
        status: "PENDING_REVIEW",
        legalFirstName: client.firstName,
        legalLastName: client.lastName,
        dateOfBirth: client.dateOfBirth,
        provinceOfResidence: client.province,
        countryOfResidence: client.country,
        maritalStatus: client.familyStatus,
        dependentsCount: client.dependentsCount ?? client.dependents,
        occupation: client.occupation,
        employer: client.employer,
        employmentStatus: client.employmentStatus,
        annualIncome: client.annualIncome ?? client.approximateIncome,
        incomeRange: client.incomeRange,
        netWorth: client.netWorth,
        liquidNetWorth: client.liquidAssets,
        totalLiabilities: client.liabilities,
        primaryObjective: client.primaryGoal,
        investmentHorizon: client.investmentHorizon,
        riskProfileResult: client.riskProfile,
        financialGoals: client.financialGoals ?? client.goals,
        clientConfirmedNoChange: true,
        lastKycReviewAt: now,
        nextKycReviewAt: nextReview,
        reviewStatus: "CLIENT_CONFIRMED",
        reviewNotes: JSON.stringify({ note: typeof body.note === "string" ? body.note.slice(0, 1000) : null, typedSignature: signature }),
        complianceScore: Math.max(client.kycProfile?.complianceScore ?? 0, 75),
      },
      update: {
        status: "PENDING_REVIEW",
        legalFirstName: client.firstName,
        legalLastName: client.lastName,
        dateOfBirth: client.dateOfBirth,
        provinceOfResidence: client.province,
        countryOfResidence: client.country,
        maritalStatus: client.familyStatus,
        dependentsCount: client.dependentsCount ?? client.dependents,
        occupation: client.occupation,
        employer: client.employer,
        employmentStatus: client.employmentStatus,
        annualIncome: client.annualIncome ?? client.approximateIncome,
        incomeRange: client.incomeRange,
        netWorth: client.netWorth,
        liquidNetWorth: client.liquidAssets,
        totalLiabilities: client.liabilities,
        primaryObjective: client.primaryGoal,
        investmentHorizon: client.investmentHorizon,
        riskProfileResult: client.riskProfile,
        financialGoals: client.financialGoals ?? client.goals,
        clientConfirmedNoChange: true,
        lastKycReviewAt: now,
        nextKycReviewAt: nextReview,
        reviewStatus: "CLIENT_CONFIRMED",
        reviewNotes: JSON.stringify({ note: typeof body.note === "string" ? body.note.slice(0, 1000) : null, typedSignature: signature }),
        complianceScore: Math.max(client.kycProfile?.complianceScore ?? 0, 75),
      },
    })

    const consent = await prisma.clientConsent.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        capturedById: user.id,
        type: "PORTAL_KYC_CONFIRMATION",
        status: "GIVEN",
        consentText: confirmationText,
        version: "portal-kyc-v1",
        givenAt: now,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
        notes: JSON.stringify({ note: typeof body.note === "string" ? body.note.slice(0, 1000) : null, typedSignature: signature }),
      },
    })

    const detailedConsents = await Promise.all(
      portalConsentTypes.map((portalConsent) =>
        prisma.clientConsent.create({
          data: {
            organizationId: client.organizationId,
            clientId: client.id,
            capturedById: user.id,
            type: portalConsent.type,
            status: "GIVEN",
            consentText: portalConsent.text,
            version: "portal-consent-v1",
            givenAt: now,
            ipAddress: clientIp(request),
            userAgent: request.headers.get("user-agent"),
            notes: JSON.stringify({ note: typeof body.note === "string" ? body.note.slice(0, 1000) : null, typedSignature: signature }),
          },
        })
      )
    )

    await prisma.client.update({
      where: { id: client.id },
      data: {
        kycCompleted: true,
        kycDate: now,
        consentGiven: true,
        nextReviewDate: client.nextReviewDate ?? nextReview,
      },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "CONSENT_GIVEN",
        title: "Confirmation client reçue",
        description: "Le client a confirmé les renseignements de son profil client depuis le portail client.",
        source: "CLIENT_PORTAL",
        entityType: "ClientConsent",
        entityId: consent.id,
      },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "CONSENT_GIVEN",
        title: "Consentements portail client acceptés",
        description: `${detailedConsents.length} consentements nécessaires ont été cochés et conservés au dossier.`,
        source: "CLIENT_PORTAL",
        entityType: "ClientConsent",
        entityId: consent.id,
      },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "KYC_UPDATED",
        title: "Profil client confirmé par le client",
        description: "Le profil client est prêt pour la révision conseiller.",
        source: "CLIENT_PORTAL",
        entityType: "KYC",
        entityId: kyc.id,
      },
    })

    await createAuditLog({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      entityType: "CONSENT",
      entityId: consent.id,
      action: "PORTAL_KYC_CONFIRMATION",
      newValue: { status: "GIVEN", version: "portal-kyc-v1", typedSignature: signature },
    })

    const snapshot = await createKycSnapshot({
      organizationId: client.organizationId,
      clientId: client.id,
      userId: user.id,
      reason: "CLIENT_PORTAL_CONFIRMATION",
      clientAccuracyConfirmed: true,
      useForAnalysisOrRecommendation: true,
    })

    if (client.advisorId) {
      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "INFO",
          priority: "HIGH",
          status: "UNREAD",
          title: "Profil client confirmé par le client",
          message: `${client.firstName} ${client.lastName} a confirmé son dossier depuis le portail client.`,
          actionLabel: "Réviser le profil client",
          actionUrl: `/clients/${client.id}`,
          href: `/clients/${client.id}`,
          entityType: "CLIENT",
          entityId: client.id,
          clientId: client.id,
        },
      })
    }

    return ok({ kyc, consent, detailedConsents, snapshot }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
