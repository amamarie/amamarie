import Link from "next/link"
import {
  ClipboardCheck,
  FileText,
  History,
  Lightbulb,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react"
import { NoteStatus, ProductRecommendationStatus } from "@prisma/client"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { getActivityTypeLabel } from "@/lib/activities/labels"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function excerpt(value?: string | null, max = 180) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) return "Aucun détail renseigné."
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function recommendationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    OPEN: "Ouverte",
    ADVISOR_REVIEW: "Revue conseiller",
    COMPLIANCE_REVIEW_REQUIRED: "Revue conformité",
    ADVISOR_APPROVED: "Approuvée conseiller",
    COMPLIANCE_APPROVED: "Approuvée conformité",
    PRESENTED_TO_CLIENT: "Présentée au client",
    CLIENT_ACCEPTED: "Acceptée",
    CLIENT_DECLINED: "Refusée",
    SIGNED: "Signée",
    LOCKED: "Figée",
    COMPLETED: "Terminée",
    DISMISSED: "Ignorée",
    ARCHIVED: "Archivée",
  }

  return labels[status] ?? status.replaceAll("_", " ").toLowerCase()
}

export default async function AdviceHistoryPage() {
  const { organizationId } = await getTenantContext()

  const [activities, notes, recommendations, activityCount, noteCount, openRecommendationCount] = await Promise.all([
    prisma.activity.findMany({
      where: { organizationId, clientId: { not: null } },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { name: true } },
        document: { select: { id: true, name: true, status: true } },
        product: { select: { id: true, productName: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.note.findMany({
      where: {
        organizationId,
        clientId: { not: null },
        status: { in: [NoteStatus.ACTIVE, NoteStatus.PINNED] },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { name: true } },
        product: { select: { productName: true, type: true } },
      },
      orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.productRecommendation.findMany({
      where: { organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { name: true } },
        relatedProduct: { select: { productName: true, type: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.activity.count({ where: { organizationId, clientId: { not: null } } }),
    prisma.note.count({
      where: {
        organizationId,
        clientId: { not: null },
        status: { in: [NoteStatus.ACTIVE, NoteStatus.PINNED] },
      },
    }),
    prisma.productRecommendation.count({
      where: {
        organizationId,
        status: {
          in: [
            ProductRecommendationStatus.OPEN,
            ProductRecommendationStatus.ADVISOR_REVIEW,
            ProductRecommendationStatus.COMPLIANCE_REVIEW_REQUIRED,
            ProductRecommendationStatus.PRESENTED_TO_CLIENT,
          ],
        },
      },
    }),
  ])

  const timeline = [
    ...activities.map((activity) => ({
      id: `activity-${activity.id}`,
      date: activity.createdAt,
      kind: "Activité",
      tone: "sky" as const,
      title: activity.title || getActivityTypeLabel(activity.type),
      detail: activity.description ?? getActivityTypeLabel(activity.type),
      clientId: activity.client?.id,
      clientLabel: activity.client ? clientName(activity.client) : "Client non lié",
      owner: activity.user?.name ?? "Système",
      context: activity.document?.name ?? activity.product?.productName ?? activity.source,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      date: note.meetingDate ?? note.createdAt,
      kind: note.type === "MEETING" ? "Rendez-vous conseil" : "Note conseil",
      tone: note.type === "COMPLIANCE" || note.type === "KYC" ? ("amber" as const) : ("emerald" as const),
      title: note.title ?? "Note client",
      detail: note.content,
      clientId: note.client?.id,
      clientLabel: note.client ? clientName(note.client) : "Client non lié",
      owner: note.user?.name ?? "Équipe",
      context: note.product?.productName ?? (note.isSensitive ? "Donnée sensible" : note.visibility.toLowerCase()),
    })),
    ...recommendations.map((recommendation) => ({
      id: `recommendation-${recommendation.id}`,
      date: recommendation.presentedToClientAt ?? recommendation.clientSignedAt ?? recommendation.updatedAt,
      kind: "Recommandation",
      tone:
        recommendation.status === ProductRecommendationStatus.SIGNED ||
        recommendation.status === ProductRecommendationStatus.CLIENT_ACCEPTED
          ? ("emerald" as const)
          : recommendation.status === ProductRecommendationStatus.CLIENT_DECLINED ||
              recommendation.status === ProductRecommendationStatus.DISMISSED
            ? ("rose" as const)
            : ("violet" as const),
      title: recommendation.title,
      detail: recommendation.finalText ?? recommendation.rationale ?? recommendation.description,
      clientId: recommendation.client.id,
      clientLabel: clientName(recommendation.client),
      owner: recommendation.advisor?.name ?? "Conseiller non assigné",
      context: recommendationStatusLabel(recommendation.status),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const finalizedRecommendationStatuses = new Set<ProductRecommendationStatus>([
    ProductRecommendationStatus.SIGNED,
    ProductRecommendationStatus.CLIENT_ACCEPTED,
    ProductRecommendationStatus.COMPLETED,
    ProductRecommendationStatus.LOCKED,
  ])
  const signedRecommendations = recommendations.filter((recommendation) =>
    finalizedRecommendationStatuses.has(recommendation.status)
  ).length

  return (
    <AppShell moduleKey="clients">
      <PageShell
        eyebrow="CRM métier"
        title="Historique conseil"
        description="Timeline réelle des notes, recommandations, documents et événements qui justifient le suivi client."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={History} label="Événements historisés" value={String(activityCount)} detail="Activités liées aux clients" />
          <Metric icon={MessageSquareText} label="Notes actives" value={String(noteCount)} detail="Notes et rendez-vous conseil" />
          <Metric icon={Lightbulb} label="Recommandations ouvertes" value={String(openRecommendationCount)} detail="À suivre ou présenter" />
          <Metric icon={ClipboardCheck} label="Conseils finalisés" value={String(signedRecommendations)} detail="Signés, acceptés ou terminés" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ContentCard title="Timeline conseil" description="Les événements sont classés par date, toutes sources confondues.">
            {timeline.length === 0 ? (
              <EmptyState text="Aucun historique conseil n’est encore disponible." />
            ) : (
              <div className="grid gap-3">
                {timeline.slice(0, 80).map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={item.tone}>{item.kind}</StatusBadge>
                          <StatusBadge tone="slate">{item.context}</StatusBadge>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-slate-950">{item.title}</h2>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{excerpt(item.detail)}</p>
                      </div>
                      <div className="shrink-0 text-left lg:text-right">
                        <p className="text-sm font-black text-slate-950">{formatDateTime(item.date)}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.owner}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                      <span>Client :</span>
                      {item.clientId ? (
                        <Link href={`/clients/${item.clientId}?tab=history`} className="font-black text-emerald-700 hover:underline">
                          {item.clientLabel}
                        </Link>
                      ) : (
                        <span>{item.clientLabel}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ContentCard>

          <div className="grid gap-4">
            <ContentCard title="Traçabilité attendue" description="Points utiles avant contrôle ou contestation.">
              <div className="grid gap-3 text-sm font-semibold text-slate-600">
                <CheckLine text="Notes de rendez-vous et appels rattachées au client." />
                <CheckLine text="Documents et produits liés dans l’historique." />
                <CheckLine text="Recommandations suivies jusqu’à présentation ou signature." />
                <CheckLine text="Conseiller ou source système visible pour chaque action." />
              </div>
            </ContentCard>
            <ContentCard title="À compléter" description="Qualité de dossier à renforcer.">
              <div className="grid gap-2 text-sm font-semibold text-slate-600">
                <p>Documenter la justification métier dans les recommandations.</p>
                <p>Rattacher les notes sensibles au bon produit ou document.</p>
                <p>Finaliser les recommandations encore ouvertes.</p>
              </div>
            </ContentCard>
            <ContentCard title="Accès fiche client" description="Chaque ligne renvoie vers le contexte client.">
              <p className="text-sm font-semibold leading-6 text-slate-600">
                L’historique complet reste aussi disponible dans chaque fiche client, avec les documents, contrats, tâches et rendez-vous associés.
              </p>
            </ContentCard>
          </div>
        </div>
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

function CheckLine({ text }: { text: string }) {
  return (
    <p className="flex gap-2">
      <FileText className="mt-0.5 size-4 text-emerald-600" />
      <span>{text}</span>
    </p>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>
}
