import { CreditCard, Flag, PackagePlus, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

import { DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { requireSaasRole } from "@/lib/auth/roles"
import { offerableSubscriptionPlanKeys, subscriptionPlans } from "@/lib/billing/plans"
import { formatCurrencyAmount } from "@/lib/developer-console"
import { currencyFromCents, getSuperAdminDashboardData } from "@/lib/super-admin"

import { createFeatureFlag, createSaasAddOn } from "../actions"

export default async function DeveloperPlansPage() {
  const user = await requireSaasRole(["DEVELOPER"])
  const data = await getSuperAdminDashboardData()

  const planRows = offerableSubscriptionPlanKeys.map((key) => {
    const plan = subscriptionPlans[key]
    const records = data.accountRecords.filter((record) => record.plan === key)
    const eurMrr = records.filter((record) => record.currency === "EUR").reduce((total, record) => total + record.monthlyRevenue, 0)
    const cadMrr = records.filter((record) => record.currency === "CAD").reduce((total, record) => total + record.monthlyRevenue, 0)
    return { key, plan, records, eurMrr, cadMrr }
  })

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="plans" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Forfaits, options et fonctionnalités"
          title="Pilotage commercial du SaaS"
          description="Les forfaits restent synchronisés avec les cabinets. Les options payantes, fonctionnalités contrôlées et métriques ci-dessous sont persistées en base pour préparer facturation, bêta et montée en gamme."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat label="Revenu mensuel récurrent estimé" value={currencyFromCents(data.finance.mrrEstimateCents)} />
            <MiniStat label="Revenu annuel récurrent estimé" value={currencyFromCents(data.finance.arrEstimateCents)} />
            <MiniStat label="Revenu moyen par cabinet" value={currencyFromCents(data.finance.arpuCents)} />
          </div>
        </PageIntro>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <SectionCard title="Forfaits actifs" eyebrow="Données cabinets">
            <div className="mt-4 grid gap-3">
              {planRows.map((row) => (
                <div key={row.key} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{row.plan.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{row.plan.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone="violet">{row.records.length} cabinet(s)</StatusPill>
                      <StatusPill tone="emerald">{formatCurrencyAmount(row.eurMrr, "EUR")} revenu mensuel EUR</StatusPill>
                      <StatusPill tone="slate">{formatCurrencyAmount(row.cadMrr, "CAD")} revenu mensuel CAD</StatusPill>
                    </div>
                  </div>
                  <CreditCard className="size-5 text-violet-700" aria-hidden="true" />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4">
            <SectionCard title="Créer un add-on" eyebrow="Facturation interne">
              <form action={createSaasAddOn} className="mt-4 grid gap-2">
                <input name="key" placeholder="pack_ia" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input name="name" placeholder="Pack IA" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input name="price" placeholder="29" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select name="currency" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>EUR</option><option>CAD</option></select>
                <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer add-on</button>
              </form>
            </SectionCard>
            <SectionCard title="Créer un feature flag" eyebrow="Bêta contrôlée">
              <form action={createFeatureFlag} className="mt-4 grid gap-2">
                <input name="key" placeholder="nouveau_calendrier" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input name="publicName" placeholder="Nouveau calendrier" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select name="status" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>DISABLED</option><option>BETA</option><option>ACTIVE</option></select>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input name="beta" type="checkbox" className="size-4" />
                  Accès bêta
                </label>
                <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer flag</button>
              </form>
            </SectionCard>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Options payantes" eyebrow="Persistées DB">
            <div className="mt-4 grid gap-3">
              {data.platform.addOns.length === 0 ? <Empty>Aucune option payante configurée.</Empty> : data.platform.addOns.map((addOn) => (
                <div key={addOn.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{addOn.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{addOn.description ?? addOn.key}</p>
                    </div>
                    <PackagePlus className="size-5 text-violet-700" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="emerald">{currencyFromCents(addOn.priceCents, addOn.currency)}</StatusPill>
                    <StatusPill tone="slate">{addOn._count.organizations} cabinet(s)</StatusPill>
                    <StatusPill tone={addOn.status === "ACTIVE" ? "emerald" : "slate"}>{addOn.status}</StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Fonctionnalités contrôlées" eyebrow="Bêta et activation">
            <div className="mt-4 grid gap-3">
              {data.platform.featureFlags.length === 0 ? <Empty>Aucune fonctionnalité contrôlée configurée.</Empty> : data.platform.featureFlags.map((flag) => (
                <div key={flag.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{flag.publicName}</p>
                      <p className="mt-1 text-sm text-slate-600">{flag.description ?? flag.key}</p>
                    </div>
                    <Flag className="size-5 text-violet-700" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone={flag.status === "ACTIVE" ? "emerald" : flag.status === "BETA" ? "violet" : "slate"}>{flag.status}</StatusPill>
                    <StatusPill tone={flag.beta ? "violet" : "slate"}>{flag.beta ? "Bêta" : "Standard"}</StatusPill>
                    <StatusPill tone="slate">{flag._count.overrides} override(s)</StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Métriques SaaS" eyebrow="Synthèse financière et produit" className="mt-4">
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric icon={TrendingUp} label="Revenu mensuel récurrent" value={currencyFromCents(data.finance.mrrEstimateCents)} detail="Forfaits + options EUR" />
            <Metric icon={TrendingUp} label="Revenu annuel récurrent" value={currencyFromCents(data.finance.arrEstimateCents)} detail="Revenu mensuel x 12" />
            <Metric icon={TrendingUp} label="Factures payées" value={currencyFromCents(data.finance.paidInvoicesCents)} detail="Saisie interne" />
            <Metric icon={TrendingUp} label="Paiements échoués" value={`${data.finance.failedPaymentsCount}`} detail="À relancer" />
            <Metric icon={TrendingUp} label="Contacts" value={`${data.productUsage.contacts}`} detail="Tous cabinets" />
            <Metric icon={TrendingUp} label="Tâches" value={`${data.productUsage.tasks}`} detail="Tous cabinets" />
            <Metric icon={TrendingUp} label="API ce mois" value={`${data.productUsage.apiCallsThisMonth}`} detail="Logs persistés" />
            <Metric icon={TrendingUp} label="Tickets ouverts" value={`${data.support.openTickets.length}`} detail={`${data.support.criticalTickets.length} critiques/hauts`} />
          </div>
        </SectionCard>
      </section>
    </main>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-violet-700">{value}</p>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof TrendingUp; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-500">{children}</div>
}
