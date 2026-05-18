import Link from "next/link"

import { DeveloperHeader, SectionCard, StatusPill } from "@/components/developer/DeveloperChrome"
import { requireSaasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

type PageProps = { params: Promise<{ id: string }> }

export default async function DeveloperApiLogDetailPage({ params }: PageProps) {
  const user = await requireSaasRole(["DEVELOPER"])
  const { id } = await params
  const log = await prisma.developerApiLog.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, subscriptionPlan: true } },
      apiKey: { select: { id: true, name: true, keyPrefix: true } },
      webhook: { select: { id: true, name: true, url: true } },
    },
  })

  if (!log) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
        <DeveloperHeader userName={user.name} active="api" />
        <section className="mx-auto max-w-5xl px-4 py-8">
          <SectionCard title="Log introuvable" eyebrow="API">
            <Link href="/developpeur/api" className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Retour API</Link>
          </SectionCard>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <DeveloperHeader userName={user.name} active="api" />
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <Link href="/developpeur/api" className="text-sm font-semibold text-violet-700 hover:underline">Retour API</Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Détail du log</h1>
          <p className="mt-1 text-sm text-slate-600">{log.organization.name} · {formatDate(log.createdAt)}</p>
        </div>

        <SectionCard title="Résumé" eyebrow={log.type} action={<StatusPill tone={log.status === "success" ? "emerald" : log.status === "warning" ? "amber" : "rose"}>{log.statusCode}</StatusPill>}>
          <dl className="mt-4 grid gap-3 md:grid-cols-3">
            <Detail label="Méthode" value={log.method} />
            <Detail label="Endpoint" value={log.endpoint} mono />
            <Detail label="Environnement" value={log.environment} />
            <Detail label="Latence" value={log.latencyMs ? `${log.latencyMs} ms` : "Non mesurée"} />
            <Detail label="Adresse IP" value={log.ipAddress ?? "Non disponible"} />
            <Detail label="Erreur" value={log.errorCode ?? "Aucune"} />
          </dl>
          {log.apiKey ? <p className="mt-4 text-sm font-semibold text-slate-600">Clé API: <Link href={`/developpeur/api/cles/${log.apiKey.id}`} className="text-violet-700 hover:underline">{log.apiKey.name}</Link> · {log.apiKey.keyPrefix}</p> : null}
          {log.webhook ? <p className="mt-2 text-sm font-semibold text-slate-600">Webhook: {log.webhook.name} · {log.webhook.url}</p> : null}
          {log.errorMessage ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{log.errorMessage}</p> : null}
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <JsonBlock title="Requête masquée" value={log.requestBody} />
          <JsonBlock title="Réponse" value={log.responseBody} />
        </div>
      </section>
    </main>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-950 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <SectionCard title={title} eyebrow="JSON">
      <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
        {value ? JSON.stringify(value, null, 2) : "null"}
      </pre>
    </SectionCard>
  )
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(date)
}
