"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  subscriptionMonthlyRevenue,
  subscriptionPrices,
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  type PlanMonthlyPriceOverrides,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
} from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type Currency = SubscriptionCurrencyKey
type PricingMode = SubscriptionPricingModeKey
type PlanKey = SubscriptionPlanKey
type BillingInterval = "monthly" | "annual"
type AutoCheckoutSelection = {
  plan?: string
  pricingMode?: string
  currency?: string
  interval?: string
}

const currencyLabels: Record<Currency, { suffix: string }> = {
  EUR: { suffix: "EUR" },
  CAD: { suffix: "CAD" },
}

function formatPlanAmount(amount: number, currency: Currency) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

const plans = [
  {
    key: "ESSENTIEL" as const,
    name: "Essentiel",
    oldName: "Starter",
    positioning: "Je m’organise",
    target: "Indépendant seul",
    promise: "Centraliser clients, prospects, rendez-vous et relances.",
    icon: CalendarClock,
    accent: "emerald",
    limits: ["1 utilisateur", "1 000 contacts", "1 pipeline", "1 000 emails / mois"],
    included: [
      "CRM clients et prospects",
      "Calendrier Google ou Outlook",
      "Tâches et rappels",
      "10 modèles email",
      "Import Excel",
      "Documents client basiques",
      "Tableau de bord basique",
      "Support email",
    ],
    excluded: ["Automatisations avancées", "IA avancée", "Reporting équipe"],
    cta: "Commencer",
  },
  {
    key: "CROISSANCE" as const,
    name: "Croissance",
    oldName: "Pro",
    positioning: "Je vends plus",
    target: "Conseiller actif",
    promise: "Automatiser les relances, les campagnes et les suivis clients.",
    icon: Zap,
    accent: "sky",
    popular: true,
    limits: ["1 conseiller + 1 assistant", "5 000 contacts", "3 pipelines", "5 000 emails / mois"],
    included: [
      "Relances automatiques",
      "Séquences email",
      "Campagnes prêtes à l’emploi",
      "IA email",
      "Résumé de rendez-vous IA",
      "Scoring prospect basique",
      "1 landing page",
      "Support prioritaire",
    ],
    excluded: ["Reporting équipe avancé", "Multi-agences", "SSO"],
    cta: "Choisir Croissance",
  },
  {
    key: "CABINET" as const,
    name: "Cabinet",
    oldName: "Cabinet",
    positioning: "Je pilote mon équipe",
    target: "Petite équipe",
    promise: "Piloter plusieurs conseillers, les campagnes et les opportunités.",
    icon: Building2,
    accent: "violet",
    limits: ["Jusqu’à 5 utilisateurs", "20 000 contacts", "Pipelines illimités", "20 000 emails / mois"],
    included: [
      "Calendriers équipe",
      "Attribution des prospects",
      "Rôles et permissions",
      "Automatisations avancées",
      "Reporting équipe",
      "Objectifs commerciaux",
      "Suivi commissions basique",
      "Onboarding inclus",
    ],
    excluded: ["SLA dédié", "SSO", "Intégrations sur mesure"],
    cta: "Structurer le cabinet",
  },
]

const comparisonRows = [
  ["Prix mensuel", "59 €", "149 €", "399 €"],
  ["Prix annuel", "49 €/mois", "119 €/mois", "329 €/mois"],
  ["Utilisateurs inclus", "1", "1 + assistant", "5"],
  ["Contacts", "1 000", "5 000", "20 000"],
  ["CRM client", "Oui", "Oui", "Oui"],
  ["Pipeline", "1", "3", "Illimités"],
  ["Calendrier", "1 intégration", "Google + Outlook", "Équipe"],
  ["Relances automatiques", "Limité", "Oui", "Avancé"],
  ["Séquences email", "Non", "Oui", "Oui"],
  ["Campagnes prêtes", "Non", "Oui", "Oui"],
  ["Emails inclus", "1 000/mois", "5 000/mois", "20 000/mois"],
  ["Landing pages", "Non", "1", "5"],
  ["IA email", "Limité", "Oui", "Oui"],
  ["IA résumé RDV", "Non", "Oui", "Oui"],
  ["Scoring prospect", "Non", "Basique", "Avancé"],
  ["Reporting", "Basique", "Activité", "Équipe"],
  ["Rôles utilisateurs", "Non", "Limité", "Oui"],
  ["Support", "Email", "Prioritaire", "Prioritaire"],
  ["Onboarding", "Self-service", "Guidé", "Inclus"],
]

