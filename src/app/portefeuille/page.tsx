import Link from "next/link"
import { CircleDollarSign, PieChart, ShieldCheck, Target, TrendingUp, type LucideIcon } from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { financialProductCategoryLabels, financialProductTypeLabels } from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const equipmentNeeds = [
  { key: "life", label: "Assurance-vie", types: ["LIFE_INSURANCE"] },
  { key: "disability", label: "Prévoyance / invalidité", types: ["DISABILITY_INSURANCE", "CRITICAL_ILLNESS", "LONG_TERM_CARE"] },
  { key: "health", label: "Santé", types: ["HEALTH_INSURANCE", "GROUP_INSURANCE"] },
  { key: "retirement", label: "Retraite", types: ["RRSP", "ANNUITY"] },
  { key: "savings", label: "Épargne / placement", types: ["TFSA", "RESP", "FHSA", "NON_REGISTERED", "INVESTMENT", "MUTUAL_FUND", "SEGREGATED_FUND", "GIC"] },
]

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function equipmentScore(types: string[]) {
  const covered = equipmentNeeds.filter((need) => need.types.some((type) => types.includes(type))).length
  return Math.round((covered / equipmentNeeds.length) * 100)
}

export default async function PortfolioPage() {
  const { organizationId } = await getTenantContext()
  const clients = await prisma.client.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      advisor: { select: { name: true } },
      products: {
        where: { status: { not: "ARCHIVED" } },
        select: {
          id: true,
          category: true,
          type: true,
          status: true,
          company: true,
          accountValue: true,
          coverageAmount: true,
          premium: true,
          commissionAmount: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const products = clients.flatMap((client) => client.products.map((product) => ({ ...product, client })))
  const activeProducts = products.filter((product) => product.status === "ACTIVE")
  const totalValue = activeProducts.reduce((sum, product) => sum + (product.accountValue ?? 0), 0)
  const totalCoverage = activeProducts.reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0)
  const totalPremium = activeProducts.reduce((sum, product) => sum + (product.premium ?? 0), 0)
  const totalCommission = activeProducts.reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)

  const byCategory = new Map<string, number>()
  const byCompany = new Map<string, number>()
  for (const product of activeProducts) {
    byCategory.set(product.category, (byCategory.get(product.category) ?? 0) + (product.accountValue ?? product.coverageAmount ?? 0))
    byCompany.set(product.company ?? "Compagnie non renseignée", (byCompany.get(product.company ?? "Compagnie non renseignée") ?? 0) + 1)
  }

  const clientEquipment = clients.map((client) => {
    const activeTypes = client.products.filter((product) => product.status === "ACTIVE").map((product) => String(product.type))
    const score = equipmentScore(activeTypes)
    return {
      client,
      score,
      activeTypes,
      totalValue: client.products.reduce((sum, product) => sum + (product.accountValue ?? 0), 0),
      totalCoverage: client.products.reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0),
      opportunities: equipmentNeeds.filter((need) => !need.types.some((type) => activeTypes.includes(type))),
    }
  }).sort((a, b) => a.score - b.score)

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Portefeuille"
        description="Vision globale des produits détenus, encours, protections, primes, commissions et opportunités d’équipement."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={PieChart} label="Encours suivis" value={formatMoney(totalValue)} detail={`${activeProducts.length} produit(s) actif(s)`} />
          <Metric icon={ShieldCheck} label="Couverture" value={formatMoney(totalCoverage)} detail="Capital de protection suivi" />
          <Metric icon={CircleDollarSign} label="Primes" value={formatMoney(totalPremium)} detail="Primes renseignées" />
          <Metric icon={TrendingUp} label="Commissions" value={formatMoney(totalCommission)} detail="Estimations actives" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)]">
          <ContentCard title="Matrice d’équipement client" description="Score calculé selon les familles de produits présentes dans chaque portefeuille.">
            {clientEquipment.length === 0 ? (
              <EmptyState text="Aucun client actif dans le portefeuille." />
            ) : (
              <div className="grid gap-3">
                {clientEquipment.slice(0, 20).map(({ client, score, totalValue: clientValue, totalCoverage: clientCoverage, opportunities }) => (
                  <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={score >= 80 ? "emerald" : score >= 50 ? "amber" : "rose"}>Score équipement {score} / 100</StatusBadge>
                          <StatusBadge tone="slate">{client.products.length} produit(s)</StatusBadge>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-slate-950">{clientName(client)}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Conseiller: {client.advisor?.name ?? "Non assigné"} · Encours {formatMoney(clientValue)} · Protection {formatMoney(clientCoverage)}
                        </p>
                      </div>
                      <Link href={`/clients/${client.id}?tab=products`} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                        Ouvrir portefeuille
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-5">
                      {equipmentNeeds.map((need) => {
                        const equipped = need.types.some((type) => client.products.some((product) => product.status === "ACTIVE" && product.type === type))
                        return (
                          <div key={need.key} className={equipped ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-3" : "rounded-2xl border border-amber-200 bg-amber-50 p-3"}>
                            <p className={equipped ? "text-xs font-black uppercase text-emerald-700" : "text-xs font-black uppercase text-amber-700"}>{equipped ? "Équipé" : "Opportunité"}</p>
                            <p className="mt-1 text-sm font-black text-slate-950">{need.label}</p>
                          </div>
                        )
                      })}
                    </div>
                    {opportunities.length > 0 ? (
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        Prochaine action utile : qualifier {opportunities[0].label.toLowerCase()}.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Répartition par catégorie" description="Montant basé sur encours ou couverture selon le produit.">
              <RankedList
                items={Array.from(byCategory.entries()).map(([label, value]) => [financialProductCategoryLabels[label] ?? label, value] as [string, number]).sort((a, b) => b[1] - a[1])}
                total={Array.from(byCategory.values()).reduce((sum, value) => sum + value, 0)}
                empty="Aucune catégorie active."
              />
            </ContentCard>
            <ContentCard title="Compagnies" description="Nombre de contrats actifs par compagnie.">
              <RankedList
                items={Array.from(byCompany.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)}
                total={Array.from(byCompany.values()).reduce((sum, value) => sum + value, 0)}
                empty="Aucune compagnie renseignée."
                countMode
              />
            </ContentCard>
            <ContentCard title="Lecture commerciale" description="Synthèse opérationnelle.">
              <div className="grid gap-2 text-sm font-semibold text-slate-600">
                <p className="flex gap-2"><Target className="mt-0.5 size-4 text-amber-600" /> Prioriser les clients sous 50 / 100 pour qualifier les produits absents.</p>
                <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 text-emerald-600" /> Vérifier les clients équipés en placement mais sans protection familiale.</p>
              </div>
            </ContentCard>
          </div>
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

function RankedList({ items, total, empty, countMode = false }: { items: Array<[string, number]>; total: number; empty: string; countMode?: boolean }) {
  if (items.length === 0) return <EmptyState text={empty} />
  return (
    <div className="grid gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-black text-slate-950">{label}</span>
            <span className="text-sm font-black text-violet-700">{countMode ? value : formatMoney(value)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-violet-600" style={{ width: `${percent(value, total)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
