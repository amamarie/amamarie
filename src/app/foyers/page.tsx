import Link from "next/link"
import { AlertTriangle, CalendarClock, Home, PiggyBank, UsersRound, type LucideIcon } from "lucide-react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type ClientRow = {
  id: string
  firstName: string
  lastName: string
  familyStatus: string | null
  spouseName: string | null
  dependents: number | null
  dependentsCount: number | null
  children: unknown
  profileType: string | null
  nextReviewDate: Date | null
  lastContactAt: Date | null
  advisor: { name: string } | null
  products: Array<{ accountValue: number | null; coverageAmount: number | null; status: string }>
  documents: Array<{ status: string }>
  tasks: Array<{ status: string; dueDate: Date | null }>
}

function clientName(client: Pick<ClientRow, "firstName" | "lastName">) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function childrenCount(children: unknown) {
  return Array.isArray(children) ? children.length : 0
}

function dependentCount(client: ClientRow) {
  return client.dependentsCount ?? client.dependents ?? childrenCount(client.children)
}

function hasHouseholdSignal(client: ClientRow) {
  return client.profileType === "HOUSEHOLD" || Boolean(client.spouseName) || dependentCount(client) > 0 || /mari|conjoint|famille|couple/i.test(client.familyStatus ?? "")
}

function householdLabel(client: ClientRow) {
  return client.profileType === "HOUSEHOLD" ? `Foyer ${client.lastName}` : `Foyer potentiel ${client.lastName}`
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value)
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

export default async function HouseholdsPage() {
  const { organizationId } = await getTenantContext()
  const clients = await prisma.client.findMany({
    where: { organizationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      familyStatus: true,
      spouseName: true,
      dependents: true,
      dependentsCount: true,
      children: true,
      profileType: true,
      nextReviewDate: true,
      lastContactAt: true,
      advisor: { select: { name: true } },
      products: { select: { accountValue: true, coverageAmount: true, status: true } },
      documents: { select: { status: true } },
      tasks: { select: { status: true, dueDate: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const households = clients.filter(hasHouseholdSignal)
  const assets = households.reduce((sum, client) => sum + client.products.reduce((productSum, product) => productSum + (product.accountValue ?? 0), 0), 0)
  const coverage = households.reduce((sum, client) => sum + client.products.reduce((productSum, product) => productSum + (product.coverageAmount ?? 0), 0), 0)
  const incomplete = households.filter((client) => client.documents.length === 0 || !client.nextReviewDate).length
  const reviewsSoon = households.filter((client) => client.nextReviewDate && client.nextReviewDate.getTime() <= Date.now() + 60 * 24 * 60 * 60 * 1000).length

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Foyers"
        description="Vue familiale et patrimoniale construite à partir des fiches clients existantes : conjoint, enfants, personnes à charge, contrats et prochaines revues."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={Home} label="Foyers détectés" value={String(households.length)} detail="Clients avec signal familial" />
          <Metric icon={UsersRound} label="Personnes à charge" value={String(households.reduce((sum, client) => sum + dependentCount(client), 0))} detail="Enfants ou dépendants renseignés" />
          <Metric icon={PiggyBank} label="Encours suivis" value={formatMoney(assets)} detail={`Couverture ${formatMoney(coverage)}`} />
          <Metric icon={AlertTriangle} label="À compléter" value={String(incomplete)} detail={`${reviewsSoon} revue(s) proche(s)`} />
        </div>

        <ContentCard title="Foyers et familles" description="Chaque ligne ouvre la fiche client principale pour compléter le foyer, le profil client ou les documents.">
          {households.length === 0 ? (
            <EmptyState text="Aucun foyer détecté. Renseignez un conjoint, des enfants, des personnes à charge ou le type de dossier Ménage / famille sur une fiche client." />
          ) : (
            <div className="grid gap-3">
              {households.map((client) => {
                const dependentTotal = dependentCount(client)
                const totalAssets = client.products.reduce((sum, product) => sum + (product.accountValue ?? 0), 0)
                const totalCoverage = client.products.reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0)
                const openTasks = client.tasks.filter((task) => task.status !== "DONE").length
                const missingDocs = client.documents.length === 0

                return (
                  <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={client.profileType === "HOUSEHOLD" ? "emerald" : "sky"}>{householdLabel(client)}</StatusBadge>
                          {missingDocs ? <StatusBadge tone="amber">Documents à compléter</StatusBadge> : <StatusBadge tone="emerald">Documents présents</StatusBadge>}
                        </div>
                        <h2 className="mt-3 text-lg font-black text-slate-950">{clientName(client)}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Conjoint: {client.spouseName ?? "Non renseigné"} · Personnes à charge: {dependentTotal}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Conseiller: {client.advisor?.name ?? "Non assigné"} · Dernier contact: {formatDate(client.lastContactAt)} · Prochaine revue: {formatDate(client.nextReviewDate)}
                        </p>
                      </div>
                      <Link href={`/clients/${client.id}?tab=profile`} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                        Ouvrir foyer
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                      <Info label="Situation" value={client.familyStatus ?? "À renseigner"} />
                      <Info label="Produits" value={`${client.products.length} contrat(s)`} />
                      <Info label="Encours" value={formatMoney(totalAssets)} />
                      <Info label="Relances" value={`${openTasks} tâche(s)`} />
                      <Info label="Protection" value={formatMoney(totalCoverage)} />
                      <Info label="Transmission" value={client.spouseName || dependentTotal > 0 ? "À qualifier" : "Non renseignée"} />
                      <Info label="Revue" value={formatDate(client.nextReviewDate)} />
                      <Info label="Priorité" value={missingDocs || openTasks > 0 ? "Action requise" : "Suivi normal"} />
                    </div>
                  </article>
                )
              })}
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
