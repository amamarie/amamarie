import { createHash } from "crypto"
import { NextResponse } from "next/server"

import { handleApiError } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { ensureComplianceEvidenceSettings } from "@/lib/compliance/evidence"
import { createSimplePdf, createZip } from "@/lib/compliance/inspection-export"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const report = await prisma.auditReport.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        evidenceDeposits: { orderBy: { createdAt: "desc" } },
      },
    })
    if (!report) return NextResponse.json({ error: "Rapport d’audit introuvable." }, { status: 404 })
    const evidenceSettings = await ensureComplianceEvidenceSettings(organizationId)
    if (evidenceSettings.requireExternalDepositForInspectionExport && report.evidenceDeposits.length === 0) {
      return NextResponse.json({
        error: "Dépôt de preuve externe requis avant l’export d’inspection.",
        code: "EXTERNAL_EVIDENCE_DEPOSIT_REQUIRED",
      }, { status: 409 })
    }

    const computedHash = createHash("sha256").update(JSON.stringify({ summary: report.summary, sections: report.sections })).digest("hex")
    const manifest = {
      id: report.id,
      title: report.title,
      reportType: report.reportType,
      generatedAt: report.generatedAt,
      client: report.client,
      createdBy: report.createdBy,
      integrity: {
        algorithm: "sha256",
        signedHash: report.signedHash,
        computedHash,
        valid: Boolean(report.signedHash && report.signedHash === computedHash),
      },
      externalEvidence: report.evidenceDeposits.map((deposit) => ({
        type: deposit.depositType,
        provider: deposit.provider,
        status: deposit.status,
        contentHash: deposit.contentHash,
        externalReference: deposit.externalReference,
        certificateSerial: deposit.certificateSerial,
        timestampToken: deposit.timestampToken,
        portalSubmissionId: deposit.portalSubmissionId,
        depositedAt: deposit.depositedAt,
      })),
      files: ["manifest.json", "audit-report.json", "inspection-summary.pdf"],
    }
    const reportJson = JSON.stringify({ ...manifest, summary: report.summary, sections: report.sections, metadata: report.metadata }, null, 2)
    const summary = report.summary as Record<string, unknown>
    const pdf = createSimplePdf(report.title, [
      `Type: ${report.reportType}`,
      `Genere le: ${report.generatedAt.toISOString()}`,
      `Hash signe: ${report.signedHash ?? "n/d"}`,
      `Hash recalcule: ${computedHash}`,
      `Integrite valide: ${manifest.integrity.valid ? "oui" : "non"}`,
      `Preuves externes: ${report.evidenceDeposits.length}`,
      "",
      ...report.evidenceDeposits.map((deposit) => `${deposit.depositType}: ${deposit.status} - ${deposit.externalReference ?? "n/d"}`),
      "",
      ...Object.entries(summary).map(([key, value]) => `${key}: ${String(value)}`),
    ])
    const zip = createZip([
      { name: "manifest.json", content: JSON.stringify(manifest, null, 2) },
      { name: "audit-report.json", content: reportJson },
      { name: "inspection-summary.pdf", content: pdf },
    ])

    await createAuditLog({
      organizationId,
      userId,
      clientId: report.clientId,
      entityType: "AuditReport",
      entityId: report.id,
      action: "AUDIT_REPORT_INSPECTION_ZIP_DOWNLOADED",
      newValue: { signedHash: report.signedHash, computedHash, hashValid: manifest.integrity.valid },
      sensitivityLevel: "HIGH",
    })

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${(report.fileName ?? `audit-report-${report.id}.json`).replace(/\\.json$/, ".zip")}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
