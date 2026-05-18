import type { Metadata } from "next"

import { PricingPage } from "@/components/pricing/PricingPage"
import { getPublicPricingMode, getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"

export const metadata: Metadata = {
  title: "Forfaits FinAdvisor",
  description: "Forfaits SaaS pour CRM, calendrier et marketing de conseillers en assurance et produits financiers.",
}

export default async function ForfaitsPage() {
  const [mode, priceOverrides] = await Promise.all([
    getPublicPricingMode(),
    getSubscriptionPlanPriceOverrides(),
  ])
  return <PricingPage mode={mode} priceOverrides={priceOverrides} />
}
