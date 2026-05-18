"use client"

import { useActionState, useMemo, useState } from "react"
import { Copy, KeyRound, PlugZap, RotateCcw, Search, Send, Webhook } from "lucide-react"

import {
  createDeveloperApiKeyAction,
  createDeveloperOAuthClientAction,
  createDeveloperWebhookAction,
  regenerateDeveloperApiKeyAction,
  resetDeveloperSandboxAction,
  seedDeveloperSandboxAction,
  testDeveloperIntegrationAction,
  testDeveloperWebhookAction,
  upsertDeveloperIntegrationAction,
  type DeveloperApiActionState,
} from "@/app/developpeur/actions"
import {
  developerApiPermissions,
  permissionGroups,
  webhookEventLabels,
  type DeveloperApiPermission,
  type WebhookEventKey,
} from "@/lib/developer-api/catalog"
import {
  developerEndpointReference,
  developerErrorReference,
  developerWebhookReference,
  connectorProviderCatalog,
  partnerConnectorReference,
} from "@/lib/developer-api/reference"

const initialState: DeveloperApiActionState = { status: "idle" }

type OrganizationOption = {
  id: string
  name: string
  plan: string
}

type WebhookOption = {
  id: string
  name: string
  events: string[]
}

export type DeveloperSearchItem = {
  type: string
  title: string
  detail: string
  href?: string
  keywords: string
}

