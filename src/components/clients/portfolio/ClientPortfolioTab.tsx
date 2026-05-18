"use client"

import { AlertTriangle, Camera, Loader2, ShieldCheck, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import {
  financialProductStatusLabels,
  financialProductTypeLabels,
} from "@/lib/financial-products"
import {
  formatCurrency,
  formatDate,
  formatFrequency,
  formatPercentage,
  formatProductType,
} from "@/lib/portfolio/formatters"
import type { StatusTone } from "@/types"

type Product = {
  id: string
  category: string
  type: string
  status: string
  company: string | null
  productName: string | null
  policyNumber: string | null
  contractNumber: string | null
  accountNumber: string | null
  premium: number | null
  premiumFrequency: string | null
  coverageAmount: number | null
  accountValue: number | null
  contributionAmount: number | null
  contributionFrequency: string | null
  commissionAmount: number | null
  commissionType: string | null
  primaryBeneficiary: string | null
  renewalAt: string | null
  maturityAt: string | null
  lastReviewAt: string | null
  nextReviewAt: string | null
  documentStatus: string | null
  valueHistory?: { id: string; value: number; valueDate: string; notes: string | null }[]
}

type PortfolioAlert = {
  id: string
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  description: string
  actionLabel: string
}

type PortfolioData = {
  summary: {
    totalInvestmentValue: number
    totalInsuranceCoverage: number
    totalAnnualPremium: number
    totalMonthlyContribution: number
    totalEstimatedCommission: number
    activeProductsCount: number
    productsNeedingReviewCount: number
    missingDocumentsCount: number
    upcomingRenewalsCount: number
  }
  healthScore: {
    score: number
    status: string
    actions: string[]
  }
  alerts: PortfolioAlert[]
  insurances: Product[]
  investments: Product[]
  products: Product[]
  assetAllocation: {
    type: string
    value: number
    percentage: number
    products: number
    companies: string[]
  }[]
  upcomingRenewals: Product[]
  productsNeedingReview: Product[]
  documents: { id: string; name: string; type: string; status: string; createdAt: string }[]
  snapshots: {
    id: string
    totalInvestmentValue: number
    totalInsuranceCoverage: number
    totalAnnualPremium: number
    totalMonthlyContribution: number
    totalEstimatedCommission: number
    snapshotDate: string
  }[]
}

async function readJson<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: { message?: string } | string }
  if (!response.ok) {
    const message =
      typeof result.error === "string"
        ? result.error
        : result.error?.message ?? "Une erreur est survenue."
    throw new Error(message)
  }
  return result.data as T
}

const severityTone: Record<PortfolioAlert["severity"], StatusTone> = {
  LOW: "sky",
  MEDIUM: "amber",
  HIGH: "rose",
  CRITICAL: "rose",
}

function statusLabel(value?: string | null) {
  if (!value) return "Non défini"
  return financialProductStatusLabels[value] ?? value
}

