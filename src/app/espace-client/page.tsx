import Link from "next/link"
import { CheckCircle2, FileText, HeartPulse, Mail, MessageSquareText, ShieldCheck, UploadCloud } from "lucide-react"

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
    const steps = [
      { icon: Mail, title: "Courriel du dossier", detail: "L’accès doit utiliser le même courriel que la fiche client." },
      { icon: FileText, title: "Dossier CRM lié", detail: "Le conseiller peut copier ou renvoyer le lien depuis votre dossier." },
      { icon: ShieldCheck, title: "Accès sécurisé", detail: "Une fois lié, le profil, les documents et consentements apparaissent ici." },
    ]
    const availableActions = [
      { icon: MessageSquareText, title: "Écrire au conseiller", detail: "Les messages seront classés dans le dossier." },
      { icon: UploadCloud, title: "Ajouter des documents", detail: "Les fichiers seront visibles par le cabinet." },
      { icon: CheckCircle2, title: "Confirmer les étapes", detail: "Profil, consentements et demandes de suivi." },
    ]

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

        <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_320px] lg:px-8">
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-950 p-6 text-white">
              <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-emerald-300 ring-1 ring-white/10">
                <HeartPulse className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-wide text-emerald-200">
                {isPreview ? "Aperçu indisponible" : "Dossier à lier"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{isPreview ? "Aucun dossier client trouvé" : "Votre espace est prêt, mais aucun dossier n’est encore lié"}</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                {isPreview
                  ? clientId
                    ? "Le dossier demandé n’est pas accessible avec la session actuellement ouverte."
                    : "Aucun client actif du cabinet n’est disponible pour afficher l’aperçu de l’espace client."
                  : `Aucun dossier CRM ne correspond encore au courriel ${user.email}.`}
              </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              {steps.map((step) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <h2 className="mt-3 text-sm font-black text-slate-950">{step.title}</h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{step.detail}</p>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-slate-100 p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                {isPreview
                  ? clientId
                    ? `Client demandé: ${clientId}. Vérifiez que le dossier appartient au même cabinet que votre session, ou ouvrez le lien client en navigation privée.`
                    : "Ouvrez un aperçu précis depuis un dossier client CRM avec le bouton de lien espace client."
                  : "Demandez à votre conseiller de vérifier le courriel de votre fiche client ou de vous renvoyer le lien sécurisé du dossier."}
              </div>
            </div>
          </div>

          <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-lg font-black text-slate-950">Après liaison</h2>
            <div className="mt-4 grid gap-3">
              {availableActions.map((action) => {
                const Icon = action.icon
                return (
                  <div key={action.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-100">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-950">{action.title}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{action.detail}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 grid gap-2">
              <Link href="/sign-in?role=client&redirect_url=%2Fespace-client" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white transition hover:bg-slate-800">
                Revenir à la connexion
              </Link>
              <Link href="/" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                Accueil FinAssuro
              </Link>
            </div>
          </aside>
        </section>
      </main>
    )
  }

  const serializableClient = JSON.parse(JSON.stringify(client))

  return <ClientPortalWorkspace userName={user.name} userEmail={user.email} client={serializableClient} isPreview={isPreview} />
}
