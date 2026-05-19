import { Activity, Bot, CheckCircle2, DatabaseZap, GitBranch, PhoneCall, RefreshCcw, TriangleAlert, Workflow } from "lucide-react"

import { DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { Button } from "@/components/ui/button"
import { checkN8nHealth, type N8nWorkflowStatus } from "@/lib/automation/n8n"
import { requireSaasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

import { syncAllAutomationWorkflows, syncInboundCallWorkflow, syncRetellAssuranceWorkflow } from "./actions"

function formatDate(value?: string | Date | null) {
  if (!value) return "Jamais"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function workflowTone(status?: N8nWorkflowStatus) {
  if (!status?.found) return "amber" as const
  if (status.active === false) return "amber" as const
  if (status.lastError) return "rose" as const
  return "emerald" as const
}

export default async function DeveloperAutomationsPage() {
  const user = await requireSaasRole(["DEVELOPER"])
  const [health, totalRules, activeRules, failedRuns, recentRuns] = await Promise.all([
    checkN8nHealth(),
    prisma.automationRule.count(),
    prisma.automationRule.count({ where: { isActive: true } }),
    prisma.automationRun.count({ where: { status: "FAILED" } }),
    prisma.automationRun.findMany({
      take: 8,
      orderBy: { startedAt: "desc" },
      include: {
        organization: { select: { name: true } },
        automationRule: { select: { name: true } },
      },
    }),
  ])
  const workflows = [
    health.leadFormSmsWorkflow,
    health.leadFormMultichannelWorkflow,
    health.leadFormQualificationRoutingWorkflow,
    health.inboundCallReceptionWorkflow,
    health.retellAssurancePhoneAgentWorkflow,
  ].filter(Boolean) as N8nWorkflowStatus[]

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="automatisations" />

      <section className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Moteur technique"
          title="Automatisations serveur"
          description="Console technique pour surveiller n8n, RetellAI, les webhooks et les règles globales. Les conseillers ne voient pas cette page."
        >
          <div className="flex flex-wrap gap-2">
            <form action={syncAllAutomationWorkflows}>
              <Button className="rounded-xl bg-violet-700 font-semibold hover:bg-violet-800">
                <RefreshCcw className="size-4" />
                Sync tous workflows
              </Button>
            </form>
            <form action={syncRetellAssuranceWorkflow}>
              <Button variant="outline" className="rounded-xl border-violet-200 bg-violet-50 font-semibold text-violet-700 hover:bg-violet-100">
                <Bot className="size-4" />
                Sync RetellAI
              </Button>
            </form>
            <form action={syncInboundCallWorkflow}>
              <Button variant="outline" className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50">
                <PhoneCall className="size-4" />
                Sync appel entrant
              </Button>
            </form>
          </div>
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Workflow} label="n8n API" value={health.apiReachable ? "Joignable" : "À vérifier"} detail={health.error ?? "Dernier contrôle effectué"} tone={health.apiReachable ? "emerald" : "rose"} />
          <MetricCard icon={GitBranch} label="Règles CRM" value={`${activeRules}/${totalRules}`} detail="Actives / installées tous cabinets" tone="violet" />
          <MetricCard icon={Activity} label="Runs échoués" value={String(failedRuns)} detail="Historique global automatisations" tone={failedRuns > 0 ? "amber" : "emerald"} />
          <MetricCard icon={DatabaseZap} label="Secrets runtime" value={health.webhookSecretConfigured ? "Configurés" : "Manquants"} detail={health.webhookConfigured ? "Webhooks branchés" : "Base webhook à configurer"} tone={health.webhookSecretConfigured ? "emerald" : "amber"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <SectionCard title="Workflows n8n" eyebrow="Supervision">
            <div className="mt-4 grid gap-3">
              {workflows.map((workflow) => (
                <article key={workflow.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{workflow.name}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{workflow.key}</p>
                    </div>
                    <StatusPill tone={workflowTone(workflow)}>
                      {!workflow.found ? "Absent" : workflow.active === false ? "Inactif" : workflow.lastError ? "Erreur" : "OK"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-medium text-slate-600 md:grid-cols-3">
                    <span>ID : {workflow.id ?? "-"}</span>
                    <span>Dernière exécution : {formatDate(workflow.lastExecutionAt)}</span>
                    <span>Mise à jour : {formatDate(workflow.updatedAt)}</span>
                  </div>
                  {workflow.lastError ? (
                    <p className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700">{workflow.lastError}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Séparation produit" eyebrow="Accès">
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <AccessLine label="Développeur" value="Workflows, webhooks, secrets, santé n8n, logs techniques" tone="violet" />
              <AccessLine label="Admin cabinet" value="Règles métier simples et scénarios activés pour le cabinet" tone="emerald" />
              <AccessLine label="Conseiller" value="Préférences personnelles : agent vocal, message, ton, langue, disponibilités" tone="slate" />
              <AccessLine label="Client" value="Aucun accès aux automatisations" tone="amber" />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Dernières exécutions" eyebrow="Journal automatisations">
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {recentRuns.length === 0 ? (
              <p className="bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune exécution récente.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentRuns.map((run) => (
                  <div key={run.id} className="grid gap-3 bg-white p-4 text-sm md:grid-cols-[1fr_160px_160px] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{run.automationRule?.name ?? run.trigger}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{run.organization.name}</p>
                      {run.error ? <p className="mt-2 text-xs font-semibold text-rose-700">{run.error}</p> : null}
                    </div>
                    <StatusPill tone={run.status === "FAILED" ? "rose" : run.status === "SUCCESS" ? "emerald" : "amber"}>{run.status}</StatusPill>
                    <span className="text-xs font-medium text-slate-500">{formatDate(run.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </section>
    </main>
  )
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof CheckCircle2; label: string; value: string; detail: string; tone: "emerald" | "rose" | "amber" | "violet" }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`inline-flex size-10 items-center justify-center rounded-xl border ${classes[tone]}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{detail}</p>
    </div>
  )
}

function AccessLine({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "violet" | "slate" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{value}</p>
    </div>
  )
}
