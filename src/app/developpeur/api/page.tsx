import {
  Activity,
  BookOpenText,
  Braces,
  Gauge,
  KeyRound,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  Webhook,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { CompactMetric, DeveloperHeader, PageIntro, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { ApiEndpointTester, CreateApiKeyForm, CreateOAuthClientForm, CreateWebhookForm, DeveloperDocSearch, DeveloperGlobalSearch, IntegrationConnectionForm, RegenerateApiKeyForm, SandboxControls, TestIntegrationForm, TestWebhookForm, type DeveloperSearchItem } from "@/components/developer/DeveloperApiForms"
import { requireSaasRole } from "@/lib/auth/roles"
import {
  getDeveloperConsoleData,
} from "@/lib/developer-console"
import { developerApiPermissions, webhookEventLabels } from "@/lib/developer-api/catalog"
import { developerChangelog, developerEndpointReference, developerErrorReference, developerWebhookReference, partnerConnectorReference } from "@/lib/developer-api/reference"

import { disconnectDeveloperIntegration, revokeDeveloperApiKey, revokeDeveloperOAuthClient, revokeDeveloperWebhook, updateDeveloperPartnerRequestStatus } from "../actions"

export default async function DeveloperApiPage() {
  const user = await requireSaasRole(["DEVELOPER"])
  const {
    accountRecords,
    developerApiKeys,
    developerWebhooks,
    developerApiLogs,
    developerOAuthClients,
    developerIntegrations,
    developerWebhookDeliveries,
    developerPartnerRequests,
    quotaRowsByOrganization,
  } = await getDeveloperConsoleData({ auditLimit: 4 })
  const activeApiKeys = developerApiKeys.filter((key) => key.status === "ACTIVE")
  const activeWebhooks = developerWebhooks.filter((webhook) => webhook.status === "ACTIVE")
  const errorRate = developerApiLogs.length === 0
    ? 0
    : Math.round((developerApiLogs.filter((log) => log.status === "error").length / developerApiLogs.length) * 1000) / 10
  const organizationOptions = accountRecords.map((record) => ({
    id: record.organization.id,
    name: record.organization.name,
    plan: record.plan,
  }))
  const globalSearchItems: DeveloperSearchItem[] = [
    ...developerEndpointReference.map((endpoint) => ({
      type: "Endpoint",
      title: `${endpoint.method} ${endpoint.path}`,
      detail: `${endpoint.title} · ${endpoint.permission}`,
      keywords: `${endpoint.description} ${endpoint.useCase} ${endpoint.errors.map((error) => error.label).join(" ")}`,
    })),
    ...developerWebhookReference.map((event) => ({
      type: "Événement",
      title: event.event,
      detail: `${event.label} · ${event.trigger}`,
      keywords: event.trigger,
    })),
    ...developerErrorReference.map((error) => ({
      type: "Erreur",
      title: error.code,
      detail: error.message,
      keywords: error.message,
    })),
    ...developerApiKeys.map((key) => ({
      type: "Clé API",
      title: key.name,
      detail: `${key.organization.name} · ${key.environment} · ${key.status}`,
      href: `/developpeur/api/cles/${key.id}`,
      keywords: `${key.permissionsList.join(" ")} ${key.keyPrefix}`,
    })),
    ...developerWebhooks.map((webhook) => ({
      type: "Webhook",
      title: webhook.name,
      detail: `${webhook.organization.name} · ${webhook.url} · ${webhook.status}`,
      keywords: webhook.eventList.join(" "),
    })),
    ...developerApiLogs.map((log) => ({
      type: "Log",
      title: `${log.method} ${log.endpoint}`,
      detail: `${log.organization.name} · ${log.statusCode} · ${log.status}`,
      href: `/developpeur/api/logs/${log.id}`,
      keywords: `${log.errorCode ?? ""} ${log.errorMessage ?? ""} ${log.ipAddress ?? ""}`,
    })),
    ...developerOAuthClients.map((client) => ({
      type: "OAuth",
      title: client.name,
      detail: `${client.organization.name} · ${client.clientId} · ${client.status}`,
      keywords: client.permissionsList.join(" "),
    })),
    ...developerIntegrations.map((integration) => ({
      type: "Connecteur",
      title: integration.provider,
      detail: `${integration.organization.name} · ${integration.category} · ${integration.status}`,
      keywords: `${integration.provider} ${integration.category} ${integrationConfigText(integration.config, "lastDiagnostic")} ${integrationConfigText(integration.config, "setupStatus")} ${integrationConfigText(integration.config, "authMethod")}`,
    })),
    ...developerPartnerRequests.map((request) => ({
      type: "Demande partenaire",
      title: request.companyName,
      detail: `${request.contactName} · ${request.email} · ${request.status}`,
      keywords: `${request.useCase} ${Array.isArray(request.requestedScopes) ? request.requestedScopes.join(" ") : ""}`,
    })),
  ]

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="api" />

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Plateforme développeur"
          title="API, webhooks et intégrations"
          description="Centralise les accès techniques sans polluer l’interface conseiller. Les cabinets peuvent être connectés à leur site, Make, Zapier, calendrier, marketing et back-office avec des accès tracés."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <QuickAction icon={KeyRound} label="Créer une clé" />
            <QuickAction icon={Webhook} label="Configurer webhook" />
            <QuickAction icon={TerminalSquare} label="Tester sandbox" />
          </div>
        </PageIntro>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <CompactMetric icon={ShieldCheck} label="Clés actives" value={String(activeApiKeys.length)} detail={`${developerApiKeys.length} clé(s) au total`} tone="emerald" />
          <CompactMetric icon={RotateCcw} label="Webhooks actifs" value={String(activeWebhooks.length)} detail={`${developerWebhooks.length} destination(s)`} tone="violet" />
          <CompactMetric icon={Activity} label="Erreurs logs" value={`${errorRate} %`} detail={`${developerApiLogs.length} événement(s) récents`} tone={errorRate > 5 ? "rose" : "amber"} />
          <CompactMetric icon={Gauge} label="Cabinets API" value={String(quotaRowsByOrganization.length)} detail="Quotas calculés par forfait" tone="emerald" />
        </div>

        <div className="mt-4">
          <DeveloperGlobalSearch items={globalSearchItems} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CreateApiKeyForm organizations={organizationOptions} />
          <CreateWebhookForm organizations={organizationOptions} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.58fr)_minmax(360px,0.42fr)]">
          <SectionCard title="Clés API" eyebrow="Accès sécurisés" action={<StatusPill tone="emerald">{activeApiKeys.length} active(s)</StatusPill>}>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nom</th>
                    <th className="px-3 py-2">Cabinet</th>
                    <th className="px-3 py-2">Environnement</th>
                    <th className="px-3 py-2">Permissions</th>
                    <th className="px-3 py-2">Dernière utilisation</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {developerApiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-3 py-3 font-semibold text-slate-950">
                        <Link href={`/developpeur/api/cles/${key.id}`} className="text-violet-700 hover:underline">{key.name}</Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{key.organization.name}</td>
                      <td className="px-3 py-3 text-slate-600">{key.environment}</td>
                      <td className="px-3 py-3 text-slate-600">{key.permissionsList.slice(0, 2).map((permission) => developerApiPermissions[permission as keyof typeof developerApiPermissions] ?? permission).join(", ")}{key.permissionsList.length > 2 ? ` +${key.permissionsList.length - 2}` : ""}</td>
                      <td className="px-3 py-3 text-slate-600">{key.lastUsedAt ? new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short" }).format(key.lastUsedAt) : "Jamais"}</td>
                      <td className="px-3 py-3"><StatusPill tone={statusTone(key.status)}>{key.status}</StatusPill></td>
                      <td className="px-3 py-3">
                        <div className="grid gap-2">
                          <RegenerateApiKeyForm apiKeyId={key.id} />
                          {key.status === "ACTIVE" ? (
                            <form action={revokeDeveloperApiKey}>
                              <input type="hidden" name="apiKeyId" value={key.id} />
                              <input name="confirmation" placeholder="REVOQUER" className="mb-2 h-8 w-full rounded-lg border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-900" />
                              <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">Révoquer</button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Sécurité développeur" eyebrow="Contrôles critiques">
            <div className="mt-4 grid gap-2">
              {[
                "Clés production avec expiration recommandée",
                "Révocation rapide disponible",
                "Permissions par module CRM",
                "Webhooks signés avec secret",
                "Données sensibles masquées dans les logs",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Webhooks" eyebrow="Événements sortants" action={<StatusPill tone="violet">{activeWebhooks.length} actif(s)</StatusPill>}>
            <div className="mt-4">
              <TestWebhookForm webhooks={developerWebhooks.filter((webhook) => webhook.status === "ACTIVE").map((webhook) => ({ id: webhook.id, name: webhook.name, events: webhook.eventList }))} />
            </div>
            <div className="mt-4 grid gap-2">
              {developerWebhooks.map((webhook) => (
                <div key={webhook.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{webhook.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{webhook.url}</p>
                    </div>
                    <StatusPill tone={statusTone(webhook.status)}>{webhook.status}</StatusPill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                    <span>{webhook.eventList.map((event) => webhookEventLabels[event as keyof typeof webhookEventLabels] ?? event).join(", ")}</span>
                    <span>{webhook.lastDeliveryAt ? new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short" }).format(webhook.lastDeliveryAt) : "Jamais"}</span>
                    <span>{webhook.lastStatusCode ?? "—"} · {Math.round(webhook.successRate)} %</span>
                  </div>
                  {webhook.status === "ACTIVE" ? (
                    <form action={revokeDeveloperWebhook} className="mt-3">
                      <input type="hidden" name="webhookId" value={webhook.id} />
                      <input name="confirmation" placeholder="REVOQUER" className="mr-2 h-9 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-900" />
                      <button className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Révoquer</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Logs API récents" eyebrow="Diagnostic rapide">
            <div className="mt-4 grid gap-2">
              {developerApiLogs.slice(0, 8).map((log) => (
                <Link href={`/developpeur/api/logs/${log.id}`} key={log.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[90px_80px_minmax(0,1fr)_120px]">
                  <span className="font-semibold text-slate-500">{new Intl.DateTimeFormat("fr-CA", { timeStyle: "short" }).format(log.createdAt)}</span>
                  <span className="font-semibold text-slate-700">{log.method}</span>
                  <span className="min-w-0 truncate font-mono text-xs text-slate-700">{log.endpoint}</span>
                  <StatusPill tone={log.status === "success" ? "emerald" : log.status === "warning" ? "amber" : "rose"}>{log.statusCode}</StatusPill>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CreateOAuthClientForm organizations={organizationOptions} />
          <SectionCard title="Clients OAuth" eyebrow="Portail partenaire public">
            <div className="mt-4 grid gap-2">
              {developerOAuthClients.map((client) => (
                <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{client.name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{client.clientId} · {client.organization.name}</p>
                    </div>
                    <StatusPill tone={statusTone(client.status)}>{client.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">{client.permissionsList.slice(0, 4).join(", ")}{client.permissionsList.length > 4 ? ` +${client.permissionsList.length - 4}` : ""}</p>
                  {client.status === "ACTIVE" ? (
                    <form action={revokeDeveloperOAuthClient} className="mt-3">
                      <input type="hidden" name="clientId" value={client.id} />
                      <input name="confirmation" placeholder="REVOQUER" className="mr-2 h-9 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-900" />
                      <button className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Révoquer</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Demandes partenaires" eyebrow="Self-service public" className="mt-4">
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {developerPartnerRequests.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune demande partenaire pour l’instant.</div>
            ) : developerPartnerRequests.map((request) => {
              const scopes = Array.isArray(request.requestedScopes) ? request.requestedScopes.map(String) : []
              return (
                <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{request.companyName}</p>
                      <p className="mt-1 text-sm text-slate-600">{request.contactName} · {request.email}</p>
                      {request.website ? <p className="mt-1 text-xs font-semibold text-violet-700">{request.website}</p> : null}
                    </div>
                    <StatusPill tone={request.status === "APPROVED" ? "emerald" : request.status === "REJECTED" ? "rose" : request.status === "IN_REVIEW" ? "amber" : "violet"}>{request.status}</StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{request.useCase}</p>
                  {scopes.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {scopes.slice(0, 8).map((scope) => <span key={`${request.id}-${scope}`} className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">{scope}</span>)}
                    </div>
                  ) : null}
                  <form action={updateDeveloperPartnerRequestStatus} className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <input type="hidden" name="requestId" value={request.id} />
                    <select name="status" defaultValue={request.status} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
                      <option value="NEW">Nouveau</option>
                      <option value="IN_REVIEW">En revue</option>
                      <option value="APPROVED">Approuvé</option>
                      <option value="REJECTED">Refusé</option>
                    </select>
                    <input name="internalNotes" defaultValue={request.internalNotes ?? ""} placeholder="Note interne" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
                    <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Mettre à jour</button>
                  </form>
                </article>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Documentation API" eyebrow="Endpoints MVP" className="mt-4">
          <div className="mt-4">
            <DeveloperDocSearch />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {developerEndpointReference.map((endpoint) => (
              <article key={endpoint.path} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-950 px-2 py-1 font-mono text-xs font-semibold text-white">{endpoint.method}</span>
                  <span className="font-mono text-xs font-semibold text-violet-700">{endpoint.permission}</span>
                </div>
                <p className="mt-3 font-mono text-sm font-semibold text-slate-950">{endpoint.path}</p>
                <p className="mt-2 text-sm leading-5 text-slate-600">{endpoint.description}</p>
                <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600">{endpoint.useCase}</p>
                <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Requête, réponse et erreurs</summary>
                  {endpoint.requestExample ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">{JSON.stringify(endpoint.requestExample, null, 2)}</pre>
                  ) : null}
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">{JSON.stringify(endpoint.responseExample, null, 2)}</pre>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {endpoint.errors.map((error) => (
                      <span key={`${endpoint.path}-${error.code}`} className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">{error.code} · {error.label}</span>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm text-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-200">
              <Braces className="size-4" aria-hidden="true" />
              Exemple copiable
            </div>
            <pre className="mt-3 overflow-x-auto font-mono text-xs leading-6">{developerEndpointReference[0]?.copyCurl}</pre>
          </div>
          <div className="mt-4">
            <ApiEndpointTester />
          </div>
        </SectionCard>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <SectionCard title="Quotas & limites" eyebrow="Selon forfait">
            <div className="mt-4 grid gap-2">
              {quotaRowsByOrganization.map((quota) => {
                const percent = Math.round((quota.usage.apiCalls / Math.max(quota.limits.apiCalls, 1)) * 100)
                return (
                <div key={quota.organizationId} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_90px_90px_120px]">
                  <span className="font-semibold text-slate-950">{quota.organizationName}</span>
                  <span className="text-slate-600">{quota.usage.apiCalls}</span>
                  <span className="text-slate-600">{quota.limits.apiCalls}</span>
                  <StatusPill tone={percent >= 90 ? "rose" : percent >= 75 ? "amber" : "emerald"}>{percent} %</StatusPill>
                </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Intégrations prioritaires" eyebrow="Connecteurs">
            <div className="mt-4">
              <IntegrationConnectionForm organizations={organizationOptions} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {partnerConnectorReference.map((integration) => (
                <div key={integration.provider} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{integration.provider}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{integration.status}</p>
                    </div>
                    <PlugZap className="size-4 text-violet-700" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{integration.capability}</p>
                </div>
              ))}
            </div>
            {developerIntegrations.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {developerIntegrations.map((integration) => {
                  const config = integrationConfig(integration.config)
                  const connectionUrl = safeText(config.connectionUrl)
                  const lastDiagnostic = safeText(config.lastDiagnostic) || "Aucun test lancé pour ce connecteur."
                  const setupStatus = safeText(config.setupStatus) || "NON_CONFIGURE"
                  const authMethod = safeText(config.authMethod) || "Méthode non renseignée"
                  const lastStatusCode = safeText(config.lastStatusCode)
                  const lastLatencyMs = safeText(config.lastLatencyMs)

                  return (
                    <div key={integration.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-950">{integration.provider}</p>
                          <p className="mt-1 text-xs text-slate-500">{integration.organization.name} · {integration.category}</p>
                        </div>
                        <StatusPill tone={integrationStatusTone(integration.status)}>{integration.status}</StatusPill>
                      </div>
                      <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                        <p><span className="font-semibold text-slate-900">Méthode:</span> {authMethod}</p>
                        <p><span className="font-semibold text-slate-900">Configuration:</span> {setupStatus}</p>
                        {connectionUrl ? <p className="sm:col-span-2"><span className="font-semibold text-slate-900">URL:</span> <span className="break-all">{connectionUrl}</span></p> : null}
                        <p className="sm:col-span-2"><span className="font-semibold text-slate-900">Diagnostic:</span> {lastDiagnostic}</p>
                        {lastStatusCode || lastLatencyMs ? (
                          <p className="sm:col-span-2">
                            <span className="font-semibold text-slate-900">Dernier test:</span>
                            {lastStatusCode ? ` HTTP ${lastStatusCode}` : ""}
                            {lastLatencyMs ? ` · ${lastLatencyMs} ms` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        <TestIntegrationForm integrationId={integration.id} />
                        {integration.status === "CONNECTED" ? (
                          <form action={disconnectDeveloperIntegration} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="integrationId" value={integration.id} />
                            <input name="confirmation" placeholder="DESACTIVER" className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-900" />
                            <button className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">Désactiver</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </SectionCard>
        </div>

        <SectionCard title="Sandbox et changelog" eyebrow="Test sans risque" className="mt-4">
          <div className="mt-4">
            <SandboxControls organizations={organizationOptions} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Feature icon={RotateCcw} title="Reset sandbox" text="Réinitialisation des contacts, tâches, campagnes et événements fictifs." />
            <Feature icon={BookOpenText} title="Changelog API" text={developerChangelog.map((item) => `${item.version} ${item.change}`).join(" ")} />
            <Feature icon={TerminalSquare} title="Simulateur" text="Envoi manuel d’un contact.created ou deal.stage_changed vers un webhook test." />
          </div>
          {developerWebhookDeliveries.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Webhook</th>
                    <th className="px-3 py-2">Événement</th>
                    <th className="px-3 py-2">Tentative</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Prochaine tentative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {developerWebhookDeliveries.slice(0, 8).map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-3 py-2 font-semibold text-slate-950">{delivery.webhook.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{delivery.event}</td>
                      <td className="px-3 py-2 text-slate-600">{delivery.attempt}/{delivery.maxAttempts}</td>
                      <td className="px-3 py-2"><StatusPill tone={delivery.status === "DELIVERED" ? "emerald" : delivery.status === "FAILED" ? "rose" : "amber"}>{delivery.status}</StatusPill></td>
                      <td className="px-3 py-2 text-slate-600">{new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short" }).format(delivery.nextAttemptAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      </section>
    </main>
  )
}

function statusTone(status: string): "emerald" | "rose" | "amber" | "violet" | "slate" {
  if (status === "ACTIVE") return "emerald"
  if (status === "REVOKED" || status === "COMPROMISED") return "rose"
  if (status === "EXPIRED" || status === "INACTIVE") return "amber"
  return "slate"
}

function integrationStatusTone(status: string): "emerald" | "rose" | "amber" | "violet" | "slate" {
  if (status === "CONNECTED") return "emerald"
  if (status === "ERROR") return "rose"
  if (status === "NEEDS_CONFIGURATION") return "amber"
  if (status === "DISCONNECTED") return "slate"
  return "violet"
}

function integrationConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function integrationConfigText(value: unknown, key: string): string {
  return safeText(integrationConfig(value)[key])
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function QuickAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-[0_3px_0_#e2e8f0] transition hover:bg-slate-50">
      <Icon className="size-4 text-violet-700" aria-hidden="true" />
      {label}
    </button>
  )
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Icon className="size-5 text-violet-700" aria-hidden="true" />
      <p className="mt-3 font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
    </div>
  )
}
