import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { createKycVersion } from "@/lib/compliance/kyc-advanced"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { sanitizeFileName } from "@/lib/documents/file-validation"
import { prisma } from "@/lib/prisma"
import { sendClientPortalInvitation } from "@/lib/services/client-portal-invitations"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"
import type { Prisma } from "@prisma/client"

function toSnapshotJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pdfEscape(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function createSimplePdf(lines: string[]) {
  const contentLines = lines.slice(0, 68).map((line) => `(${pdfEscape(line).slice(0, 112)}) Tj T*`).join("\n")
  const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${contentLines}\nET`
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += object
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, "utf8")
}

function section(title: string, lines: Array<string | null | undefined>) {
  return [
    "",
    "------------------------------------------------------------",
    title.toUpperCase(),
    "------------------------------------------------------------",
    ...lines.filter(Boolean).map((line) => String(line)),
  ]
}

function fullName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

export async function createKycSnapshot({
  organizationId,
  clientId,
  userId,
  reason,
  advisorAttestationAccepted = false,
  clientAccuracyConfirmed = false,
  useForAnalysisOrRecommendation = false,
  sendToClientForConfirmation = false,
  origin,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  reason: string
  advisorAttestationAccepted?: boolean
  clientAccuracyConfirmed?: boolean
  useForAnalysisOrRecommendation?: boolean
  sendToClientForConfirmation?: boolean
  origin?: string | null
}) {
  const isClientPortalSnapshot = reason === "CLIENT_PORTAL_CONFIRMATION"
  if (!isClientPortalSnapshot && !advisorAttestationAccepted) {
    throw new Error("ADVISOR_ATTESTATION_REQUIRED")
  }
  if (!isClientPortalSnapshot && !useForAnalysisOrRecommendation) {
    throw new Error("SNAPSHOT_USE_CONFIRMATION_REQUIRED")
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      advisor: { select: { id: true, organizationId: true, name: true, email: true, title: true } },
      kycProfile: true,
      consents: true,
      documents: true,
      complianceAlerts: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" },
      },
      products: {
        select: {
          id: true,
          category: true,
          type: true,
          status: true,
          company: true,
          productName: true,
          policyNumber: true,
          coverageAmount: true,
          premium: true,
          documentStatus: true,
        },
      },
    },
  })
  if (!client) throw new Error("Client introuvable.")

  const lastSnapshot = await prisma.kycSnapshot.findFirst({
    where: { organizationId, clientId },
    orderBy: { version: "desc" },
    select: { version: true },
  })

  const capturedAt = new Date()
  const kycEvaluation = evaluateKycProfile(client.kycProfile)
  const snapshotPayload = toSnapshotJson({
    capturedAt: capturedAt.toISOString(),
    reason,
    attestations: {
      advisorAttestationAccepted: Boolean(advisorAttestationAccepted || client.kycProfile?.advisorAttestation),
      clientAccuracyConfirmed: Boolean(clientAccuracyConfirmed || isClientPortalSnapshot || client.kycCompleted),
      useForAnalysisOrRecommendation: Boolean(useForAnalysisOrRecommendation || isClientPortalSnapshot),
      sendToClientForConfirmation,
      advisorId: userId ?? null,
    },
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      clientNumber: client.clientNumber,
      profileType: client.profileType,
      status: client.status,
      dateOfBirth: client.dateOfBirth,
      gender: client.gender,
      phone: client.phone,
      phonePrimary: client.phonePrimary,
      phoneSecondary: client.phoneSecondary,
      email: client.email,
      emailPrimary: client.emailPrimary,
      emailSecondary: client.emailSecondary,
      preferredContactMethod: client.preferredContactMethod,
      address: client.address,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      city: client.city,
      province: client.province,
      postalCode: client.postalCode,
      country: client.country,
      familyStatus: client.familyStatus,
      spouseName: client.spouseName,
      spouseGender: client.spouseGender,
      spouseDateOfBirth: client.spouseDateOfBirth,
      hasChildren: client.hasChildren,
      children: client.children,
      dependents: client.dependents,
      dependentsCount: client.dependentsCount,
      dependentsDetails: client.dependentsDetails,
      occupation: client.occupation,
      employer: client.employer,
      employmentStatus: client.employmentStatus,
      yearsAtJob: client.yearsAtJob,
      annualIncome: client.annualIncome,
      approximateIncome: client.approximateIncome,
      incomeRange: client.incomeRange,
      riskProfile: client.riskProfile,
      netWorth: client.netWorth,
      liquidAssets: client.liquidAssets,
      liabilities: client.liabilities,
      savingsRate: client.savingsRate,
      goals: client.goals,
      financialGoals: client.financialGoals,
      primaryGoal: client.primaryGoal,
      investmentHorizon: client.investmentHorizon,
      source: client.source,
      referredBy: client.referredBy,
      relationshipStartDate: client.relationshipStartDate,
      lastContactAt: client.lastContactAt,
      nextReviewDate: client.nextReviewDate,
      kycCompleted: client.kycCompleted,
      kycDate: client.kycDate,
      identityVerified: client.identityVerified,
      consentGiven: client.consentGiven,
      complianceStatus: client.complianceStatus,
    },
    advisor: client.advisor,
    kycProfile: toSnapshotJson(client.kycProfile),
    consents: client.consents.map((consent) => ({
      id: consent.id,
      type: consent.type,
      status: consent.status,
      version: consent.version,
      givenAt: consent.givenAt,
      revokedAt: consent.revokedAt,
      expiresAt: consent.expiresAt,
      notes: consent.notes,
    })),
    documents: client.documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      isRequired: document.isRequired,
      visibility: document.visibility,
      requestedAt: document.requestedAt,
      receivedAt: document.receivedAt,
      validatedAt: document.validatedAt,
      expiresAt: document.expiresAt,
    })),
    products: toSnapshotJson(client.products),
    openAlerts: client.complianceAlerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      status: alert.status,
      createdAt: alert.createdAt,
    })),
    summary: {
      kycStatus: client.kycProfile?.status ?? (client.kycCompleted ? "APPROVED" : "NOT_STARTED"),
      complianceScore: client.kycProfile?.complianceScore ?? null,
      completionScore: kycEvaluation.completionScore,
      freshnessScore: kycEvaluation.freshnessScore,
      coherenceScore: kycEvaluation.coherenceScore,
      recommendationReady: kycEvaluation.recommendationReady,
      finalRiskProfile: kycEvaluation.finalRiskProfile,
      missingKycFields: kycEvaluation.missingFields,
      subjectType: client.kycProfile?.subjectType ?? client.profileType,
      identityVerified: client.identityVerified,
      consentGiven: client.consentGiven,
      activeConsents: client.consents.filter((consent) => consent.status === "GIVEN").length,
      documentsTotal: client.documents.length,
      documentsValidated: client.documents.filter((document) => document.status === "VALIDATED").length,
      documentsRequiredOpen: client.documents.filter((document) => document.isRequired && !["VALIDATED", "RECEIVED"].includes(document.status)).length,
      openAlerts: client.complianceAlerts.length,
      criticalAlerts: client.complianceAlerts.filter((alert) => alert.severity === "CRITICAL" || alert.severity === "HIGH").length,
      productsTotal: client.products.length,
    },
  })

  const snapshot = await prisma.kycSnapshot.create({
    data: {
      organizationId,
      clientId,
      createdById: userId,
      version: (lastSnapshot?.version ?? 0) + 1,
      reason,
      snapshotData: snapshotPayload,
    },
  })

  const summary = snapshotPayload.summary
  const clientName = fullName(client)
  const reportText = [
    "FINASSURO CRM",
    "RAPPORT PROFIL CLIENT",
    `Document date: ${new Intl.DateTimeFormat("fr-CA").format(capturedAt)}`,
    `Client: ${clientName}`,
    `Version profil client: v${snapshot.version}`,
    `Raison: ${reason}`,
    ...section("Attestations", [
      `Attestation conseiller: ${snapshotPayload.attestations.advisorAttestationAccepted ? "Oui" : "Non"}`,
      `Confirmation exactitude client: ${snapshotPayload.attestations.clientAccuracyConfirmed ? "Oui" : "Non / a obtenir"}`,
      `Utilisable pour analyse ou recommandation: ${snapshotPayload.attestations.useForAnalysisOrRecommendation ? "Oui" : "Non"}`,
      `Envoye au client pour confirmation: ${sendToClientForConfirmation ? "Oui" : "Non"}`,
    ]),
    ...section("Donnees figees", [
      `Type de dossier: ${summary.subjectType ?? "Non defini"}`,
      `Statut profil client: ${summary.kycStatus ?? "Non defini"}`,
      `Score conformite: ${typeof summary.complianceScore === "number" ? `${summary.complianceScore}/100` : "Non cote"}`,
      `Completude profil client: ${summary.completionScore}/100`,
      `Fraicheur profil client: ${summary.freshnessScore}/100`,
      `Coherence profil client: ${summary.coherenceScore}/100`,
      `Profil de risque final calcule: ${summary.finalRiskProfile}`,
      `Pret pour recommandation: ${summary.recommendationReady ? "Oui" : "Non"}`,
      `Champs profil client manquants: ${summary.missingKycFields.length > 0 ? summary.missingKycFields.join(", ") : "Aucun champ critique"}`,
      `Identite verifiee: ${summary.identityVerified ? "Oui" : "Non"}`,
      `Consentement actif: ${summary.consentGiven ? "Oui" : "Non"}`,
      `Consentements actifs: ${summary.activeConsents}`,
      `Documents valides: ${summary.documentsValidated}/${summary.documentsTotal}`,
      `Documents requis ouverts: ${summary.documentsRequiredOpen}`,
      `Alertes ouvertes: ${summary.openAlerts}`,
      `Alertes critiques: ${summary.criticalAlerts}`,
      `Produits au dossier: ${summary.productsTotal}`,
    ]),
    ...section("Identification client", [
      `Nom: ${clientName}`,
      `Telephone: ${client.phonePrimary ?? client.phone}`,
      `Courriel: ${client.emailPrimary ?? client.email ?? client.emailSecondary ?? "Non defini"}`,
      `Adresse: ${[client.addressLine1 ?? client.address, client.city, client.province, client.postalCode, client.country].filter(Boolean).join(", ") || "Non definie"}`,
    ]),
    ...section("Utilisation", [
      "Ce rapport fige les renseignements connus au moment de la creation de cette version.",
      "Il doit etre conserve comme preuve lorsque le dossier est utilise pour une analyse des besoins ou une recommandation.",
      "Si la situation du client change, une nouvelle version doit etre creee.",
    ]),
  ].join("\n")
  const fileName = sanitizeFileName(`profil-client-${clientName}-v${snapshot.version}.pdf`)
  const storagePath = `${organizationId}/clients/${clientId}/kyc/${fileName}`
  const pdfBuffer = createSimplePdf(reportText.split("\n"))
  const bucket = getDocumentsBucket()
  const { error: uploadError } = await getSupabaseServerClient()
    .storage
    .from(bucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })
  if (uploadError) throw new Error(uploadError.message)

  await ensureClientFolderStructure({ organizationId, clientId, userId })
  const clientFolder = await prisma.documentFolder.findFirst({
    where: { organizationId, clientId, name: "Documents signés", status: "ACTIVE" },
    select: { id: true },
  })
  const reportDocument = await prisma.document.create({
    data: {
      organizationId,
      clientId,
      uploadedById: userId,
      type: "KYC_FORM",
      status: sendToClientForConfirmation ? "REQUESTED" : "RECEIVED",
      visibility: sendToClientForConfirmation ? "CLIENT_VISIBLE" : "TEAM",
      folderId: clientFolder?.id,
      name: `Rapport profil client v${snapshot.version}`,
      description: `PDF de preuve généré automatiquement pour la version v${snapshot.version} du profil client. Le rapport complet est conservé dans le fichier joint.`,
      fileName,
      originalFileName: `Rapport profil client - ${clientName} - v${snapshot.version}.pdf`,
      storageBucket: bucket,
      storagePath,
      storageProvider: "SUPABASE",
      mimeType: "application/pdf",
      fileSize: pdfBuffer.byteLength,
      requestedAt: sendToClientForConfirmation ? capturedAt : null,
      receivedAt: sendToClientForConfirmation ? null : capturedAt,
      notes: JSON.stringify({
        snapshot: {
          id: snapshot.id,
          version: snapshot.version,
          reason,
          advisorAttestationAccepted: snapshotPayload.attestations.advisorAttestationAccepted,
          clientAccuracyConfirmed: snapshotPayload.attestations.clientAccuracyConfirmed,
          useForAnalysisOrRecommendation: snapshotPayload.attestations.useForAnalysisOrRecommendation,
          sendToClientForConfirmation,
          origin: origin ?? null,
        },
      }),
    },
  })

  await prisma.kycSnapshot.update({
    where: { id: snapshot.id },
    data: {
      snapshotData: toSnapshotJson({
        ...snapshotPayload,
        reportDocumentId: reportDocument.id,
        reportDocumentName: reportDocument.name,
        reportVisibility: reportDocument.visibility,
        reportStatus: reportDocument.status,
      }) as Prisma.InputJsonValue,
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    documentId: reportDocument.id,
    type: "DOCUMENT_ADDED",
    title: sendToClientForConfirmation ? "Rapport profil client envoyé au client" : "Rapport profil client généré",
    description: sendToClientForConfirmation
      ? "Le rapport est visible dans l’espace client pour confirmation."
      : "Le rapport a été généré et conservé dans le dossier documentaire.",
    entityType: "KycSnapshot",
    entityId: snapshot.id,
    metadata: { reportDocumentId: reportDocument.id, version: snapshot.version },
  })

  if (sendToClientForConfirmation && client.advisorId) {
    if (userId) {
      try {
        await sendClientPortalInvitation({
          client,
          advisor: client.advisor,
          triggeredByUserId: userId,
          origin,
        })
      } catch (invitationError) {
        await createCrmActivity({
          organizationId,
          userId,
          clientId,
          type: "EMAIL_SENT",
          title: "Envoi confirmation profil client à vérifier",
          description: invitationError instanceof Error ? invitationError.message : "Impossible d’envoyer automatiquement l’invitation portail.",
          entityType: "KycSnapshot",
          entityId: snapshot.id,
        })
      }
    }
    await prisma.notification.create({
      data: {
        organizationId,
        userId: client.advisorId,
        type: "INFO",
        priority: "HIGH",
        status: "UNREAD",
        title: "Profil client envoyé au client",
        message: `${clientName} doit confirmer le rapport de profil client dans son espace client.`,
        actionLabel: "Ouvrir le dossier",
        actionUrl: `/clients/${client.id}`,
        href: `/clients/${client.id}`,
        entityType: "KYC",
        entityId: snapshot.id,
        clientId: client.id,
      },
    })
  }

  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    type: "KYC_SNAPSHOT_CREATED",
    title: "Version profil client créée",
    description: `Version ${snapshot.version} - ${reason}`,
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "KYC",
    entityId: snapshot.id,
    action: "KYC_SNAPSHOT_CREATED",
    newValue: toSnapshotJson({
      version: snapshot.version,
      reason,
      reportDocumentId: reportDocument.id,
      attestations: snapshotPayload.attestations,
      summary,
    }) as Prisma.InputJsonValue,
  })

  await createKycVersion({
    organizationId,
    clientId,
    userId,
    kycProfileId: client.kycProfile?.id ?? null,
    sourceSnapshotId: snapshot.id,
    snapshotData: toSnapshotJson({ ...snapshotPayload, reportDocumentId: reportDocument.id }) as Prisma.InputJsonValue,
    scoresSnapshot: {
      complianceScore: summary.complianceScore,
      completionScore: summary.completionScore,
      freshnessScore: summary.freshnessScore,
      coherenceScore: summary.coherenceScore,
      finalRiskProfile: summary.finalRiskProfile,
      recommendationReady: summary.recommendationReady,
    },
    alertsSnapshot: {
      openAlerts: summary.openAlerts,
      criticalAlerts: summary.criticalAlerts,
      missingKycFields: summary.missingKycFields,
    },
    clientConfirmedAt: snapshotPayload.attestations.clientAccuracyConfirmed ? capturedAt : null,
    advisorValidatedAt: snapshotPayload.attestations.advisorAttestationAccepted ? capturedAt : null,
    locked: true,
  })

  return { ...snapshot, snapshotData: { ...snapshotPayload, reportDocumentId: reportDocument.id }, reportDocument }
}