const addOns = [
  ["Utilisateur supplémentaire", "39 €/mois", "59 $/mois"],
  ["Conseiller supplémentaire", "49 €/mois", "69 $/mois"],
  ["Assistant supplémentaire", "19 €/mois", "29 $/mois"],
  ["Pack IA supplémentaire", "19-49 €/mois", "29-69 $/mois"],
  ["WhatsApp Business", "29-99 €/mois", "39-139 $/mois"],
  ["Signature électronique", "19-49 €/mois", "29-69 $/mois"],
  ["Stockage documentaire extra", "9-29 €/mois", "15-39 $/mois"],
  ["Migration de données", "299-1 500 €", "429-2 190 $"],
  ["Onboarding accompagné", "499-2 000 €", "729-2 890 $"],
  ["Campagnes personnalisées", "199-999 €", "289-1 449 $"],
]

const setupFees = [
  ["Essentiel", "0 €", "0 $"],
  ["Croissance", "199 € optionnel", "289 $ optionnel"],
  ["Cabinet", "499 € ou offert en annuel", "729 $ ou offert en annuel"],
]

function normalizeInterval(value: unknown): BillingInterval {
  const normalized = String(value ?? "").trim().toLowerCase()
  return normalized === "annual" || normalized === "annuel" || normalized === "yearly" ? "annual" : "monthly"
}

