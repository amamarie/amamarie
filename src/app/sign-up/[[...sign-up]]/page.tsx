import { SignUp } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { ArrowRight, CheckCircle2, HeartPulse } from "lucide-react"

import { InternalAuthCard } from "@/components/auth/InternalAuthCard"
import { SignedInAuthNotice } from "@/components/auth/SignedInAuthNotice"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import { isInternalAuthEnabled } from "@/lib/auth-config"
import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  subscriptionCurrencies,
  subscriptionPlans,
  subscriptionPricingModes,
} from "@/lib/billing/plans"

type SignUpPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const roleLabels = {
  developer: "Interface développeur",
  advisor: "Interface conseiller",
  client: "Client assurance",
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams
  const useInternalAuth = isInternalAuthEnabled()
  const appUser = useInternalAuth ? await getCurrentUserWithOrg() : null
  const clerkUser = useInternalAuth ? null : await currentUser()
  const rawRole = Array.isArray(params?.role) ? params?.role[0] : params?.role
  const rawEmail = Array.isArray(params?.email) ? params?.email[0] : params?.email
  const rawPlan = Array.isArray(params?.plan) ? params?.plan[0] : params?.plan
  const rawPricing = Array.isArray(params?.pricing) ? params?.pricing[0] : params?.pricing
  const rawCurrency = Array.isArray(params?.currency) ? params?.currency[0] : params?.currency
  const rawRedirectUrl = Array.isArray(params?.redirect_url) ? params?.redirect_url[0] : params?.redirect_url
  const appRole = normalizeSaasAppRole(rawRole)
  const subscriptionPlan = normalizeSubscriptionPlan(rawPlan)
  const subscriptionPricingMode = normalizeSubscriptionPricingMode(rawPricing)
  const subscriptionCurrency = normalizeSubscriptionCurrency(rawCurrency)
  const initialEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : undefined
  const redirectUrl = rawRedirectUrl?.startsWith("/") ? rawRedirectUrl : "/post-auth"
  const signInParams = new URLSearchParams()
  signInParams.set("role", appRole)
  if (initialEmail) signInParams.set("email", initialEmail)
  if (appRole === "advisor") {
    signInParams.set("plan", subscriptionPlan)
    signInParams.set("pricing", subscriptionPricingMode)
    signInParams.set("currency", subscriptionCurrency)
  }
  if (rawRedirectUrl?.startsWith("/")) signInParams.set("redirect_url", rawRedirectUrl)
  const signInUrl = `/sign-in?${signInParams.toString()}`
  const signUpParams = new URLSearchParams()
  signUpParams.set("role", appRole)
  if (initialEmail) signUpParams.set("email", initialEmail)
  if (appRole === "advisor") {
    signUpParams.set("plan", subscriptionPlan)
    signUpParams.set("pricing", subscriptionPricingMode)
    signUpParams.set("currency", subscriptionCurrency)
  }
  if (rawRedirectUrl?.startsWith("/")) signUpParams.set("redirect_url", rawRedirectUrl)
  const signOutRedirectUrl = `/sign-up?${signUpParams.toString()}`
  const isClientAccess = appRole === "client"
  const clientSteps = [
    "Créer votre accès avec le courriel du dossier",
    "Confirmer le code envoyé par courriel",
    "Ouvrir l’espace client lié au conseiller",
  ]

  return (
    <main className="grid min-h-screen gap-6 bg-[#f7f9fc] px-4 py-8 text-slate-950 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <Link href="/auth" className="text-sm font-semibold text-slate-500 transition hover:text-slate-950">
          Changer de profil
        </Link>
        {isClientAccess ? (
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-950 p-5 text-white">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-emerald-300 ring-1 ring-white/10">
                <HeartPulse className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xs font-black uppercase tracking-wide text-emerald-200">Création client</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Créer votre accès client sécurisé</h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                Cet accès sert uniquement à consulter votre dossier, transmettre des documents et confirmer les étapes demandées par votre conseiller.
              </p>
            </div>
            <div className="grid gap-2 p-4">
              {clientSteps.map((step) => (
                <div key={step} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Créer un accès SaaS</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Profil sélectionné: <span className="font-semibold text-slate-950">{roleLabels[appRole]}</span>. Ce choix définit l’espace accessible après inscription.
              {appRole === "advisor" ? (
                <> Forfait choisi: <span className="font-semibold text-slate-950">{subscriptionPlans[subscriptionPlan].label}</span> · {subscriptionPricingModes[subscriptionPricingMode]} · {subscriptionCurrencies[subscriptionCurrency]}.</>
              ) : null}
            </p>
          </>
        )}
        <div className={isClientAccess ? "mt-5 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 shadow-sm" : "mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"}>
          <p className="text-sm font-black text-slate-950">Séparation appliquée</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {isClientAccess
              ? "Votre compte client ne peut pas ouvrir le CRM conseiller. Les informations visibles restent limitées à votre dossier."
              : "Un client ne peut pas ouvrir le CRM conseiller. Un développeur ne reçoit pas les outils de suivi client. Le conseiller garde son espace cabinet."}
          </p>
          {isClientAccess ? (
            <Link href={signInUrl} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-black text-emerald-800 transition hover:bg-emerald-100">
              J’ai déjà un accès
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </section>
      <section className="flex items-center justify-center py-8">
        {useInternalAuth ? (
          <InternalAuthCard
            mode="sign-up"
            role={appRole}
            redirectUrl={redirectUrl}
            subscriptionPlan={appRole === "advisor" ? subscriptionPlan : undefined}
            subscriptionPricingMode={appRole === "advisor" ? subscriptionPricingMode : undefined}
            subscriptionCurrency={appRole === "advisor" ? subscriptionCurrency : undefined}
            initialEmail={initialEmail}
            targetLabel={roleLabels[appRole]}
            currentUser={appUser ? { email: appUser.email, name: appUser.name } : null}
            alternateHref={signInUrl}
          />
        ) : clerkUser ? (
          <SignedInAuthNotice
            currentEmail={clerkUser.primaryEmailAddress?.emailAddress}
            currentName={clerkUser.fullName}
            redirectUrl={redirectUrl}
            signOutRedirectUrl={signOutRedirectUrl}
            targetLabel={roleLabels[appRole]}
          />
        ) : (
          <SignUp
            fallbackRedirectUrl={redirectUrl}
            forceRedirectUrl={redirectUrl}
            signInUrl={signInUrl}
            initialValues={initialEmail ? { emailAddress: initialEmail } : undefined}
            unsafeMetadata={{
              appRole,
              subscriptionPlan: appRole === "advisor" ? subscriptionPlan : undefined,
              subscriptionPricingMode: appRole === "advisor" ? subscriptionPricingMode : undefined,
              subscriptionCurrency: appRole === "advisor" ? subscriptionCurrency : undefined,
            }}
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
