import type { Metadata } from "next"

import { PricingPage } from "@/components/pricing/PricingPage"
import { getPublicPricingMode, getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"

export const metadata: Metadata = {
  title: "Forfaits FinAdvisor",
  description: "Forfaits SaaS pour CRM, calendrier et marketing de conseillers en assurance et produits financiers.",
}

type ForfaitsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForfaitsPage({ searchParams }: ForfaitsPageProps) {
  const params = await searchParams
  const autoCheckout = (Array.isArray(params?.checkout) ? params.checkout[0] : params?.checkout) === "1"
    ? {
        plan: Array.isArray(params?.plan) ? params.plan[0] : params?.plan,
        pricingMode: Array.isArray(params?.pricing) ? params.pricing[0] : params?.pricing,
        currency: Array.isArray(params?.currency) ? params.currency[0] : params?.currency,
        interval: Array.isArray(params?.interval) ? params.interval[0] : params?.interval,
      }
    : undefined
  const [mode, priceOverrides] = await Promise.all([
    getPublicPricingMode(),
    getSubscriptionPlanPriceOverrides(),
  ])
  return <PricingPage mode={mode} priceOverrides={priceOverrides} autoCheckout={autoCheckout} />
}
