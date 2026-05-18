import Link from "next/link"
import { AlertTriangle, CalendarClock, PackageCheck, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import {
  commissionTypeLabels,
  financialProductCategoryLabels,
  financialProductStatusLabels,
  financialProductTypeLabels,
  paymentFrequencyLabels,
} from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function formatMoney(value?: number | null, currency = "CAD") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non renseigné"
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function statusTone(status: string): "emerald" | "amber" | "rose" | "slate" | "sky" {
  if (status === "ACTIVE") return "emerald"
  if (status === "PENDING" || status === "UNDER_REVIEW") return "amber"
  if (status === "LAPSED" || status === "CANCELLED" || status === "EXPIRED") return "rose"
  if (status === "ARCHIVED") return "slate"
  return "sky"
}

function isRenewalSoon(value?: Date | null) {
  return Boolean(value && value.getTime() <= Date.now() + 90 * 24 * 60 * 60 * 1000 && value.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000)
}

export default async function ContractsPage() {
  const { organizationId } = await getTenantContext()
  const products = await prisma.financialProduct.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, status: true } },
      advisor: { select: { name: true } },
      documents: { select: { id: true, status: true } },
      valueHistory: { orderBy: { valueDate: "desc" }, take: 1 },
    },
    orderBy: [{ renewalAt: "asc" }, { updatedAt: "desc" }],
  })

  const activeProducts = products.filter((product) => product.status === "ACTIVE")
  const renewalSoon = activeProducts.filter((product) => isRenewalSoon(product.renewalAt)).length
  const missingDocuments = products.filter((product) => product.documentStatus && !["VALIDATED", "VALID", "COMPLET", "COMPLETED"].includes(product.documentStatus.toUpperCase())).length
  const totalAccountValue = activeProducts.reduce((sum, product) => sum + (product.accountValue ?? 0), 0)
  const totalCoverage = activeProducts.reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0)

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Contrats"
        description="Vue globale des contrats et produits détenus : statut, compagnie, échéance, encours, primes, documents et commissions."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={PackageCheck} label="Contrats actifs" value={String(activeProducts.length)} detail={`${products.length} contrat(s) au total`} />
          <Metric icon={TrendingUp} label="Encours actifs" value={formatMoney(totalAccountValue)} detail={`Protection ${formatMoney(totalCoverage)}`} />
          <Metric icon={CalendarClock} label="Échéances 90 jours" value={String(renewalSoon)} detail="Renouvellements à préparer" />
          <Metric icon={AlertTriangle} label="Docs à vérifier" value={String(missingDocuments)} detail="Statut documentaire incomplet" />
        </div>

        <ContentCard title="Liste des contrats" description="Chaque contrat est relié au client, au conseiller et à sa fiche portefeuille.">
          {products.length === 0 ? (
            <EmptyState text="Aucun contrat ou produit n’est encore enregistré." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Contrat</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Compagnie</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Échéance</th>
                    <th className="px-3 py-3">Prime / Encours</th>
                    <th className="px-3 py-3">Commission</th>
                    <th className="px-3 py-3">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 py-3">
                        <Link href={`/clients/${product.client.id}?tab=products`} className="font-black text-emerald-700 hover:underline">
                          {clientName(product.client)}
                        </Link>
                        <p className="text-xs font-semibold text-slate-500">{product.advisor?.name ?? "Conseiller non assigné"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-950">{product.productName ?? "Produit sans nom"}</p>
                        <p className="text-xs text-slate-500">{product.contractNumber ?? product.policyNumber ?? product.accountNumber ?? "Numéro absent"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-700">{financialProductTypeLabels[product.type] ?? product.type}</p>
                        <p className="text-xs text-slate-500">{financialProductCategoryLabels[product.category] ?? product.category}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{product.company ?? "Non renseignée"}</td>
                      <td className="px-3 py-3"><StatusBadge tone={statusTone(product.status)}>{financialProductStatusLabels[product.status] ?? product.status}</StatusBadge></td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(product.renewalAt ?? product.maturityAt ?? product.nextReviewAt)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <p>{formatMoney(product.premium, product.currency)} {product.premiumFrequency ? paymentFrequencyLabels[product.premiumFrequency] : ""}</p>
                        <p className="text-xs font-semibold text-slate-500">{formatMoney(product.accountValue ?? product.valueHistory[0]?.value, product.currency)}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <p>{formatMoney(product.commissionAmount, product.currency)}</p>
                        <p className="text-xs text-slate-500">{commissionTypeLabels[product.commissionType ?? "UNKNOWN"] ?? "Non renseignée"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={product.documents.length > 0 ? "emerald" : "amber"}>
                          {product.documents.length > 0 ? `${product.documents.length} doc(s)` : product.documentStatus ?? "À compléter"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
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

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
