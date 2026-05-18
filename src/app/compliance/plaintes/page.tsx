import Link from "next/link"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { ComplaintActions } from "./ComplaintActions"

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

export default async function ComplaintsRegistryPage() {
  const { organizationId } = await getTenantContext()
  const complaints = await prisma.complaint.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      advisor: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ status: "asc" }, { receivedAt: "desc" }],
    take: 300,
  })
  return (
    <PageShell eyebrow="Registre conformité" title="Plaintes" description="Suivi structuré des plaintes, délais, responsables, statut et dossiers clients liés.">
      <ContentCard title="Registre des plaintes" description={`${complaints.length} plainte(s) répertoriée(s).`}>
        <div className="grid gap-3">
          {complaints.map((complaint) => (
            <div key={complaint.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{complaint.complaintNumber} - {complaint.category ?? "Plainte"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{complaint.client.firstName} {complaint.client.lastName} · {complaint.productType ?? "Produit non précisé"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{complaint.description}</p>
                  <Link href={`/clients/${complaint.clientId}?tab=history`} className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:text-emerald-800">
                    Ouvrir le dossier
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={complaint.status === "CLOSED" ? "emerald" : "amber"}>{complaint.status}</StatusBadge>
                  <StatusBadge tone={complaint.severity === "HIGH" || complaint.severity === "CRITICAL" ? "rose" : "slate"}>{complaint.severity}</StatusBadge>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Reçue le {formatDate(complaint.receivedAt)} · Responsable {complaint.assignedTo?.name ?? "Non assigné"} · AMF {complaint.reportableToAmf ? "oui" : "non"}</p>
              <ComplaintActions complaintId={complaint.id} status={complaint.status} />
            </div>
          ))}
          {complaints.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune plainte.</p> : null}
        </div>
      </ContentCard>
    </PageShell>
  )
}
