import Link from "next/link"
import { Activity, BarChart3, CalendarDays, FileText, Flag, Mail, Users } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { subscriptionPlans } from "@/lib/billing/plans"
import { getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminProductPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const activated = data.accountHealth.filter((record) => record.organization._count.clients + record.organization._count.leads >= 50 && record.organization._count.tasks >= 10)
  const adoptionRows = data.accountHealth.slice().sort((a, b) => b.healthScore - a.healthScore).slice(0, 8)

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="produit" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Produit et adoption" description="Activation, usage des modules, fonctionnalités contrôlées, options payantes et adoption produit par cabinet." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={Users} label="Activation" value={`${activated.length}/${data.accountRecords.length}`} detail="50 contacts + 10 tâches" tone="emerald" />
          <AdminMetric icon={Activity} label="Contacts" value={`${data.productUsage.contacts}`} detail="Tous cabinets" tone="violet" />
          <AdminMetric icon={CalendarDays} label="RDV API" value={`${data.productUsage.appointmentsThisMonth}`} detail="Ce mois" tone="amber" />
          <AdminMetric icon={Mail} label="Campagnes API" value={`${data.productUsage.campaignsThisMonth}`} detail="Ce mois" tone="slate" />
          <AdminMetric icon={FileText} label="Documents" value={`${data.productUsage.documents}`} detail="Tous cabinets" tone="emerald" />
          <AdminMetric icon={BarChart3} label="Fonctionnalités contrôlées" value={`${data.platform.featureFlags.length}`} detail="Bêta et activations" tone="violet" />
          <AdminMetric icon={BarChart3} label="Options payantes" value={`${data.platform.addOns.length}`} detail={`${data.platform.organizationAddOns.length} actives`} tone="amber" />
          <AdminMetric icon={Activity} label="Journaux API" value={`${data.productUsage.apiCallsThisMonth}`} detail="Ce mois" tone="slate" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <AdminCard title="Adoption par cabinet" eyebrow="Activation et usage">
            <div className="mt-4 grid gap-3">
              {adoptionRows.map((record) => {
                const contacts = record.organization._count.clients + record.organization._count.leads
                const isActivated = contacts >= 50 && record.organization._count.tasks >= 10
                return (
                  <Link key={record.organization.id} href={`/super-admin/clients/${record.organization.id}?tab=usage`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-semibold text-slate-950">{record.organization.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{subscriptionPlans[record.plan].label} · {contacts} contacts · {record.organization._count.tasks} tâches</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminPill tone={isActivated ? "emerald" : "amber"}>{isActivated ? "Activé" : "À accompagner"}</AdminPill>
                      <AdminPill tone={record.healthScore >= 80 ? "emerald" : record.healthScore >= 60 ? "amber" : "rose"}>Santé {record.healthScore}%</AdminPill>
                    </div>
                  </Link>
                )
              })}
            </div>
          </AdminCard>

          <AdminCard title="Fonctionnalités contrôlées" eyebrow="Bêta contrôlée">
            <div className="mt-4 grid gap-3">
              {data.platform.featureFlags.length === 0 ? <AdminEmpty>Aucune fonctionnalité contrôlée configurée.</AdminEmpty> : data.platform.featureFlags.map((flag) => (
                <div key={flag.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Flag className="size-4 text-violet-700" aria-hidden="true" />
                  <p className="mt-2 font-semibold text-slate-950">{flag.publicName}</p>
                  <p className="mt-1 text-sm text-slate-600">{flag.description ?? flag.key}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminPill tone={flag.status === "ACTIVE" ? "emerald" : flag.status === "BETA" ? "violet" : "slate"}>{flag.status}</AdminPill>
                    <AdminPill tone={flag.beta ? "violet" : "slate"}>{flag.beta ? "Bêta" : "Standard"}</AdminPill>
                    <AdminPill tone="slate">{flag._count.overrides} compte(s)</AdminPill>
                  </div>
                </div>
              ))}
              <Link href="/super-admin/parametres" className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">Gérer forfaits, options et fonctionnalités</Link>
            </div>
          </AdminCard>
        </div>
      </section>
    </main>
  )
}