export function DeveloperGlobalSearch({ items }: { items: DeveloperSearchItem[] }) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const results = normalizedQuery
    ? items.filter((item) => `${item.type} ${item.title} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalizedQuery)).slice(0, 12)
    : items.slice(0, 8)

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <label className="flex items-center gap-2 rounded-xl border-2 border-violet-100 bg-violet-50 px-3">
        <Search className="size-4 text-violet-700" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Recherche globale: endpoint, clé, webhook, erreur, OAuth, connecteur, log..."
          className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-violet-400"
        />
      </label>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {results.map((item, index) => {
          const content = (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-violet-200 hover:bg-violet-50">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white">{item.type}</span>
                {item.href ? <span className="text-xs font-semibold text-violet-700">Ouvrir</span> : null}
              </div>
              <p className="mt-2 font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{item.detail}</p>
            </div>
          )

          return item.href ? (
            <a key={`${item.type}-${item.title}-${index}`} href={item.href}>
              {content}
            </a>
          ) : (
            <div key={`${item.type}-${item.title}-${index}`}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}

export function CreateApiKeyForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(createDeveloperApiKeyAction, initialState)
  const [permissionLevel, setPermissionLevel] = useState("read_create")
  const defaultPermissions = useMemo(() => Object.keys(developerApiPermissions).filter((permission) => permission.endsWith(":read")) as DeveloperApiPermission[], [])

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-violet-700" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-950">Créer une clé API</h3>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Cabinet
          <select name="organizationId" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name} · {organization.plan}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Environnement
          <select name="environment" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Nom de la clé
          <input name="name" placeholder="Site web cabinet" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Expiration
          <select name="expiration" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="never">Jamais</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
            <option value="1y">1 an</option>
          </select>
        </label>
      </div>

      <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700">
        Description
        <textarea name="description" rows={2} placeholder="Utilisée pour créer des prospects depuis le site du cabinet." className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ["read_only", "Lecture seule", "Peut lire sans modifier."],
          ["read_create", "Lecture + création", "Contacts, tâches et opportunités."],
          ["custom", "Personnalisé", "Permissions granulaires."],
        ].map(([value, label, detail]) => (
          <label key={value} className={`rounded-xl border-2 p-3 ${permissionLevel === value ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
            <input
              type="radio"
              name="permissionLevel"
              value={value}
              checked={permissionLevel === value}
              onChange={() => setPermissionLevel(value)}
              className="sr-only"
            />
            <span className="block text-sm font-semibold text-slate-950">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
          </label>
        ))}
      </div>

      {permissionLevel === "custom" ? (
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {permissionGroups.map((group) => (
            <div key={group.label} className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{group.label}</p>
              <div className="mt-2 grid gap-2">
                {group.permissions.map((permission) => (
                  <label key={permission} className="flex items-start gap-2 text-sm text-slate-700">
                    <input name="permissions" value={permission} type="checkbox" className="mt-1 size-4 rounded border-slate-300 text-violet-700" />
                    <span>
                      <span className="block font-semibold">{developerApiPermissions[permission]}</span>
                      <span className="block font-mono text-xs text-slate-500">{permission}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 hidden">
          {defaultPermissions.map((permission) => <input key={permission} name="permissions" value={permission} readOnly />)}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          IP autorisées
          <input name="allowedIps" placeholder="185.42.XX.XX, 92.10.XX.XX" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Quota mensuel
          <input name="quotaMonthly" type="number" min="0" placeholder="10000" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
      </div>

      <button disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
        <KeyRound className="size-4" aria-hidden="true" />
        {pending ? "Création..." : "Créer la clé API"}
      </button>

      <ActionResult state={state} />
    </form>
  )
}

export function RegenerateApiKeyForm({ apiKeyId }: { apiKeyId: string }) {
  const [state, action, pending] = useActionState(regenerateDeveloperApiKeyAction, initialState)

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="apiKeyId" value={apiKeyId} />
      <input name="confirmation" placeholder="Tape REGENERER" className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900 placeholder:text-amber-500" />
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
        <RotateCcw className="size-4" aria-hidden="true" />
        Régénérer
      </button>
      <ActionResult state={state} compact />
    </form>
  )
}

export function CreateWebhookForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(createDeveloperWebhookAction, initialState)

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Webhook className="size-5 text-violet-700" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-950">Créer un webhook</h3>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Cabinet
          <select name="organizationId" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Environnement
          <select name="environment" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Nom
          <input name="name" placeholder="Make - nouveaux prospects" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          URL HTTPS
          <input name="url" placeholder="https://hook.make.com/..." className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {(Object.entries(webhookEventLabels) as Array<[WebhookEventKey, string]>).map(([event, label]) => (
          <label key={event} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm">
            <input name="events" value={event} type="checkbox" className="mt-1 size-4 rounded border-slate-300 text-violet-700" />
            <span>
              <span className="block font-semibold text-slate-800">{label}</span>
              <span className="block font-mono text-xs text-slate-500">{event}</span>
            </span>
          </label>
        ))}
      </div>

      <button disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
        <Webhook className="size-4" aria-hidden="true" />
        {pending ? "Création..." : "Créer le webhook"}
      </button>

      <ActionResult state={state} />
    </form>
  )
}

export function TestWebhookForm({ webhooks }: { webhooks: WebhookOption[] }) {
  const [state, action, pending] = useActionState(testDeveloperWebhookAction, initialState)

  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <p className="text-sm font-semibold text-violet-950">Tester un webhook réel</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <select name="webhookId" className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm">
          {webhooks.map((webhook) => (
            <option key={webhook.id} value={webhook.id}>{webhook.name}</option>
          ))}
        </select>
        <select name="event" className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm">
          {(Object.entries(webhookEventLabels) as Array<[WebhookEventKey, string]>).map(([event, label]) => (
            <option key={event} value={event}>{label}</option>
          ))}
        </select>
        <button disabled={pending || webhooks.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
          <Send className="size-4" aria-hidden="true" />
          Tester
        </button>
      </div>
      <ActionResult state={state} compact />
    </form>
  )
}

export function SandboxControls({ organizations }: { organizations: OrganizationOption[] }) {
  const [seedState, seedAction, seedPending] = useActionState(seedDeveloperSandboxAction, initialState)
  const [resetState, resetAction, resetPending] = useActionState(resetDeveloperSandboxAction, initialState)
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "")

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <p className="text-sm font-semibold text-violet-950">Sandbox isolée</p>
      <p className="mt-1 text-xs leading-5 text-violet-800">
        Génère des contacts, opportunités et tâches fictifs sans modifier les vrais cabinets.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm">
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name} · {organization.plan}</option>
          ))}
        </select>
        <form id="sandbox-seed-form" action={seedAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <button disabled={seedPending} className="h-10 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
            Générer
          </button>
        </form>
        <form action={resetAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="confirmation" placeholder="REINITIALISER" className="mr-2 h-10 w-36 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-900" />
          <button disabled={resetPending} className="h-10 rounded-lg border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60">
            Réinitialiser
          </button>
        </form>
      </div>
      <ActionResult state={seedState} compact />
      <ActionResult state={resetState} compact />
    </div>
  )
}

