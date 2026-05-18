import { CreditCard, Flag, Globe2, PackagePlus, ShieldCheck } from "lucide-react"

import { createFeatureFlag, createSaasAddOn, updatePublicPricingMode, updateSubscriptionPlanPrice } from "@/app/developpeur/actions"
import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import {
  subscriptionCurrencies,
  offerableSubscriptionPlanKeys,
  subscriptionPlans,
  subscriptionPricingModes,
  type PlanMonthlyPriceOverrides,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
} from "@/lib/billing/plans"
import { formatCurrencyAmount, monthlyRevenueByPlan } from "@/lib/developer-console"
import { getPublicPricingMode } from "@/lib/platform-settings"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { currencyFromCents, getSuperAdminDashboardData } from "@/lib/super-admin"

const sensitiveActions = [
  "Suspendre un compte",
  "Annuler un abonnement",
  "Appliquer une remise importante",
  "Exporter des données",
  "Entrer en mode assistance",
  "Révoquer une clé API",
  "Désactiver les campagnes email",
  "Changer un plan tarifaire",
]

const pricingModeKeys = Object.keys(subscriptionPricingModes) as SubscriptionPricingModeKey[]
const currencyKeys = Object.keys(subscriptionCurrencies) as SubscriptionCurrencyKey[]

function getEffectivePlanPrice(overrides: PlanMonthlyPriceOverrides, mode: SubscriptionPricingModeKey, plan: SubscriptionPlanKey, currency: SubscriptionCurrencyKey) {
  return overrides[mode]?.[plan]?.[currency] ?? monthlyRevenueByPlan[mode][plan][currency]
}

export default async function SuperAdminSettingsPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const pricingMode = await getPublicPricingMode()
  const planRows = offerableSubscriptionPlanKeys.map((planKey) => {
    const plan = subscriptionPlans[planKey]
    const records = data.accountRecords.filter((record) => record.plan === planKey)
    const eurMrr = records.filter((record) => record.currency === "EUR").reduce((total, record) => total + record.monthlyRevenue, 0)
    const cadMrr = records.filter((record) => record.currency === "CAD").reduce((total, record) => total + record.monthlyRevenue, 0)
    return { key: planKey, plan, records, eurMrr, cadMrr }
  })

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="parametres" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Paramètres super admin" description="Réglages internes pour les forfaits, options payantes, fonctionnalités contrôlées, affichage tarifaire, contrôles sensibles et séparation de l’interface interne." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={CreditCard} label="Plans" value={`${planRows.length}`} detail="Forfaits configurés" tone="violet" />
          <AdminMetric icon={PackagePlus} label="Options payantes" value={`${data.platform.addOns.length}`} detail={`${data.platform.organizationAddOns.length} actives`} tone="emerald" />
          <AdminMetric icon={Flag} label="Fonctionnalités contrôlées" value={`${data.platform.featureFlags.length}`} detail="Bêta et accès ciblés" tone="amber" />
          <AdminMetric icon={ShieldCheck} label="Grille publique" value={subscriptionPricingModes[pricingMode]} detail="Pages publiques" tone="slate" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <AdminCard title="Forfaits" eyebrow="Plans et limites">
            <div className="mt-4 grid gap-3">
              {planRows.map((row) => (
                <div key={row.key} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{row.plan.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{row.plan.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminPill tone="violet">{row.records.length} cabinet(s)</AdminPill>
                      <AdminPill tone="emerald">{formatCurrencyAmount(row.eurMrr, "EUR")} revenu mensuel EUR</AdminPill>
                      <AdminPill tone="slate">{formatCurrencyAmount(row.cadMrr, "CAD")} revenu mensuel CAD</AdminPill>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {pricingModeKeys.flatMap((mode) => currencyKeys.map((currency) => {
                      const value = getEffectivePlanPrice(data.planPriceOverrides, mode, row.key, currency)
                      return (
                        <form key={`${row.key}-${mode}-${currency}`} action={updateSubscriptionPlanPrice} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                          <input type="hidden" name="plan" value={row.key} />
                          <input type="hidden" name="pricingMode" value={mode} />
                          <input type="hidden" name="currency" value={currency} />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-500">{subscriptionPricingModes[mode]} · {currency}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-950">{formatCurrencyAmount(value, currency)} / mois</p>
                            </div>
                            <CreditCard className="size-4 text-violet-700" aria-hidden="true" />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              name="monthlyAmount"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={value}
                              aria-label={`Prix ${row.plan.label} ${subscriptionPricingModes[mode]} ${currency}`}
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
                            />
                            <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">OK</button>
                          </div>
                        </form>
                      )
                    }))}
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <div className="grid gap-4">
            <AdminCard title="Grille tarifaire publique" eyebrow="Paramètre public">
              <form action={updatePublicPricingMode} className="mt-4 grid gap-2">
                <select name="publicPricingMode" defaultValue={pricingMode} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <option value="standard">Offre standard</option>
                  <option value="beta">Offre bêta</option>
                </select>
                <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer</button>
              </form>
            </AdminCard>

            <AdminCard title="Séparation interne" eyebrow="Architecture">
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Globe2 className="size-5 text-violet-700" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-950">Interface client et super admin séparées</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Le routage actuel expose l’admin sous `/super-admin`. Le déploiement peut mapper ce segment sur `admin.tonsaas.com` via la configuration d’hébergement.</p>
              </div>
            </AdminCard>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminCard title="Créer une option payante" eyebrow="Revenu additionnel">
            <form action={createSaasAddOn} className="mt-4 grid gap-2">
              <input name="key" placeholder="pack_ia" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input name="name" placeholder="Pack IA" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input name="price" placeholder="29" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <select name="currency" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>EUR</option><option>CAD</option></select>
              <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer l’option</button>
            </form>
          </AdminCard>

          <AdminCard title="Créer une fonctionnalité contrôlée" eyebrow="Bêta contrôlée">
            <form action={createFeatureFlag} className="mt-4 grid gap-2">
              <input name="key" placeholder="nouveau_calendrier" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input name="publicName" placeholder="Nouveau calendrier" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <select name="status" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>DISABLED</option><option>BETA</option><option>ACTIVE</option></select>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input name="beta" type="checkbox" className="size-4" />
                Accès bêta
              </label>
              <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer la fonctionnalité</button>
            </form>
          </AdminCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminCard title="Options payantes configurées" eyebrow="Persistées DB">
            <div className="mt-4 grid gap-3">
              {data.platform.addOns.length === 0 ? <AdminEmpty>Aucune option payante configurée.</AdminEmpty> : data.platform.addOns.map((addOn) => (
                <div key={addOn.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{addOn.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{addOn.description ?? addOn.key}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminPill tone="emerald">{currencyFromCents(addOn.priceCents, addOn.currency)}</AdminPill>
                    <AdminPill tone="slate">{addOn._count.organizations} cabinet(s)</AdminPill>
                    <AdminPill tone={addOn.status === "ACTIVE" ? "emerald" : "slate"}>{addOn.status}</AdminPill>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Actions sensibles" eyebrow="Confirmations requises">
            <div className="mt-4 grid gap-2">
              {sensitiveActions.map((action) => (
                <div key={action} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-sm font-semibold text-slate-950">{action}</span>
                  <AdminPill tone="amber">confirmation typée</AdminPill>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      </section>
    </main>
  )
}
