import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Home,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"

const needs = [
  { title: "Protéger ma famille", detail: "Assurance vie, bénéficiaires et budget mensuel.", icon: UsersRound, tone: "emerald" },
  { title: "Protéger mon revenu", detail: "Invalidité, maladie grave et continuité financière.", icon: HeartPulse, tone: "sky" },
  { title: "Protéger mon prêt", detail: "Hypothèque, dettes et obligations importantes.", icon: Home, tone: "amber" },
  { title: "Planifier mon épargne", detail: "Objectifs, horizon et niveau de risque à discuter.", icon: PiggyBank, tone: "violet" },
]

const steps = [
  ["1", "Besoin", "Choisissez ce que vous voulez protéger."],
  ["2", "Profil", "Ajoutez âge, situation familiale et budget."],
  ["3", "Priorité", "Recevez une préparation claire pour le conseiller."],
  ["4", "Rendez-vous", "Planifiez une discussion sécurisée."],
]

export default function InsuranceClientPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Choix des interfaces
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Parcours client
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Sparkles className="size-4" aria-hidden="true" />
            Simple comme un parcours guidé
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Trouver la bonne assurance commence par clarifier votre besoin.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Cette interface est faite pour le client. Elle ne montre ni pipeline, ni tâches internes, ni outils développeur. Elle prépare une conversation utile avec un conseiller.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Sans jargon", "Confidentiel", "Orienté besoin"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Votre préparation</p>
              <h2 className="mt-1 text-xl font-semibold">4 étapes avant le rendez-vous</h2>
            </div>
            <ClipboardList className="size-6 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3">
            {steps.map(([number, title, detail]) => (
              <div key={number} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg bg-slate-50 p-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white">{number}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {needs.map((need) => {
              const Icon = need.icon

              return (
                <article key={need.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-950">{need.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{need.detail}</p>
                    </div>
                  </div>
                  <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Choisir
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </article>
              )
            })}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Résumé client</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Statut", "Préqualification"],
                ["Objectif", "Protection familiale"],
                ["Budget", "À préciser"],
                ["Prochaine action", "Rendez-vous conseiller"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <Link href="/sign-up?role=client" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
              Demander un accompagnement
              <CalendarDays className="size-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
    </main>
  )
}