export function ApiEndpointTester() {
  const [apiKey, setApiKey] = useState("")
  const [endpoint, setEndpoint] = useState("/api/v1/contacts")
  const [method, setMethod] = useState("GET")
  const [body, setBody] = useState('{"first_name":"Jean","last_name":"Martin","email":"jean@example.com","phone":"+15145550123","source":"site_web"}')
  const [result, setResult] = useState("")
  const [pending, setPending] = useState(false)

  async function runTest() {
    setPending(true)
    setResult("")
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: method === "GET" ? undefined : body,
      })
      const payload = await response.json().catch(() => null)
      setResult(JSON.stringify({ status: response.status, body: payload }, null, 2))
    } catch (error) {
      setResult(JSON.stringify({ error: error instanceof Error ? error.message : "Test impossible" }, null, 2))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Send className="size-5 text-violet-700" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-950">Tester un endpoint</h3>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <select value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          {developerEndpointReference.filter((item) => item.path.startsWith("/api/v1/")).map((item) => (
            <option key={item.path} value={item.path}>{item.path}</option>
          ))}
        </select>
      </div>
      <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700">
        Clé API
        <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk_live_..." className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      </label>
      {method !== "GET" ? (
        <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700">
          JSON
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
        </label>
      ) : null}
      <button type="button" disabled={pending || !apiKey} onClick={runTest} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Test..." : "Tester en sandbox ou production"}
      </button>
      {result ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">{result}</pre> : null}
    </div>
  )
}

