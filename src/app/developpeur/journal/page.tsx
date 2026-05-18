import { Activity, CalendarClock, FileClock, ShieldCheck, UserRoundCheck } from "lucide-react"

import { CompactMetric, DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { requireSaasRole } from "@/lib/auth/roles"
import { apiLogRows, formatAuditAction, formatShortDate, getDeveloperConsoleData } from "@/lib/developer-console"

export default async function DeveloperJournalPage() {
  const user = await requireSaasRole(["DEVELOPER"])
  const { accountRecords, recentAuditLogs, atRiskRecords, customAccessRecords } = await getDeveloperConsoleData({ auditLimit: 50 })
  const passwordEvents = recentAuditLogs.filter((log) => log.action === "USER_PASSWORD_RESET")
  const accessEvents = recentAuditLogs.filter((log) => log.action === "SAAS_ACCESS_UPDATED")

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="journal" />

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Audit développeur"
          title="Journal des actions et événements"
          description="Retrouve les changements critiques effectués sur les cabinets: forfaits, modules, accès, mots de passe et événements techniques récents."
        >
          <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 shadow-[0_3px_0_#e2e8f0]">
            <p className="text-xs font-semibold uppercase text-slate-500">Conservation</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">Audit interne</p>
          </div>
        </PageIntro>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <CompactMetric icon={FileClock} label="Actions listées" value={String(recentAuditLogs.length)} detail="Dernières entrées audit" tone="violet" />
          <CompactMetric icon={ShieldCheck} label="Accès modifiés" value={String(accessEvents.length)} detail="Forfaits, modules, sièges" tone="emerald" />
          <CompactMetric icon={UserRoundCheck} label="Mots de passe" value={String(passwordEvents.length)} detail="Réinitialisations internes" tone="amber" />
          <CompactMetric icon={Activity} label="Cabinets à risque" value={String(atRiskRecords.length)} detail={`${customAccessRecords.length} accès personnalisé(s)`} tone={atRiskRecords.length ? "rose" : "emerald"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.66fr)_minmax(340px,0.34fr)]">
          <SectionCard title="Journal d’audit" eyebrow="Actions administrateur" action={<StatusPill tone="slate">{accountRecords.length} cabinet(s)</StatusPill>}>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Cabinet</th>
                    <th className="px-3 py-2">Acteur</th>
                    <th className="px-3 py-2">Entité</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {recentAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-3 font-semibold text-slate-950">{formatAuditAction(log.action)}</td>
                      <td className="px-3 py-3 text-slate-600">{log.organization.name}</td>
                      <td className="px-3 py-3 text-slate-600">{log.user?.name ?? log.user?.email ?? "Système"}</td>
                      <td className="px-3 py-3 text-slate-600">{log.entityType}</td>
                      <td className="px-3 py-3 text-slate-600">{formatShortDate(log.createdAt)}</td>
                      <td className="px-3 py-3"><StatusPill tone={log.action === "USER_PASSWORD_RESET" ? "amber" : "emerald"}>Traité</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="À surveiller" eyebrow="Priorités audit">
            <div className="mt-4 grid gap-2">
              {atRiskRecords.length > 0 ? (
                atRiskRecords.map((record) => (
                  <div key={record.organization.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-amber-950">{record.organization.name}</p>
                        <p className="mt-1 text-sm leading-5 text-amber-800">
                          {record.seatLimitExceeded ? "Limite de sièges dépassée. " : ""}
                          {record.missingPasswordCount > 0 ? `${record.missingPasswordCount} mot(s) de passe à créer. ` : ""}
                          {record.status === "SUSPENDED" ? "Compte suspendu. " : ""}
                        </p>
                      </div>
                      <StatusPill tone={record.healthScore >= 65 ? "amber" : "rose"}>{record.healthScore}%</StatusPill>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  Aucun cabinet à risque dans les données actuelles.
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Événements techniques récents" eyebrow="API et webhooks" className="mt-4">
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {apiLogRows.map((log) => (
              <div key={`${log.time}-${log.endpoint}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {log.time}
                  </span>
                  <StatusPill tone={log.tone}>{log.status.split(" ")[0]}</StatusPill>
                </div>
                <p className="mt-3 truncate font-mono text-xs font-semibold text-slate-950">{log.method} {log.endpoint}</p>
                <p className="mt-2 text-xs text-slate-500">{log.latency} · {log.ip}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </main>
  )
}
