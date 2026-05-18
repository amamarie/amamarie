import { Database, FileSpreadsheet, PackageCheck, UsersRound } from "lucide-react"

import { ContentCard, PageShell } from "@/components/crm/page-shell"
import { CrmImportExportClient } from "@/components/crm/CrmImportExportClient"
import { AppShell } from "@/components/layout/AppShell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export default async function ImportExportPage() {
  const { organizationId } = await getTenantContext()
  const [clientCount, productCount, documentCount, recentImports] = await Promise.all([
    prisma.client.count({ where: { organizationId } }),
    prisma.financialProduct.count({ where: { organizationId } }),
    prisma.document.count({ where: { organizationId } }),
    prisma.activity.findMany({
      where: { organizationId, type: "CLIENT_CREATED", source: "IMPORT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    }).catch(() => []),
  ])

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Import / Export"
        description="Importer des clients et contrats depuis CSV, détecter les doublons et exporter les données CRM réelles."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Metric icon={UsersRound} label="Clients" value={String(clientCount)} detail="Dossiers dans le portefeuille" />
          <Metric icon={PackageCheck} label="Contrats / produits" value={String(productCount)} detail="Rattachés aux clients" />
          <Metric icon={Database} label="Documents" value={String(documentCount)} detail="Pièces et demandes suivies" />
        </div>

        <CrmImportExportClient />

        <ContentCard title="Derniers imports" description="Historique des clients créés par import.">
          {recentImports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Aucun import récent détecté.
            </div>
          ) : (
            <div className="grid gap-2">
              {recentImports.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-black text-slate-950">{activity.client ? `${activity.client.firstName} ${activity.client.lastName}` : activity.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{activity.description ?? "Client créé par import"} · {new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(activity.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof FileSpreadsheet; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-[0_6px_0_#bbf7d0]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-emerald-700" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}
