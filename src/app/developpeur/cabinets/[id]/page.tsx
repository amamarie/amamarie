import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { Activity, AlertTriangle, CreditCard, FileText, LifeBuoy, LockKeyhole, Megaphone, Plug, Shield, Users } from "lucide-react"

import { DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { requireSaasRole } from "@/lib/auth/roles"
import { subscriptionPlans, subscriptionStatuses } from "@/lib/billing/plans"
import { TEMPORARY_ADVISOR_PASSWORD, formatShortDate } from "@/lib/developer-console"
import { currencyFromCents, getSuperAdminAccount360 } from "@/lib/super-admin"

import {
  attachOrganizationAddOn,
  createPlatformIncident,
  createProductAnnouncement,
  createSaasInvoice,
  createSuperAdminNote,
  createSuperAdminTicket,
  recordSaasPayment,
  resetUserPassword,
  resolveSuperAdminTicket,
  startAssistanceSession,
} from "../../actions"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const tabs = [
  ["overview", "Vue d’ensemble"],
  ["users", "Utilisateurs"],
  ["subscription", "Abonnement"],
  ["usage", "Usage"],
  ["support", "Support"],
  ["integrations", "Intégrations"],
  ["emails", "Emails"],
  ["api", "API"],
  ["logs", "Logs"],
  ["security", "Sécurité"],
  ["notes", "Notes"],
] as const

export default async function SuperAdminCabinetDetailPage({ params, searchParams }: PageProps) {
  const user = await requireSaasRole(["DEVELOPER"])
  const { id } = await params
  const query = await searchParams
  const activeTab = typeof query?.tab === "string" ? query.tab : "overview"
  const data = await getSuperAdminAccount360(id)
  if (!data) notFound()

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="cabinets" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Fiche cabinet 360"
          title={data.organization.name}
          description={`${data.organizationTypeLabel} · ${data.organization.city ?? "Ville non renseignée"}${data.organization.region ? `, ${data.organization.region}` : ""}${data.organization.country ? `, ${data.organization.country}` : ""}`}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat label="Santé" value={`${data.healthScore}/100`} tone={data.healthScore >= 80 ? "emerald" : data.healthScore >= 60 ? "amber" : "rose"} />
            <MiniStat label="Risque de résiliation" value={data.churnLabel} tone={data.churnScore >= 70 ? "rose" : data.churnScore >= 40 ? "amber" : "emerald"} />
            <MiniStat label="Revenu mensuel récurrent" value={currencyFromCents(data.totalMrrCents, data.currency)} tone="violet" />
          </div>
        </PageIntro>

        <nav className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={`/developpeur/cabinets/${data.organization.id}?tab=${key}`}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {activeTab === "overview" ? <OverviewTab data={data} /> : null}
        {activeTab === "users" ? <UsersTab data={data} /> : null}
        {activeTab === "subscription" ? <SubscriptionTab data={data} /> : null}
        {activeTab === "usage" ? <UsageTab data={data} /> : null}
        {activeTab === "support" ? <SupportTab data={data} /> : null}
        {activeTab === "integrations" ? <IntegrationsTab data={data} /> : null}
        {activeTab === "emails" ? <EmailsTab data={data} /> : null}
        {activeTab === "api" ? <ApiTab data={data} /> : null}
        {activeTab === "logs" ? <LogsTab data={data} /> : null}
        {activeTab === "security" ? <SecurityTab data={data} /> : null}
        {activeTab === "notes" ? <NotesTab data={data} /> : null}
      </section>
    </main>
  )
}

function OverviewTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Résumé du compte" eyebrow="Données réelles">
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric icon={Users} label="Utilisateurs" value={`${data.teamMembers.length}`} detail={`${data.seatsUsed}/${data.organization.advisorSeatLimit} sièges`} />
          <Metric icon={Activity} label="Contacts" value={`${data.contactsCount}`} detail={`${data.organization._count.clients} clients · ${data.organization._count.leads} leads`} />
          <Metric icon={CreditCard} label="Abonnement" value={data.planLabel} detail={`${subscriptionStatuses[data.status]} · ${currencyFromCents(data.baseMrrCents, data.currency)}`} />
          <Metric icon={AlertTriangle} label="Risque de résiliation" value={`${data.churnScore}/100`} detail={data.churnLabel} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Fact label="Dernière activité" value={data.lastActivityAt ? formatShortDate(data.lastActivityAt) : "Aucune activité"} />
          <Fact label="Factures" value={`${data.invoices.length} facture(s), ${data.payments.filter((payment) => payment.status === "FAILED").length} paiement(s) échoué(s)`} />
          <Fact label="Tickets ouverts" value={`${data.openTickets.length}`} />
          <Fact label="Intégrations en erreur" value={`${data.integrations.filter((integration) => integration.status === "ERROR").length}`} />
        </div>
      </SectionCard>
      <QuickActions organizationId={data.organization.id} addOns={data.addOns.map((item) => item.addOn)} />
    </div>
  )
}

function UsersTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <SectionCard title="Utilisateurs du cabinet" eyebrow="Accès client" className="mt-4">
      <div className="mt-4 grid gap-3">
        {data.teamMembers.map((member) => (
          <div key={member.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-semibold text-slate-950">{member.name}</p>
              <p className="mt-1 text-sm text-slate-600">{member.email} · {member.role}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Mot de passe interne : {member.internalCredential ? `mis à jour le ${formatShortDate(member.internalCredential.passwordUpdatedAt)}` : "à créer"}
              </p>
            </div>
            <form action={resetUserPassword}>
              <input type="hidden" name="userId" value={member.id} />
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <LockKeyhole className="size-4" aria-hidden="true" />
                Réinitialiser
              </button>
            </form>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
        Mot de passe temporaire après réinitialisation : {TEMPORARY_ADVISOR_PASSWORD}
      </p>
    </SectionCard>
  )
}

function SubscriptionTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Abonnement, factures et paiements" eyebrow="Finance interne">
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric icon={CreditCard} label="Plan" value={subscriptionPlans[data.plan].label} detail={subscriptionStatuses[data.status]} />
          <Metric icon={CreditCard} label="Revenu mensuel du plan" value={currencyFromCents(data.baseMrrCents, data.currency)} detail={data.pricingMode} />
          <Metric icon={CreditCard} label="Options payantes" value={currencyFromCents(data.activeAddOnMrrCents, data.currency)} detail={`${data.addOns.filter((item) => item.status === "ACTIVE").length} active(s)`} />
          <Metric icon={CreditCard} label="Revenu mensuel total" value={currencyFromCents(data.totalMrrCents, data.currency)} detail="Forfait + options" />
        </div>
        <SimpleTable
          title="Factures"
          rows={data.invoices.map((invoice) => [invoice.invoiceNumber ?? invoice.id.slice(0, 8), currencyFromCents(invoice.amountCents, invoice.currency), invoice.status, formatShortDate(invoice.createdAt)])}
          empty="Aucune facture interne."
        />
        <SimpleTable
          title="Paiements"
          rows={data.payments.map((payment) => [payment.invoice?.invoiceNumber ?? payment.id.slice(0, 8), currencyFromCents(payment.amountCents, payment.currency), payment.status, formatShortDate(payment.createdAt)])}
          empty="Aucun paiement enregistré."
        />
      </SectionCard>
      <SectionCard title="Saisie finance" eyebrow="Persisté DB">
        <FinanceForms organizationId={data.organization.id} invoices={data.invoices} />
      </SectionCard>
    </div>
  )
}

function UsageTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <SectionCard title="Usage produit" eyebrow="30 derniers jours + volumes compte" className="mt-4">
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric icon={Activity} label="Contacts" value={`${data.contactsCount}`} detail="Clients + leads" />
        <Metric icon={Activity} label="Tâches" value={`${data.organization._count.tasks}`} detail="Total cabinet" />
        <Metric icon={Activity} label="RDV API" value={`${data.usage30d.appointmentsCount}`} detail="30 jours" />
        <Metric icon={Activity} label="Campagnes" value={`${data.usage30d.campaignsCount}`} detail={`${data.usage30d.campaignSubscribersCount} abonnés API`} />
        <Metric icon={FileText} label="Documents" value={`${data.organization._count.documents}`} detail="Total cabinet" />
        <Metric icon={Activity} label="SMS" value={`${data.usage30d.smsCount}`} detail="30 jours" />
        <Metric icon={Activity} label="API" value={`${data.usage30d.apiCalls}`} detail="30 jours" />
        <Metric icon={Activity} label="Activités CRM" value={`${data.organization._count.activities}`} detail="Total cabinet" />
      </div>
    </SectionCard>
  )
}

function SupportTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Tickets support" eyebrow="Réels">
        <div className="mt-4 grid gap-3">
          {data.tickets.length === 0 ? <Empty>Aucun ticket support.</Empty> : data.tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-slate-600">{ticket.description ?? "Sans description"}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{ticket.module ?? "Module non précisé"} · {formatShortDate(ticket.createdAt)}</p>
                </div>
                <StatusPill tone={ticket.status === "OPEN" ? "amber" : "emerald"}>{ticket.priority} · {ticket.status}</StatusPill>
              </div>
              {ticket.status !== "RESOLVED" ? (
                <form action={resolveSuperAdminTicket} className="mt-3 flex gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input name="confirmation" placeholder="RESOUDRE" className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Résoudre</button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Créer un ticket" eyebrow="Support interne">
        <TicketForm organizationId={data.organization.id} />
      </SectionCard>
    </div>
  )
}

function IntegrationsTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  const gmail = data.organization.gmailConnections.length
  return (
    <SectionCard title="Diagnostic intégrations" eyebrow="Connexions externes" className="mt-4">
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric icon={Plug} label="Gmail" value={`${gmail}`} detail="Connexion(s) native(s)" />
        <Metric icon={Plug} label="Intégrations dev" value={`${data.integrations.length}`} detail={`${data.integrations.filter((item) => item.status === "ERROR").length} erreur(s)`} />
        <Metric icon={Plug} label="Webhooks échoués" value={`${data.webhookDeliveries.filter((item) => item.status === "FAILED").length}`} detail="Livraisons récentes" />
      </div>
      <SimpleTable
        title="Connexions"
        rows={data.integrations.map((item) => [item.provider, item.category, item.status, item.lastSyncAt ? formatShortDate(item.lastSyncAt) : "Jamais"])}
        empty="Aucune intégration développeur branchée."
      />
    </SectionCard>
  )
}

function EmailsTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <SectionCard title="Emails et délivrabilité" eyebrow="Volumes disponibles" className="mt-4">
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric icon={Megaphone} label="Emails API" value={`${data.quota.emailApiCalls}`} detail="Compteur email API du mois" />
        <Metric icon={Megaphone} label="Campagnes" value={`${data.usage30d.campaignsCount}`} detail="Créées via API sur 30 jours" />
        <Metric icon={Megaphone} label="Abonnés" value={`${data.usage30d.campaignSubscribersCount}`} detail="Ajouts campagne API" />
        <Metric icon={Megaphone} label="Logs email" value={`${data.apiLogs.filter((log) => log.endpoint.includes("email") || log.endpoint.includes("campaign")).length}`} detail="API logs liés" />
      </div>
    </SectionCard>
  )
}

function ApiTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <SectionCard title="API et webhooks" eyebrow="Accès technique du cabinet" className="mt-4">
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric icon={Plug} label="Clés API" value={`${data.apiKeys.filter((key) => key.status === "ACTIVE").length}`} detail={`${data.quotaLimits.activeApiKeys} max`} />
        <Metric icon={Plug} label="Webhooks" value={`${data.webhooks.filter((hook) => hook.status === "ACTIVE").length}`} detail={`${data.quotaLimits.activeWebhooks} max`} />
        <Metric icon={Plug} label="Appels/mois" value={`${data.quota.apiCalls}`} detail={`${data.quotaLimits.apiCalls} limite`} />
        <Metric icon={Plug} label="Erreurs API" value={`${data.apiLogs.filter((log) => log.status === "error").length}`} detail="Derniers 100 logs" />
      </div>
      <SimpleTable title="Clés API" rows={data.apiKeys.map((key) => [key.name, key.environment, key.status, key.keyPrefix])} empty="Aucune clé API." />
      <SimpleTable title="Webhooks" rows={data.webhooks.map((hook) => [hook.name, hook.environment, hook.status, `${hook.successRate}% succès`])} empty="Aucun webhook." />
    </SectionCard>
  )
}

function LogsTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <SectionCard title="Logs et audit" eyebrow="Traçabilité" className="mt-4">
      <SimpleTable
        title="Logs API"
        rows={data.apiLogs.slice(0, 30).map((log) => [formatShortDate(log.createdAt), log.type, `${log.method} ${log.endpoint}`, `${log.statusCode}`])}
        empty="Aucun log API."
      />
      <SimpleTable
        title="Audit interne"
        rows={data.auditLogs.slice(0, 30).map((log) => [formatShortDate(log.createdAt), log.action, log.user?.email ?? "Système", log.entityType])}
        empty="Aucun audit log."
      />
    </SectionCard>
  )
}

function SecurityTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Sécurité compte" eyebrow="Contrôles internes">
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric icon={Shield} label="Sessions assistance" value={`${data.assistanceSessions.length}`} detail={`${data.assistanceSessions.filter((item) => item.status === "ACTIVE").length} active(s)`} />
          <Metric icon={Shield} label="Exports/API sensibles" value={`${data.apiLogs.filter((log) => log.endpoint.includes("documents") || log.endpoint.includes("delete")).length}`} detail="Sur logs récents" />
          <Metric icon={Shield} label="Paiements échoués" value={`${data.payments.filter((payment) => payment.status === "FAILED").length}`} detail="Risque accès" />
          <Metric icon={Shield} label="Incidents" value={`${data.incidents.length}`} detail="Impacts liés" />
        </div>
      </SectionCard>
      <SectionCard title="Mode assistance" eyebrow="Action tracée">
        <AssistanceForm organizationId={data.organization.id} />
      </SectionCard>
    </div>
  )
}

