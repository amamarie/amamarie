import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type InsuranceNeedsSettings = {
  life: {
    incomeReplacementYears: number
    finalExpenses: number
    educationPerChild: number
    emergencyMonths: number
    familyCoverageGapRatio: number
    highMortgageThreshold: number
  }
  disability: {
    minimumEmergencyMonths: number
    highIncomeThreshold: number
    groupCoverageRatioWarning: number
  }
  criticalIllness: {
    mortgageProtectionPortion: number
    medicalLiquidity: number
    incomeReplacementMonths: number
    familyReserve: number
    minimumEmergencyMonths: number
  }
  business: {
    continuityMonths: number
  }
}

export const defaultInsuranceNeedsSettings: InsuranceNeedsSettings = {
  life: {
    incomeReplacementYears: 10,
    finalExpenses: 25000,
    educationPerChild: 50000,
    emergencyMonths: 6,
    familyCoverageGapRatio: 0.5,
    highMortgageThreshold: 250000,
  },
  disability: {
    minimumEmergencyMonths: 3,
    highIncomeThreshold: 100000,
    groupCoverageRatioWarning: 0.65,
  },
  criticalIllness: {
    mortgageProtectionPortion: 150000,
    medicalLiquidity: 50000,
    incomeReplacementMonths: 12,
    familyReserve: 25000,
    minimumEmergencyMonths: 3,
  },
  business: {
    continuityMonths: 6,
  },
}

const SETTINGS_RULE_NAME = "__FINADVISOR_INSURANCE_NEEDS_SETTINGS__"

export function mergeInsuranceNeedsSettings(input?: Partial<InsuranceNeedsSettings> | null): InsuranceNeedsSettings {
  return {
    life: { ...defaultInsuranceNeedsSettings.life, ...input?.life },
    disability: { ...defaultInsuranceNeedsSettings.disability, ...input?.disability },
    criticalIllness: { ...defaultInsuranceNeedsSettings.criticalIllness, ...input?.criticalIllness },
    business: { ...defaultInsuranceNeedsSettings.business, ...input?.business },
  }
}

export function getInsuranceNeedsSettings(): InsuranceNeedsSettings {
  const raw = process.env.INSURANCE_NEEDS_SETTINGS_JSON
  if (!raw) return defaultInsuranceNeedsSettings
  try {
    const parsed = JSON.parse(raw) as Partial<InsuranceNeedsSettings>
    return mergeInsuranceNeedsSettings(parsed)
  } catch {
    return defaultInsuranceNeedsSettings
  }
}

export async function getOrganizationInsuranceNeedsSettings(organizationId: string): Promise<InsuranceNeedsSettings> {
  const rule = await prisma.automationRule.findFirst({
    where: { organizationId, name: SETTINGS_RULE_NAME },
    select: { actions: true },
  })
  if (!rule?.actions || typeof rule.actions !== "object" || Array.isArray(rule.actions)) return getInsuranceNeedsSettings()
  const settings = (rule.actions as { settings?: Partial<InsuranceNeedsSettings> }).settings
  return mergeInsuranceNeedsSettings(settings)
}

export async function saveOrganizationInsuranceNeedsSettings({
  organizationId,
  userId,
  settings,
}: {
  organizationId: string
  userId: string
  settings: InsuranceNeedsSettings
}) {
  const payload = { settings, kind: "INSURANCE_NEEDS_SETTINGS", updatedAt: new Date().toISOString() } satisfies Prisma.InputJsonObject
  const existing = await prisma.automationRule.findFirst({
    where: { organizationId, name: SETTINGS_RULE_NAME },
    select: { id: true },
  })
  const rule = existing
    ? await prisma.automationRule.update({
        where: { id: existing.id },
        data: {
          actions: payload,
          updatedById: userId,
          isActive: false,
        },
      })
    : await prisma.automationRule.create({
        data: {
          organizationId,
          name: SETTINGS_RULE_NAME,
          description: "Paramètres système des hypothèses d’analyse des besoins. Ne pas activer comme automatisation.",
          trigger: "CLIENT_UPDATED",
          conditions: { system: true, hidden: true },
          actions: payload,
          isActive: false,
          createdById: userId,
          updatedById: userId,
        },
      })
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      entityType: "InsuranceNeedsSettings",
      entityId: rule.id,
      action: "INSURANCE_NEEDS_SETTINGS_UPDATED",
      newValue: payload,
    },
  })
  return mergeInsuranceNeedsSettings(settings)
}
