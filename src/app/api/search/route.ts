import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, organizationId }, select: { id: true, role: true } })
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()

    if (!query || query.length < 2) {
      return ok([])
    }

    const [clients, leads, tasks, documents, products, alerts, notes] = await Promise.all([
      prisma.client.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 6,
      }),
      prisma.lead.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 6,
      }),
      prisma.task.findMany({
        where: { organizationId, title: { contains: query, mode: "insensitive" } },
        take: 6,
      }),
      prisma.document.findMany({
        where: { organizationId, name: { contains: query, mode: "insensitive" } },
        take: 6,
      }),
      prisma.financialProduct.findMany({
        where: {
          organizationId,
          OR: [
            { company: { contains: query, mode: "insensitive" } },
            { productName: { contains: query, mode: "insensitive" } },
            { policyNumber: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { client: true },
        take: 6,
      }),
      prisma.complianceAlert.findMany({
        where: {
          organizationId,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { client: true },
        take: 6,
      }),
      prisma.note.findMany({
        where: {
          organizationId,
          ...(user.role === "OWNER" || user.role === "COMPLIANCE" ? {} : { visibility: { not: "COMPLIANCE_ONLY" }, isSensitive: false }),
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 6,
      }),
    ])

    return ok([
      ...clients.map((client) => ({
        id: `client-${client.id}`,
        type: "Client",
        title: `${client.firstName} ${client.lastName}`,
        context: client.phone,
        href: `/clients/${client.id}`,
      })),
      ...leads.map((lead) => ({
        id: `lead-${lead.id}`,
        type: "Prospect",
        title: `${lead.firstName} ${lead.lastName}`,
        context: lead.phone,
        href: `/prospects/${lead.id}`,
      })),
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        type: "Tâche",
        title: task.title,
        context: task.status,
        href: "/taches",
      })),
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        type: "Document",
        title: document.name,
        context: document.status,
        href: document.clientId ? `/clients/${document.clientId}` : "/documents",
      })),
      ...products.map((product) => ({
        id: `product-${product.id}`,
        type: "Produit",
        title: product.productName ?? product.company ?? product.type,
        context: product.client ? `${product.client.firstName} ${product.client.lastName}` : product.status,
        href: `/clients/${product.clientId}`,
      })),
      ...alerts.map((alert) => ({
        id: `alert-${alert.id}`,
        type: "Alerte",
        title: alert.title,
        context: alert.client ? `${alert.client.firstName} ${alert.client.lastName}` : alert.severity,
        href: `/clients/${alert.clientId}`,
      })),
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        type: "Note",
        title: note.title ?? "Note",
        context: note.content.slice(0, 80),
        href: note.clientId ? `/clients/${note.clientId}` : note.leadId ? `/prospects/${note.leadId}` : "/dashboard",
      })),
    ])
  } catch (error) {
    return handleApiError(error)
  }
}
