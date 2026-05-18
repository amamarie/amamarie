import Link from "next/link"
import { HeartPulse, Mail, ShieldCheck } from "lucide-react"

import { ClientPortalWorkspace } from "@/components/client-portal/ClientPortalWorkspace"
import { getClientPortalContext } from "@/lib/client-portal"

type ClientSpacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientSpacePage({ searchParams }: ClientSpacePageProps) {
  const params = await searchParams
  const clientId = Array.isArray(params?.clientId) ? params.clientId[0] : params?.clientId
  const { user, client, isPreview } = await getClientPortalContext(clientId)

  if (!client) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Espace client</span>
                <span className="block text-xs text-slate-500">Dossier assurance</span>
              </span>
            </Link>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
              À lier au dossier
            </span>
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-[2rem] border-2 border-amber-200 bg-white p-6 shadow-[0_10px_0_#fde68a]">
            <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <HeartPulse className="size-6" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight">{isPreview ? "Aucun dossier client trouvé" : "Aucun dossier synchronisé"}</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {isPreview ? (
                <>
                  {clientId
                    ? "Le dossier demandé n’est pas accessible avec la session actuellement ouverte."
                    : "Aucun client actif du cabinet n’est disponible pour afficher l’aperçu de l’espace client."}
                </>
              ) : (
                <>
                  Votre accès client est actif, mais aucun dossier CRM ne correspond encore à votre courriel <span className="font-black text-slate-950">{user.email}</span>.
                </>
              )}
            </p>
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
              {isPreview
                ? clientId
                  ? `Client demandé: ${clientId}. Vérifiez que le dossier appartient au même cabinet que votre session, ou ouvrez le lien client en navigation privée.`
                  : "Ouvrez un aperçu précis avec /espace-client?clientId=ID_DU_CLIENT ou utilisez le bouton Copier le lien espace client dans le dossier CRM."
                : "Demandez à votre conseiller d’utiliser ce même courriel dans votre fiche client. Dès que le courriel correspond, vos documents, messages, tâches et étapes de dossier apparaîtront ici."}
            </p>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Ce que vous pourrez faire ensuite</h2>
            <div className="mt-4 space-y-3">
              {[
                "Voir la progression du profil client, de l’identité, des consentements et des documents.",
                "Envoyer un message directement dans le dossier CRM du conseiller.",
                "Téléverser une pièce jointe classée automatiquement au bon dossier.",
                "Suivre les demandes, tâches ouvertes et dernières activités importantes.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                  <Mail className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    )
  }

  const serializableClient = JSON.parse(JSON.stringify(client))

  return <ClientPortalWorkspace userName={user.name} userEmail={user.email} client={serializableClient} isPreview={isPreview} />
}
