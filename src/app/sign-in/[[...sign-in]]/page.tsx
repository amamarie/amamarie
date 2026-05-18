import { SignIn } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { ArrowRight, Code2, HeartPulse, UsersRound } from "lucide-react"

import { InternalAuthCard } from "@/components/auth/InternalAuthCard"
import { SignedInAuthNotice } from "@/components/auth/SignedInAuthNotice"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { normalizeSaasAppRole, type SaasAppRole } from "@/lib/auth/app-roles"
import { isInternalAuthEnabled } from "@/lib/auth-config"
import { normalizeSubscriptionCurrency, normalizeSubscriptionPlan, normalizeSubscriptionPricingMode } from "@/lib/billing/plans"

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const roleChoices: Array<{
  role: SaasAppRole
  label: string
  description: string
  redirectUrl: string
  icon: typeof HeartPulse
}> = [
  {
    role: "client",
    label: "Client assurance",
    description: "Voir le dossier, confirmer le profil client, envoyer des documents et écrire au conseiller.",
    redirectUrl: "/espace-client",
    icon: HeartPulse,
  },
  {
    role: "advisor",
    label: "Conseiller",
    description: "Ouvrir le CRM cabinet, les clients, documents, tâches et alertes.",
    redirectUrl: "/dashboard",
    icon: UsersRound,
  },
  {
    role: "developer",
    label: "Développeur",
    description: "Superviser les intégrations, webhooks, permissions et journaux techniques.",
    redirectUrl: "/developpeur",
    icon: Code2,
  },
]

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const useInternalAuth = isInternalAuthEnabled()
  const appUser = useInternalAuth ? await getCurrentUserWithOrg() : null
  const clerkUser = useInternalAuth ? null : await currentUser()
  const rawRedirectUrl = Array.isArray(params?.redirect_url) ? params.redirect_url[0] : params?.redirect_url
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role
  const rawEmail = Array.isArray(params?.email) ? params.email[0] : params?.email
  const rawPlan = Array.isArray(params?.plan) ? params.plan[0] : params?.plan
  const rawPricing = Array.isArray(params?.pricing) ? params.pricing[0] : params?.pricing
  const rawCurrency = Array.isArray(params?.currency) ? params.currency[0] : params?.currency
  const rawResetToken = Array.isArray(params?.reset_token) ? params.reset_token[0] : params?.reset_token
  const appRole = normalizeSaasAppRole(rawRole)
  const subscriptionPlan = normalizeSubscriptionPlan(rawPlan)
  const subscriptionPricingMode = normalizeSubscriptionPricingMode(rawPricing)
  const subscriptionCurrency = normalizeSubscriptionCurrency(rawCurrency)
  const selectedChoice = roleChoices.find((choice) => choice.role === appRole) ?? roleChoices[0]
  const initialEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : undefined
  const redirectUrl = rawRedirectUrl?.startsWith("/") ? rawRedirectUrl : selectedChoice.redirectUrl
  const signUpParams = new URLSearchParams()
  if (rawRedirectUrl?.startsWith("/")) signUpParams.set("redirect_url", rawRedirectUrl)
  signUpParams.set("role", appRole)
  if (initialEmail) signUpParams.set("email", initialEmail)
  if (appRole === "advisor") {
    signUpParams.set("plan", subscriptionPlan)
    signUpParams.set("pricing", subscriptionPricingMode)
    signUpParams.set("currency", subscriptionCurrency)
  }
  const signUpUrl = signUpParams.size > 0 ? `/sign-up?${signUpParams.toString()}` : "/auth"
  const signOutParams = new URLSearchParams()
  signOutParams.set("role", appRole)
  if (initialEmail) signOutParams.set("email", initialEmail)
  signOutParams.set("redirect_url", redirectUrl)
  const signOutRedirectUrl = `/sign-in?${signOutParams.toString()}`

  return (
    <main className="grid min-h-screen gap-6 bg-[#f7f9fc] px-4 py-6 text-slate-950 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8">
      <section className="order-2 mx-auto flex w-full max-w-md flex-col justify-center lg:order-1">
        <Link href="/" className="text-sm font-semibold text-slate-500 transition hover:text-slate-950">
          FinAssuro
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Connexion SaaS</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Espace sélectionné: <span className="font-semibold text-slate-950">{selectedChoice.label}</span>. Après connexion, vous serez envoyé vers la bonne plateforme.
        </p>
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-950">Lien client reçu?</p>
          <p className="mt-2 text-sm leading-6 text-emerald-800">
            Connectez-vous avec le même courriel que celui du dossier. Si vous n’avez pas encore de compte, créez votre accès client.
          </p>
          <Link href={signUpUrl} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
            Créer l’accès {selectedChoice.label.toLowerCase()}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-5 grid gap-2 text-sm">
          {roleChoices.map((choice) => {
            const Icon = choice.icon
            const params = new URLSearchParams()
            params.set("role", choice.role)
            params.set("redirect_url", choice.role === appRole ? redirectUrl : choice.redirectUrl)
            if (initialEmail && choice.role === appRole) params.set("email", initialEmail)
            if (choice.role === "advisor" && appRole === "advisor") {
              params.set("plan", subscriptionPlan)
              params.set("pricing", subscriptionPricingMode)
              params.set("currency", subscriptionCurrency)
            }
            const isSelected = choice.role === appRole

            return (
              <Link
                key={choice.role}
                href={`/sign-in?${params.toString()}`}
                className={isSelected
                  ? "flex gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-3 font-semibold text-slate-900 shadow-sm ring-2 ring-emerald-100"
                  : "flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"}
              >
                <span className={isSelected ? "grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700" : "grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block">{choice.label}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">{choice.description}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
      <section id="auth-form" className="order-1 flex items-center justify-center py-4 lg:order-2 lg:py-8">
        {useInternalAuth ? (
          <InternalAuthCard
            mode="sign-in"
            role={appRole}
            redirectUrl={redirectUrl}
            initialEmail={initialEmail}
            resetToken={rawResetToken}
            targetLabel={selectedChoice.label}
            currentUser={appUser ? { email: appUser.email, name: appUser.name } : null}
            alternateHref={signUpUrl}
          />
        ) : clerkUser ? (
          <SignedInAuthNotice
            currentEmail={clerkUser.primaryEmailAddress?.emailAddress}
            currentName={clerkUser.fullName}
            redirectUrl={redirectUrl}
            signOutRedirectUrl={signOutRedirectUrl}
            targetLabel={selectedChoice.label}
          />
        ) : (
          <SignIn
            fallbackRedirectUrl={redirectUrl}
            forceRedirectUrl={redirectUrl}
            signUpUrl={signUpUrl}
            initialValues={initialEmail ? { emailAddress: initialEmail } : undefined}
            appearance={{
              elements: {
                cardBox: "shadow-[0_24px_80px_rgba(15,23,42,0.16)]",
              },
            }}
          />
        )}
      </section>
    </main>
  )
}
