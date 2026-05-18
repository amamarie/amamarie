import Link from "next/link"

import { DeveloperHeader, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { RegenerateApiKeyForm } from "@/components/developer/DeveloperApiForms"
import { requireSaasRole } from "@/lib/auth/roles"
import { developerApiPermissions } from "@/lib/developer-api/catalog"
import { parseJsonStringArray } from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

import { revokeDeveloperApiKey } from "../../../actions"

type PageProps = { params: Promise<{ id: string }> }

export default async function DeveloperApiKeyDetailPage({ params }: PageProps) {
  const user = await requireSaasRole(["DEVELOPER"])
  const { id } = await params
  const apiKey = await prisma.developerApiKey.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, subscriptionPlan: true } },
      createdBy: { select: { name: true, email: true } },
      logs: { take: 20, orderBy: { createdAt: "desc" } },
    },
  })

  if (!apiKey) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
        <DeveloperHeader userName={user.name} active="api" />
        <section className="mx-auto max-w-5xl px-4 py-8">
          <SectionCard title="Clé introuvable" eyebrow="API">
            <Link href="/developpeur/api" className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Retour API</Link>
          </SectionCard>
        </section>
      </main>
    )
  }

  const permissions = parseJsonStringArray(apiKey.permissions)

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="api" />
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/developpeur/api" className="text-sm font-semibold text-violet-700 hover:underline">Retour API</Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{apiKey.name}</h1>
            <p className="mt-1 text-sm text-slate-600">{apiKey.organization.name} · {apiKey.environment} · préfixe {apiKey.keyPrefix}</p>
          </div>
          <StatusPill tone={statusTone(apiKey.status)}>{apiKey.status}</StatusPill>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(320px,0.38fr)]">
          <SectionCard title="Détails de la clé" eyebrow="Accès API">
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Cabinet" value={apiKey.organization.name} />
              <Detail label="Forfait" value={apiKey.organization.subscriptionPlan} />
              <Detail label="Créée par" value={apiKey.createdBy?.name ?? apiKey.createdBy?.email ?? "Système"} />
              <Detail label="Créée le" value={formatDate(apiKey.createdAt)} />
              <Detail label="Dernière utilisation" value={apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Jamais"} />
              <Detail label="Expiration" value={apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Aucune"} />
              <Detail label="IP autorisées" value={apiKey.allowedIps ?? "Toutes"} />
              <Detail label="Domaines autorisés" value={apiKey.allowedDomains ?? "Non limité"} />
            </dl>
            <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {permissions.map((permission) => (
                  <span key={permission} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    {developerApiPermissions[permission as keyof typeof developerApiPermissions] ?? permission}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Actions critiques" eyebrow="Double confirmation">
            <div className="mt-4 grid gap-3">
              <RegenerateApiKeyForm apiKeyId={apiKey.id} />
              {apiKey.status === "ACTIVE" ? (
                <form action={revokeDeveloperApiKey} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <input type="hidden" name="apiKeyId" value={apiKey.id} />
                  <label className="grid gap-1.5 text-xs font-semibold text-rose-900">
                    Tape REVOQUER
                    <input name="confirmation" className="h-10 rounded-lg border border-rose-200 bg-white px-3 text-sm" />
                  </label>
                  <button className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">Révoquer définitivement</button>
                </form>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Logs liés à cette clé" eyebrow="Diagnostic">
          <div className="mt-4 grid gap-2">
            {apiKey.logs.map((log) => (
              <Link href={`/developpeur/api/logs/${log.id}`} key={log.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[160px_90px_minmax(0,1fr)_120px]">
                <span className="font-semibold text-slate-500">{formatDate(log.createdAt)}</span>
                <span className="font-semibold text-slate-700">{log.method}</span>
                <span className="min-w-0 truncate font-mono text-xs text-slate-700">{log.endpoint}</span>
                <StatusPill tone={log.status === "success" ? "emerald" : log.status === "warning" ? "amber" : "rose"}>{log.statusCode}</StatusPill>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  )
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function statusTone(status: string): "emerald" | "rose" | "amber" | "slate" {
  if (status === "ACTIVE") return "emerald"
  if (status === "REVOKED" || status === "COMPROMISED") return "rose"
  if (status === "EXPIRED" || status === "INACTIVE") return "amber"
  return "slate"
}