export function ClientPortfolioTab({ clientId }: { clientId: string }) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadPortfolio = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/portfolio`, { cache: "no-store" })
      setPortfolio(await readJson<PortfolioData>(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le portefeuille.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPortfolio()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadPortfolio])

  async function createSnapshot() {
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/clients/${clientId}/portfolio/snapshot`, {
        method: "POST",
      })
      await readJson<unknown>(response)
      setNotice("Snapshot du portefeuille créé.")
      await loadPortfolio()
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Impossible de créer le snapshot.")
    } finally {
      setIsSaving(false)
    }
  }

  const donutBackground = useMemo(() => {
    if (!portfolio || portfolio.assetAllocation.length === 0) return "#e2e8f0"
    const colors = ["#10b981", "#38bdf8", "#8b5cf6", "#f59e0b", "#64748b", "#14b8a6"]
    let start = 0
    const parts = portfolio.assetAllocation.map((item, index) => {
      const end = start + item.percentage
      const part = `${colors[index % colors.length]} ${start}% ${end}%`
      start = end
      return part
    })
    return `conic-gradient(${parts.join(", ")})`
  }, [portfolio])

  if (isLoading) {
    return (
      <ContentCard title="Portefeuille">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Loader2 className="size-4 animate-spin text-emerald-600" />
          Chargement du portefeuille...
        </div>
      </ContentCard>
    )
  }

  if (error || !portfolio) {
    return (
      <ContentCard title="Portefeuille">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="font-semibold text-slate-950">{error ?? "Portefeuille introuvable."}</p>
          <Button className="mt-4 rounded-2xl" variant="outline" onClick={() => void loadPortfolio()}>
            Réessayer
          </Button>
        </div>
      </ContentCard>
    )
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <PortfolioHealthScoreCard portfolio={portfolio} />
        <PortfolioSummaryCards portfolio={portfolio} onSnapshot={createSnapshot} isSaving={isSaving} />
      </section>

      <PortfolioAlertsPanel alerts={portfolio.alerts} />

      <section className="grid gap-6 xl:grid-cols-2">
        <ContentCard title="Répartition des actifs">
          <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
            <div className="mx-auto flex size-40 items-center justify-center rounded-full" style={{ background: donutBackground }}>
              <div className="flex size-24 items-center justify-center rounded-full bg-white text-center text-sm font-semibold text-slate-800 shadow-inner">
                {formatCurrency(portfolio.summary.totalInvestmentValue)}
              </div>
            </div>
            <div className="space-y-3">
              {portfolio.assetAllocation.length === 0 ? (
                <EmptyLine>Aucun placement avec valeur actuelle.</EmptyLine>
              ) : (
                portfolio.assetAllocation.map((item) => (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">{formatProductType(item.type)}</span>
                      <span className="text-slate-500">{formatPercentage(item.percentage)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">{formatCurrency(item.value)} - {item.products} produit(s)</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </ContentCard>

        <UpcomingRenewalsList products={portfolio.upcomingRenewals} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <InsuranceCoverageSection products={portfolio.insurances} />
        <InvestmentAccountsSection products={portfolio.investments} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ContributionsSection products={portfolio.investments} />
        <CommissionSummarySection products={portfolio.products} total={portfolio.summary.totalEstimatedCommission} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PortfolioSnapshotsChart snapshots={portfolio.snapshots} />
        <PortfolioDocumentsStatus documents={portfolio.documents} />
      </section>
    </div>
  )
}

function PortfolioHealthScoreCard({ portfolio }: { portfolio: PortfolioData }) {
  const score = portfolio.healthScore.score
  const tone = score >= 85 ? "emerald" : score >= 65 ? "amber" : "rose"

  return (
    <ContentCard title="Score santé du dossier">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative flex size-32 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(#10b981 ${score}%, #e2e8f0 ${score}% 100%)` }}
          />
          <div className="relative flex size-24 items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-950 shadow-inner">
            {score}
          </div>
        </div>
        <div>
          <StatusBadge tone={tone}>{portfolio.healthScore.status}</StatusBadge>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Score interne de suivi du dossier. Il aide à prioriser les suivis, sans produire de recommandation financière automatisée.
          </p>
          <div className="mt-3 space-y-2">
            {portfolio.healthScore.actions.slice(0, 4).map((action) => (
              <p key={action} className="text-sm text-slate-700">- {action}</p>
            ))}
          </div>
        </div>
      </div>
    </ContentCard>
  )
}

function PortfolioSummaryCards({
  portfolio,
  onSnapshot,
  isSaving,
}: {
  portfolio: PortfolioData
  onSnapshot: () => Promise<void>
  isSaving: boolean
}) {
  const cards = [
    { label: "Valeur placements", value: formatCurrency(portfolio.summary.totalInvestmentValue), icon: TrendingUp },
    { label: "Couverture assurance", value: formatCurrency(portfolio.summary.totalInsuranceCoverage), icon: ShieldCheck },
    { label: "Prime annuelle", value: formatCurrency(portfolio.summary.totalAnnualPremium), icon: ShieldCheck },
    { label: "Contributions mensuelles", value: formatCurrency(portfolio.summary.totalMonthlyContribution), icon: TrendingUp },
    { label: "Commissions estimées", value: formatCurrency(portfolio.summary.totalEstimatedCommission), icon: TrendingUp },
    { label: "Produits actifs", value: `${portfolio.summary.activeProductsCount}`, icon: ShieldCheck },
    { label: "Produits à réviser", value: `${portfolio.summary.productsNeedingReviewCount}`, icon: AlertTriangle },
    { label: "Documents manquants", value: `${portfolio.summary.missingDocumentsCount}`, icon: AlertTriangle },
  ]

  return (
    <ContentCard title="Résumé portefeuille">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{card.label}</p>
              <card.icon className="size-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>
      <Button className="mt-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void onSnapshot()} disabled={isSaving}>
        <Camera className="size-4" />
        {isSaving ? "Création..." : "Créer snapshot"}
      </Button>
    </ContentCard>
  )
}

function PortfolioAlertsPanel({ alerts }: { alerts: PortfolioAlert[] }) {
  return (
    <ContentCard title="Alertes et opportunités de suivi">
      {alerts.length === 0 ? (
        <EmptyLine>Aucune alerte importante pour ce portefeuille.</EmptyLine>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.slice(0, 8).map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={severityTone[alert.severity]}>{alert.severity}</StatusBadge>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">{alert.type}</span>
              </div>
              <p className="mt-3 font-semibold text-slate-950">{alert.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{alert.description}</p>
              <p className="mt-3 text-sm font-semibold text-emerald-700">{alert.actionLabel}</p>
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  )
}

function InsuranceCoverageSection({ products }: { products: Product[] }) {
  return (
    <ContentCard title="Protections d’assurance">
      <CardList
        items={products}
        empty="Aucune protection d’assurance enregistrée."
        render={(product) => (
          <ProductLine
            key={product.id}
            product={product}
            primary={formatCurrency(product.coverageAmount)}
            secondary={`Prime ${formatCurrency(product.premium)} ${formatFrequency(product.premiumFrequency)}`}
            detail={`Bénéficiaire: ${product.primaryBeneficiary ?? "Non défini"}`}
          />
        )}
      />
    </ContentCard>
  )
}

function InvestmentAccountsSection({ products }: { products: Product[] }) {
  return (
    <ContentCard title="Placements">
      <CardList
        items={products}
        empty="Aucun placement enregistré."
        render={(product) => (
          <ProductLine
            key={product.id}
            product={product}
            primary={formatCurrency(product.accountValue)}
            secondary={`Contribution ${formatCurrency(product.contributionAmount)} ${formatFrequency(product.contributionFrequency)}`}
            detail={`Révision: ${formatDate(product.nextReviewAt)}`}
          />
        )}
      />
    </ContentCard>
  )
}

function ContributionsSection({ products }: { products: Product[] }) {
  return (
    <ContentCard title="Contributions">
      <CardList
        items={products.filter((product) => product.contributionAmount)}
        empty="Aucune contribution périodique renseignée."
        render={(product) => (
          <ProductLine
            key={product.id}
            product={product}
            primary={formatCurrency(product.contributionAmount)}
            secondary={formatFrequency(product.contributionFrequency)}
            detail={product.company ?? "Institution non définie"}
          />
        )}
      />
    </ContentCard>
  )
}

function CommissionSummarySection({ products, total }: { products: Product[]; total: number }) {
  return (
    <ContentCard title={`Commissions estimées - ${formatCurrency(total)}`}>
      <CardList
        items={products.filter((product) => product.commissionAmount)}
        empty="Aucune commission estimée renseignée."
        render={(product) => (
          <ProductLine
            key={product.id}
            product={product}
            primary={formatCurrency(product.commissionAmount)}
            secondary="Estimation interne"
            detail={product.company ?? "Compagnie non définie"}
          />
        )}
      />
    </ContentCard>
  )
}

function UpcomingRenewalsList({ products }: { products: Product[] }) {
  return (
    <ContentCard title="Calendrier portefeuille">
      <CardList
        items={products}
        empty="Aucun renouvellement dans les 90 prochains jours."
        render={(product) => (
          <ProductLine
            key={product.id}
            product={product}
            primary={formatDate(product.renewalAt)}
            secondary="Renouvellement"
            detail={product.company ?? "Compagnie non définie"}
          />
        )}
      />
    </ContentCard>
  )
}

function PortfolioSnapshotsChart({ snapshots }: { snapshots: PortfolioData["snapshots"] }) {
  const maxValue = Math.max(...snapshots.map((snapshot) => snapshot.totalInvestmentValue), 1)

  return (
    <ContentCard title="Historique de valeur">
      {snapshots.length === 0 ? (
        <EmptyLine>Aucun snapshot. Créez un snapshot pour commencer l’historique.</EmptyLine>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">{formatDate(snapshot.snapshotDate)}</span>
                <span className="text-slate-500">{formatCurrency(snapshot.totalInvestmentValue)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${(snapshot.totalInvestmentValue / maxValue) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  )
}

function PortfolioDocumentsStatus({ documents }: { documents: PortfolioData["documents"] }) {
  return (
    <ContentCard title="Documents liés">
      <CardList
        items={documents}
        empty="Aucun document lié au dossier."
        render={(document) => (
          <div key={document.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">{document.name}</p>
            <p className="mt-1 text-sm text-slate-600">{document.type} - {document.status}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(document.createdAt)}</p>
          </div>
        )}
      />
    </ContentCard>
  )
}

function ProductLine({
  product,
  primary,
  secondary,
  detail,
}: {
  product: Product
  primary: string
  secondary: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{financialProductTypeLabels[product.type] ?? product.type}</p>
          <p className="mt-1 text-sm text-slate-600">{product.company ?? "Compagnie non définie"} - {product.productName ?? "Produit sans nom"}</p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="shrink-0 text-sm sm:text-right">
          <p className="font-semibold text-slate-950">{primary}</p>
          <p className="mt-1 text-slate-500">{secondary}</p>
          <StatusBadge tone={product.status === "ACTIVE" ? "emerald" : product.status === "UNDER_REVIEW" ? "amber" : "slate"}>
            {statusLabel(product.status)}
          </StatusBadge>
        </div>
      </div>
    </div>
  )
}

function CardList<T>({
  items,
  empty,
  render,
}: {
  items: T[]
  empty: string
  render: (item: T) => ReactNode
}) {
  if (items.length === 0) return <EmptyLine>{empty}</EmptyLine>
  return <div className="space-y-3">{items.map(render)}</div>
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {children}
    </div>
  )
}
