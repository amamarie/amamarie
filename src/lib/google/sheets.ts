import { getAdvisorGoogleWorkspaceAccessToken } from "@/lib/google/gmail"

type AppendLeadFormSubmissionInput = {
  organizationId: string
  advisorId: string
  spreadsheetId?: string | null
  sheetName?: string | null
  values?: Array<string | number | boolean | null>
  row?: Record<string, string | number | boolean | null>
}

type AppendGoogleSheetRowInput = {
  organizationId: string
  advisorId: string
  spreadsheetId?: string | null
  sheetName?: string | null
  headers: string[]
  row: Record<string, string | number | boolean | null>
}

type CreateLeadFormSpreadsheetInput = {
  organizationId: string
  advisorId: string
  title: string
  sheetName?: string | null
}

const leadFormHeaders = [
  "Date",
  "Formulaire",
  "Prénom",
  "Nom",
  "Courriel",
  "Téléphone",
  "Intérêt",
  "Message",
  "Réponses personnalisées",
  "Lead ID",
  "Submission ID",
]

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

async function readSheetHeaders({
  spreadsheetId,
  sheetName,
  accessToken,
}: {
  spreadsheetId: string
  sheetName: string
  accessToken: string
}) {
  const headerRange = encodeSheetRange(sheetName, "A1:Z1")
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}`)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const payload = await response.json().catch(() => ({})) as { values?: string[][]; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`GOOGLE_SHEETS_HEADER_READ_FAILED:${payload.error?.message ?? response.status}`)
  }

  const headers = payload.values?.[0]?.map((header) => String(header).trim()).filter(Boolean) ?? []
  return headers.length > 0 ? headers : leadFormHeaders
}

function rowFromHeaders(headers: string[], row: Record<string, string | number | boolean | null>) {
  const normalizedEntries = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  )

  return headers.map((header) => normalizedEntries.get(normalizeHeader(header)) ?? "")
}

function encodeSheetRange(sheetName: string, range = "A:Z") {
  const escaped = sheetName.replaceAll("'", "''")
  return encodeURIComponent(`'${escaped}'!${range}`)
}

export async function createLeadFormSpreadsheet({
  organizationId,
  advisorId,
  title,
  sheetName = "Leads",
}: CreateLeadFormSpreadsheetInput) {
  const google = await getAdvisorGoogleWorkspaceAccessToken({ organizationId, userId: advisorId })
  if (!google?.accessToken || !google.hasWorkspaceScopes) {
    return { skipped: true as const, reason: "GOOGLE_WORKSPACE_NOT_CONNECTED" }
  }

  const normalizedSheetName = sheetName?.trim() || "Leads"
  const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${google.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: normalizedSheetName } }],
    }),
  })

  const spreadsheet = await createResponse.json().catch(() => ({})) as {
    spreadsheetId?: string
    error?: { message?: string }
  }
  if (!createResponse.ok || !spreadsheet.spreadsheetId) {
    throw new Error(`GOOGLE_SHEETS_CREATE_FAILED:${spreadsheet.error?.message ?? createResponse.status}`)
  }

  const headerRange = encodeSheetRange(normalizedSheetName, `A1:${String.fromCharCode(64 + leadFormHeaders.length)}1`)
  const headerUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/${headerRange}`)
  headerUrl.searchParams.set("valueInputOption", "RAW")

  const headerResponse = await fetch(headerUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${google.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [leadFormHeaders] }),
  })
  const headerPayload = await headerResponse.json().catch(() => ({})) as { error?: { message?: string } }
  if (!headerResponse.ok) {
    throw new Error(`GOOGLE_SHEETS_HEADER_FAILED:${headerPayload.error?.message ?? headerResponse.status}`)
  }

  return {
    skipped: false as const,
    spreadsheetId: spreadsheet.spreadsheetId,
    sheetName: normalizedSheetName,
  }
}

export async function appendGoogleSheetRow({
  organizationId,
  advisorId,
  spreadsheetId,
  sheetName = "Leads",
  headers: fallbackHeaders,
  row,
}: AppendGoogleSheetRowInput) {
  if (!spreadsheetId) return { skipped: true as const, reason: "GOOGLE_SHEET_ID_NOT_CONFIGURED" }

  const google = await getAdvisorGoogleWorkspaceAccessToken({ organizationId, userId: advisorId })
  if (!google?.accessToken || !google.hasWorkspaceScopes) {
    return { skipped: true as const, reason: "GOOGLE_WORKSPACE_NOT_CONNECTED" }
  }

  const normalizedSheetName = sheetName?.trim() || "Leads"
  const headers = await readSheetHeaders({ spreadsheetId, sheetName: normalizedSheetName, accessToken: google.accessToken })
    .catch(() => fallbackHeaders)
  const values = rowFromHeaders(headers.length ? headers : fallbackHeaders, row)
  const appendRange = encodeSheetRange(normalizedSheetName, "A:Z")
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append`)
  url.searchParams.set("valueInputOption", "USER_ENTERED")
  url.searchParams.set("insertDataOption", "INSERT_ROWS")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${google.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  })

  const payload = await response.json().catch(() => ({})) as { updates?: { updatedRange?: string }; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`GOOGLE_SHEETS_APPEND_FAILED:${payload.error?.message ?? response.status}`)
  }

  return {
    skipped: false as const,
    updatedRange: payload.updates?.updatedRange ?? null,
  }
}

export async function appendLeadFormSubmissionToSheet({
  organizationId,
  advisorId,
  spreadsheetId,
  sheetName = "Leads",
  values,
  row,
}: AppendLeadFormSubmissionInput) {
  if (!spreadsheetId) return { skipped: true as const, reason: "SHEET_NOT_CONFIGURED" }

  const google = await getAdvisorGoogleWorkspaceAccessToken({ organizationId, userId: advisorId })
  if (!google?.accessToken || !google.hasWorkspaceScopes) {
    return { skipped: true as const, reason: "GOOGLE_WORKSPACE_NOT_CONNECTED" }
  }

  const normalizedSheetName = sheetName || "Leads"
  const appendValues = row
    ? rowFromHeaders(await readSheetHeaders({ spreadsheetId, sheetName: normalizedSheetName, accessToken: google.accessToken }), row)
    : values

  if (!appendValues) {
    return { skipped: true as const, reason: "SHEET_ROW_EMPTY" }
  }

  const range = encodeSheetRange(normalizedSheetName)
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append`)
  url.searchParams.set("valueInputOption", "USER_ENTERED")
  url.searchParams.set("insertDataOption", "INSERT_ROWS")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${google.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  })

  const payload = await response.json().catch(() => ({})) as { updates?: { updatedRange?: string }; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`GOOGLE_SHEETS_APPEND_FAILED:${payload.error?.message ?? response.status}`)
  }

  return {
    skipped: false as const,
    updatedRange: payload.updates?.updatedRange ?? null,
  }
}
