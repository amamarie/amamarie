import { NextResponse } from "next/server"

import { requireSaasRole } from "@/lib/auth/roles"
import { processDueDeveloperWebhookRetries } from "@/lib/developer-api/core"

export async function POST() {
  await requireSaasRole(["DEVELOPER"])
  const result = await processDueDeveloperWebhookRetries()
  return NextResponse.json(result)
}