export function CreateOAuthClientForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(createDeveloperOAuthClientAction, initialState)
  const [permissionLevel, setPermissionLevel] = useState("read_create")

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-violet-700" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-950">Créer un client OAuth</h3>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Cabinet
          <select name="organizationId" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Nom
          <input name="name" placeholder="Portail partenaire" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
        </label>
      </div>
      <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700">
        Redirect URIs
        <textarea name="redirectUris" rows={2} placeholder="https://partenaire.example.com/callback" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ["read_only", "Lecture seule", "Lecture API uniquement."],
          ["read_create", "Lecture + création", "Cas partenaire standard."],
          ["custom", "Personnalisé", "Permissions granulaires."],
        ].map(([value, label, detail]) => (
          <label key={value} className={`rounded-xl border-2 p-3 ${permissionLevel === value ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
            <input type="radio" name="permissionLevel" value={value} checked={permissionLevel === value} onChange={() => setPermissionLevel(value)} className="sr-only" />
            <span className="block text-sm font-semibold text-slate-950">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
          </label>
        ))}
      </div>
      {permissionLevel === "custom" ? (
        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {permissionGroups.map((group) => (
            <div key={group.label} className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{group.label}</p>
              <div className="mt-2 grid gap-2">
                {group.permissions.map((permission) => (
                  <label key={permission} className="flex items-start gap-2 text-sm text-slate-700">
                    <input name="permissions" value={permission} type="checkbox" className="mt-1 size-4 rounded border-slate-300 text-violet-700" />
                    <span>{developerApiPermissions[permission]}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <button disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
        <KeyRound className="size-4" aria-hidden="true" />
        {pending ? "Création..." : "Créer le client OAuth"}
      </button>
      <ActionResult state={state} />
    </form>
  )
}

export function IntegrationConnectionForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action, pending] = useActionState(upsertDeveloperIntegrationAction, initialState)
  const [provider, setProvider] = useState<string>(connectorProviderCatalog[0]?.key ?? "google-calendar")
  const selectedProvider = connectorProviderCatalog.find((item) => item.key === provider) ?? connectorProviderCatalog[0]

  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="flex items-center gap-2">
        <PlugZap className="size-5 text-violet-700" aria-hidden="true" />
        <p className="text-sm font-semibold text-violet-950">Brancher un connecteur</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select name="organizationId" className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm">
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </select>
        <select name="provider" value={provider} onChange={(event) => setProvider(event.target.value)} className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm">
          {connectorProviderCatalog.map((connector) => (
            <option key={connector.key} value={connector.key}>{connector.name}</option>
          ))}
        </select>
        <input name="category" value={selectedProvider.category} readOnly className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-700" />
        <input name="externalAccount" placeholder="Compte ou workspace externe" className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm" />
      </div>
      <input name="connectionUrl" placeholder={selectedProvider.testMode === "webhook_post" ? "URL webhook HTTPS" : "URL de callback ou identifiant externe"} className="mt-2 h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm" />
      <input name="secret" placeholder={selectedProvider.testMode === "api_key_present" ? "Clé API fournisseur" : "Token/API key optionnel"} className="mt-2 h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm" />
      <div className="mt-2 rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs leading-5 text-violet-900">
        <span className="font-bold">{selectedProvider.authMethod}.</span> {selectedProvider.setupHint}
      </div>
      <button disabled={pending} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
        {pending ? "Connexion..." : "Enregistrer le connecteur"}
      </button>
      <ActionResult state={state} compact />
    </form>
  )
}

export function TestIntegrationForm({ integrationId }: { integrationId: string }) {
  const [state, action, pending] = useActionState(testDeveloperIntegrationAction, initialState)

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="integrationId" value={integrationId} />
      <button disabled={pending} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60">
        {pending ? "Test..." : "Tester le connecteur"}
      </button>
      <ActionResult state={state} compact />
    </form>
  )
}

export function DeveloperDocSearch() {
  const items = [
    ...developerEndpointReference.map((item) => ({
      title: item.title,
      method: item.method,
      path: item.path,
      permission: item.permission,
      text: `${item.description} ${item.useCase} ${item.errors.map((error) => `${error.code} ${error.label}`).join(" ")}`,
    })),
    ...developerWebhookReference.map((item) => ({
      title: item.label,
      method: "EVENT",
      path: item.event,
      permission: "webhook event",
      text: item.trigger,
    })),
    ...developerErrorReference.map((item) => ({
      title: item.code,
      method: "ERROR",
      path: item.code,
      permission: item.message,
      text: item.message,
    })),
    ...partnerConnectorReference.map((item) => ({
      title: item.provider,
      method: "APP",
      path: item.provider,
      permission: item.status,
      text: item.capability,
    })),
  ]
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const results = normalizedQuery
    ? items.filter((item) => `${item.title} ${item.method} ${item.path} ${item.permission} ${item.text}`.toLowerCase().includes(normalizedQuery))
    : items

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
        <Search className="size-4 text-slate-500" aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un endpoint, événement, permission ou erreur..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {results.map((item) => (
          <div key={item.path} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-950">{item.title}</span>
              <span className="rounded-md bg-slate-950 px-2 py-1 font-mono text-xs font-semibold text-white">{item.method}</span>
            </div>
            <p className="mt-2 font-mono text-xs font-semibold text-violet-700">{item.path}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{item.permission}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionResult({ state, compact = false }: { state: DeveloperApiActionState; compact?: boolean }) {
  if (state.status === "idle") return null

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
      {state.message ? <p className="font-semibold">{state.message}</p> : null}
      {state.secret ? (
        <div className={`mt-2 grid gap-2 ${compact ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
          <code className="min-w-0 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-900">{state.secret}</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(state.secret ?? "")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">
            <Copy className="size-4" aria-hidden="true" />
            Copier
          </button>
        </div>
      ) : null}
    </div>
  )
}
