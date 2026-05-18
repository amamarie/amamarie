import type { UserRole } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { ensurePrivacySettings, logPrivacyAccessRisk, maskSensitiveRecord } from "@/lib/privacy/advanced"

type ExportContext = {
  organizationId: string
  userId: string
  requestId: string
  request?: Request
  role?: UserRole | null
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ""
  return `"${String(value).replaceAll('"', '""')}"`
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return ""
  const headers = Array.from(rows.reduce((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n")
}

export async function buildPrivacyExportPayload({ organizationId, userId, requestId, request, role }: ExportContext) {
  const privacyRequest = await prisma.privacyRequest.findFirst({ where: { id: requestId, organizationId } })
  if (!privacyRequest) throw new Error("PRIVACY_REQUEST_NOT_FOUND")
  const settings = await ensurePrivacySettings(organizationId, userId)
  const [
    client,
    consents,
    disclosures,
    documents,
    kycProfile,
    goals,
    recommendations,
    insuranceAnalyses,
    tasks,
    notes,
    products,
    accessLogs,
  ] = await Promise.all([
    prisma.client.findFirst({
      where: { id: privacyRequest.clientId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailPrimary: true,
        phone: true,
        phonePrimary: true,
        address: true,
        addressLine1: true,
        city: true,
        province: true,
        postalCode: true,
        dateOfBirth: true,
        familyStatus: true,
        dependentsCount: true,
        employmentStatus: true,
        occupation: true,
        employer: true,
        annualIncome: true,
        netWorth: true,
        riskProfile: true,
        investmentHorizon: true,
        primaryGoal: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.clientConsent.findMany({
      where: { clientId: privacyRequest.clientId, organizationId },
      include: { purpose: true, template: { select: { id: true, title: true, version: true, language: true } }, events: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dataDisclosure.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, include: { purpose: true }, orderBy: { disclosedAt: "desc" } }),
    prisma.document.findMany({ where: { clientId: privacyRequest.clientId, organizationId, deletedAt: null }, select: { id: true, name: true, type: true, status: true, visibility: true, sensitivityLevel: true, issueDate: true, expiresAt: true, createdAt: true } }),
    prisma.clientKycProfile.findFirst({ where: { clientId: privacyRequest.clientId, organizationId } }),
    prisma.financialGoal.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.productRecommendation.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, select: { id: true, title: true, type: true, status: true, clientDecision: true, createdAt: true, lockedAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.insuranceNeedsAnalysis.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, select: { id: true, analysisType: true, status: true, analysisDate: true, lockedAt: true, clientConfirmedAt: true }, orderBy: { analysisDate: "desc" } }),
    prisma.task.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, select: { id: true, title: true, type: true, status: true, priority: true, dueDate: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.note.findMany({ where: { clientId: privacyRequest.clientId, organizationId, status: { notIn: ["DELETED", "ARCHIVED"] }, isSensitive: false }, select: { id: true, title: true, content: true, type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.financialProduct.findMany({ where: { clientId: privacyRequest.clientId, organizationId, status: { not: "ARCHIVED" } }, select: { id: true, productName: true, company: true, type: true, status: true, accountValue: true, coverageAmount: true, premium: true, effectiveDate: true, renewalAt: true }, orderBy: { updatedAt: "desc" } }),
    prisma.documentAccessLog.findMany({ where: { clientId: privacyRequest.clientId, organizationId }, select: { id: true, documentId: true, eventType: true, purpose: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 250 }),
  ])

  const maskedClient = client ? maskSensitiveRecord({ record: client, settings, role }) : null
  const exportPayload = {
    generatedAt: new Date().toISOString(),
    privacyRequestId: requestId,
    requestType: privacyRequest.requestType,
    security: {
      delivery: "Access-controlled CRM export",
      maskingApplied: Boolean(settings.defaultPrivacyMode && role !== "OWNER" && role !== "COMPLIANCE"),
      caveat: "Certaines donnees internes, renseignements de tiers ou notes sensibles peuvent necessiter une revision humaine avant remise.",
    },
    client: maskedClient,
    profile: { kycProfile, goals, products },
    consents,
    disclosures,
    documents,
    professionalRecords: { recommendations, insuranceAnalyses, tasks, notes },
    accessLogs,
  }

  await prisma.privacyRequest.update({ where: { id: requestId }, data: { status: "DATA_COMPILED", metadata: exportPayload } })
  await logPrivacyAccessRisk({ organizationId, userId, clientId: privacyRequest.clientId, eventType: "EXPORT", request, metadata: { privacyRequestId: requestId, requestType: privacyRequest.requestType } })
  await createAuditLog({ organizationId, userId, clientId: privacyRequest.clientId, entityType: "PrivacyRequest", entityId: requestId, action: "PRIVACY_REQUEST_EXPORT_COMPILED", newValue: { sections: Object.keys(exportPayload) } })
  return exportPayload
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, dosDate }
}

export function createZip(files: Array<{ name: string; content: string | Buffer }>) {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name)
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)
    const crc = crc32(content)
    const { time, dosDate } = dosDateTime()
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(content.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, name, content)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt16LE(time, 12)
    entry.writeUInt16LE(dosDate, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(content.length, 20)
    entry.writeUInt32LE(content.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt16LE(0, 30)
    entry.writeUInt16LE(0, 32)
    entry.writeUInt16LE(0, 34)
    entry.writeUInt16LE(0, 36)
    entry.writeUInt32LE(0, 38)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)
    offset += local.length + name.length + content.length
  }
  const centralStart = offset
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, centralBuffer, end])
}

export function privacyExportFiles(payload: Awaited<ReturnType<typeof buildPrivacyExportPayload>>) {
  const clientRows = payload.client ? [payload.client as Record<string, unknown>] : []
  const consentRows = payload.consents.map((consent) => ({
    id: consent.id,
    type: consent.type,
    status: consent.status,
    purpose: consent.purpose?.name,
    givenAt: consent.givenAt,
    expiresAt: consent.expiresAt,
  }))
  const disclosureRows = payload.disclosures.map((disclosure) => ({
    id: disclosure.id,
    recipientName: disclosure.recipientName,
    recipientType: disclosure.recipientType,
    purpose: disclosure.purpose?.name,
    outsideQuebec: disclosure.outsideQuebec,
    disclosedAt: disclosure.disclosedAt,
  }))
  return [
    { name: "manifest.json", content: json({ generatedAt: payload.generatedAt, privacyRequestId: payload.privacyRequestId, requestType: payload.requestType, security: payload.security }) },
    { name: "data/export-complet.json", content: json(payload) },
    { name: "csv/client.csv", content: rowsToCsv(clientRows) },
    { name: "csv/consentements.csv", content: rowsToCsv(consentRows) },
    { name: "csv/divulgations.csv", content: rowsToCsv(disclosureRows) },
    { name: "csv/documents.csv", content: rowsToCsv(payload.documents as Array<Record<string, unknown>>) },
    { name: "rapport-confidentialite.md", content: `# Export de renseignements personnels\n\nDemande: ${payload.privacyRequestId}\nType: ${payload.requestType}\nGenere le: ${payload.generatedAt}\n\nSections incluses: client, profil, consentements, divulgations, documents, dossiers professionnels, journaux d'acces.\n\n${payload.security.caveat}\n` },
    { name: "SECURITE.txt", content: "Archive generee par le CRM avec controle d'acces, journalisation et masquage selon les parametres du cabinet. Transmettre par canal securise seulement." },
  ]
}
