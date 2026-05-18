import Link from "next/link"
import {
  AlertTriangle,
  Database,
  FileWarning,
  Fingerprint,
  PackageSearch,
  SearchCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { financialProductTypeLabels } from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function normalizeEmail(value?: string | null) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizePhone(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function duplicateGroups<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    if (!key) continue
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return Array.from(groups.entries()).filter(([, group]) => group.length > 1)
}

export default async function DataQualityPage() {
  const { organizationId } = await getTenantContext()

  const [clients, leads, products, documents] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailPrimary: true,
        phone: true,
        phonePrimary: true,
        advisorId: true,
        status: true,
        kycCompleted: true,
        identityVerified: true,
        consentGiven: true,
        advisor: { select: { name: true } },
        documents: {
          select: { id: true, status: true, type: true, isRequired: true },
        },
        products: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.lead.findMany({
      where: { organizationId, status: { notIn: ["ARCHIVED", "LOST"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        advisorId: true,
        status: true,
        advisor: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.financialProduct.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        type: true,
        status: true,
        productName: true,
        policyNumber: true,
        contractNumber: true,
        accountNumber: true,
        company: true,
        issuedAt: true,
        effectiveDate: true,
        renewalAt: true,
        nextReviewAt: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.document.findMany({
      where: { organizationId, status: { in: ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"] }, archivedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        isRequired: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
  ])

  const people = [
    ...clients.map((client) => ({ kind: "client" as const, href: `/clients/${client.id}`, ...client })),
    ...leads.map((lead) => ({ kind: "prospect" as const, href: `/prospects/${lead.id}`, documents: [], products: [], kycCompleted: false, identityVerified: false, consentGiven: false, ...lead })),
  ]

  const duplicateEmails = duplicateGroups(people, (person) => normalizeEmail(person.email ?? ("emailPrimary" in person ? person.emailPrimary : null)))
  const duplicatePhones = duplicateGroups(people, (person) => normalizePhone(person.phone ?? ("phonePrimary" in person ? person.phonePrimary : null))).filter(([key]) => key.length >= 7)
  const duplicateNames = duplicateGroups(people, (person) => normalizeName(person.firstName, person.lastName))

  const missingContact = people.filter((person) => !normalizeEmail(person.email ?? ("emailPrimary" in person ? person.emailPrimary : null)) || normalizePhone(person.phone ?? ("phonePrimary" in person ? person.phonePrimary : null)).length < 7)
  const withoutAdvisor = people.filter((person) => !person.advisorId)
  const clientComplianceGaps = clients.filter((client) =>
    !client.kycCompleted ||
    !client.identityVerified ||
    !client.consentGiven ||
    client.documents.some((document) => ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"].includes(document.status))
  )
  const incompleteProducts = products.filter((product) =>
    !product.company ||
    (!product.policyNumber && !product.contractNumber && !product.accountNumber) ||
    (!product.issuedAt && !product.effectiveDate) ||
    !product.nextReviewAt
  )

  const duplicateCount = duplicateEmails.length + duplicatePhones.length + duplicateNames.length
  const totalIssues = duplicateCount + missingContact.length + withoutAdvisor.length + clientComplianceGaps.length + incompleteProducts.length + documents.length

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Qualité des données"
        description="Contrôlez les doublons, coordonnées manquantes, assignations, dossiers incomplets et contrats à compléter après import ou saisie manuelle."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Database} label="Points à corriger" value={String(totalIssues)} detail="Tous contrôles confondus" />
          <Metric icon={Fingerprint} label="Groupes doublons" value={String(duplicateCount)} detail="Email, téléphone ou nom" />
          <Metric icon={UserRoundX} label="Sans conseiller" value={String(withoutAdvisor.length)} detail="Clients/prospects non assignés" />
          <Metric icon={PackageSearch} label="Contrats incomplets" value={String(incompleteProducts.length)} detail="Identifiant, compagnie ou revue manquante" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <ContentCard title="Doublons potentiels" description="Détection simple sur email, téléphone et nom complet normalisé.">
            {duplicateCount === 0 ? (
              <EmptyState text="Aucun doublon évident détecté." />
            ) : (
              <div className="grid gap-4">
                <DuplicateSection title="Même email" groups={duplicateEmails} />
                <DuplicateSection title="Même téléphone" groups={duplicatePhones} />
                <DuplicateSection title="Même nom" groups={duplicateNames.slice(0, 10)} />
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Actions prioritaires" description="Nettoyage recommandé.">
              <div className="grid gap-2 text-sm font-semibold text-slate-600">
                <ActionLine icon={SearchCheck} text="Fusionner ou archiver les doublons confirmés." />
                <ActionLine icon={UserRoundX} text="Assigner les clients/prospects sans conseiller." />
                <ActionLine icon={FileWarning} text="Demander les pièces obligatoires manquantes." />
                <ActionLine icon={PackageSearch} text="Compléter les numéros de contrat et dates de revue." />
              </div>
            </ContentCard>

            <ContentCard title="Coordonnées manquantes" description="Email ou téléphone absent/incomplet.">
              <CompactPeopleList people={missingContact.slice(0, 10)} empty="Aucune coordonnée manquante." />
            </ContentCard>

            <ContentCard title="Sans conseiller" description="Dossiers à assigner.">
              <CompactPeopleList people={withoutAdvisor.slice(0, 10)} empty="Tous les dossiers sont assignés." />
            </ContentCard>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ContentCard title="Dossiers client incomplets" description="KYC, identité, consentement ou documents à traiter.">
            {clientComplianceGaps.length === 0 ? (
              <EmptyState text="Aucun dossier client incomplet détecté." />
            ) : (
              <div className="grid gap-3">
                {clientComplianceGaps.slice(0, 20).map((client) => (
                  <Link key={client.id} href={`/clients/${client.id}?tab=compliance`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-200 hover:bg-amber-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-950">{clientName(client)}</p>
                      <StatusBadge tone="amber">{client.documents.length} document(s) à traiter</StatusBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!client.kycCompleted ? <StatusBadge tone="rose">KYC incomplet</StatusBadge> : null}
                      {!client.identityVerified ? <StatusBadge tone="rose">Identité non vérifiée</StatusBadge> : null}
                      {!client.consentGiven ? <StatusBadge tone="amber">Consentement absent</StatusBadge> : null}
                      <StatusBadge tone="slate">{client.advisor?.name ?? "Non assigné"}</StatusBadge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Contrats à compléter" description="Informations métier manquantes sur les produits/contrats.">
            {incompleteProducts.length === 0 ? (
              <EmptyState text="Aucun contrat incomplet détecté." />
            ) : (
              <div className="grid gap-3">
                {incompleteProducts.slice(0, 20).map((product) => (
                  <Link key={product.id} href={`/clients/${product.client.id}?tab=products`} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-200 hover:bg-violet-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-950">{product.productName ?? financialProductTypeLabels[product.type] ?? product.type}</p>
                      <StatusBadge tone="violet">{clientName(product.client)}</StatusBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!product.company ? <StatusBadge tone="amber">Compagnie absente</StatusBadge> : null}
                      {!product.policyNumber && !product.contractNumber && !product.accountNumber ? <StatusBadge tone="rose">Numéro absent</StatusBadge> : null}
                      {!product.issuedAt && !product.effectiveDate ? <StatusBadge tone="amber">Date effet absente</StatusBadge> : null}
                      {!product.nextReviewAt ? <StatusBadge tone="amber">Revue non planifiée</StatusBadge> : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ContentCard>
        </div>

        <ContentCard title="Documents à régulariser" description="Pièces requises, demandées, rejetées ou expirées.">
          {documents.length === 0 ? (
            <EmptyState text="Aucun document à régulariser." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {documents.slice(0, 30).map((document) => (
                <Link key={document.id} href={document.client ? `/clients/${document.client.id}?tab=documents` : "/documents"} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950">{document.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {document.client ? clientName(document.client) : document.lead ? clientName(document.lead) : "Dossier non lié"}
                      </p>
                    </div>
                    <StatusBadge tone={document.status === "EXPIRED" || document.status === "REJECTED" ? "rose" : "amber"}>{document.status.toLowerCase()}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ContentCard>
      </PageShell>
    </AppShell>
  )
}

function DuplicateSection({
  title,
  groups,
}: {
  title: string
  groups: Array<[string, Array<{ id: string; kind: "client" | "prospect"; firstName: string; lastName: string; href: string; advisor?: { name: string | null } | null }>]>
}) {
  if (groups.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-slate-500">{title}</p>
      <div className="grid gap-2">
        {groups.slice(0, 8).map(([key, group]) => (
          <div key={`${title}-${key}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="rose">{group.length} fiches</StatusBadge>
              <span className="text-sm font-black text-slate-950">{key}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.map((item) => (
                <Link key={item.id} href={item.href} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700 hover:border-emerald-200 hover:text-emerald-700">
                  {clientName(item)} · {item.kind}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompactPeopleList({
  people,
  empty,
}: {
  people: Array<{ id: string; firstName: string; lastName: string; kind: "client" | "prospect"; href: string; advisor?: { name: string | null } | null }>
  empty: string
}) {
  if (people.length === 0) return <EmptyState text={empty} />
  return (
    <div className="grid gap-2">
      {people.map((person) => (
        <Link key={`${person.kind}-${person.id}`} href={person.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black text-slate-950">{clientName(person)}</p>
            <StatusBadge tone={person.kind === "client" ? "emerald" : "sky"}>{person.kind}</StatusBadge>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{person.advisor?.name ?? "Non assigné"}</p>
        </Link>
      ))}
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-white p-4 shadow-[0_6px_0_#fecdd3]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-rose-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function ActionLine({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="flex gap-2">
      <Icon className="mt-0.5 size-4 text-emerald-600" />
      <span>{text}</span>
    </p>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
