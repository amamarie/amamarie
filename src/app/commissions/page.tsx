import Link from "next/link"
import { AlertTriangle, Building2, CalendarClock, ReceiptText, TrendingUp, UserRound } from "lucide-react"

import { AppShell } from "@/components/layout/AppShell"
import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { commissionTypeLabels, financialProductStatusLabels, financialProductTypeLabels } from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function formatMoney(value?: number | null, currency = "CAD") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non renseigné"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function commissionStatus(product: { commissionAmount: number | null; renewalAt: Date | null; status: string }) {
  if (!product.commissionAmount) return { label: "À compléter", tone: "amber" as const }
  if (product.status === "CANCELLED" || product.status === "ARCHIVED") return { label: "Annulée", tone: "slate" as const }
  if (product.renewalAt && product.renewalAt.getTime() < Date.now() && product.status !== "ACTIVE") return { label: "En retard", tone: "rose" as const }
  if (product.status === "ACTIVE") return { label: "Attendue", tone: "emerald" as const }
  return { label: "Estimée", tone: "sky" as const }
}

export default async function CommissionsPage() {
  const { organizationId } = await getTenantContext()
  const products = await prisma.financialProduct.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      advisor: { select: { id: true, name: true } },
    },
    orderBy: [{ commissionAmount: "desc" }, { updatedAt: "desc" }],
  })

  const withCommission = products.filter((product) => product.commissionAmount && product.commissionAmount > 0)
  const expectedTotal = withCommission.reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)
  const activeTotal = withCommission.filter((product) => product.status === "ACTIVE").reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)
  const missingCount = products.filter((product) => !product.commissionAmount).length
  const companies = new Map<string, number>()
  const advisors = new Map<string, number>()

  for (const product of withCommission) {
    companies.set(product.company ?? "Compagnie non renseignée", (companies.get(product.company ?? "Compagnie non renseignée") ?? 0) + (product.commissionAmount ?? 0))
    advisors.set(product.advisor?.name ?? "Conseiller non assigné", (advisors.get(product.advisor?.name ?? "Conseiller non assigné") ?? 0) + (product.commissionAmount ?? 0))
  }

  const topCompanies = Array.from(companies.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topAdvisors = Array.from(advisors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Commissions"
        description="Vue réelle des commissions estimées depuis les contrats et produits du portefeuille client."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={ReceiptText} label="Commissions estimées" value={formatMoney(expectedTotal)} detail={`${withCommission.length} produit(s) renseigné(s)`} />
          <Metric icon={TrendingUp} label="Sur contrats actifs" value={formatMoney(activeTotal)} detail="Produits actifs uniquement" />
          <Metric icon={AlertTriangle} label="À compléter" value={String(missingCount)} detail="Produits sans commission" />
          <Metric icon={Building2} label="Compagnies" value={String(companies.size)} detail="Avec commission suivie" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ContentCard title="Commissions par contrat" description="Montants stockés sur les produits financiers réels du CRM.">
            {products.length === 0 ? (
              <EmptyState text="Aucun contrat ou produit n’est encore enregistré." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Client</th>
                      <th className="px-3 py-3">Contrat</th>
                      <th className="px-3 py-3">Compagnie</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Commission</th>
                      <th className="px-3 py-3">Statut</th>
                      <th className="px-3 py-3">Échéance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {products.map((product) => {
                      const status = commissionStatus(product)
                      return (
                        <tr key={product.id}>
                          <td className="px-3 py-3">
                            <Link href={`/clients/${product.client.id}?tab=products`} className="font-black text-emerald-700 hover:underline">
                              {clientName(product.client)}
                            </Link>
                            <p className="text-xs font-semibold text-slate-500">{product.advisor?.name ?? "Conseiller non assigné"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-950">{product.productName ?? financialProductTypeLabels[product.type] ?? product.type}</p>
                            <p className="text-xs text-slate-500">{product.contractNumber ?? product.policyNumber ?? product.accountNumber ?? "Numéro absent"}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{product.company ?? "Non renseignée"}</td>
                          <td className="px-3 py-3 text-slate-600">{commissionTypeLabels[product.commissionType ?? "UNKNOWN"] ?? "Non renseigné"}</td>
                          <td className="px-3 py-3 font-black text-slate-950">{formatMoney(product.commissionAmount, product.currency)}</td>
                          <td className="px-3 py-3"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                          <td className="px-3 py-3 text-slate-600">{formatDate(product.renewalAt ?? product.nextReviewAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Par conseiller" description="Classement basé sur les commissions estimées.">
              <RankedList items={topAdvisors} empty="Aucune commission par conseiller." />
            </ContentCard>
            <ContentCard title="Par compagnie" description="Répartition des commissions suivies.">
              <RankedList items={topCompanies} empty="Aucune compagnie renseignée." />
            </ContentCard>
            <ContentCard title="À surveiller" description="Actions utiles pour fiabiliser le pilotage.">
              <div className="grid gap-2 text-sm font-semibold text-slate-600">
                <p className="flex gap-2"><CalendarClock className="mt-0.5 size-4 text-amber-600" /> Compléter les commissions manquantes sur les produits actifs.</p>
                <p className="flex gap-2"><UserRound className="mt-0.5 size-4 text-emerald-600" /> Vérifier les montants attendus avant chaque renouvellement.</p>
              </div>
            </ContentCard>
          </div>
        </div>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof ReceiptText; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-[0_6px_0_#bbf7d0]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function RankedList({ items, empty }: { items: Array<[string, number]>; empty: string }) {
  if (items.length === 0) return <EmptyState text={empty} />
  return (
    <div className="grid gap-2">
      {items.map(([label, amount]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <span className="text-sm font-black text-slate-950">{label}</span>
          <span className="text-sm font-black text-emerald-700">{formatMoney(amount)}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
