import { NextResponse } from "next/server"
import type { ClientStatus, CommissionType, FinancialProductType, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const clientStatuses = new Set(["ACTIVE", "INACTIVE", "PROSPECT_CONVERTED", "REVIEW_NEEDED", "ARCHIVED"])
const productTypes = new Set([
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
  "RRSP",
  "TFSA",
  "RESP",
  "FHSA",
  "NON_REGISTERED",
  "INVESTMENT",
  "MUTUAL_FUND",
  "SEGREGATED_FUND",
  "GIC",
  "ANNUITY",
  "OTHER_INVESTMENT",
  "OTHER",
])
const commissionTypes = new Set(["FIRST_YEAR", "RENEWAL", "TRAILER", "FLAT", "UNKNOWN"])

type CsvRow = Record<string, string>

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(cell.trim())
      cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function toObjects(rows: string[][]): CsvRow[] {
  const [header, ...data] = rows
  if (!header) return []
  const normalizedHeader = header.map((item) => item.trim())
  return data.map((row) => Object.fromEntries(normalizedHeader.map((key, index) => [key, row[index]?.trim() ?? ""])))
}

function value(row: CsvRow, ...keys: string[]) {
  for (const key of keys) {
    const found = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()]
    if (found?.trim()) return found.trim()
  }
  return ""
}

function normalizedEnum(input: string, allowed: Set<string>, fallback: string) {
  const normalized = input.trim().toUpperCase().replaceAll(" ", "_").replaceAll("-", "_")
  return allowed.has(normalized) ? normalized : fallback
}

function numberOrNull(input: string) {
  if (!input) return null
  const normalized = input.replace(/\s/g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function dateOrNull(input: string) {
  if (!input) return null
  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function productType(input: string): FinancialProductType {
  const normalized = input.trim().toLowerCase()
  if (normalized.includes("per") || normalized.includes("rrsp")) return "RRSP"
  if (normalized.includes("vie") || normalized.includes("life")) return "LIFE_INSURANCE"
  if (normalized.includes("sant") || normalized.includes("health")) return "HEALTH_INSURANCE"
  if (normalized.includes("prévoyance") || normalized.includes("prevoyance") || normalized.includes("disability")) return "DISABILITY_INSURANCE"
  if (normalized.includes("tfsa")) return "TFSA"
  if (normalized.includes("placement") || normalized.includes("invest")) return "INVESTMENT"
  return normalizedEnum(input, productTypes, "OTHER") as FinancialProductType
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "Fichier CSV requis." }, { status: 400 })

    const rows = toObjects(parseCsv(await file.text()))
    const result = {
      createdClients: 0,
      updatedClients: 0,
      createdProducts: 0,
      skippedRows: 0,
      errors: [] as string[],
    }

    for (const [index, row] of rows.entries()) {
      const firstName = value(row, "firstName", "Prénom", "Prenom", "prenom")
      const lastName = value(row, "lastName", "Nom", "nom")
      const email = value(row, "email", "Mail", "Email")
      const phone = value(row, "phone", "Téléphone", "Telephone", "tel")
      if (!firstName || !lastName || !phone) {
        result.skippedRows += 1
        result.errors.push(`Ligne ${index + 2}: prénom, nom et téléphone requis.`)
        continue
      }

      const advisorEmail = value(row, "advisorEmail", "Conseiller", "conseiller")
      const advisor = advisorEmail
        ? await prisma.user.findFirst({ where: { organizationId, email: { equals: advisorEmail, mode: "insensitive" } }, select: { id: true } })
        : null
      const duplicateFilters: Prisma.ClientWhereInput[] = [
        ...(email ? [
          { email: { equals: email, mode: "insensitive" } },
          { emailPrimary: { equals: email, mode: "insensitive" } },
        ] satisfies Prisma.ClientWhereInput[] : []),
        { phone },
        { phonePrimary: phone },
      ]
      const existingClient = await prisma.client.findFirst({
        where: {
          organizationId,
          OR: duplicateFilters,
        },
        select: { id: true },
      })

      const clientData = {
        firstName,
        lastName,
        email,
        emailPrimary: email || null,
        phone,
        phonePrimary: phone,
        status: normalizedEnum(value(row, "status", "Statut"), clientStatuses, "ACTIVE") as ClientStatus,
        source: "Import CSV",
        advisorId: advisor?.id ?? userId,
      }

      const client = existingClient
        ? await prisma.client.update({ where: { id: existingClient.id }, data: clientData })
        : await prisma.client.create({ data: { ...clientData, organizationId } })

      if (existingClient) result.updatedClients += 1
      else {
        result.createdClients += 1
        await prisma.activity.create({
          data: {
            organizationId,
            userId,
            clientId: client.id,
            type: "CLIENT_CREATED",
            title: "Client importé",
            description: `${firstName} ${lastName} a été créé depuis un fichier CSV.`,
            source: "IMPORT",
          },
        }).catch(() => null)
      }

      const productName = value(row, "productName", "Produit", "Contrat", "product")
      const contractNumber = value(row, "contractNumber", "No contrat", "Numéro contrat", "Numero contrat")
      if (productName || contractNumber) {
        await prisma.financialProduct.create({
          data: {
            organizationId,
            clientId: client.id,
            advisorId: advisor?.id ?? userId,
            category: "OTHER",
            type: productType(value(row, "productType", "Type produit", "type")),
            status: "ACTIVE",
            productName: productName || null,
            company: value(row, "company", "Compagnie", "Institution") || null,
            contractNumber: contractNumber || null,
            effectiveDate: dateOrNull(value(row, "effectiveDate", "Date effet", "dateEffet")),
            renewalAt: dateOrNull(value(row, "renewalAt", "Échéance", "Echeance")),
            accountValue: numberOrNull(value(row, "accountValue", "Encours", "Valeur")),
            premium: numberOrNull(value(row, "premium", "Prime")),
            commissionAmount: numberOrNull(value(row, "commissionAmount", "Commission")),
            commissionType: normalizedEnum(value(row, "commissionType", "Type commission"), commissionTypes, "UNKNOWN") as CommissionType,
          },
        })
        result.createdProducts += 1
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import impossible." }, { status: 500 })
  }
}
