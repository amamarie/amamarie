import Link from "next/link"
import { AlertTriangle, Headset, MessageSquareText, Timer } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatShortDate } from "@/lib/developer-console"
import { getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminSupportPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const open = data.support.openTickets
  const critical = data.support.criticalTickets
  const notes = data.support.notes

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="support" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Support interne" description="Tickets, notes, priorités et actions de suivi pour les cabinets clients." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={Headset} label="Tickets ouverts" value={`${open.length}`} detail={`${data.support.tickets.length} au total`} tone="violet" />
          <AdminMetric icon={AlertTriangle} label="Critiques / hauts" value={`${critical.length}`} detail="Priorité support" tone={critical.length ? "rose" : "emerald"} />
          <AdminMetric icon={MessageSquareText} label="Notes internes" value={`${notes.length}`} detail="Dernières notes" tone="slate" />
          <AdminMetric icon={Timer} label="Assistance" value={`${data.platform.assistanceSessions.length}`} detail="Sessions tracées" tone="amber" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <AdminCard title="Tickets" eyebrow="Priorisés">
            <div className="mt-4 grid gap-3">
              {data.support.tickets.length === 0 ? <AdminEmpty>Aucun ticket support.</AdminEmpty> : data.support.tickets.map((ticket) => (
                <Link key={ticket.id} href={`/super-admin/clients/${ticket.organizationId}?tab=support`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-slate-950">{ticket.subject}</p>
                    <p className="mt-1 text-sm text-slate-600">{ticket.organization.name} · {ticket.module ?? "Module non précisé"} · {formatShortDate(ticket.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminPill tone={ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "rose" : ticket.priority === "NORMAL" ? "amber" : "slate"}>{ticket.priority}</AdminPill>
                    <AdminPill tone={ticket.status === "OPEN" ? "amber" : "emerald"}>{ticket.status}</AdminPill>
                  </div>
                </Link>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Notes récentes" eyebrow="CRM interne">
            <div className="mt-4 grid gap-3">
              {notes.length === 0 ? <AdminEmpty>Aucune note interne.</AdminEmpty> : notes.map((note) => (
                <Link key={note.id} href={`/super-admin/clients/${note.organizationId}?tab=notes`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50">
                  <p className="font-semibold text-slate-950">{note.organization.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{note.content}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{note.category} · {formatShortDate(note.createdAt)}</p>
                </Link>
              ))}
            </div>
          </AdminCard>
        </div>
      </section>
    </main>
  )
}
