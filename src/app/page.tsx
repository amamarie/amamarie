import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Code2,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { cn } from "@/lib/utils"

const portals = [
  {
    title: "Interface développeur",
    eyebrow: "Build & supervision",
    description: "Surveillez les API, les rôles, les webhooks et les intégrations sans accéder au poste conseiller.",
    href: "/developpeur",
    signInHref: "/sign-in?role=developer&redirect_url=%2Fdeveloppeur",
    signUpHref: "/sign-up?role=developer",
    allowedRoles: ["DEVELOPER"],
    action: "Ouvrir la console",
    icon: Code2,
    tone: "violet",
    permissions: ["API", "Logs", "Webhooks", "Permissions"],
  },
  {
    title: "Super admin",
    eyebrow: "Pilotage interne",
    description: "Suivez les clients SaaS, revenus, support, risque de résiliation, incidents et actions sensibles depuis une interface interne.",
    href: "/super-admin",
    signInHref: "/sign-in?role=developer&redirect_url=%2Fsuper-admin",
    signUpHref: "/sign-up?role=developer",
    allowedRoles: ["DEVELOPER"],
    action: "Ouvrir le super admin",
    icon: ShieldCheck,
    tone: "slate",
    permissions: ["Clients", "Revenu récurrent", "Support", "Sécurité"],
  },
  {
    title: "Client assurance",
    eyebrow: "Parcours guidé",
    description: "Aidez une personne à préciser son besoin d’assurance avant de parler à un conseiller.",
    href: "/espace-client",
    signInHref: "/sign-in?role=client&redirect_url=%2Fespace-client",
    signUpHref: "/sign-up?role=client",
    allowedRoles: ["CLIENT", "OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"],
    action: "Ouvrir l’espace client",
    icon: HeartPulse,
    tone: "emerald",
    permissions: ["Besoins", "Budget", "Protection", "Rendez-vous"],
  },
  {
    title: "Interface conseiller",
    eyebrow: "CRM cabinet",
    description: "Gérez prospects, clients, tâches, documents, conformité et communications du cabinet.",
    href: "/dashboard",
    signInHref: "/sign-in?role=advisor&redirect_url=%2Fdashboard",
    signUpHref: "/sign-up?role=advisor",
    allowedRoles: ["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE"],
    action: "Ouvrir le CRM",
    icon: UsersRound,
    tone: "sky",
    permissions: ["Clients", "Pipeline", "Documents", "Conformité"],
  },
]

const differences = [
  ["Développeur", "Configurer la plateforme", "Pas de gestion client quotidienne"],
  ["Client", "Exprimer un besoin d’assurance", "Aucun accès au CRM interne"],
  ["Conseiller", "Suivre les dossiers et recommandations", "Pas d’accès aux outils de build"],
]

const roleLabels: Record<string, string> = {
  DEVELOPER: "développeur",
  CLIENT: "client assurance",
  OWNER: "conseiller",
  ADVISOR: "conseiller",
  ASSISTANT: "assistant",
  COMPLIANCE: "conformité",
}

export default async function PortalHomePage() {
  const user = await getCurrentUserWithOrg()
  const isSignedIn = Boolean(user)
  const currentRoleLabel = user?.role ? roleLabels[user.role] ?? user.role.toLowerCase() : null

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-950">FinAssuro</span>
              <span className="block text-xs font-medium text-slate-500">Trois espaces distincts</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden rounded-lg sm:inline-flex">
              <Link href="/forfaits">Forfaits</Link>
            </Button>
            <Button asChild variant="outline" className="hidden rounded-lg sm:inline-flex">
              <Link href="/auth">Choisir un espace</Link>
            </Button>
            <Button asChild className="rounded-lg bg-slate-950 hover:bg-slate-800">
              <Link href={isSignedIn ? "/post-auth" : "/auth"}>{isSignedIn ? "Continuer" : "Connexion"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:px-8 lg:py-12">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Sparkles className="size-4" aria-hidden="true" />
            Accès séparés par profil
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Choisissez le bon espace avant d’entrer dans FinAssuro.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Le développeur, le client qui cherche une assurance et le conseiller ne doivent pas voir le même produit. Chaque interface a son objectif, son langage et ses permissions.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["Distinct", "Guidé", "Professionnel"].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <BadgeCheck className="size-4 text-emerald-600" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {portals.map((portal) => {
            const Icon = portal.icon
            const canOpenPortal = !user || portal.allowedRoles.includes(user.role)
            const cardClassName = cn(
              "group rounded-lg border bg-white p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              canOpenPortal ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-not-allowed opacity-75",
              portal.tone === "emerald" && "border-emerald-200",
              portal.tone === "violet" && "border-violet-200",
              portal.tone === "sky" && "border-sky-200"
            )
            const content = (
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-lg",
                    portal.tone === "emerald" && "bg-emerald-50 text-emerald-700",
                    portal.tone === "violet" && "bg-violet-50 text-violet-700",
                    portal.tone === "sky" && "bg-sky-50 text-sky-700"
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">{portal.eyebrow}</span>
                  <span className="mt-1 block text-xl font-semibold tracking-tight text-slate-950">{portal.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">{portal.description}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {portal.permissions.map((permission) => (
                      <span key={permission} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {permission}
                      </span>
                    ))}
                  </span>
                  {!canOpenPortal ? (
                    <span className="mt-3 block rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800 ring-1 ring-amber-100">
                      Compte connecté comme {currentRoleLabel}. Cet espace exige un autre profil; il ne redirige pas vers le CRM conseiller.
                    </span>
                  ) : null}
                </span>
                <ArrowRight className={cn("mt-1 size-5 shrink-0 text-slate-400 transition", canOpenPortal && "group-hover:translate-x-0.5 group-hover:text-slate-900")} aria-hidden="true" />
              </div>
            )

            return canOpenPortal ? (
              isSignedIn ? (
                <Link
                  key={portal.title}
                  href={portal.href}
                  className={cardClassName}
                >
                  {content}
                </Link>
              ) : (
                <div key={portal.title} className={cardClassName}>
                  {content}
                  <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <Link
                      href={portal.signInHref}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href={portal.signUpHref}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Créer un accès
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <div key={portal.title} className={cardClassName} aria-disabled="true">
                {content}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            {differences.map(([role, purpose, limit]) => (
              <div key={role} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-slate-500" aria-hidden="true" />
                  <p className="font-semibold text-slate-950">{role}</p>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">{purpose}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{limit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
