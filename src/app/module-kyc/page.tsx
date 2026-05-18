import { BarChart3, FileCheck2, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react"
import Link from "next/link"

const features = [
  {
    title: "Profil investisseur structuré",
    detail: "Objectifs, horizon, liquidité, connaissances financières, expérience, tolérance et capacité de risque sont suivis séparément.",
    icon: UserRoundCheck,
  },
  {
    title: "Alertes de convenance",
    detail: "Le module détecte les incohérences comme tolérance élevée avec capacité faible, horizon court avec risque élevé ou levier non documenté.",
    icon: ShieldCheck,
  },
  {
    title: "Versions et preuve",
    detail: "Chaque version profil client peut être verrouillée, datée, conservée et liée aux recommandations ou rapports de convenance.",
    icon: FileCheck2,
  },
  {
    title: "Règles cabinet",
    detail: "Les seuils de complétude, fraîcheur, cohérence, conservation, masquage et blocage recommandation sont configurables.",
    icon: BarChart3,
  },
]

export default function KycMarketingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="border-b border-slate-100 bg-emerald-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-200">FinAssuro CRM</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight">Module Profil client intelligent pour conseillers financiers</h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-emerald-50">
              Collectez, validez, confirmez et verrouillez le profil client avec objectifs, horizon, liquidité, tolérance au risque, capacité de risque, audit trail et preuve de convenance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/profil-client" className="rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-950 shadow-[0_6px_0_#10b981] transition hover:-translate-y-0.5">
                Ouvrir le module Profil client
              </Link>
              <Link href="/clients" className="rounded-full border-2 border-emerald-200 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-900">
                Voir les dossiers clients
              </Link>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-emerald-700 bg-emerald-900 p-5 shadow-[0_8px_0_#064e3b]">
            <LockKeyhole className="size-8 text-emerald-200" />
            <p className="mt-4 text-sm font-black uppercase tracking-wide text-emerald-200">Preuve de conformité</p>
            <div className="mt-4 grid gap-3">
              {["profil confirmé par le client", "Capacité de risque distincte", "Version verrouillée", "Recommandation liée à une version profil client", "Journal d’accès Loi 25"].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-3 text-sm font-bold text-emerald-50">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
              <feature.icon className="size-7 text-emerald-700" />
              <h2 className="mt-4 text-lg font-black">{feature.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
