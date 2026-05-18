import Link from "next/link"
import { AlertTriangle, KeyRound, ShieldCheck, UserCheck } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatAuditAction, formatShortDate } from "@/lib/developer-console"
import { getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminSecurityPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const revokedKeys = data.developerApiKeys.filter((key) => key.status === "REVOKED")
  const failedApiLogs = data.developerApiLogs.filter((log) => log.status === "error" || log.statusCode >= 400)
  const activeAssistance = data.platform.assistanceSessions.filter((session) => session.status === "ACTIVE")
  const activeIncidents = data.platform.incidents.filter((incident) => incident.status !== "RESOLVED")

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="securite" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Sécurité interne" description="Audit des actions sensibles, accès API, sessions assistance, incidents et signaux de risque." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={ShieldCheck} label="Audit logs" value={`${data.recentAuditLogs.length}`} detail="Dernières actions" tone="violet" />
          <AdminMetric icon={KeyRound} label="Clés révoquées" value={`${revokedKeys.length}`} detail={`${data.developerApiKeys.length} clés suivies`} tone="slate" />
          <AdminMetric icon={AlertTriangle} label="Erreurs API" value={`${failedApiLogs.length}`} detail="Logs récents" tone={failedApiLogs.length ? "amber" : "emerald"} />
          <AdminMetric icon={UserCheck} label="Assistance active" value={`${activeAssistance.length}`} detail="Sessions support" tone={activeAssistance.length ? "amber" : "emerald"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminCard title="Actions sensibles récentes" eyebrow="Audit">
            <div className="mt-4 grid gap-3">
              {data.recentAuditLogs.length === 0 ? <AdminEmpty>Aucun audit log récent.</AdminEmpty> : data.recentAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{formatAuditAction(log.action)}</p>
                  <p className="mt-1 text-sm text-slate-600">{log.organization.name} · {log.user?.email ?? "Système"} · {formatShortDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Sessions assistance" eyebrow="Traçabilité">
            <div className="mt-4 grid gap-3">
              {data.platform.assistanceSessions.length === 0 ? <AdminEmpty>Aucune session assistance.</AdminEmpty> : data.platform.assistanceSessions.map((session) => (
                <Link key={session.id} href={`/super-admin/clients/${session.organizationId}?tab=security`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{session.organization.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{session.reason}</p>
                    </div>
                    <AdminPill tone={session.status === "ACTIVE" ? "amber" : "slate"}>{session.status}</AdminPill>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">{session.adminUser?.email ?? "Admin"} · expire le {formatShortDate(session.expiresAt)}</p>
                </Link>
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard title="Incidents actifs" eyebrow="Sécurité produit" className="mt-4">
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeIncidents.length === 0 ? <AdminEmpty>Aucun incident actif.</AdminEmpty> : activeIncidents.map((incident) => (
              <div key={incident.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-950">{incident.title}</p>
                <p className="mt-1 text-sm text-amber-800">{incident.module} · {incident.priority} · {incident.status}</p>
                <p className="mt-2 text-xs font-medium text-amber-700">{incident.impacts.length} cabinet(s) impacté(s)</p>
              </div>
            ))}
          </div>
        </AdminCard>
      </section>
    </main>
  )
}
