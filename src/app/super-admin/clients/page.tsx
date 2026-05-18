import Link from "next/link"
import { Building2, Search, Users } from "lucide-react"

import { AdminCard, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { offerableSubscriptionPlanKeys, subscriptionPlans, subscriptionStatuses } from "@/lib/billing/plans"
import { currencyFromCents, getSuperAdminDashboardData } from "@/lib/super-admin"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SuperAdminClientsPage({ searchParams }: PageProps) {
  const user = await requireSuperAdmin()
  const params = await searchParams
  const q = typeof params?.q === "string" ? params.q.trim().toLowerCase() : ""
  const plan = typeof params?.plan === "string" ? params.plan : "ALL"
  const risk = typeof params?.risk === "string" ? params.risk : "ALL"
  const status = typeof params?.status === "string" ? params.status : "ALL"
  const payment = typeof params?.payment === "string" ? params.payment : "ALL"
  const data = await getSuperAdminDashboardData()

  const records = data.accountHealth.filter((record) => {
    const failedPayment = data.finance.payments.some((item) => item.organizationId === record.organization.id && item.status === "FAILED")
    const unpaidInvoice = data.finance.invoices.some((item) => item.organizationId === record.organization.id && item.status !== "PAID" && item.status !== "VOID")
    const paymentState = failedPayment ? "FAILED" : unpaidInvoice ? "UNPAID" : "OK"
    const text = [
      record.organization.name,
      record.organization.legalName,
      record.organization.contactEmail,
      record.organization.city,
      record.organization.country,
      subscriptionPlans[record.plan].label,
      ...record.teamMembers.map((member) => `${member.name} ${member.email}`),
    ].filter(Boolean).join(" ").toLowerCase()
    const matchesQuery = !q || text.includes(q)
    const matchesPlan = plan === "ALL" || record.plan === plan
    const matchesStatus = status === "ALL" || record.status === status
    const matchesPayment = payment === "ALL" || paymentState === payment
    const matchesRisk =
      risk === "ALL" ||
      (risk === "HIGH" && record.churnScore >= 70) ||
      (risk === "MEDIUM" && record.churnScore >= 40 && record.churnScore < 70) ||
      (risk === "LOW" && record.churnScore < 40)
    return matchesQuery && matchesPlan && matchesStatus && matchesPayment && matchesRisk
  })

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="clients" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Comptes clients" description="Recherche, filtre et ouvre les fiches 360 des cabinets clients avec les métriques réelles de santé, revenus et usage." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={Building2} label="Comptes" value={`${records.length}`} detail={`${data.accountRecords.length} au total`} tone="violet" />
          <AdminMetric icon={Users} label="Sièges" value={`${data.totalSeatsUsed}/${Math.max(data.totalSeatLimit, 1)}`} detail="Utilisation totale" tone="emerald" />
          <AdminMetric icon={Building2} label="Risque élevé" value={`${data.accountHealth.filter((record) => record.churnScore >= 70).length}`} detail="Risque de résiliation >= 70" tone="rose" />
          <AdminMetric icon={Building2} label="Revenu mensuel récurrent" value={currencyFromCents(data.finance.mrrEstimateCents)} detail="Forfaits + options" tone="amber" />
        </div>

        <AdminCard title="Recherche et filtres" eyebrow="Portefeuille" className="mt-4">
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px_160px_160px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input name="q" defaultValue={q} placeholder="Cabinet, email, ville, utilisateur..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100" />
            </label>
            <select name="plan" defaultValue={plan} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              <option value="ALL">Tous les plans</option>
              {offerableSubscriptionPlanKeys.map((key) => <option key={key} value={key}>{subscriptionPlans[key].label}</option>)}
            </select>
            <select name="risk" defaultValue={risk} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              <option value="ALL">Tous les risques</option>
              <option value="HIGH">Risque élevé</option>
              <option value="MEDIUM">Risque moyen</option>
              <option value="LOW">Risque faible</option>
            </select>
            <select name="status" defaultValue={status} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              <option value="ALL">Tous statuts</option>
              {Object.entries(subscriptionStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select name="payment" defaultValue={payment} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              <option value="ALL">Tous paiements</option>
              <option value="OK">Paiement OK</option>
              <option value="FAILED">Paiement échoué</option>
              <option value="UNPAID">Facture impayée</option>
            </select>
            <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Filtrer</button>
          </form>
        </AdminCard>

        <AdminCard title="Liste des cabinets" eyebrow="Données réelles" className="mt-4">
          <div className="mt-4 grid gap-3">
            {records.map((record) => (
                <Link key={record.organization.id} href={`/super-admin/clients/${record.organization.id}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 lg:grid-cols-[minmax(0,1.2fr)_120px_120px_140px_170px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{record.organization.name}</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{record.organization.contactEmail ?? "Courriel non renseigné"} · {record.organization.city ?? "Ville non renseignée"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{subscriptionPlans[record.plan].label}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Statut</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{subscriptionStatuses[record.status]}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Usage</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{record.organization._count.clients + record.organization._count.leads} contacts</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminPill tone={record.healthScore >= 80 ? "emerald" : record.healthScore >= 60 ? "amber" : "rose"}>Santé {record.healthScore}%</AdminPill>
                  <AdminPill tone={record.churnScore >= 70 ? "rose" : record.churnScore >= 40 ? "amber" : "emerald"}>{record.churnLabel}</AdminPill>
                </div>
              </Link>
            ))}
            {records.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-500">Aucun cabinet ne correspond aux filtres.</p> : null}
          </div>
        </AdminCard>
      </section>
    </main>
  )
}
