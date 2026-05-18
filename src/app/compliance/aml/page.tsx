import Link from "next/link"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { getAmlDashboard } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { AmlCabinetActions } from "./AmlCabinetActions"

function tone(value: string) {
  if (["CRITICAL", "HIGH", "CONFIRMED_MATCH", "BLOCKED"].includes(value)) return "rose"
  if (["IMPORTANT", "MEDIUM", "POTENTIAL_MATCH", "COMPLIANCE_REVIEW"].includes(value)) return "amber"
  if (["LOW", "NO_MATCH", "ACTIVE", "RESOLVED", "CLOSED"].includes(value)) return "emerald"
  return "slate"
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

export default async function AmlCompliancePage() {
  const { organizationId } = await getTenantContext()
  const [dashboard, profiles, reports, monitoringEvents, rules] = await Promise.all([
    getAmlDashboard({ organizationId }),
    prisma.amlProfile.findMany({
      where: { organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, profileType: true } },
        alerts: { where: { status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } }, orderBy: { createdAt: "desc" }, take: 5 },
        scoreComponents: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.amlInternalReport.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.amlMonitoringEvent.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.amlRiskRule.findMany({
      where: { organizationId },
      orderBy: [{ category: "asc" }, { ruleKey: "asc" }],
      take: 100,
    }),
  ])

  const metrics = dashboard.metrics

  return (
    <PageShell
      eyebrow="Conformité"
      title="AML / LBA-FAT & sanctions"
      description="Vue cabinet des vérifications d’identité, sources des fonds, PPV/DOI, sanctions, bénéficiaires effectifs, alertes et déclarations internes."
    >
      <AmlCabinetActions />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Clients risque élevé" value={metrics.highRiskClients} detail="Surveillance renforcée" />
        <Metric label="Sanctions potentielles" value={metrics.potentialSanctions} detail="Blocage et revue" />
        <Metric label="PPV / DOI à revoir" value={metrics.pepToReview} detail="Revue haute direction" />
        <Metric label="Sources fonds manquantes" value={metrics.fundsMissing} detail="Preuve ou justification" />
        <Metric label="Bénéficiaires incomplets" value={metrics.beneficialIncomplete} detail="Clients entreprises" />
        <Metric label="Déclarations ouvertes" value={metrics.reportsOpen} detail="Dossiers internes" />
        <Metric label="Revues requises" value={metrics.reviewsRequired} detail="Responsable conformité" />
        <Metric label="Surveillance ouverte" value={metrics.monitoringEventsOpen} detail="Événements à revoir" />
      </section>

      <ContentCard title="Alertes AML ouvertes" description="Alertes bloquantes ou importantes à résoudre avant progression des dossiers.">
        <div className="grid gap-3">
          {dashboard.alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{alert.message}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{alert.clientName} · {alert.alertType}</p>
                  <Link href={`/clients/${alert.clientId}?tab=compliance`} className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:text-emerald-800">
                    Ouvrir le dossier AML
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={tone(alert.severity)}>{alert.severity}</StatusBadge>
                  {alert.blocking ? <StatusBadge tone="rose">Bloquant</StatusBadge> : null}
                </div>
              </div>
            </div>
          ))}
          {dashboard.alerts.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune alerte AML ouverte.</p> : null}
        </div>
      </ContentCard>

      <ContentCard title="Profils AML clients" description="Score explicable faible / moyen / élevé, statuts des contrôles et prochaine revue.">
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{profile.client.firstName} {profile.client.lastName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Score {profile.riskScore} · {profile.riskRationale}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Prochaine revue : {formatDate(profile.nextReviewAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={tone(profile.riskLevel)}>{profile.riskLevel}</StatusBadge>
                  <StatusBadge tone={tone(profile.status)}>{profile.status}</StatusBadge>
                  {profile.enhancedMonitoring ? <StatusBadge tone="rose">Contrôle renforcé</StatusBadge> : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <SmallStatus label="Identité" value={profile.identityStatus} />
                <SmallStatus label="Fonds" value={profile.sourceOfFundsStatus} />
                <SmallStatus label="Richesse" value={profile.sourceOfWealthStatus} />
                <SmallStatus label="Tiers" value={profile.thirdPartyStatus} />
                <SmallStatus label="PPV / DOI" value={profile.pepStatus} />
                <SmallStatus label="Sanctions" value={profile.sanctionsStatus} />
              </div>
            </div>
          ))}
          {profiles.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucun profil AML encore créé.</p> : null}
        </div>
      </ContentCard>

      <ContentCard title="Déclarations internes AML" description="Dossiers d’analyse interne avant décision humaine et, si applicable, préparation d’une déclaration externe.">
        <div className="grid gap-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{report.reportType} · {report.client.firstName} {report.client.lastName}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{report.facts ?? report.context ?? "Analyse interne AML à documenter."}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Créé le {formatDate(report.createdAt)} · FINTRAC/CANAFE : {report.submittedToFintrac ? report.fintracReference ?? "soumis" : "non soumis"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={tone(report.status)}>{report.status}</StatusBadge>
                  <StatusBadge tone={tone(report.decision)}>{report.decision}</StatusBadge>
                </div>
              </div>
            </div>
          ))}
          {reports.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune déclaration interne AML.</p> : null}
        </div>
      </ContentCard>

      <ContentCard title="Surveillance continue AML" description="Événements détectés ou ajoutés manuellement : nouveaux fonds, pays à risque, tiers, opérations inhabituelles ou changement de profil.">
        <div className="grid gap-3">
          {monitoringEvents.map((event) => (
            <div key={event.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{event.eventTitle}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{event.client.firstName} {event.client.lastName} · {event.eventType}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{event.description ?? "Événement AML à documenter ou résoudre."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={tone(event.status)}>{event.status}</StatusBadge>
                  <StatusBadge tone={event.riskImpact >= 8 ? "rose" : event.riskImpact >= 5 ? "amber" : "slate"}>Impact +{event.riskImpact}</StatusBadge>
                </div>
              </div>
            </div>
          ))}
          {monitoringEvents.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucun événement de surveillance continue.</p> : null}
        </div>
      </ContentCard>

      <ContentCard title="Règles AML configurées" description="Règles cabinet utilisées pour créer les alertes, blocages et impacts de score AML.">
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{rule.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{rule.ruleKey} · {rule.category}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={rule.enabled ? "emerald" : "slate"}>{rule.enabled ? "Actif" : "Désactivé"}</StatusBadge>
                  {rule.blocking ? <StatusBadge tone="rose">Bloquant</StatusBadge> : null}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{rule.description ?? "Règle AML configurable."}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">Sévérité {rule.severity} · impact score +{rule.scoreImpact}</p>
            </div>
          ))}
          {rules.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune règle AML. Utilise “Installer règles” pour créer la base standard.</p> : null}
        </div>
      </ContentCard>
    </PageShell>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  )
}

function SmallStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  )
}
