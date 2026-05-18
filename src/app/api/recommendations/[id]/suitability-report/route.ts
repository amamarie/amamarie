import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { ensureKycVersionForRecommendation } from "@/lib/compliance/kyc-advanced"
import { assertKycReadyForRecommendation } from "@/lib/compliance/kyc-engine"
import { sanitizeFileName } from "@/lib/documents/file-validation"
import { prisma } from "@/lib/prisma"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function pdfEscape(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function createSimplePdf(lines: string[]) {
  const contentLines = lines.slice(0, 76).map((line) => `(${pdfEscape(line).slice(0, 112)}) Tj T*`).join("\n")
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
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

function section(title: string, lines: string[]) {
  return ["", title.toUpperCase(), ...lines]
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const recommendation = await prisma.productRecommendation.findFirst({
      where: { id, organizationId },
      include: {
        client: { include: { kycProfile: true, investmentProfile: true, financialGoalItems: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] } } },
        advisor: true,
        relatedProduct: true,
        sourceKycVersion: true,
      },
    })
    if (!recommendation) return fail("NOT_FOUND", "Recommandation introuvable.", 404)
    assertKycReadyForRecommendation(recommendation.client.kycProfile)

    const kycVersion = recommendation.sourceKycVersion ?? await ensureKycVersionForRecommendation({
      organizationId,
      clientId: recommendation.clientId,
      userId,
    })
    if (kycVersion && !recommendation.sourceKycVersionId) {
      await prisma.productRecommendation.update({
        where: { id: recommendation.id },
        data: { sourceKycVersionId: kycVersion.id },
      })
    }

    const clientName = `${recommendation.client.firstName} ${recommendation.client.lastName}`.trim()
    const generatedAt = new Date()
    const lines = [
      "FINADVISOR CRM",
      "RAPPORT DE CONVENANCE",
      `Document date: ${new Intl.DateTimeFormat("fr-CA").format(generatedAt)}`,
      `Client: ${clientName}`,
      `Conseiller: ${recommendation.advisor?.name ?? "Non assigne"}`,
      `Profil client utilise: ${kycVersion ? `v${kycVersion.versionNumber}` : "Aucune version verrouillee"}`,
      ...section("Recommandation", [
        `Titre: ${recommendation.title}`,
        `Type: ${recommendation.type}`,
        `Priorite: ${recommendation.priority}`,
        `Produit lie: ${recommendation.relatedProduct?.productName ?? recommendation.relatedProduct?.type ?? "Non lie"}`,
        `Raison: ${recommendation.rationale ?? recommendation.description}`,
      ]),
      ...section("Profil investisseur utilise", [
        `Objectif principal: ${recommendation.client.investmentProfile?.primaryObjective ?? recommendation.client.kycProfile?.primaryObjective ?? "Non defini"}`,
        `Horizon: ${recommendation.client.investmentProfile?.timeHorizon ?? recommendation.client.kycProfile?.investmentHorizon ?? "Non defini"}`,
        `Liquidite: ${recommendation.client.investmentProfile?.liquidityNeeds ?? recommendation.client.kycProfile?.liquidityNeeds ?? "Non definie"}`,
        `Tolerance: ${recommendation.client.kycProfile?.riskTolerance ?? "Non definie"}`,
        `Capacite: ${recommendation.client.kycProfile?.riskCapacity ?? "Non definie"}`,
        `Profil final: ${recommendation.client.investmentProfile?.finalRiskProfile ?? recommendation.client.kycProfile?.riskProfileResult ?? "Non defini"}`,
      ]),
      ...section("Objectifs financiers", recommendation.client.financialGoalItems.length
        ? recommendation.client.financialGoalItems.slice(0, 8).map((goal) => `${goal.priority} - ${goal.goalName} (${goal.goalType})`)
        : ["Aucun objectif detaille. A documenter avant recommandation avancee."]),
      ...section("Conclusion de convenance", [
        "Cette recommandation est rattachee au profil client disponible et doit etre presentee par un conseiller autorise.",
        "Toute incompatibilite entre objectif, horizon, liquidite, tolerance ou capacite doit etre justifiee au dossier.",
        "Le client doit confirmer les renseignements importants et le conseiller doit conserver la preuve de remise.",
      ]),
    ]

    await ensureClientFolderStructure({ organizationId, clientId: recommendation.clientId, userId })
    const fileName = sanitizeFileName(`rapport-convenance-${clientName}-${generatedAt.toISOString().slice(0, 10)}.pdf`)
    const storagePath = `${organizationId}/clients/${recommendation.clientId}/kyc/${fileName}`
    const pdfBuffer = createSimplePdf(lines)
    const bucket = getDocumentsBucket()
    const { error: uploadError } = await getSupabaseServerClient().storage.from(bucket).upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })
    if (uploadError) throw new Error(uploadError.message)

    const document = await prisma.document.create({
      data: {
        organizationId,
        clientId: recommendation.clientId,
        uploadedById: userId,
        type: "RISK_PROFILE",
        status: "RECEIVED",
        visibility: "TEAM",
        name: `Rapport de convenance - ${clientName}`,
        description: lines.join("\n"),
        fileName,
        originalFileName: fileName,
        storageBucket: bucket,
        storagePath,
        storageProvider: "SUPABASE",
        mimeType: "application/pdf",
        fileSize: pdfBuffer.byteLength,
        receivedAt: generatedAt,
        notes: JSON.stringify({ recommendationId: recommendation.id, sourceKycVersionId: kycVersion?.id ?? null }),
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: recommendation.clientId,
      entityType: "ProductRecommendation",
      entityId: recommendation.id,
      action: "SUITABILITY_REPORT_GENERATED",
      newValue: { documentId: document.id, sourceKycVersionId: kycVersion?.id ?? null },
    })

    return ok({ document, sourceKycVersion: kycVersion })
  } catch (error) {
    return handleApiError(error)
  }
}
