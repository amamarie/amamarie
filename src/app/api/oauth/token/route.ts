import { NextResponse } from "next/server"

import {
  generateOAuthAccessToken,
  hashSecret,
  parseJsonStringArray,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const startedAt = Date.now()
  const body = await request.formData().catch(() => null)
  const grantType = String(body?.get("grant_type") ?? "")
  const clientId = String(body?.get("client_id") ?? "")
  const clientSecret = String(body?.get("client_secret") ?? "")

  if (grantType !== "client_credentials" || !clientId || !clientSecret) {
    return NextResponse.json({ error: "unsupported_grant_type", error_description: "Utilise grant_type=client_credentials avec client_id et client_secret." }, { status: 400 })
  }

  const client = await prisma.developerOAuthClient.findUnique({ where: { clientId } })
  if (!client || client.status !== "ACTIVE" || client.clientSecretHash !== hashSecret(clientSecret)) {
    await writeDeveloperApiLog({ organizationId: client?.organizationId, type: "Authentification", method: "POST", endpoint: "/api/oauth/token", environment: "production", statusCode: 401, latencyMs: Date.now() - startedAt, errorCode: "invalid_client", errorMessage: "Client OAuth invalide." })
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  const generated = generateOAuthAccessToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const permissions = parseJsonStringArray(client.permissions)
  await prisma.developerOAuthAccessToken.create({
    data: {
      organizationId: client.organizationId,
      clientId: client.id,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      permissions,
      expiresAt,
    },
  })
  await prisma.developerOAuthClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
  await writeDeveloperApiLog({ organizationId: client.organizationId, type: "Authentification", method: "POST", endpoint: "/api/oauth/token", environment: "production", statusCode: 200, latencyMs: Date.now() - startedAt, responseBody: { token_type: "Bearer", expires_in: 3600, scope: permissions } })

  return NextResponse.json({
    access_token: generated.token,
    token_type: "Bearer",
    expires_in: 3600,
    scope: permissions.join(" "),
  })
}
