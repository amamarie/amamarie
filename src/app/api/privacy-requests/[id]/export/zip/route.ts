import { handleApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { buildPrivacyExportPayload, createZip, privacyExportFiles } from "@/lib/privacy/export"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: { role: true } })
    const payload = await buildPrivacyExportPayload({ organizationId, userId, requestId: id, request, role: user?.role })
    const zip = createZip(privacyExportFiles(payload))
    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="export-portabilite-${id}.zip"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
