import { AppShell } from "@/components/layout/AppShell"
import { SettingsCenter } from "@/components/settings/SettingsCenter"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"
import {
  decodeModuleAccess,
  getSubscriptionPriceSummary,
  moduleCatalog,
  modulesForSubscription,
  normalizeSubscriptionCurrency,
  normalizeOrganizationType,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  normalizeSubscriptionStatus,
  organizationTypes,
  subscriptionCurrencies,
  subscriptionPlans,
  subscriptionPricingModes,
  subscriptionStatuses,
} from "@/lib/billing/plans"
import { getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    redirect("/sign-in?role=advisor&redirect_url=%2Fparametres")
  }

  if (user.role !== "OWNER") {
    redirect(homePathForUserRole(user.role))
  }

  const [organization, priceOverrides] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        subscriptionPlan: true,
        organizationType: true,
        subscriptionStatus: true,
        subscriptionPricingMode: true,
        subscriptionCurrency: true,
        advisorSeatLimit: true,
        moduleAccess: true,
        name: true,
        legalName: true,
        businessNumber: true,
        phone: true,
        contactEmail: true,
        website: true,
        country: true,
        region: true,
        city: true,
        publicAddress: true,
        users: {
          select: { role: true },
        },
      },
    }),
    getSubscriptionPlanPriceOverrides(),
  ])
  const plan = normalizeSubscriptionPlan(organization?.subscriptionPlan)
  const organizationType = normalizeOrganizationType(organization?.organizationType)
  const status = normalizeSubscriptionStatus(organization?.subscriptionStatus)
  const pricingMode = normalizeSubscriptionPricingMode(organization?.subscriptionPricingMode)
  const currency = normalizeSubscriptionCurrency(organization?.subscriptionCurrency)
  const modules = modulesForSubscription(organization?.subscriptionPlan ?? plan, organization?.moduleAccess)
  const moduleLabels = modules.map((moduleKey) => moduleCatalog.find((module) => module.key === moduleKey)?.label ?? moduleKey)

  return (
    <AppShell moduleKey="settings">
      <SettingsCenter
        billing={{
          plan,
          planLabel: subscriptionPlans[plan].label,
          planDescription: subscriptionPlans[plan].description,
          organizationType,
          organizationTypeLabel: organizationTypes[organizationType].label,
          organizationTypeDescription: organizationTypes[organizationType].description,
          status,
          statusLabel: subscriptionStatuses[status],
          pricingMode,
          pricingModeLabel: subscriptionPricingModes[pricingMode],
          currency,
          currencyLabel: subscriptionCurrencies[currency],
          priceSummary: getSubscriptionPriceSummary(plan, pricingMode, currency, priceOverrides),
          seatLimit: organization?.advisorSeatLimit ?? subscriptionPlans[plan].defaultSeatLimit,
          seatsUsed: countAdvisorSeats(organization?.users ?? []),
          moduleLabels,
          isCustomAccess: Boolean(decodeModuleAccess(organization?.moduleAccess)),
        }}
        organization={{
          name: organization?.name ?? "FinAssuro CRM",
          legalName: organization?.legalName ?? "",
          businessNumber: organization?.businessNumber ?? "",
          phone: organization?.phone ?? "",
          contactEmail: organization?.contactEmail ?? "",
          website: organization?.website ?? "",
          country: organization?.country ?? "Canada",
          region: organization?.region ?? "",
          city: organization?.city ?? "",
          publicAddress: organization?.publicAddress ?? "",
        }}
      />
    </AppShell>
  )
}

function countAdvisorSeats(users: Array<{ role: string }>) {
  return users.filter((member) => member.role === "OWNER" || member.role === "ADVISOR" || member.role === "ASSISTANT" || member.role === "COMPLIANCE").length
}
