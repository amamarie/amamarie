import Link from "next/link"
import { Activity, AlertTriangle, ListChecks, Search, ShieldCheck } from "lucide-react"

import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatAuditAction, formatShortDate } from "@/lib/developer-console"
import { prisma } from "@/lib/prisma"
import { getSuperAdminDashboardData } from "@/lib/super-admin"

type PageProps = {
  searchParams?: Promise<{
    q?: string
    type?: string
    status?: string
  }>
}

export default async function SuperAdminLogsPage({ searchParams }: PageProps) {
  const user = await requireSuperAdmin()
  const params = await searchParams
  const q = String(params?.q ?? "").trim().toLowerCase()
  const type = String(params?.type ?? "all")
  const status = String(params?.status ?? "all")
  const data = await getSuperAdminDashboardData()
  const auditLogs = await prisma.auditLog.findMany({
    take: 80,
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
    },
  })

  const rows = [
    ...auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      type: "Audit",
      status: log.sensitivityLevel === "HIGH" ? "attention" : "success",
      title: formatAuditAction(log.action),
      detail: `${log.entityType} · ${log.user?.email ?? "Système"}`,
      organizationId: log.organizationId,
      organizationName: log.organization.name,
      createdAt: log.createdAt,
      href: `/super-admin/clients/${log.organizationId}?tab=logs`,
    })),
    ...data.developerApiLogs.map((log) => ({
      id: `api-${log.id}`,
      type: log.type,
      status: log.statusCode >= 400 || log.status === "error" ? "error" : "success",
      title: `${log.method} ${log.endpoint}`,
      detail: `${log.statusCode} · ${log.latencyMs ?? 0} ms · ${log.apiKey?.name ?? log.webhook?.name ?? "API"}`,
      organizationId: log.organizationId,
      organizationName: log.organization.name,
      createdAt: log.createdAt,
      href: `/super-admin/clients/${log.organizationId}?tab=api`,
    })),
    ...data.developerWebhookDeliveries.map((delivery) => ({
      id: `webhook-${delivery.id}`,
      type: "Webhook",
      status: delivery.status === "DELIVERED" ? "success" : "error",
      title: `${delivery.event} vers ${delivery.webhook.name}`,
      detail: `${delivery.lastStatusCode ?? "—"} · tentative ${delivery.attempt}/${delivery.maxAttempts}`,
      organizationId: delivery.organizationId,
      organizationName: delivery.organization.name,
      createdAt: delivery.createdAt,
      href: `/super-admin/clients/${delivery.organizationId}?tab=api`,
    })),
    ...data.finance.payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: "Paiement",
      status: payment.status === "FAILED" ? "error" : payment.status === "PAID" ? "success" : "attention",
      title: `Paiement ${payment.status}`,
      detail: `${payment.amountCents / 100} ${payment.currency} · ${payment.method ?? "méthode inconnue"}`,
      organizationId: payment.organizationId,
      organizationName: payment.organization.name,
      createdAt: payment.createdAt,
      href: `/super-admin/clients/${payment.organizationId}?tab=subscription`,
    })),
    ...data.support.tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      type: "Support",
      status: ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "success" : ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "error" : "attention",
      title: ticket.subject,
      detail: `${ticket.priority} · ${ticket.module ?? "module non précisé"}`,
      organizationId: ticket.organizationId,
      organizationName: ticket.organization.name,
      createdAt: ticket.createdAt,
      href: `/super-admin/clients/${ticket.organizationId}?tab=support`,
    })),
  ]
    .filter((row) => type === "all" || row.type.toLowerCase() === type.toLowerCase())
    .filter((row) => status === "all" || row.status === status)
    .filter((row) => {
      if (!q) return true
      return [row.type, row.status, row.title, row.detail, row.organizationName].join(" ").toLowerCase().includes(q)
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const errorRows = rows.filter((row) => row.status === "error")
  const auditRows = rows.filter((row) => row.type === "Audit")
  const webhookRows = rows.filter((row) => row.type === "Webhook")

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="logs" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Logs internes" description="Recherche transversale sur les logs audit, API, webhooks, paiements et support. Les données viennent des journaux persistés." />

        <form className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder="Rechercher client, endpoint, action, statut..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none focus:border-violet-300 focus:bg-white" />
          </label>
          <select name="type" defaultValue={type} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <option value="all">Tous les types</option>
            <option value="Audit">Audit</option>
            <option value="API">API</option>
            <option value="Webhook">Webhook</option>
            <option value="Paiement">Paiement</option>
            <option value="Support">Support</option>
          </select>
          <select name="status" defaultValue={status} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <option value="all">Tous les statuts</option>
            <option value="success">Succès</option>
            <option value="attention">Attention</option>
            <option value="error">Erreur</option>
          </select>
          <button className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-violet-700">Filtrer</button>
        </form>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={ListChecks} label="Événements" value={`${rows.length}`} detail="Après filtres" tone="violet" />
          <AdminMetric icon={AlertTriangle} label="Erreurs" value={`${errorRows.length}`} detail="À diagnostiquer" tone={errorRows.length ? "rose" : "emerald"} />
          <AdminMetric icon={ShieldCheck} label="Audit" value={`${auditRows.length}`} detail="Actions internes" tone="slate" />
          <AdminMetric icon={Activity} label="Webhooks" value={`${webhookRows.length}`} detail="Livraisons suivies" tone="amber" />
        </div>

        <AdminCard title="Journal consolidé" eyebrow="Diagnostic" className="mt-4">
          <div className="mt-4 grid gap-3">
            {rows.length === 0 ? <AdminEmpty>Aucun log trouvé avec ces filtres.</AdminEmpty> : rows.map((row) => (
              <Link key={row.id} href={row.href} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[140px_1fr_auto]">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{row.type}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{formatShortDate(row.createdAt)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{row.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{row.organizationName} · {row.detail}</p>
                </div>
                <div className="flex items-center">
                  <AdminPill tone={row.status === "error" ? "rose" : row.status === "attention" ? "amber" : "emerald"}>{row.status}</AdminPill>
                </div>
              </Link>
            ))}
          </div>
        </AdminCard>
      </section>
    </main>
  )
}
