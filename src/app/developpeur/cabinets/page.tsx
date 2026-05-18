import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  LockKeyhole,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { DeveloperCabinetSelector } from "@/components/developer/DeveloperCabinetSelector"
import { OrganizationAccessForm } from "@/components/developer/OrganizationAccessForm"
import { requireSaasRole } from "@/lib/auth/roles"
import {
  getSubscriptionPriceSummary,
  moduleCatalog,
  organizationTypes,
  subscriptionPlans,
  subscriptionPricingModes,
  subscriptionStatuses,
} from "@/lib/billing/plans"
import {
  TEMPORARY_ADVISOR_PASSWORD,
  formatCurrencyAmount,
  formatShortDate,
  getDeveloperConsoleData,
} from "@/lib/developer-console"

import { resetUserPassword, updateOrganizationAccess } from "../actions"

type DeveloperCabinetsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DeveloperCabinetsPage({ searchParams }: DeveloperCabinetsPageProps) {
  const user = await requireSaasRole(["DEVELOPER"])
  const params = await searchParams
  const passwordReset = typeof params?.passwordReset === "string" ? params.passwordReset : undefined
  const accessStatus = typeof params?.access === "string" ? params.access : undefined
  const selectedCabinetId = typeof params?.cabinetId === "string" ? params.cabinetId : undefined
  const {
    accountRecords,
    activeRecords,
    atRiskRecords,
    customAccessRecords,
    revenueByCurrency,
    totalSeatsUsed,
    totalSeatLimit,
    planPriceOverrides,
  } = await getDeveloperConsoleData({ auditLimit: 4 })
  const selectedRecord =
    accountRecords.find((record) => record.organization.id === selectedCabinetId) ??
    atRiskRecords[0] ??
    accountRecords[0]
  const cabinetOptions = accountRecords.map((record) => ({
    id: record.organization.id,
    name: record.organization.name,
    detail: `${subscriptionPlans[record.plan].label} · ${record.seatsUsed}/${record.organization.advisorSeatLimit} siège(s)`,
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
      <DeveloperHeader userName={user.name} active="cabinets" />

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="CRM développeur"
          title="Cabinets, forfaits et accès"
          description="Ajuste les forfaits attribués aux cabinets. Le type d’organisation, les modules conseillers, les sièges et la visibilité fonctionnelle suivent le forfait sauvegardé."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryBadge icon={Building2} label="Cabinets actifs" value={`${activeRecords.length}/${accountRecords.length}`} />
            <SummaryBadge icon={ShieldAlert} label="À vérifier" value={String(atRiskRecords.length)} />
          </div>
        </PageIntro>

        {passwordReset ? (
          <div className={`mt-4 rounded-2xl border p-4 shadow-sm ${passwordReset === "forbidden" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex items-start gap-3">
              {passwordReset === "forbidden" ? <AlertTriangle className="mt-0.5 size-5 text-rose-700" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" aria-hidden="true" />}
              <div>
                <p className={`font-semibold ${passwordReset === "forbidden" ? "text-rose-950" : "text-emerald-950"}`}>
                  {passwordReset === "forbidden" ? "Réinitialisation refusée" : "Mot de passe réinitialisé"}
                </p>
                <p className={`mt-1 text-sm leading-6 ${passwordReset === "forbidden" ? "text-rose-800" : "text-emerald-800"}`}>
                  {passwordReset === "forbidden"
                    ? "Ce compte ne peut pas recevoir un mot de passe conseiller interne."
                    : `${passwordReset} peut se connecter avec le mot de passe temporaire : ${TEMPORARY_ADVISOR_PASSWORD}`}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {accessStatus ? (
          <div className={`mt-4 rounded-2xl border p-4 shadow-sm ${accessStatus === "invalid" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex items-start gap-3">
              {accessStatus === "invalid" ? <AlertTriangle className="mt-0.5 size-5 text-rose-700" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" aria-hidden="true" />}
              <div>
                <p className={`font-semibold ${accessStatus === "invalid" ? "text-rose-950" : "text-emerald-950"}`}>
                  {accessStatus === "plan-applied" ? "Forfait appliqué" : accessStatus === "updated" ? "Forfait enregistré" : "Mise à jour impossible"}
                </p>
                <p className={`mt-1 text-sm leading-6 ${accessStatus === "invalid" ? "text-rose-800" : "text-emerald-800"}`}>
                  {accessStatus === "plan-applied"
                    ? "Le cabinet utilise maintenant les sièges et modules par défaut du forfait choisi."
                    : accessStatus === "updated"
                      ? "Les paramètres du cabinet ont été sauvegardés."
                      : "Aucun cabinet valide n’a été transmis pour cette modification."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <KpiCard label="Sièges utilisés" value={`${totalSeatsUsed}/${Math.max(totalSeatLimit, 1)}`} detail="Conseillers et assistants" />
          <KpiCard label="Revenu mensuel EUR" value={formatCurrencyAmount(revenueByCurrency.EUR, "EUR")} detail="Forfaits actifs" />
          <KpiCard label="Revenu mensuel CAD" value={formatCurrencyAmount(revenueByCurrency.CAD, "CAD")} detail="Conversion commerciale" />
          <KpiCard label="Accès personnalisés" value={String(customAccessRecords.length)} detail="Modules hors forfait" />
        </div>

        <SectionCard
          title="Portefeuille cabinets"
          eyebrow="Gestion opérationnelle"
          action={<StatusPill tone={atRiskRecords.length > 0 ? "amber" : "emerald"}>{atRiskRecords.length} alerte(s)</StatusPill>}
          className="mt-4"
        >
          <DeveloperCabinetSelector options={cabinetOptions} selectedId={selectedRecord?.organization.id} />

          {selectedRecord ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)]">
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-slate-500">Cabinet sélectionné</p>
                      <h3 className="mt-1 truncate text-xl font-semibold text-slate-950">{selectedRecord.organization.name}</h3>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {organizationTypes[selectedRecord.organizationType].label} · mis à jour le {formatShortDate(selectedRecord.organization.updatedAt)}
                      </p>
                    </div>
                    <StatusPill tone={selectedRecord.healthScore >= 85 ? "emerald" : selectedRecord.healthScore >= 65 ? "amber" : "rose"}>{selectedRecord.healthScore}%</StatusPill>
                  </div>
                  <Link
                    href={`/developpeur/cabinets/${selectedRecord.organization.id}`}
                    className="mt-4 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Ouvrir la fiche 360
                  </Link>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Fact label="Forfait" value={subscriptionPlans[selectedRecord.plan].label} />
                    <Fact label="Offre" value={subscriptionPricingModes[selectedRecord.pricingMode]} />
                    <Fact label="Prix" value={getSubscriptionPriceSummary(selectedRecord.plan, selectedRecord.pricingMode, selectedRecord.currency, planPriceOverrides)} />
                    <Fact label="Statut" value={subscriptionStatuses[selectedRecord.status]} />
                    <Fact label="Sièges" value={`${selectedRecord.seatsUsed}/${selectedRecord.organization.advisorSeatLimit}`} />
                    <Fact label="Contacts" value={`${selectedRecord.organization._count.clients + selectedRecord.organization._count.leads}`} />
                    <Fact label="Documents" value={`${selectedRecord.organization._count.documents}`} />
                    <Fact label="Tâches" value={`${selectedRecord.organization._count.tasks}`} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Équipe</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedRecord.teamMembers.length} utilisateur(s)</h3>
                    </div>
                    {selectedRecord.seatLimitExceeded ? <StatusPill tone="rose">Limite dépassée</StatusPill> : <StatusPill tone="emerald">OK</StatusPill>}
                  </div>
                  <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                    {selectedRecord.teamMembers.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{member.name}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{member.email} · {member.role}</p>
                          </div>
                          <StatusPill tone={member.internalCredential ? "emerald" : "amber"}>
                            {member.internalCredential ? "Mot de passe actif" : "À créer"}
                          </StatusPill>
                        </div>
                        <form action={resetUserPassword} className="mt-3">
                          <input type="hidden" name="userId" value={member.id} />
                          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                            <LockKeyhole className="size-4" aria-hidden="true" />
                            Réinitialiser
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Modules actifs</p>
                  <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                    {selectedRecord.includedModules.map((moduleKey) => (
                      <span key={moduleKey} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {moduleCatalog.find((module) => module.key === moduleKey)?.label ?? moduleKey}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <OrganizationAccessForm
                organizationId={selectedRecord.organization.id}
                initialPlan={selectedRecord.plan}
                initialStatus={selectedRecord.status}
                initialPricingMode={selectedRecord.pricingMode}
                initialCurrency={selectedRecord.currency}
                initialSeatLimit={selectedRecord.organization.advisorSeatLimit}
                initialModules={selectedRecord.includedModules}
                updateAction={updateOrganizationAccess}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Aucun cabinet conseiller disponible.
            </div>
          )}
        </SectionCard>
      </section>
    </main>
  )
}

function SummaryBadge({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 shadow-[0_3px_0_#e2e8f0]">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function KpiCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}