export function PricingPage({
  mode,
  priceOverrides = {},
  autoCheckout,
}: {
  mode: PricingMode
  priceOverrides?: PlanMonthlyPriceOverrides
  autoCheckout?: AutoCheckoutSelection
}) {
  const autoCheckoutPlan = autoCheckout ? normalizeSubscriptionPlan(autoCheckout.plan) : null
  const [currency, setCurrency] = useState<Currency>(() => autoCheckout ? normalizeSubscriptionCurrency(autoCheckout.currency) : "EUR")
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(() => normalizeInterval(autoCheckout?.interval))
  const prices = subscriptionPrices[mode]
  const isBeta = mode === "beta"
  const pageTitle = isBeta ? "Offre bêta FinAssuro" : "Forfaits FinAssuro"
  const badge = isBeta ? "Prix bêta garantis 12 mois" : "Grille tarifaire normale"
  const subtitle = isBeta
    ? "Lancez votre cabinet avec un tarif réduit en échange de retours réguliers sur le produit."
    : "Choisissez l’offre adaptée à votre activité: indépendant, conseiller actif ou cabinet structuré."
  const selectedCurrency = currencyLabels[currency]
  const monthlyPrice = (planKey: PlanKey) => formatPlanAmount(priceOverrides[mode]?.[planKey]?.[currency] ?? subscriptionMonthlyRevenue[mode][planKey][currency], currency)
  const comparisonPrices = useMemo(() => {
    return comparisonRows.map((row) => {
      if (row[0] === "Prix mensuel") {
        return [
          "Prix mensuel",
          monthlyPrice("ESSENTIEL"),
          monthlyPrice("CROISSANCE"),
          monthlyPrice("CABINET"),
        ]
      }
      if (row[0] === "Prix annuel") {
        return [
          "Prix annuel",
          `${prices.ESSENTIEL[currency].annual}/mois`,
          `${prices.CROISSANCE[currency].annual}/mois`,
          `${prices.CABINET[currency].annual}/mois`,
        ]
      }
      return row
    })
  }, [currency, prices, priceOverrides, mode])

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-950">FinAssuro</span>
              <span className="block text-xs font-medium text-slate-500">CRM + calendrier + marketing</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link href="/forfaits" className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 hover:bg-emerald-100">
              Forfaits
            </Link>
            <Button asChild className="rounded-lg bg-slate-950 hover:bg-slate-800">
              <Link href="/auth">Essayer</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Sparkles className="size-4" aria-hidden="true" />
              {badge}
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {pageTitle}: gérez vos clients, automatisez vos relances et développez votre cabinet.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              {subtitle}
            </p>
            {isBeta ? (
              <p className="mt-4 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                Condition bêta: prix garanti 12 mois en échange de retours réguliers, de tests terrain et d’un court témoignage si le produit apporte de la valeur.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            <CurrencySwitch currency={currency} setCurrency={setCurrency} />
            <BillingIntervalSwitch interval={billingInterval} setInterval={setBillingInterval} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              price={{
                monthly: billingInterval === "annual" ? prices[plan.key][currency].annual : monthlyPrice(plan.key),
                annual: prices[plan.key][currency].annual,
              }}
              currency={selectedCurrency}
              currencyCode={currency}
              pricingMode={mode}
              billingInterval={billingInterval}
              autoCheckout={autoCheckoutPlan === plan.key}
              isBeta={isBeta}
            />
          ))}
        </div>

        <section className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.28fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Gauge className="size-5 text-emerald-700" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Comparatif complet</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Même logique de progression: centraliser, automatiser, piloter, personnaliser.</p>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    {["Fonctionnalité", "Essentiel", "Croissance", "Cabinet"].map((header) => (
                      <th key={header} className="border-b border-slate-200 bg-slate-50 px-3 py-3 font-semibold text-slate-700 first:rounded-tl-lg last:rounded-tr-lg">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonPrices.map((row) => (
                    <tr key={row[0]} className="odd:bg-white even:bg-slate-50/60">
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                          <span className={cn(index === 0 && "font-semibold text-slate-950")}>{cell}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="grid gap-4">
            <InfoPanel
              icon={Megaphone}
              title="Forfait à pousser"
              text="Croissance doit rester l’offre naturelle: c’est le premier forfait qui aide vraiment à vendre plus avec relances, campagnes et IA."
            />
            <InfoPanel
              icon={FileText}
              title="Limites stratégiques"
              text="Essentiel reste utile, mais limité sur contacts, automatisations, IA, landing pages et reporting pour encourager la montée en gamme."
            />
            <InfoPanel
              icon={UsersRound}
              title="Utilisateurs extra"
              text="Après Cabinet: 49 par conseiller actif et 19 par assistant. C’est plus clair que de facturer tous les utilisateurs au même prix."
            />
          </aside>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <PricingList
            icon={CreditCard}
            title="Add-ons recommandés"
            description="Options à vendre séparément pour augmenter le revenu moyen par cabinet."
            rows={addOns.map(([name, eur, cad]) => [name, currency === "EUR" ? eur : cad])}
          />
          <PricingList
            icon={Database}
            title="Frais d’installation"
            description="Setup offert pour tout engagement annuel afin d’encourager l’abonnement annuel."
            rows={setupFees.map(([name, eur, cad]) => [name, currency === "EUR" ? eur : cad])}
          />
        </section>
      </section>
    </main>
  )
}

function BillingIntervalSwitch({
  interval,
  setInterval,
}: {
  interval: BillingInterval
  setInterval: (interval: BillingInterval) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-950">Paiement</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Choisissez mensuel ou annuel avant de passer à Stripe.</p>
      <div className="mt-4 grid grid-cols-2 rounded-full border-2 border-slate-200 bg-slate-50 p-1">
        {([
          ["monthly", "Mensuel"],
          ["annual", "Annuel"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              interval === value ? "bg-slate-950 text-white shadow-[0_3px_0_#020617]" : "text-slate-600 hover:bg-white"
            )}
            aria-pressed={interval === value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CurrencySwitch({
  currency,
  setCurrency,
}: {
  currency: Currency
  setCurrency: (currency: Currency) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-950">Devise</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Basculer les prix publics entre euro et dollar canadien.</p>
      <div className="mt-4 grid grid-cols-2 rounded-full border-2 border-slate-200 bg-slate-50 p-1">
        {(["EUR", "CAD"] as Currency[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCurrency(item)}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              currency === item ? "bg-emerald-500 text-white shadow-[0_3px_0_#16a34a]" : "text-slate-600 hover:bg-white"
            )}
            aria-pressed={currency === item}
          >
            {item === "EUR" ? "€ Euro" : "$ CAD"}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  price,
  currency,
  currencyCode,
  pricingMode,
  billingInterval,
  autoCheckout,
  isBeta,
}: {
  plan: (typeof plans)[number]
  price: { monthly: string; annual: string }
  currency: { suffix: string }
  currencyCode: Currency
  pricingMode: PricingMode
  billingInterval: BillingInterval
  autoCheckout?: boolean
  isBeta: boolean
}) {
  const Icon = plan.icon
  const [isRedirecting, setIsRedirecting] = useState(false)
  const checkoutRedirect = `/forfaits?checkout=1&plan=${plan.key}&pricing=${normalizeSubscriptionPricingMode(pricingMode)}&currency=${currencyCode}&interval=${billingInterval}`
  const paymentSignUpHref = `/sign-up?role=advisor&redirect_url=${encodeURIComponent(checkoutRedirect)}&plan=${plan.key}&pricing=${pricingMode}&currency=${currencyCode}`
  const signUpHref = `/sign-up?role=advisor&redirect_url=%2Fdashboard&plan=${plan.key}&pricing=${pricingMode}&currency=${currencyCode}`

  async function startCheckout() {
    setIsRedirecting(true)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.key,
          pricingMode,
          currency: currencyCode,
          interval: billingInterval,
        }),
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; data?: { url?: string }; error?: { code?: string } } | null
      if (response.status === 401 || response.status === 403) {
        window.location.href = paymentSignUpHref
        return
      }
      if (!response.ok || !payload?.ok || !payload.data?.url) {
        throw new Error(payload?.error?.code ?? "CHECKOUT_FAILED")
      }
      window.location.href = payload.data.url
    } catch {
      window.location.href = paymentSignUpHref
    } finally {
      setIsRedirecting(false)
    }
  }

  useEffect(() => {
    if (!autoCheckout || isRedirecting) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCheckout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout])

  return (
    <article
      className={cn(
        "relative flex min-h-full flex-col rounded-lg border bg-white p-5 shadow-sm",
        plan.popular ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
      )}
    >
      {plan.popular ? (
        <div className="absolute right-4 top-4 rounded-full bg-sky-600 px-3 py-1 text-xs font-black text-white">
          Le plus populaire
        </div>
      ) : null}
      <span className={cn(
        "grid size-11 place-items-center rounded-lg ring-1",
        plan.accent === "emerald" && "bg-emerald-50 text-emerald-700 ring-emerald-100",
        plan.accent === "sky" && "bg-sky-50 text-sky-700 ring-sky-100",
        plan.accent === "violet" && "bg-violet-50 text-violet-700 ring-violet-100",
        plan.accent === "slate" && "bg-slate-100 text-slate-700 ring-slate-200"
      )}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-5 text-xs font-semibold uppercase text-slate-500">{plan.positioning}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{plan.name}</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">Ancien nom: {plan.oldName}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{plan.promise}</p>

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <div className="flex items-end gap-2">
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{price.monthly}</p>
          <p className="pb-1 text-sm font-semibold text-slate-500">/ mois {currency.suffix}</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-emerald-800">
          {billingInterval === "annual"
            ? "Facturé annuellement via Stripe."
            : isBeta
              ? "Prix bêta garanti 12 mois."
              : `${price.annual} / mois avec engagement annuel.`}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {plan.limits.map((limit) => (
          <div key={limit} className="flex items-start gap-2 text-sm text-slate-700">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{limit}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex-1">
        <p className="text-sm font-semibold text-slate-950">Inclus</p>
        <ul className="mt-3 grid gap-2">
          {plan.included.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="button"
        disabled={isRedirecting}
        onClick={startCheckout}
        className={cn("mt-5 rounded-lg", plan.popular ? "bg-sky-600 hover:bg-sky-700" : "bg-slate-950 hover:bg-slate-800")}
      >
        {isRedirecting ? "Ouverture Stripe..." : plan.cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
      <Link href={signUpHref} className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500 hover:text-slate-900">
        Créer un compte sans paiement immédiat
      </Link>
    </article>
  )
}

function InfoPanel({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon
  title: string
  text: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="size-5 text-emerald-700" aria-hidden="true" />
      <h3 className="mt-3 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}

function PricingList({
  icon: Icon,
  title,
  description,
  rows,
}: {
  icon: LucideIcon
  title: string
  description: string
  rows: string[][]
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-700">{label}</span>
            <span className="text-right font-black text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
