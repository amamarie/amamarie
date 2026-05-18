import Link from "next/link"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { ExceptionApprovalActions } from "./ExceptionApprovalActions"

function formatDate(value?: Date | string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

export default async function ExceptionsRegistryPage() {
  const { organizationId } = await getTenantContext()
  const exceptions = await prisma.complianceException.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      advisor: { select: { id: true, name: true, role: true } },
      requestedBy: { select: { id: true, name: true, role: true } },
      approvedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  })
  const approvalSteps = exceptions.length > 0
    ? await prisma.complianceApprovalStep.findMany({
      where: { organizationId, linkedEntityType: "ComplianceException", linkedEntityId: { in: exceptions.map((item) => item.id) } },
      orderBy: [{ linkedEntityId: "asc" }, { level: "asc" }],
    })
    : []
  const stepsByException = new Map<string, typeof approvalSteps>()
  for (const step of approvalSteps) {
    const current = stepsByException.get(step.linkedEntityId) ?? []
    current.push(step)
    stepsByException.set(step.linkedEntityId, current)
  }
  return (
    <PageShell eyebrow="Registre conformité" title="Exceptions" description="Dérogations, justifications, approbations, échéances et preuves liées.">
      <ContentCard title="Registre des exceptions" description={`${exceptions.length} exception(s) répertoriée(s).`}>
        <div className="grid gap-3">
          {exceptions.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{item.exceptionType}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{item.client ? `${item.client.firstName} ${item.client.lastName}` : "Cabinet"} · demandée par {item.requestedBy?.name ?? "Système"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.reason}</p>
                  <Link href={item.clientId ? `/clients/${item.clientId}?tab=history` : "/compliance"} className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.14em] text-emerald-700 hover:text-emerald-800">
                    Ouvrir le dossier
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={item.status === "APPROVED" ? "emerald" : "amber"}>{item.status}</StatusBadge>
                  <StatusBadge tone={item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL" ? "rose" : "slate"}>{item.riskLevel}</StatusBadge>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Créée le {formatDate(item.createdAt)} · Approuvée par {item.approvedBy?.name ?? "Non approuvée"} · Expire {formatDate(item.expiresAt)}</p>
              <ExceptionApprovalActions exceptionId={item.id} status={item.status} steps={(stepsByException.get(item.id) ?? []).map((step) => ({
                id: step.id,
                level: step.level,
                title: step.title,
                status: step.status,
                requiredRole: step.requiredRole,
                approvedAt: step.approvedAt,
                rejectedAt: step.rejectedAt,
              }))} />
            </div>
          ))}
          {exceptions.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune exception.</p> : null}
        </div>
      </ContentCard>
    </PageShell>
  )
}
