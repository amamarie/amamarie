import Link from "next/link"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { SupervisionReviewActions } from "./SupervisionReviewActions"

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

export default async function SupervisionRegistryPage() {
  const { organizationId } = await getTenantContext()
  const reviews = await prisma.supervisionReview.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      advisor: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  })
  return (
    <PageShell eyebrow="Supervision cabinet" title="Revues de supervision" description="File de révision, échantillonnage, corrections demandées et validations conformité.">
      <ContentCard title="Dossiers à superviser" description={`${reviews.length} revue(s) répertoriée(s).`}>
        <div className="grid gap-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{review.reviewType}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{review.client ? `${review.client.firstName} ${review.client.lastName}` : "Cabinet"} · conseiller {review.advisor?.name ?? "Non assigné"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{review.requiredCorrections ?? review.findings ?? "Revue à compléter."}</p>
                  <Link href={review.clientId ? `/clients/${review.clientId}?tab=history` : "/compliance"} className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:text-emerald-800">
                    Ouvrir le dossier
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={review.status === "APPROVED" || review.status === "CLOSED" ? "emerald" : "amber"}>{review.status}</StatusBadge>
                  <StatusBadge tone={review.riskLevel === "HIGH" || review.riskLevel === "CRITICAL" ? "rose" : "slate"}>{review.riskLevel}</StatusBadge>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Réviseur {review.reviewer?.name ?? "Non assigné"} · créée le {formatDate(review.createdAt)} · approuvée {formatDate(review.approvedAt)}</p>
              <SupervisionReviewActions reviewId={review.id} status={review.status} />
            </div>
          ))}
          {reviews.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune revue.</p> : null}
        </div>
      </ContentCard>
    </PageShell>
  )
}
