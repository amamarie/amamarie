import Link from "next/link"
import { Activity, AlertTriangle, BarChart3, Building2, CreditCard, Headset, ShieldCheck, TrendingUp, Users } from "lucide-react"

import { AdminCard, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { subscriptionPlans } from "@/lib/billing/plans"
import { formatShortDate } from "@/lib/developer-console"
import { currencyFromCents, getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminDashboardPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const highRisk = data.accountHealth.filter((record) => record.churnScore >= 70)
  const mediumRisk = data.accountHealth.filter((record) => record.churnScore >= 40 && record.churnScore < 70)
  const activeIncidents = data.platform.incidents.filter((incident) => incident.status !== "RESOLVED")

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="dashboard" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro
          title="Centre de pilotage SaaS"
          description="Vue interne pour suivre les clients, les revenus, le support, les risques et les opérations sensibles de FinAdvisor."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <IntroStat label="Revenu mensuel récurrent" value={currencyFromCents(data.finance.mrrEstimateCents)} />
            <IntroStat label="Revenu annuel récurrent" value={currencyFromCents(data.finance.arrEstimateCents)} />
            <IntroStat label="Clients" value={`${data.activeRecords.length}/${data.accountRecords.length}`} />
          </div>
        </SuperAdminIntro>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={CreditCard} label="Revenu mensuel récurrent estimé" value={currencyFromCents(data.finance.mrrEstimateCents)} detail="Forfaits + options payantes EUR" tone="violet" />
          <AdminMetric icon={TrendingUp} label="Revenu moyen par cabinet" value={currencyFromCents(data.finance.arpuCents)} detail="Cabinets actifs" tone="emerald" />
          <AdminMetric icon={AlertTriangle} label="Risque de résiliation" value={`${highRisk.length} élevé`} detail={`${mediumRisk.length} risque moyen`} tone={highRisk.length ? "rose" : "emerald"} />
          <AdminMetric icon={Headset} label="Support" value={`${data.support.openTickets.length} ouverts`} detail={`${data.support.criticalTickets.length} critiques/hauts`} tone={data.support.criticalTickets.length ? "rose" : "slate"} />
          <AdminMetric icon={Users} label="Utilisateurs" value={`${data.totalSeatsUsed}/${Math.max(data.totalSeatLimit, 1)}`} detail="Sièges conseillers utilisés" tone="amber" />
          <AdminMetric icon={Activity} label="Usage produit" value={`${data.productUsage.contacts}`} detail={`${data.productUsage.tasks} tâches · ${data.productUsage.documents} docs`} tone="emerald" />
          <AdminMetric icon={BarChart3} label="API" value={`${data.productUsage.apiCallsThisMonth}`} detail="Appels ce mois" tone="violet" />
          <AdminMetric icon={ShieldCheck} label="Incidents" value={`${activeIncidents.length}`} detail={`${data.platform.assistanceSessions.length} sessions assistance`} tone={activeIncidents.length ? "amber" : "emerald"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <AdminCard
            title="Comptes à traiter"
            eyebrow="Priorité client"
            action={<Link href="/super-admin/clients" className="text-sm font-semibold text-violet-700 hover:underline">Voir clients</Link>}
          >
            <div className="mt-4 grid gap-3">
              {data.accountHealth.slice().sort((a, b) => b.churnScore - a.churnScore).slice(0, 6).map((record) => (
                <Link key={record.organization.id} href={`/super-admin/clients/${record.organization.id}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-slate-950">{record.organization.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{subscriptionPlans[record.plan].label} · {record.organization.city ?? "Ville non renseignée"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminPill tone={record.churnScore >= 70 ? "rose" : record.churnScore >= 40 ? "amber" : "emerald"}>Risque {record.churnScore}/100</AdminPill>
                    <AdminPill tone={record.healthScore >= 80 ? "emerald" : record.healthScore >= 60 ? "amber" : "rose"}>Santé {record.healthScore}%</AdminPill>
                  </div>
                </Link>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Actions rapides" eyebrow="Opérations">
            <div className="mt-4 grid gap-3">
              <QuickLink href="/super-admin/clients" icon={Building2} title="Gérer clients" text="Comptes, forfaits, risque de résiliation" />
              <QuickLink href="/super-admin/finance" icon={CreditCard} title="Finance" text="Factures, paiements, revenu récurrent" />
              <QuickLink href="/super-admin/support" icon={Headset} title="Support" text="Tickets et notes internes" />
              <QuickLink href="/super-admin/parametres" icon={BarChart3} title="Forfaits et options" text="Forfaits, options, fonctionnalités contrôlées" />
            </div>
          </AdminCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <AdminCard title="Revenus récents" eyebrow="Finance">
            <div className="mt-4 grid gap-2">
              {data.finance.invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{invoice.organization.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{currencyFromCents(invoice.amountCents, invoice.currency)} · {invoice.status} · {formatShortDate(invoice.createdAt)}</p>
                </div>
              ))}
              {data.finance.invoices.length === 0 ? <p className="text-sm font-medium text-slate-500">Aucune facture interne.</p> : null}
            </div>
          </AdminCard>
          <AdminCard title="Tickets récents" eyebrow="Support">
            <div className="mt-4 grid gap-2">
              {data.support.tickets.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.organization.name} · {ticket.priority} · {ticket.status}</p>
                </div>
              ))}
              {data.support.tickets.length === 0 ? <p className="text-sm font-medium text-slate-500">Aucun ticket interne.</p> : null}
            </div>
          </AdminCard>
          <AdminCard title="Incidents & annonces" eyebrow="Produit">
            <div className="mt-4 grid gap-2">
              {activeIncidents.slice(0, 3).map((incident) => (
                <div key={incident.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-950">{incident.title}</p>
                  <p className="mt-1 text-xs text-amber-800">{incident.module} · {incident.priority}</p>
                </div>
              ))}
              {data.platform.announcements.slice(0, 3).map((announcement) => (
                <div key={announcement.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{announcement.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{announcement.status} · {announcement._count.deliveries} livraison(s)</p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      </section>
    </main>
  )
}

function IntroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-violet-700">{value}</p>
    </div>
  )
}

function QuickLink({ href, icon: Icon, title, text }: { href: string; icon: typeof Building2; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-violet-200 hover:bg-violet-50">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </Link>
  )
}
