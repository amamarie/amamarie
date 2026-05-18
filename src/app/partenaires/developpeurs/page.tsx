import Link from "next/link"
import { BookOpenText, KeyRound, PlugZap, ShieldCheck, Webhook, type LucideIcon } from "lucide-react"

import { createDeveloperPartnerRequest } from "@/app/partenaires/developpeurs/actions"
import { developerApiPermissions, permissionGroups } from "@/lib/developer-api/catalog"
import { developerChangelog, developerEndpointReference, developerErrorReference, developerWebhookReference, partnerConnectorReference } from "@/lib/developer-api/reference"

export default function PartnerDeveloperPortalPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border-2 border-slate-200 bg-white p-6 shadow-[0_8px_0_#e2e8f0]">
          <p className="text-sm font-black uppercase text-violet-700">Portail partenaires</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Connecter FinAdvisor à un site, un back-office ou une automatisation</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Utilisez les clés API, OAuth 2.0 client_credentials, webhooks signés et la sandbox pour tester une intégration sans toucher aux vraies données client.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/developpeur/api" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Ouvrir la console développeur</Link>
            <a href="#docs" className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800">Voir les endpoints</a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Feature icon={KeyRound} title="OAuth et clés API" text="Séparez production, sandbox et partenaires avec permissions dédiées." />
          <Feature icon={Webhook} title="Webhooks signés" text="Recevez contact.created, deal.created, task.created ou document.requested." />
          <Feature icon={ShieldCheck} title="Traçabilité" text="Chaque appel est journalisé avec requête masquée, réponse, statut et latence." />
          <Feature icon={PlugZap} title="Connecteurs" text="Google, Outlook, Brevo et Make peuvent être suivis depuis la console." />
        </div>

        <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
            <div>
              <p className="text-sm font-black uppercase text-violet-700">Accès partenaire</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Demander un accès API ou OAuth</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Cette demande crée un dossier interne dans la console développeur. L’équipe peut ensuite valider le cas d’usage, créer un client OAuth, limiter les permissions et accompagner le passage en production.
              </p>
              <div className="mt-4 grid gap-2">
                {[
                  "Validation du cas d’usage et des permissions",
                  "Création d’un client OAuth ou d’une clé sandbox",
                  "Test webhook et vérification des logs",
                  "Passage en production avec accès réversible",
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">{item}</div>
                ))}
              </div>
            </div>
            <form action={createDeveloperPartnerRequest} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Cabinet / partenaire
                  <input name="companyName" required placeholder="Cabinet Martin Conseil" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Contact
                  <input name="contactName" required placeholder="Marie Martin" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Email
                  <input name="email" required type="email" placeholder="marie@cabinet.fr" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Site ou application
                  <input name="website" placeholder="https://cabinet.fr" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Cas d’usage
                <textarea name="useCase" required rows={4} placeholder="Créer des prospects depuis notre site, envoyer contact.created vers Make, synchroniser les tâches..." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-black uppercase text-slate-500">Permissions demandées</p>
                <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                  {permissionGroups.flatMap((group) => group.permissions).map((permission) => (
                    <label key={permission} className="flex items-start gap-2 text-sm text-slate-700">
                      <input name="requestedScopes" value={permission} type="checkbox" className="mt-1 size-4 rounded border-slate-300 text-violet-700" />
                      <span>
                        <span className="block font-bold">{developerApiPermissions[permission]}</span>
                        <span className="block font-mono text-xs text-slate-500">{permission}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">Envoyer la demande partenaire</button>
            </form>
          </div>
        </section>

        <section id="docs" className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <BookOpenText className="size-5 text-violet-700" aria-hidden="true" />
            <h2 className="text-xl font-black">Référence API publique</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {developerEndpointReference.map((endpoint) => (
              <div key={endpoint.path} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="rounded-md bg-slate-950 px-2 py-1 font-mono text-xs font-bold text-white">{endpoint.method}</span>
                <p className="mt-3 font-mono text-sm font-bold text-violet-700">{endpoint.path}</p>
                <p className="mt-1 font-semibold text-slate-950">{endpoint.title}</p>
                <p className="mt-1 text-sm text-slate-600">{endpoint.description}</p>
                <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">{endpoint.permission}</p>
                <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700">Exemples</summary>
                  {endpoint.requestExample ? <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">{JSON.stringify(endpoint.requestExample, null, 2)}</pre> : null}
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">{JSON.stringify(endpoint.responseExample, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Événements webhook</h2>
            <div className="mt-4 grid gap-2">
              {developerWebhookReference.map((event) => (
                <div key={event.event} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-mono text-xs font-bold text-violet-700">{event.event}</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">{event.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{event.trigger}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Erreurs API</h2>
            <div className="mt-4 grid gap-2">
              {developerErrorReference.map((error) => (
                <div key={error.code} className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                  <p className="font-mono text-xs font-bold text-rose-700">{error.code}</p>
                  <p className="mt-1 text-sm font-semibold text-rose-950">{error.message}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Connecteurs suivis</h2>
            <div className="mt-4 grid gap-2">
              {partnerConnectorReference.map((connector) => (
                <div key={connector.provider} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-950">{connector.provider}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-violet-700">{connector.status}</p>
                  <p className="mt-1 text-sm text-slate-600">{connector.capability}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Changelog API</h2>
          <div className="mt-4 grid gap-2">
            {developerChangelog.map((item) => (
              <div key={item.version} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[130px_90px_minmax(0,1fr)]">
                <span className="text-sm font-bold text-slate-600">{item.date}</span>
                <span className="font-mono text-sm font-bold text-violet-700">{item.version}</span>
                <span className="text-sm text-slate-700">{item.change}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Icon className="size-5 text-violet-700" aria-hidden="true" />
      <p className="mt-3 font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}
