import Link from "next/link"
import {
  Activity,
  BarChart3,
  Building2,
  Gauge,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { DeveloperHeader, StatusPill } from "@/components/developer/DeveloperChrome"
import { DeveloperCabinetSelector } from "@/components/developer/DeveloperCabinetSelector"
import { PublicPricingModeForm } from "@/components/developer/PublicPricingModeForm"
import { organizationTypes } from "@/lib/billing/plans"
import { requireSaasRole } from "@/lib/auth/roles"
import { offerableSubscriptionPlanKeys, subscriptionPlans } from "@/lib/billing/plans"
import {
  formatAuditAction,
  formatCurrencyAmount,
  formatShortDate,
  getAverageHealth,
  getDeveloperConsoleData,
} from "@/lib/developer-console"
import { getPublicPricingMode } from "@/lib/platform-settings"

import { updatePublicPricingMode } from "./actions"

type DeveloperConsolePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DeveloperConsolePage({ searchParams }: DeveloperConsolePageProps) {
  const user = await requireSaasRole(["DEVELOPER"])
  const params = await searchParams
  const selectedCabinetId = typeof params?.cabinetId === "string" ? params.cabinetId : undefined
  const publicPricingMode = await getPublicPricingMode()
  const {
    accountRecords,
    activeRecords,
    suspendedRecords,
    atRiskRecords,
    customAccessRecords,
    totalSeatsUsed,
    totalSeatLimit,
    totalContacts,
    revenueByCurrency,
    recentAuditLogs,
    workflowRuntime,
  } = await getDeveloperConsoleData()

  const planDistribution = offerableSubscriptionPlanKeys.map((key) => ({
    key,
    label: subscriptionPlans[key].label,
    count: accountRecords.filter((record) => record.plan === key).length,
  }))
  const selectedRecord =
    accountRecords.find((record) => record.organization.id === selectedCabinetId) ??
    atRiskRecords[0] ??
    accountRecords[0]
  const cabinetOptions = accountRecords.map((record) => ({
    id: record.organization.id,
    name: record.organization.name,
    detail: `${subscriptionPlans[record.plan].label} · ${record.healthScore}% santé`,
    searchText: [
      record.organization.name,
      record.organization.legalName,
      record.organization.city,
      record.organization.region,
      record.organization.country,
      subscriptionPlans[record.plan].label,
      organizationTypes[record.organizationType].label,
      record.status,
      ...record.teamMembers.map((member) => `${member.name} ${member.email} ${member.role}`),
    ].filter(Boolean).join(" "),
  }))

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="vue" />

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                  <Sparkles className="size-4" aria-hidden="true" />
                  CRM développeur
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pilotage SaaS FinAssuro</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Vue compacte des cabinets, accès, santé produit, forfaits et activité technique. Les détails sont séparés par page.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <NavCard href="/developpeur/api" icon={TerminalSquare} title="API" text="Clés, webhooks, sandbox" />
                <NavCard href="/developpeur/cabinets" icon={Building2} title="Cabinets" text="Forfaits et accès" />
                <NavCard href="/developpeur/journal" icon={Activity} title="Journal" text="Audit et événements" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Building2} label="Cabinets actifs" value={`${activeRecords.length}/${accountRecords.length}`} detail={`${suspendedRecords.length} suspendu(s)`} tone="violet" />
              <MetricCard icon={UsersRound} label="Sièges utilisés" value={`${totalSeatsUsed}/${Math.max(totalSeatLimit, 1)}`} detail="Conseillers, assistants, conformité" tone="emerald" />
              <MetricCard icon={BarChart3} label="Revenu mensuel récurrent estimé" value={`${formatCurrencyAmount(revenueByCurrency.EUR, "EUR")} · ${formatCurrencyAmount(revenueByCurrency.CAD, "CAD")}`} detail="Hors offres sur devis" tone="amber" />
              <MetricCard icon={ShieldAlert} label="À surveiller" value={String(atRiskRecords.length)} detail={`${customAccessRecords.length} accès personnalisé(s)`} tone={atRiskRecords.length > 0 ? "rose" : "emerald"} />
            </div>
          </div>

          <PublicPricingModeForm initialMode={publicPricingMode} updateAction={updatePublicPricingMode} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.74fr)_minmax(320px,0.36fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Portefeuille</p>
                <h2 className="mt-1 text-lg font-semibold">Résumé cabinets</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{totalContacts} contacts suivis</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {planDistribution.map((item) => (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.count}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Gauge className="size-5 text-violet-700" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Santé produit</h2>
            </div>
            <div className="mt-4 grid gap-2">
              <PriorityLine label="Santé moyenne" value={`${getAverageHealth(accountRecords)} %`} tone="emerald" />
              <PriorityLine label="Workflows serveur" value={workflowRuntime.configured ? "Branchés" : "À configurer"} tone={workflowRuntime.configured ? "emerald" : "amber"} />
              <PriorityLine label="Mots de passe à créer" value={String(accountRecords.reduce((total, record) => total + record.missingPasswordCount, 0))} tone="amber" />
              <PriorityLine label="Modules personnalisés" value={String(customAccessRecords.length)} tone="violet" />
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Cabinet conseiller</p>
              <h2 className="mt-1 text-lg font-semibold">Sélection rapide</h2>
            </div>
            <Link href="/developpeur/cabinets" className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">
              Gérer le cabinet
            </Link>
          </div>
          <DeveloperCabinetSelector options={cabinetOptions} selectedId={selectedRecord?.organization.id} />
          {selectedRecord ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MiniFact label="Cabinet" value={selectedRecord.organization.name} />
              <MiniFact label="Forfait" value={subscriptionPlans[selectedRecord.plan].label} />
              <MiniFact label="Sièges" value={`${selectedRecord.seatsUsed}/${selectedRecord.organization.advisorSeatLimit}`} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Santé</p>
                <div className="mt-1">
                  <StatusPill tone={selectedRecord.healthScore >= 85 ? "emerald" : selectedRecord.healthScore >= 65 ? "amber" : "rose"}>{selectedRecord.healthScore}%</StatusPill>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Journal récent</h2>
            <Link href="/developpeur/journal" className="text-sm font-semibold text-violet-700 hover:text-violet-900">Voir tout</Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {recentAuditLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{formatAuditAction(log.action)}</p>
                <p className="mt-1 text-xs text-slate-500">{log.organization.name} · {formatShortDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

function NavCard({ href, icon: Icon, title, text }: { href: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 shadow-[0_3px_0_#e2e8f0] transition hover:bg-slate-50">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      <span className="mt-2 block text-sm font-semibold text-slate-950">{title}</span>
      <span className="block text-xs text-slate-500">{text}</span>
    </Link>
  )
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: "emerald" | "rose" | "amber" | "violet" | "slate" }) {
  const iconClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className={`inline-flex size-9 items-center justify-center rounded-xl ${iconClasses[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}

function PriorityLine({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "amber" | "violet" | "slate" }) {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{value}</span>
    </div>
  )
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}
