import { CreditCard, Receipt, TrendingUp, WalletCards } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatShortDate } from "@/lib/developer-console"
import { currencyFromCents, getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminFinancePage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const paidPayments = data.finance.payments.filter((payment) => payment.status === "PAID")
  const failedPayments = data.finance.payments.filter((payment) => payment.status === "FAILED")
  const paidCents = paidPayments.reduce((total, payment) => total + payment.amountCents, 0)

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="finance" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Finance SaaS" description="Suivi interne des revenus, factures et paiements. Les montants viennent des tables internes SaasInvoice/SaasPayment." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={TrendingUp} label="Revenu mensuel récurrent estimé" value={currencyFromCents(data.finance.mrrEstimateCents)} detail="Forfaits + options" tone="violet" />
          <AdminMetric icon={TrendingUp} label="Revenu annuel récurrent estimé" value={currencyFromCents(data.finance.arrEstimateCents)} detail="Revenu mensuel x 12" tone="emerald" />
          <AdminMetric icon={WalletCards} label="Paiements reçus" value={currencyFromCents(paidCents)} detail={`${paidPayments.length} paiement(s)`} tone="emerald" />
          <AdminMetric icon={CreditCard} label="Paiements échoués" value={`${failedPayments.length}`} detail="À relancer" tone={failedPayments.length ? "rose" : "slate"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminCard title="Factures" eyebrow="Dernières écritures">
            <div className="mt-4 grid gap-3">
              {data.finance.invoices.length === 0 ? <AdminEmpty>Aucune facture interne enregistrée.</AdminEmpty> : data.finance.invoices.map((invoice) => (
                <div key={invoice.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-slate-950">{invoice.organization.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{invoice.invoiceNumber ?? invoice.id.slice(0, 8)} · {formatShortDate(invoice.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminPill tone={invoice.status === "PAID" ? "emerald" : invoice.status === "OPEN" ? "amber" : "slate"}>{invoice.status}</AdminPill>
                    <AdminPill tone="violet">{currencyFromCents(invoice.amountCents, invoice.currency)}</AdminPill>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Paiements" eyebrow="Historique">
            <div className="mt-4 grid gap-3">
              {data.finance.payments.length === 0 ? <AdminEmpty>Aucun paiement enregistré.</AdminEmpty> : data.finance.payments.map((payment) => (
                <div key={payment.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-slate-950">{payment.organization.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{payment.method ?? "Méthode non renseignée"} · {formatShortDate(payment.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminPill tone={payment.status === "PAID" ? "emerald" : payment.status === "FAILED" ? "rose" : "amber"}>{payment.status}</AdminPill>
                    <AdminPill tone="violet">{currencyFromCents(payment.amountCents, payment.currency)}</AdminPill>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard title="Options payantes actives" eyebrow="Revenu additionnel" className="mt-4">
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.platform.organizationAddOns.length === 0 ? <AdminEmpty>Aucune option payante active.</AdminEmpty> : data.platform.organizationAddOns.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Receipt className="size-4 text-violet-700" aria-hidden="true" />
                <p className="mt-2 font-semibold text-slate-950">{item.addOn.name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.organization.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminPill tone="emerald">{currencyFromCents(item.addOn.priceCents * item.quantity, item.addOn.currency)}</AdminPill>
                  <AdminPill tone="slate">Qté {item.quantity}</AdminPill>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      </section>
    </main>
  )
}
