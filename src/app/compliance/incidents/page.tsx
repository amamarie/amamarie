import Link from "next/link"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { IncidentActions } from "./IncidentActions"

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

export default async function IncidentsRegistryPage() {
  const { organizationId } = await getTenantContext()
  const incidents = await prisma.complianceIncident.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      detectedBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
    take: 300,
  })
  return (
    <PageShell eyebrow="Registre conformité" title="Incidents" description="Incidents opérationnels, confidentialité, sécurité, erreurs de dossier et mesures correctives.">
      <ContentCard title="Registre des incidents" description={`${incidents.length} incident(s) répertorié(s).`}>
        <div className="grid gap-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{incident.incidentNumber} - {incident.incidentType}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{incident.client ? `${incident.client.firstName} ${incident.client.lastName}` : "Incident cabinet"} · détecté le {formatDate(incident.detectedAt)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{incident.description}</p>
                  <Link href={incident.clientId ? `/clients/${incident.clientId}?tab=history` : "/compliance"} className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:text-emerald-800">
                    Ouvrir le dossier
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={incident.status === "CLOSED" ? "emerald" : "amber"}>{incident.status}</StatusBadge>
                  <StatusBadge tone={incident.seriousHarmRisk || incident.riskLevel === "HIGH" || incident.riskLevel === "CRITICAL" ? "rose" : "slate"}>{incident.riskLevel}</StatusBadge>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Responsable {incident.assignedTo?.name ?? "Non assigné"} · CAI {incident.notifiedAuthorityAt ? formatDate(incident.notifiedAuthorityAt) : "non avisée"} · client {incident.notifiedClientsAt ? formatDate(incident.notifiedClientsAt) : "non avisé"}</p>
              <IncidentActions incidentId={incident.id} status={incident.status} />
            </div>
          ))}
          {incidents.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucun incident.</p> : null}
        </div>
      </ContentCard>
    </PageShell>
  )
}
