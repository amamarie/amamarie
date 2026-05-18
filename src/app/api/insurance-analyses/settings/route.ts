import { NextResponse } from "next/server"
import { z } from "zod"

import { getOrganizationInsuranceNeedsSettings, saveOrganizationInsuranceNeedsSettings } from "@/lib/insurance-needs/settings"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

const settingsSchema = z.object({
  life: z.object({
    incomeReplacementYears: z.coerce.number().min(1).max(40),
    finalExpenses: z.coerce.number().min(0).max(250000),
    educationPerChild: z.coerce.number().min(0).max(500000),
    emergencyMonths: z.coerce.number().min(0).max(36),
    familyCoverageGapRatio: z.coerce.number().min(0).max(1),
    highMortgageThreshold: z.coerce.number().min(0).max(5000000),
  }),
  disability: z.object({
    minimumEmergencyMonths: z.coerce.number().min(0).max(36),
    highIncomeThreshold: z.coerce.number().min(0).max(1000000),
    groupCoverageRatioWarning: z.coerce.number().min(0).max(1),
  }),
  criticalIllness: z.object({
    mortgageProtectionPortion: z.coerce.number().min(0).max(5000000),
    medicalLiquidity: z.coerce.number().min(0).max(1000000),
    incomeReplacementMonths: z.coerce.number().min(0).max(60),
    familyReserve: z.coerce.number().min(0).max(1000000),
    minimumEmergencyMonths: z.coerce.number().min(0).max(36),
  }),
  business: z.object({
    continuityMonths: z.coerce.number().min(0).max(36),
  }),
})

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return NextResponse.json({ data: await getOrganizationInsuranceNeedsSettings(organizationId) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: "Impossible de charger les paramètres d’analyse." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const settings = settingsSchema.parse(await request.json())
    return NextResponse.json({ data: await saveOrganizationInsuranceNeedsSettings({ organizationId, userId, settings }) })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Paramètres invalides.", details: error.flatten() }, { status: 422 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’enregistrer les paramètres d’analyse." }, { status: 400 })
  }
}
