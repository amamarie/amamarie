import { createHash } from "crypto"
import { NextResponse } from "next/server"

import { handleApiError } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
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
      },
    })
    if (!report) return NextResponse.json({ error: "Rapport d’audit introuvable." }, { status: 404 })

    const computedHash = createHash("sha256").update(JSON.stringify({ summary: report.summary, sections: report.sections })).digest("hex")
    const payload = {
      id: report.id,
      title: report.title,
      reportType: report.reportType,
      status: report.status,
      generatedAt: report.generatedAt,
      client: report.client,
      createdBy: report.createdBy,
      integrity: {
        signedHash: report.signedHash,
        computedHash,
        valid: Boolean(report.signedHash && report.signedHash === computedHash),
        algorithm: "sha256",
      },
      summary: report.summary,
      sections: report.sections,
      metadata: report.metadata,
    }

    await createAuditLog({
      organizationId,
      userId,
      clientId: report.clientId,
      entityType: "AuditReport",
      entityId: report.id,
      action: "AUDIT_REPORT_DOWNLOADED",
      newValue: { signedHash: report.signedHash, computedHash, hashValid: payload.integrity.valid },
    })

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.fileName ?? `audit-report-${report.id}.json`}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
