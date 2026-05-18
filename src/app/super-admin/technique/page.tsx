import Link from "next/link"
import { AlertTriangle, Code2, Mail, Plug, Server, Webhook } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatShortDate } from "@/lib/developer-console"
import { getSuperAdminDashboardData } from "@/lib/super-admin"

export default async function SuperAdminTechnicalPage() {
  const user = await requireSuperAdmin()
  const data = await getSuperAdminDashboardData()
  const integrationErrors = data.developerIntegrations.filter((integration) => integration.status === "ERROR")
  const webhookErrors = data.developerWebhookDeliveries.filter((delivery) => delivery.status === "FAILED" || delivery.lastStatusCode && delivery.lastStatusCode >= 400)
  const apiErrors = data.developerApiLogs.filter((log) => log.statusCode >= 400)
  const emailLogs = data.developerApiLogs.filter((log) => log.endpoint.includes("email") || log.endpoint.includes("campaign"))

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="technique" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Technique, intégrations et API" description="Supervision des connexions externes, erreurs système, API, webhooks, emails et quotas." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={Plug} label="Intégrations" value={`${data.developerIntegrations.length}`} detail={`${integrationErrors.length} erreur(s)`} tone={integrationErrors.length ? "amber" : "emerald"} />
          <AdminMetric icon={Webhook} label="Webhooks" value={`${data.developerWebhooks.length}`} detail={`${webhookErrors.length} échec(s)`} tone={webhookErrors.length ? "rose" : "emerald"} />
          <AdminMetric icon={Code2} label="API logs" value={`${data.developerApiLogs.length}`} detail={`${apiErrors.length} erreur(s)`} tone={apiErrors.length ? "amber" : "slate"} />
          <AdminMetric icon={Mail} label="Email API" value={`${emailLogs.length}`} detail="Logs campagnes/email" tone="violet" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <AdminCard title="Intégrations externes" eyebrow="Diagnostic">
            <div className="mt-4 grid gap-3">
              {data.developerIntegrations.length === 0 ? <AdminEmpty>Aucune intégration développeur configurée.</AdminEmpty> : data.developerIntegrations.map((integration) => (
                <Link key={integration.id} href={`/super-admin/clients/${integration.organizationId}?tab=integrations`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-slate-950">{integration.provider}</p>
                    <p className="mt-1 text-sm text-slate-600">{integration.organization.name} · {integration.category} · {integration.lastSyncAt ? formatShortDate(integration.lastSyncAt) : "Jamais synchronisé"}</p>
                  </div>
                  <AdminPill tone={integration.status === "ERROR" ? "rose" : integration.status === "CONNECTED" ? "emerald" : "slate"}>{integration.status}</AdminPill>
                </Link>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Erreurs API et webhooks" eyebrow="À diagnostiquer">
            <div className="mt-4 grid gap-3">
              {apiErrors.slice(0, 8).map((log) => (
                <Link key={log.id} href={`/super-admin/clients/${log.organizationId}?tab=logs`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{log.method} {log.endpoint}</p>
                      <p className="mt-1 text-sm text-slate-600">{log.organization.name} · {formatShortDate(log.createdAt)}</p>
                    </div>
                    <AdminPill tone="rose">{log.statusCode}</AdminPill>
                  </div>
                </Link>
              ))}
              {webhookErrors.slice(0, 5).map((delivery) => (
                <Link key={delivery.id} href={`/super-admin/clients/${delivery.organizationId}?tab=api`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="size-4 text-amber-700" aria-hidden="true" />
                  <p className="mt-2 font-semibold text-amber-950">{delivery.webhook.name}</p>
                  <p className="mt-1 text-sm text-amber-800">{delivery.organization.name} · tentative {delivery.attempt}/{delivery.maxAttempts}</p>
                </Link>
              ))}
              {apiErrors.length === 0 && webhookErrors.length === 0 ? <AdminEmpty>Aucune erreur technique récente.</AdminEmpty> : null}
            </div>
          </AdminCard>
        </div>

        <AdminCard title="Quotas API par cabinet" eyebrow="Limites forfaits" className="mt-4">
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.quotaRowsByOrganization.map((row) => (
              <div key={row.organizationId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Server className="size-4 text-violet-700" aria-hidden="true" />
                <p className="mt-2 font-semibold text-slate-950">{row.organizationName}</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <QuotaLine label="Appels API" value={`${row.usage.apiCalls}/${row.limits.apiCalls}`} />
                  <QuotaLine label="Webhooks" value={`${row.usage.webhookDeliveries}/${row.limits.webhookDeliveries}`} />
                  <QuotaLine label="Emails API" value={`${row.usage.emailApiCalls}`} />
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      </section>
    </main>
  )
}

function QuotaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  )
}
