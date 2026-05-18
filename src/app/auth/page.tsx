import Link from "next/link"
import { ArrowRight, Code2, HeartPulse, ShieldCheck, UsersRound } from "lucide-react"

const choices = [
  {
    title: "Développeur",
    description: "Console technique, intégrations, logs et supervision.",
    signInHref: "/sign-in?role=developer&redirect_url=%2Fdeveloppeur",
    signUpHref: "/sign-up?role=developer&redirect_url=%2Fdeveloppeur",
    icon: Code2,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    title: "Client assurance",
    description: "Espace personnel pour préparer un besoin d’assurance.",
    signInHref: "/sign-in?role=client&redirect_url=%2Fespace-client",
    signUpHref: "/sign-up?role=client&redirect_url=%2Fespace-client",
    icon: HeartPulse,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    title: "Conseiller",
    description: "CRM cabinet pour prospects, clients, documents et conformité.",
    signInHref: "/sign-in?role=advisor&redirect_url=%2Fdashboard",
    signUpHref: "/sign-up?role=advisor&redirect_url=%2Fdashboard",
    icon: UsersRound,
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
]

export default function AuthChoicePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold">FinAdvisor</span>
              <span className="block text-xs text-slate-500">Authentification SaaS</span>
            </span>
          </Link>
          <Link href="/sign-in" className="text-sm font-semibold text-slate-600 transition hover:text-slate-950">
            Déjà inscrit
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Choix obligatoire
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Choisissez votre espace FinAdvisor.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Chaque rôle ouvre une plateforme différente: client, conseiller ou développeur. La connexion et la création de compte conservent ce choix.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {choices.map((choice) => {
            const Icon = choice.icon

            return (
              <div
                key={choice.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className={`inline-flex size-12 items-center justify-center rounded-lg ring-1 ${choice.tone}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">{choice.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{choice.description}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link
                    href={choice.signInHref}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href={choice.signUpHref}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Créer
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
