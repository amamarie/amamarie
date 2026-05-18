import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileWarning,
  Target,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { financialProductCategoryLabels } from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const openLeadStatuses = ["NEW", "TO_CONTACT", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] as const
const wonLeadStatuses = ["WON", "CONVERTED"] as const
const closedLeadStatuses = ["WON", "CONVERTED", "LOST", "ARCHIVED"] as const
const openTaskStatuses = ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] as const
const incompleteDocumentStatuses = ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"] as const

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number) {
  return `${Math.round(value)} %`
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function advisorName(value?: string | null) {
  return value?.trim() || "Non assigné"
}

export default async function CrmManagementPage() {
  const { organizationId } = await getTenantContext()
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const [clients, leads, products, tasks, documents] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        kycCompleted: true,
        consentGiven: true,
        lastContactAt: true,
        nextReviewDate: true,
        advisor: { select: { name: true } },
        documents: {
          where: { status: { in: [...incompleteDocumentStatuses] } },
          select: { id: true, status: true, isRequired: true },
        },
        products: {
          where: { status: { not: "ARCHIVED" } },
          select: { id: true, status: true, commissionAmount: true, accountValue: true, coverageAmount: true, premium: true },
        },
        tasks: {
          where: { status: { in: [...openTaskStatuses] } },
          select: { id: true, status: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.lead.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        source: true,
        estimatedValue: true,
        advisor: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.financialProduct.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        category: true,
        status: true,
        accountValue: true,
        coverageAmount: true,
        commissionAmount: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { organizationId, status: { in: [...openTaskStatuses] } },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        assignedTo: { select: { name: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
    prisma.document.findMany({
      where: { organizationId, status: { in: [...incompleteDocumentStatuses] }, archivedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        isRequired: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ requiredBy: "asc" }, { updatedAt: "desc" }],
      take: 60,
    }),
  ])

  const activeClients = clients.filter((client) => client.status === "ACTIVE")
  const clientsWithoutRecentContact = clients.filter((client) => !client.lastContactAt || client.lastContactAt < oneYearAgo)
  const clientsWithIncompleteFile = clients.filter((client) => client.documents.length > 0 || !client.kycCompleted)
  const openLeads = leads.filter((lead) => openLeadStatuses.includes(lead.status as (typeof openLeadStatuses)[number]))
  const closedLeads = leads.filter((lead) => closedLeadStatuses.includes(lead.status as (typeof closedLeadStatuses)[number]))
  const wonLeads = leads.filter((lead) => wonLeadStatuses.includes(lead.status as (typeof wonLeadStatuses)[number]))
  const conversionRate = closedLeads.length > 0 ? (wonLeads.length / closedLeads.length) * 100 : 0
  const openPipelineValue = openLeads.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0)
  const expectedCommissions = products.reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)

  const advisorStats = new Map<string, { clients: number; prospects: number; tasks: number; commissions: number }>()
  for (const client of clients) {
    const key = advisorName(client.advisor?.name)
    const stats = advisorStats.get(key) ?? { clients: 0, prospects: 0, tasks: 0, commissions: 0 }
    stats.clients += 1
    stats.tasks += client.tasks.length
    stats.commissions += client.products.reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)
    advisorStats.set(key, stats)
  }
  for (const lead of openLeads) {
    const key = advisorName(lead.advisor?.name)
    const stats = advisorStats.get(key) ?? { clients: 0, prospects: 0, tasks: 0, commissions: 0 }
    stats.prospects += 1
    advisorStats.set(key, stats)
  }

  const byCategory = new Map<string, number>()
  for (const product of products) {
    byCategory.set(product.category, (byCategory.get(product.category) ?? 0) + (product.accountValue ?? product.coverageAmount ?? 0))
  }
  const categoryRows = Array.from(byCategory.entries())
    .map(([category, amount]) => ({ label: financialProductCategoryLabels[category] ?? category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const riskClients = clients
    .map((client) => {
      const noRecentContact = !client.lastContactAt || client.lastContactAt < oneYearAgo
      const missingFile = client.documents.length > 0 || !client.kycCompleted
      const openTasks = client.tasks.length
      const score = (noRecentContact ? 35 : 0) + (missingFile ? 35 : 0) + Math.min(openTasks * 8, 30)
      return { client, score, noRecentContact, missingFile, openTasks }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  return (
    <AppShell moduleKey="reports">
      <PageShell
        eyebrow="CRM métier"
        title="Pilotage CRM"
        description="Vue manager des clients, prospects, tâches, dossiers incomplets, portefeuille et performance commerciale."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={UsersRound} label="Clients actifs" value={String(activeClients.length)} detail={`${clients.length} client(s) suivis`} />
          <Metric icon={Target} label="Pipeline ouvert" value={formatMoney(openPipelineValue)} detail={`${openLeads.length} prospect(s) en cours`} />
          <Metric icon={TrendingUp} label="Taux de conversion" value={formatPercent(conversionRate)} detail={`${wonLeads.length}/${closedLeads.length || 0} dossiers clos gagnés`} />
          <Metric icon={BarChart3} label="Commissions attendues" value={formatMoney(expectedCommissions)} detail="Sur contrats suivis" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <ContentCard title="Performance par conseiller" description="Clients, prospects ouverts, tâches ouvertes et commissions estimées.">
            {advisorStats.size === 0 ? (
              <EmptyState text="Aucune activité par conseiller." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Conseiller</th>
                      <th className="px-3 py-3">Clients</th>
                      <th className="px-3 py-3">Prospects ouverts</th>
                      <th className="px-3 py-3">Tâches ouvertes</th>
                      <th className="px-3 py-3">Commissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {Array.from(advisorStats.entries())
                      .sort((a, b) => b[1].commissions - a[1].commissions)
                      .map(([advisor, stats]) => (
                        <tr key={advisor}>
                          <td className="px-3 py-3 font-black text-slate-950">{advisor}</td>
                          <td className="px-3 py-3 text-slate-600">{stats.clients}</td>
                          <td className="px-3 py-3 text-slate-600">{stats.prospects}</td>
                          <td className="px-3 py-3"><StatusBadge tone={stats.tasks > 10 ? "amber" : "slate"}>{stats.tasks}</StatusBadge></td>
                          <td className="px-3 py-3 font-black text-emerald-700">{formatMoney(stats.commissions)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Alertes manager" description="Points qui demandent une action.">
              <div className="grid gap-2">
                <AlertRow icon={AlertTriangle} label="Clients sans contact 12 mois" value={clientsWithoutRecentContact.length} tone={clientsWithoutRecentContact.length > 0 ? "amber" : "emerald"} />
                <AlertRow icon={FileWarning} label="Dossiers incomplets" value={clientsWithIncompleteFile.length} tone={clientsWithIncompleteFile.length > 0 ? "rose" : "emerald"} />
                <AlertRow icon={ClipboardList} label="Tâches ouvertes" value={tasks.length} tone={tasks.length > 20 ? "amber" : "slate"} />
              </div>
            </ContentCard>

            <ContentCard title="Répartition portefeuille" description="Encours ou couvertures par catégorie.">
              {categoryRows.length === 0 ? (
                <EmptyState text="Aucun produit actif à répartir." />
              ) : (
                <div className="grid gap-2">
                  {categoryRows.slice(0, 7).map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-950">{row.label}</p>
                        <p className="text-sm font-black text-emerald-700">{formatMoney(row.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ContentCard>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ContentCard title="Clients à prioriser" description="Score simple basé sur absence de contact, dossier incomplet et tâches ouvertes.">
            {riskClients.length === 0 ? (
              <EmptyState text="Aucun client prioritaire détecté." />
            ) : (
              <div className="grid gap-3">
                {riskClients.map(({ client, score, noRecentContact, missingFile, openTasks }) => (
                  <Link key={client.id} href={`/clients/${client.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-200 hover:bg-amber-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-black text-slate-950">{clientName(client)}</h2>
                      <StatusBadge tone={score >= 70 ? "rose" : "amber"}>Priorité {score} / 100</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {advisorName(client.advisor?.name)} · {openTasks} tâche(s) ouverte(s)
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {noRecentContact ? <StatusBadge tone="amber">Sans contact récent</StatusBadge> : null}
                      {missingFile ? <StatusBadge tone="rose">Dossier incomplet</StatusBadge> : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Dossiers et tâches à débloquer" description="Documents manquants et tâches ouvertes à traiter en priorité.">
            <div className="grid gap-4">
              <div>
                <p className="mb-2 text-xs font-black uppercase text-slate-500">Documents incomplets</p>
                {documents.length === 0 ? (
                  <EmptyState text="Aucun document manquant ou expiré." />
                ) : (
                  <div className="grid gap-2">
                    {documents.slice(0, 8).map((document) => (
                      <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{document.name}</p>
                          <StatusBadge tone={document.status === "EXPIRED" || document.status === "REJECTED" ? "rose" : "amber"}>{document.status.toLowerCase()}</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {document.client ? clientName(document.client) : document.lead ? clientName(document.lead) : "Dossier non lié"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase text-slate-500">Tâches ouvertes</p>
                {tasks.length === 0 ? (
                  <EmptyState text="Aucune tâche ouverte." />
                ) : (
                  <div className="grid gap-2">
                    {tasks.slice(0, 8).map((task) => (
                      <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{task.title}</p>
                          <StatusBadge tone={task.status === "OVERDUE" ? "rose" : "slate"}>{task.status.toLowerCase()}</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {task.client ? clientName(task.client) : task.lead ? clientName(task.lead) : "Sans dossier"} · {advisorName(task.assignedTo?.name)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ContentCard>
        </div>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-white p-4 shadow-[0_6px_0_#ddd6fe]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-violet-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function AlertRow({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-slate-500" />
        <p className="text-sm font-black text-slate-950">{label}</p>
      </div>
      <StatusBadge tone={tone}>{value}</StatusBadge>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
