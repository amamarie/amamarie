import { AlertCircle, CheckCircle2, Headset, LifeBuoy, MessageSquarePlus } from "lucide-react"

import { createAdvisorSupportTicket } from "@/app/support/actions"
import { AppShell } from "@/components/layout/AppShell"
import { requireSaasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

type SupportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const statusLabels: Record<string, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  WAITING_CUSTOMER: "En attente cabinet",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
}

const priorityLabels: Record<string, string> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  CRITICAL: "Critique",
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default async function AdvisorSupportPage({ searchParams }: SupportPageProps) {
  const user = await requireSaasRole(["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"])
  const params = await searchParams
  const ticketStatus = typeof params?.ticket === "string" ? params.ticket : undefined
  const tickets = await prisma.superAdminTicket.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })
  const openTickets = tickets.filter((ticket) => ticket.status !== "RESOLVED" && ticket.status !== "CLOSED")

  return (
    <AppShell moduleKey="settings">
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-7xl">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-800">
                <Headset className="size-4" aria-hidden="true" />
                Support cabinet
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Tickets support</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Créez une demande pour l’équipe support et suivez les tickets ouverts de votre cabinet. Les tickets sont visibles par le super admin avec les informations nécessaires au diagnostic.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Stat label="Tickets ouverts" value={`${openTickets.length}`} />
              <Stat label="Tickets au total" value={`${tickets.length}`} />
            </div>
          </div>

          {ticketStatus ? (
            <div className={`mt-4 rounded-xl border p-4 ${ticketStatus === "created" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-start gap-3">
                {ticketStatus === "created" ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" aria-hidden="true" /> : <AlertCircle className="mt-0.5 size-5 text-amber-700" aria-hidden="true" />}
                <p className={`text-sm font-semibold ${ticketStatus === "created" ? "text-emerald-900" : "text-amber-900"}`}>
                  {ticketStatus === "created" ? "Ticket créé. Le support peut maintenant le traiter." : "Ajoutez un sujet pour créer le ticket."}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <LifeBuoy className="size-5 text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Demandes du cabinet</h2>
                  <p className="mt-1 text-sm text-slate-600">Historique réel des tickets enregistrés en base.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {tickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    Aucun ticket support pour ce cabinet.
                  </div>
                ) : tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">{ticket.subject}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{ticket.description ?? "Sans description détaillée."}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          Créé le {formatDate(ticket.createdAt)} par {ticket.createdBy?.name ?? ticket.createdBy?.email ?? "cabinet"}
                          {ticket.assignedTo ? ` · Assigné à ${ticket.assignedTo.name ?? ticket.assignedTo.email}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={ticket.priority === "CRITICAL" || ticket.priority === "HIGH" ? "rose" : "slate"}>{priorityLabels[ticket.priority] ?? ticket.priority}</Pill>
                        <Pill tone={ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "emerald" : "amber"}>{statusLabels[ticket.status] ?? ticket.status}</Pill>
                      </div>
                    </div>
                    {ticket.module ? <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Module: {ticket.module}</p> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <MessageSquarePlus className="size-5 text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Créer un ticket</h2>
                  <p className="mt-1 text-sm text-slate-600">Décrivez le problème ou la demande.</p>
                </div>
              </div>

              <form action={createAdvisorSupportTicket} className="mt-5 grid gap-3">
                <input name="subject" placeholder="Sujet du ticket" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select name="module" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Module concerné</option>
                  <option value="Calendrier">Calendrier</option>
                  <option value="Emails">Emails</option>
                  <option value="CRM">CRM</option>
                  <option value="Documents">Documents</option>
                  <option value="Facturation">Facturation</option>
                  <option value="Intégrations">Intégrations</option>
                  <option value="Autre">Autre</option>
                </select>
                <select name="priority" defaultValue="NORMAL" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="LOW">Faible</option>
                  <option value="NORMAL">Normale</option>
                  <option value="HIGH">Haute</option>
                  <option value="CRITICAL">Critique</option>
                </select>
                <textarea name="description" placeholder="Décrivez ce qui se passe, l’écran concerné et l’impact pour votre cabinet." className="min-h-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Créer le ticket</button>
              </form>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Pill({ children, tone }: { children: string; tone: "emerald" | "amber" | "rose" | "slate" }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      tone === "emerald" ? "bg-emerald-50 text-emerald-700"
      : tone === "amber" ? "bg-amber-50 text-amber-800"
      : tone === "rose" ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-700"
    }`}>
      {children}
    </span>
  )
}
