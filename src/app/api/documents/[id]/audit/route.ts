import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const document = await getDocumentById({ user, id })

    const [versions, links, extractions, accessLogs] = await Promise.all([
      prisma.documentVersion.findMany({
        where: { organizationId: user.organizationId, documentId: document.id },
        include: { changedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { versionNumber: "desc" },
      }),
      prisma.documentLink.findMany({
        where: { organizationId: user.organizationId, documentId: document.id },
        include: { createdBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.documentExtraction.findMany({
        where: { organizationId: user.organizationId, documentId: document.id },
        include: {
          validatedBy: { select: { id: true, name: true, role: true } },
          fields: {
            include: { validatedBy: { select: { id: true, name: true, role: true } } },
            orderBy: [{ status: "asc" }, { fieldLabel: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.documentAccessLog.findMany({
        where: { organizationId: user.organizationId, documentId: document.id },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ])

    await logDocumentAccess({
      user,
      document,
      eventType: "VIEW",
      request,
      purpose: "Consultation de la preuve documentaire",
      metadata: { section: "document_audit" },
    })

    return ok({ versions, links, extractions, accessLogs })
  } catch (error) {
    return handleDocumentError(error)
  }
}

