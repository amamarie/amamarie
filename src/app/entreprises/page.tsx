import Link from "next/link"
import { AlertTriangle, Building2, CheckCircle2, FileCheck2, ShieldCheck, type LucideIcon } from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const businessProfileTypes = ["BUSINESS", "TRUST", "ESTATE", "NON_PROFIT"]

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non renseigné"
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

function isBusinessClient(client: {
  profileType: string | null
  isSelfEmployed: boolean
  employer: string | null
  kybProfile: unknown
}) {
  return Boolean(client.kybProfile) || businessProfileTypes.includes(client.profileType ?? "") || client.isSelfEmployed || /inc|sarl|sas|sasu|soci[eé]t[eé]|entreprise|cabinet|conseil/i.test(client.employer ?? "")
}

function kybTone(score?: number | null): "emerald" | "amber" | "rose" | "sky" {
  if (typeof score !== "number") return "sky"
  if (score >= 75) return "emerald"
  if (score >= 45) return "amber"
  return "rose"
}

export default async function BusinessClientsPage() {
  const { organizationId } = await getTenantContext()
  const allClients = await prisma.client.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileType: true,
      isSelfEmployed: true,
      employer: true,
      occupation: true,
      annualIncome: true,
      nextReviewDate: true,
      advisor: { select: { name: true } },
      products: { select: { accountValue: true, coverageAmount: true, status: true } },
      documents: { select: { status: true } },
      kybProfile: {
        select: {
          status: true,
          subjectType: true,
          legalName: true,
          tradeName: true,
          entityType: true,
          industry: true,
          jurisdiction: true,
          registrationNumber: true,
          annualRevenue: true,
          businessActivity: true,
          employeeCount: true,
          beneficialOwnersDocumented: true,
          corporateDocumentsCollected: true,
          kybScore: true,
          nextReviewAt: true,
        },
      },
      amlProfile: { select: { riskLevel: true, beneficialOwnershipStatus: true, sanctionsStatus: true, pepStatus: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  })
  const businessClients = allClients.filter(isBusinessClient)
  const kybRequired = businessClients.filter((client) => !client.kybProfile || (client.kybProfile.kybScore ?? 0) < 75).length
  const beneficialMissing = businessClients.filter((client) => client.kybProfile && !client.kybProfile.beneficialOwnersDocumented).length
  const corporateDocsMissing = businessClients.filter((client) => client.kybProfile && !client.kybProfile.corporateDocumentsCollected).length

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Entreprises"
        description="Vue dédiée aux clients professionnels : profil entreprise, KYB, bénéficiaires effectifs, documents corporatifs, contrats et risques."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Building2} label="Entreprises" value={String(businessClients.length)} detail="Clients professionnels détectés" />
          <Metric icon={ShieldCheck} label="KYB à compléter" value={String(kybRequired)} detail="Score inférieur à 75 % ou absent" />
          <Metric icon={AlertTriangle} label="Bénéficiaires" value={String(beneficialMissing)} detail="Effectifs non documentés" />
          <Metric icon={FileCheck2} label="Docs corporatifs" value={String(corporateDocsMissing)} detail="Documents à collecter" />
        </div>

        <ContentCard title="Dossiers entreprises" description="Les données proviennent des fiches clients, du KYB et de l’AML existants.">
          {businessClients.length === 0 ? (
            <EmptyState text="Aucun client entreprise détecté. Renseignez le type de dossier Entreprise / société ou créez un profil KYB depuis une fiche client." />
          ) : (
            <div className="grid gap-3">
              {businessClients.map((client) => {
                const kyb = client.kybProfile
                const totalAssets = client.products.reduce((sum, product) => sum + (product.accountValue ?? 0), 0)
                const totalCoverage = client.products.reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0)

                return (
                  <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={kybTone(kyb?.kybScore)}>KYB {kyb ? `${kyb.kybScore} %` : "à créer"}</StatusBadge>
                          <StatusBadge tone={client.amlProfile?.riskLevel === "HIGH" ? "rose" : "slate"}>AML {client.amlProfile?.riskLevel ?? "Non évalué"}</StatusBadge>
                          {kyb?.beneficialOwnersDocumented ? <StatusBadge tone="emerald">Bénéficiaires OK</StatusBadge> : <StatusBadge tone="amber">Bénéficiaires à vérifier</StatusBadge>}
                        </div>
                        <h2 className="mt-3 text-lg font-black text-slate-950">{kyb?.legalName ?? kyb?.tradeName ?? client.employer ?? clientName(client)}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Contact: {clientName(client)} · Activité: {kyb?.industry ?? kyb?.businessActivity ?? client.occupation ?? "À renseigner"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Conseiller: {client.advisor?.name ?? "Non assigné"} · Juridiction: {kyb?.jurisdiction ?? "Non renseignée"} · Revue: {formatDate(kyb?.nextReviewAt ?? client.nextReviewDate)}
                        </p>
                      </div>
                      <Link href={`/clients/${client.id}?tab=compliance`} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                        Ouvrir KYB
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                      <Info label="Type" value={kyb?.entityType ?? client.profileType ?? "Entreprise"} />
                      <Info label="Immatriculation" value={kyb?.registrationNumber ?? "À renseigner"} />
                      <Info label="Revenus" value={formatMoney(kyb?.annualRevenue ?? client.annualIncome)} />
                      <Info label="Employés" value={kyb?.employeeCount ? String(kyb.employeeCount) : "Non renseigné"} />
                      <Info label="Contrats" value={`${client.products.length} produit(s)`} />
                      <Info label="Encours" value={formatMoney(totalAssets)} />
                      <Info label="Protection" value={formatMoney(totalCoverage)} />
                      <Info label="Documents" value={kyb?.corporateDocumentsCollected ? "Collectés" : "À collecter"} />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Contrôles requis" description="Points attendus pour un dossier entreprise exploitable.">
          <div className="grid gap-3 md:grid-cols-4">
            {["Profil KYB créé", "Bénéficiaires effectifs", "Documents corporatifs", "Revue AML"].map((label) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className="size-5 text-emerald-700" />
                <p className="mt-3 font-black text-slate-950">{label}</p>
              </div>
            ))}
          </div>
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-[0_6px_0_#bae6fd]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-sky-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
