import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
  PackageCheck,
  RefreshCw,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"
import { DocumentStatus, FinancialProductStatus } from "@prisma/client"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { financialProductStatusLabels, financialProductTypeLabels } from "@/lib/financial-products"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const activeProductStatuses = [
  FinancialProductStatus.ACTIVE,
  FinancialProductStatus.PENDING,
  FinancialProductStatus.UNDER_REVIEW,
]

const openReminderStatuses = ["OPEN", "SNOOZED"] as const

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function daysUntil(date: Date) {
  const today = startOfDay(new Date()).getTime()
  const target = startOfDay(date).getTime()
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function formatDate(value?: Date | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function dueTone(date: Date) {
  const days = daysUntil(date)
  if (days < 0) return "rose" as const
  if (days <= 14) return "amber" as const
  return "sky" as const
}

function dueLabel(date: Date) {
  const days = daysUntil(date)
  if (days < 0) return `En retard de ${Math.abs(days)} j`
  if (days === 0) return "Aujourd’hui"
  return `Dans ${days} j`
}

function productLabel(product: { productName: string | null; type: string }) {
  return product.productName ?? financialProductTypeLabels[product.type] ?? product.type
}

export default async function DeadlinesPage() {
  const { organizationId } = await getTenantContext()
  const today = startOfDay(new Date())
  const horizon = addDays(today, 90)

  const [products, documents, clients, reminders] = await Promise.all([
    prisma.financialProduct.findMany({
      where: {
        organizationId,
        status: { in: activeProductStatuses },
        OR: [
          { renewalAt: { lte: horizon } },
          { nextReviewAt: { lte: horizon } },
          { maturityAt: { lte: horizon } },
        ],
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { name: true } },
      },
      orderBy: [{ renewalAt: "asc" }, { nextReviewAt: "asc" }],
      take: 80,
    }),
    prisma.document.findMany({
      where: {
        organizationId,
        status: { not: DocumentStatus.ARCHIVED },
        OR: [{ expiresAt: { lte: horizon } }, { status: DocumentStatus.EXPIRED }],
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ expiresAt: "asc" }, { updatedAt: "desc" }],
      take: 80,
    }),
    prisma.client.findMany({
      where: {
        organizationId,
        status: { not: "ARCHIVED" },
        nextReviewDate: { lte: horizon },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nextReviewDate: true,
        lastContactAt: true,
        advisor: { select: { name: true } },
      },
      orderBy: { nextReviewDate: "asc" },
      take: 80,
    }),
    prisma.smartReminder.findMany({
      where: {
        organizationId,
        status: { in: [...openReminderStatuses] },
        OR: [{ dueDate: { lte: horizon } }, { triggerDate: { lte: today } }],
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { triggerDate: "asc" }],
      take: 80,
    }),
  ])

  const contractRenewals = products.filter((product) => product.renewalAt)
  const productReviews = products.filter((product) => product.nextReviewAt)
  const productMaturities = products.filter((product) => product.maturityAt)
  const expiringDocuments = documents.filter((document) => document.expiresAt || document.status === DocumentStatus.EXPIRED)
  const overdueItems =
    contractRenewals.filter((product) => product.renewalAt && product.renewalAt < today).length +
    productReviews.filter((product) => product.nextReviewAt && product.nextReviewAt < today).length +
    productMaturities.filter((product) => product.maturityAt && product.maturityAt < today).length +
    expiringDocuments.filter((document) => (document.expiresAt && document.expiresAt < today) || document.status === DocumentStatus.EXPIRED).length +
    clients.filter((client) => client.nextReviewDate && client.nextReviewDate < today).length +
    reminders.filter((reminder) => reminder.dueDate && reminder.dueDate < today).length

  const timeline = [
    ...contractRenewals.map((product) => ({
      id: `renewal-${product.id}`,
      date: product.renewalAt as Date,
      kind: "Renouvellement",
      icon: RefreshCw,
      title: productLabel(product),
      detail: `${financialProductTypeLabels[product.type] ?? product.type} · ${financialProductStatusLabels[product.status] ?? product.status}`,
      clientId: product.client.id,
      clientLabel: clientName(product.client),
      owner: product.advisor?.name ?? "Conseiller non assigné",
      href: `/clients/${product.client.id}?tab=products`,
    })),
    ...productReviews.map((product) => ({
      id: `review-${product.id}`,
      date: product.nextReviewAt as Date,
      kind: "Revue produit",
      icon: ClipboardCheck,
      title: productLabel(product),
      detail: product.complianceNotes ?? product.notes ?? "Revue périodique du contrat ou placement.",
      clientId: product.client.id,
      clientLabel: clientName(product.client),
      owner: product.advisor?.name ?? "Conseiller non assigné",
      href: `/clients/${product.client.id}?tab=products`,
    })),
    ...productMaturities.map((product) => ({
      id: `maturity-${product.id}`,
      date: product.maturityAt as Date,
      kind: "Maturité",
      icon: PackageCheck,
      title: productLabel(product),
      detail: "Produit arrivant à échéance ou maturité.",
      clientId: product.client.id,
      clientLabel: clientName(product.client),
      owner: product.advisor?.name ?? "Conseiller non assigné",
      href: `/clients/${product.client.id}?tab=products`,
    })),
    ...expiringDocuments.map((document) => ({
      id: `document-${document.id}`,
      date: document.expiresAt ?? document.updatedAt,
      kind: "Document",
      icon: FileWarning,
      title: document.name,
      detail: document.status === DocumentStatus.EXPIRED ? "Document expiré." : "Document à mettre à jour avant expiration.",
      clientId: document.client?.id,
      clientLabel: document.client ? clientName(document.client) : document.lead ? clientName(document.lead) : "Dossier non lié",
      owner: "Dossier client",
      href: document.client ? `/clients/${document.client.id}?tab=documents` : "/documents",
    })),
    ...clients
      .filter((client) => client.nextReviewDate)
      .map((client) => ({
        id: `client-review-${client.id}`,
        date: client.nextReviewDate as Date,
        kind: "Bilan client",
        icon: UserRoundCheck,
        title: `Bilan annuel ${clientName(client)}`,
        detail: client.lastContactAt ? `Dernier contact le ${formatDate(client.lastContactAt)}.` : "Aucun dernier contact renseigné.",
        clientId: client.id,
        clientLabel: clientName(client),
        owner: client.advisor?.name ?? "Conseiller non assigné",
        href: `/clients/${client.id}`,
      })),
    ...reminders.map((reminder) => ({
      id: `reminder-${reminder.id}`,
      date: reminder.dueDate ?? reminder.triggerDate,
      kind: "Rappel",
      icon: CalendarClock,
      title: reminder.title,
      detail: reminder.recommendedAction ?? reminder.reason,
      clientId: reminder.client.id,
      clientLabel: clientName(reminder.client),
      owner: reminder.advisor?.name ?? "Conseiller non assigné",
      href: reminder.actionUrl ?? `/clients/${reminder.client.id}`,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Échéances"
        description="Renouvellements, revues produit, maturités, documents expirants, bilans clients et rappels à traiter."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={AlertTriangle} label="En retard" value={String(overdueItems)} detail="Échéances dépassées" />
          <Metric icon={RefreshCw} label="Renouvellements" value={String(contractRenewals.length)} detail="Contrats avec date de renouvellement" />
          <Metric icon={FileWarning} label="Documents expirants" value={String(expiringDocuments.length)} detail="À renouveler ou vérifier" />
          <Metric icon={UserRoundCheck} label="Bilans clients" value={String(clients.length)} detail="Revues client planifiées" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ContentCard title="Timeline des échéances" description="Vue consolidée sur 90 jours, avec les retards conservés en haut de liste.">
            {timeline.length === 0 ? (
              <EmptyState text="Aucune échéance à 90 jours." />
            ) : (
              <div className="grid gap-3">
                {timeline.slice(0, 90).map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.id} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={dueTone(item.date)}>{dueLabel(item.date)}</StatusBadge>
                            <StatusBadge tone="slate">{item.kind}</StatusBadge>
                          </div>
                          <h2 className="mt-3 flex items-center gap-2 text-lg font-black text-slate-950">
                            <Icon className="size-5 text-emerald-700" />
                            {item.title}
                          </h2>
                          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.detail}</p>
                        </div>
                        <div className="shrink-0 text-left lg:text-right">
                          <p className="text-sm font-black text-slate-950">{formatDate(item.date)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{item.owner}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        Client : <span className="font-black text-emerald-700">{item.clientLabel}</span>
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="À traiter en priorité" description="Retards et échéances proches.">
              <div className="grid gap-2">
                {timeline.filter((item) => daysUntil(item.date) <= 14).slice(0, 10).map((item) => (
                  <Link key={item.id} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-200 hover:bg-amber-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">{item.title}</p>
                      <StatusBadge tone={dueTone(item.date)}>{dueLabel(item.date)}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{item.clientLabel}</p>
                  </Link>
                ))}
                {timeline.filter((item) => daysUntil(item.date) <= 14).length === 0 ? <EmptyState text="Aucune urgence à 14 jours." /> : null}
              </div>
            </ContentCard>

            <ContentCard title="Règles métier utiles" description="Logique de suivi recommandée.">
              <div className="grid gap-2 text-sm font-semibold text-slate-600">
                <p>Créer une relance avant chaque renouvellement de contrat.</p>
                <p>Mettre à jour les documents expirés avant nouvelle recommandation.</p>
                <p>Planifier un bilan annuel pour les clients sans contact récent.</p>
                <p>Transformer une échéance commerciale en tâche assignée.</p>
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
    <div className="rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-[0_6px_0_#fde68a]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-amber-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
