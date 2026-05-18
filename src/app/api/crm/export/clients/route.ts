import { getTenantContext } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ""
}

export async function GET() {
  const { organizationId } = await getTenantContext()
  const clients = await prisma.client.findMany({
    where: { organizationId },
    include: {
      advisor: { select: { email: true, name: true } },
      products: { orderBy: { updatedAt: "desc" } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const header = [
    "clientId",
    "firstName",
    "lastName",
    "email",
    "phone",
    "status",
    "profileType",
    "advisorEmail",
    "advisorName",
    "productName",
    "productType",
    "company",
    "contractNumber",
    "effectiveDate",
    "renewalAt",
    "accountValue",
    "premium",
    "commissionAmount",
    "commissionType",
  ]

  const rows = clients.flatMap((client) => {
    const products = client.products.length > 0 ? client.products : [null]
    return products.map((product) => [
      client.id,
      client.firstName,
      client.lastName,
      client.emailPrimary ?? client.email,
      client.phonePrimary ?? client.phone,
      client.status,
      client.profileType,
      client.advisor?.email,
      client.advisor?.name,
      product?.productName,
      product?.type,
      product?.company,
      product?.contractNumber ?? product?.policyNumber ?? product?.accountNumber,
      formatDate(product?.effectiveDate),
      formatDate(product?.renewalAt),
      product?.accountValue,
      product?.premium,
      product?.commissionAmount,
      product?.commissionType,
    ])
  })

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="crm-clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