function NotesTab({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSuperAdminAccount360>>> }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <SectionCard title="Notes internes" eyebrow="CRM interne">
        <div className="mt-4 grid gap-3">
          {data.notes.length === 0 ? <Empty>Aucune note interne.</Empty> : data.notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">{note.category}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{note.content}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">{note.author?.email ?? "Système"} · {formatShortDate(note.createdAt)}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Ajouter une note" eyebrow="Action suivante">
        <NoteForm organizationId={data.organization.id} />
      </SectionCard>
    </div>
  )
}

function QuickActions({ organizationId, addOns }: { organizationId: string; addOns: Array<{ id: string; name: string }> }) {
  return (
    <SectionCard title="Actions rapides" eyebrow="Super admin">
      <div className="mt-4 grid gap-4">
        <TicketForm organizationId={organizationId} />
        <NoteForm organizationId={organizationId} />
        <AssistanceForm organizationId={organizationId} />
        <form action={createPlatformIncident} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="title" placeholder="Incident lié au cabinet" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="module" placeholder="Module" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select name="priority" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option>NORMAL</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Créer incident</button>
        </form>
        <form action={createProductAnnouncement} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="title" placeholder="Annonce produit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea name="body" placeholder="Message" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Créer annonce</button>
        </form>
        {addOns.length > 0 ? (
          <form action={attachOrganizationAddOn} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input type="hidden" name="organizationId" value={organizationId} />
            <select name="addOnId" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {addOns.map((addOn) => <option key={addOn.id} value={addOn.id}>{addOn.name}</option>)}
            </select>
            <input name="quantity" defaultValue="1" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Activer add-on</button>
          </form>
        ) : null}
      </div>
    </SectionCard>
  )
}

function FinanceForms({ organizationId, invoices }: { organizationId: string; invoices: Array<{ id: string; invoiceNumber: string | null; amountCents: number; currency: string }> }) {
  return (
    <div className="mt-4 grid gap-4">
      <form action={createSaasInvoice} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input name="invoiceNumber" placeholder="Numéro facture" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="amount" placeholder="Montant" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <select name="currency" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>EUR</option><option>CAD</option></select>
        <select name="status" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>DRAFT</option><option>OPEN</option><option>PAID</option><option>VOID</option></select>
        <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Créer facture</button>
      </form>
      <form action={recordSaasPayment} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <select name="invoiceId" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Sans facture liée</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber ?? invoice.id.slice(0, 8)} · {currencyFromCents(invoice.amountCents, invoice.currency)}</option>)}
        </select>
        <input name="amount" placeholder="Montant payé" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <select name="currency" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>EUR</option><option>CAD</option></select>
        <select name="status" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>PAID</option><option>FAILED</option><option>PENDING</option><option>REFUNDED</option></select>
        <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enregistrer paiement</button>
      </form>
    </div>
  )
}

function TicketForm({ organizationId }: { organizationId: string }) {
  return (
    <form action={createSuperAdminTicket} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input name="subject" placeholder="Sujet ticket" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <input name="module" placeholder="Module" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <select name="priority" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select>
      <textarea name="description" placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Créer ticket</button>
    </form>
  )
}

function NoteForm({ organizationId }: { organizationId: string }) {
  return (
    <form action={createSuperAdminNote} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <select name="category" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>GENERAL</option><option>SUPPORT</option><option>COMMERCIAL</option><option>CHURN</option></select>
      <textarea name="content" placeholder="Note interne" className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <input name="nextAction" placeholder="Prochaine action" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Ajouter note</button>
    </form>
  )
}

function AssistanceForm({ organizationId }: { organizationId: string }) {
  return (
    <form action={startAssistanceSession} className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input name="reason" placeholder="Raison obligatoire" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <select name="mode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>READ_ONLY</option><option>ACTIVE_SUPPORT</option></select>
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Démarrer 30 min</button>
    </form>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : "text-violet-700"}`}>{value}</p>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function SimpleTable({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
        {rows.length === 0 ? <Empty>{empty}</Empty> : rows.map((row, index) => (
          <div key={`${title}-${index}`} className="grid gap-2 border-b border-slate-200 bg-white p-3 text-sm last:border-b-0 md:grid-cols-4">
            {row.map((cell, cellIndex) => <span key={cellIndex} className={cellIndex === 0 ? "font-semibold text-slate-950" : "text-slate-600"}>{cell}</span>)}
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-500">{children}</div>
}
