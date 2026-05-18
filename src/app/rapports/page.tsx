import { BarChart3, ClipboardCheck, FileCheck2, HeartPulse, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { ContentCard, MetricGrid, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const openAnalysisStatuses = [
  "DRAFT",
  "MISSING_DATA",
  "IN_ANALYSIS",
  "ADVISOR_REVIEW",
  "RECOMMENDATION_PREPARED",
  "WAITING_CLIENT",
  "NEEDS_UPDATE",
] as const

const analysisTypeLabels: Record<string, string> = {
  LIFE: "Assurance vie",
  DISABILITY: "Invalidité",
  CRITICAL_ILLNESS: "Maladies graves",
  BUSINESS: "Entreprise",
  REPLACEMENT: "Remplacement",
}

const analysisStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  MISSING_DATA: "Données manquantes",
  IN_ANALYSIS: "En analyse",
  ADVISOR_REVIEW: "Révision conseiller",
  RECOMMENDATION_PREPARED: "Recommandation préparée",
  WAITING_CLIENT: "En attente client",
  COMPLETED: "Complétée",
  DELIVERED: "Remise au client",
  USED_FOR_SUBMISSION: "Utilisée pour soumission",
  NEEDS_UPDATE: "À mettre à jour",
  ARCHIVED: "Archivée",
  NOT_STARTED: "Non commencée",
}

function formatMoney(value?: number | { toNumber: () => number } | null) {
  const amount = typeof value === "number" ? value : value?.toNumber()
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "Non calculé"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

export default async function ReportsPage() {
  const { organizationId } = await getTenantContext()

  const [reportsGenerated, analysesToFinalize, reportsDelivered, recommendationsLinked, recentReports, analysesWithoutReports] = await Promise.all([
    prisma.insuranceNeedsAnalysis.count({ where: { organizationId, reportDocumentId: { not: null } } }),
    prisma.insuranceNeedsAnalysis.count({ where: { organizationId, status: { in: [...openAnalysisStatuses] } } }),
    prisma.insuranceNeedsAnalysis.count({ where: { organizationId, status: { in: ["DELIVERED", "USED_FOR_SUBMISSION"] } } }),
    prisma.insuranceNeedsAnalysis.count({ where: { organizationId, usedForRecommendation: true } }),
    prisma.insuranceNeedsAnalysis.findMany({
      where: { organizationId, reportDocumentId: { not: null } },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        reportDocument: { select: { id: true, name: true, status: true, updatedAt: true } },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
        recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    prisma.insuranceNeedsAnalysis.findMany({
      where: { organizationId, status: { in: [...openAnalysisStatuses] }, reportDocumentId: null },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
  ])

  const metrics = [
    {
      label: "Rapports générés",
      value: String(reportsGenerated),
      detail: "PDF archivés au dossier client",
      icon: FileCheck2,
      tone: "emerald" as const,
    },
    {
      label: "Analyses à finaliser",
      value: String(analysesToFinalize),
      detail: "Calcul, revue ou rapport requis",
      icon: HeartPulse,
      tone: analysesToFinalize > 0 ? "amber" as const : "emerald" as const,
    },
    {
      label: "Rapports remis",
      value: String(reportsDelivered),
      detail: "Preuve de remise ou usage en soumission",
      icon: ClipboardCheck,
      tone: "sky" as const,
    },
    {
      label: "Liés à une reco",
      value: String(recommendationsLinked),
      detail: "Analyses utilisées pour recommandation",
      icon: ShieldCheck,
      tone: "violet" as const,
    },
  ]

  return (
    <AppShell moduleKey="reports">
      <PageShell
        eyebrow="Rapports"
        title="Rapports d’analyse et preuves au dossier"
        description="Suivez les rapports d’analyse des besoins générés, les analyses sans rapport et les documents à remettre au client avant recommandation."
      >
        <MetricGrid metrics={metrics} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <ContentCard title="Rapports d’analyse récents" description="Documents PDF générés depuis le module Analyse des besoins.">
            {recentReports.length === 0 ? (
              <EmptyLine text="Aucun rapport d’analyse n’a encore été généré." />
            ) : (
              <div className="grid gap-3">
                {recentReports.map((analysis) => {
                  const result = analysis.results[0]
                  const recommendation = analysis.recommendations[0]

                  return (
                    <article key={analysis.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone="violet">{analysisTypeLabels[analysis.analysisType] ?? analysis.analysisType}</StatusBadge>
                            <StatusBadge tone="emerald">Rapport classé</StatusBadge>
                            <StatusBadge tone="slate">{analysisStatusLabels[analysis.status] ?? analysis.status}</StatusBadge>
                          </div>
                          <h2 className="mt-3 text-base font-black text-slate-950">{analysis.reportDocument?.name ?? "Rapport d’analyse"}</h2>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {clientName(analysis.client)} · Écart estimé {formatMoney(result?.gapAmount)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            Montant recommandé: {formatMoney(recommendation?.recommendedAmount)} · Mis à jour le {formatDate(analysis.reportDocument?.updatedAt ?? analysis.updatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {analysis.reportDocument ? (
                            <Link className="rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700" href={`/documents/${analysis.reportDocument.id}`}>
                              Voir PDF
                            </Link>
                          ) : null}
                          <Link className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800" href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`}>
                            Ouvrir analyse
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Rapports à produire" description="Analyses ouvertes sans preuve PDF.">
            {analysesWithoutReports.length === 0 ? (
              <EmptyLine text="Aucune analyse ouverte sans rapport." />
            ) : (
              <div className="grid gap-3">
                {analysesWithoutReports.map((analysis) => (
                  <Link
                    key={analysis.id}
                    href={`/clients/${analysis.client.id}?tab=needs&analysisId=${analysis.id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-200 hover:bg-amber-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{clientName(analysis.client)}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{analysisTypeLabels[analysis.analysisType] ?? analysis.analysisType}</p>
                      </div>
                      <StatusBadge tone={analysis.status === "MISSING_DATA" ? "amber" : "sky"}>{analysisStatusLabels[analysis.status] ?? analysis.status}</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      Écart actuel: {formatMoney(analysis.results[0]?.gapAmount)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>
        </div>

        <ContentCard title="Chaîne de preuve" description="Le rapport doit rester relié au client, au profil client, à l’analyse, à la recommandation et à l’audit trail.">
          <div className="grid gap-3 md:grid-cols-5">
            {["Profil client", "Analyse", "Rapport PDF", "Recommandation", "Audit trail"].map((step, index) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Étape {index + 1}</p>
                <p className="mt-2 font-black text-slate-950">{step}</p>
              </div>
            ))}
          </div>
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
      <BarChart3 className="mb-3 size-5 text-slate-400" />
      {text}
    </div>
  )
}
