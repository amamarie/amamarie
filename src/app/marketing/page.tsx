import {
  Flame,
  MailCheck,
  Megaphone,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { ConsentStatus } from "@prisma/client"
import { redirect } from "next/navigation"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { AppShell } from "@/components/layout/AppShell"
import { MarketingAutomationWorkspace } from "@/components/marketing/MarketingAutomationWorkspace"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

export default async function MarketingCrmPage() {
  let organizationId: string

  try {
    const tenant = await getTenantContext()
    organizationId = tenant.organizationId
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/sign-in?role=advisor&redirect_url=%2Fmarketing")
    }
    throw error
  }

  const [clients, consents, campaigns, subscribers, recentInteractions] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: { id: true, consentGiven: true },
      take: 250,
    }),
    prisma.clientConsent.findMany({
      where: { organizationId },
      select: { id: true, status: true, type: true, purpose: { select: { code: true, name: true } } },
      take: 250,
    }),
    prisma.developerMarketingCampaign.findMany({
      where: { organizationId },
      select: { id: true, status: true },
      take: 100,
    }),
    prisma.developerCampaignSubscriber.findMany({
      where: { organizationId },
      select: { id: true, status: true, consentConfirmed: true },
      take: 250,
    }),
    prisma.activity.findMany({
      where: {
        organizationId,
        clientId: { not: null },
        type: { in: ["EMAIL_RECEIVED", "SMS_RECEIVED"] },
      },
      select: { id: true, type: true },
      take: 100,
    }),
  ])

  const consentGivenCount = clients.filter((client) => client.consentGiven).length
  const activeConsentCount = consents.filter((consent) => consent.status === ConsentStatus.GIVEN).length
  const marketingConsentCount = consents.filter((consent) => {
    const purpose = `${consent.type} ${consent.purpose?.code ?? ""} ${consent.purpose?.name ?? ""}`.toLowerCase()
    return purpose.includes("marketing") || purpose.includes("prospection") || purpose.includes("communication")
  }).length
  const campaignsActive = campaigns.filter((campaign) => campaign.status === "ACTIVE").length
  const campaignsDraft = campaigns.filter((campaign) => campaign.status === "DRAFT").length
  const hotProspects = recentInteractions.length + subscribers.filter((subscriber) => subscriber.status === "SUBSCRIBED" && subscriber.consentConfirmed).length

  return (
    <AppShell moduleKey="marketing">
      <PageShell
        eyebrow="Croissance"
        title="Marketing automatisé"
        description="Un espace court et guidé pour créer des campagnes, relancer les bons contacts et transformer les clics en rendez-vous."
      >
        <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="emerald">Assistant débutant</StatusBadge>
                <StatusBadge tone="sky">CRM + calendrier</StatusBadge>
                <StatusBadge tone="amber">Conformité avant envoi</StatusBadge>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                Un bouton pour créer le tunnel, puis un tableau pour suivre les résultats.
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Choisissez un objectif métier. Le SaaS prépare la cible, le message, le formulaire, les relances email et le lien de rendez-vous.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-950">Prochaine action recommandée</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-900">
                Cliquez sur “Créer le tunnel” dans le module ci-dessous, puis partagez le formulaire public généré.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={ShieldCheck} label="Accords CRM" value={String(consentGivenCount)} detail="clients avec accord général" />
          <Metric icon={MailCheck} label="Consentements" value={String(activeConsentCount)} detail={`${marketingConsentCount} finalités marketing`} />
          <Metric icon={Megaphone} label="Campagnes" value={String(campaignsActive)} detail={`${campaignsDraft} brouillon(s)`} />
          <Metric icon={Flame} label="Prospects chauds" value={String(hotProspects)} detail="réponses et inscriptions" />
        </div>

        <MarketingAutomationWorkspace />
      </PageShell>
    </AppShell>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-600">{label}</p>
        <Icon className="size-5 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  )
}
