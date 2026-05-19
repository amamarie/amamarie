"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LogOut, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SaasAppRole } from "@/lib/auth/app-roles"
import type { SubscriptionCurrencyKey, SubscriptionPlanKey, SubscriptionPricingModeKey } from "@/lib/billing/plans"

type InternalAuthCardProps = {
  mode: "sign-in" | "sign-up"
  role: SaasAppRole
  redirectUrl: string
  subscriptionPlan?: SubscriptionPlanKey
  subscriptionPricingMode?: SubscriptionPricingModeKey
  subscriptionCurrency?: SubscriptionCurrencyKey
  initialEmail?: string
  resetToken?: string
  targetLabel: string
  currentUser?: {
    email?: string | null
    name?: string | null
  } | null
  alternateHref: string
}

export function InternalAuthCard({
  mode,
  role,
  redirectUrl,
  subscriptionPlan,
  subscriptionPricingMode,
  subscriptionCurrency,
  initialEmail,
  resetToken,
  targetLabel,
  currentUser,
  alternateHref,
}: InternalAuthCardProps) {
  const [email, setEmail] = useState(initialEmail ?? "")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState<string | null>(null)
  const [twoFactorEmail, setTwoFactorEmail] = useState<string | null>(null)
  const [twoFactorDeliveryChannel, setTwoFactorDeliveryChannel] = useState<"email" | "sms">("email")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false)
  const [isCompletingReset, setIsCompletingReset] = useState(false)

  const title = mode === "sign-up" ? `Créer l’accès ${targetLabel.toLowerCase()}` : "Connexion FinAssuro"
  const submitLabel = mode === "sign-up" ? "Créer l’accès et entrer" : "Se connecter"
  const helpText = useMemo(() => {
    if (role === "client") {
      return "Utilisez le même courriel que celui du dossier client. Le lien reçu par SMS ou courriel garde le dossier synchronisé."
    }

    return "Utilisez le courriel de votre utilisateur FinAssuro. Un compte existant peut recevoir un mot de passe interne de transition."
  }, [role])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResetMessage(null)

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    if (mode === "sign-up" && password !== passwordConfirmation) {
      setError("Les deux mots de passe ne sont pas identiques.")
      return
    }

    setIsSubmitting(true)

    const response = await fetch("/api/internal-auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name,
        role,
        redirectUrl,
        subscriptionPlan,
        subscriptionPricingMode,
        subscriptionCurrency,
        mode,
      }),
    })
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      redirectUrl?: string
      requiresTwoFactor?: boolean
      challengeId?: string
      email?: string
      deliveryChannel?: "email" | "sms"
    } | null
    setIsSubmitting(false)

    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "Connexion impossible.")
      return
    }

    if (data.requiresTwoFactor && data.challengeId) {
      setTwoFactorChallengeId(data.challengeId)
      setTwoFactorEmail(data.email ?? null)
      setTwoFactorDeliveryChannel(data.deliveryChannel === "sms" ? "sms" : "email")
      setResetMessage(data.deliveryChannel === "sms" ? "Code de vérification envoyé par SMS." : "Code de vérification envoyé par courriel.")
      return
    }

    window.location.href = data.redirectUrl ?? redirectUrl
  }

  async function verifyTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResetMessage(null)

    if (!twoFactorChallengeId) {
      setError("Demande de vérification expirée. Reconnectez-vous.")
      return
    }

    if (twoFactorCode.replace(/\D/g, "").length !== 6) {
      setError("Entrez le code à 6 chiffres reçu.")
      return
    }

    setIsVerifyingTwoFactor(true)

    const response = await fetch("/api/internal-auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: twoFactorChallengeId,
        code: twoFactorCode,
        role,
        redirectUrl,
      }),
    })
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; redirectUrl?: string } | null
    setIsVerifyingTwoFactor(false)

    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "Code de vérification invalide.")
      return
    }

    window.location.href = data.redirectUrl ?? redirectUrl
  }

  async function signOut() {
    await fetch("/api/internal-auth/sign-out", { method: "POST" })
    window.location.href = `/sign-in?role=${role}&redirect_url=${encodeURIComponent(redirectUrl)}`
  }

  async function resetPassword() {
    setError(null)
    setResetMessage(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Entre d’abord le courriel du compte à réinitialiser.")
      return
    }

    setIsResettingPassword(true)

    const response = await fetch("/api/internal-auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    })
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null
    setIsResettingPassword(false)

    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "Réinitialisation impossible.")
      return
    }

    setResetMessage(data.message ?? "Si un compte correspond à ce courriel, un lien sécurisé vient d’être envoyé.")
  }

  async function completePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResetMessage(null)

    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    if (newPassword !== newPasswordConfirmation) {
      setError("Les deux mots de passe ne sont pas identiques.")
      return
    }

    setIsCompletingReset(true)

    const response = await fetch("/api/internal-auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: newPassword, role }),
    })
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null
    setIsCompletingReset(false)

    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "Réinitialisation impossible.")
      return
    }

    setPassword("")
    setNewPassword("")
    setNewPasswordConfirmation("")
    setResetMessage(data.message ?? "Mot de passe modifié. Vous pouvez maintenant vous connecter.")
  }

  if (currentUser) {
    return (
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">Session déjà ouverte</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Vous êtes connecté.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Session active:{" "}
          <span className="font-semibold text-slate-950">
            {currentUser.name || currentUser.email || "utilisateur FinAssuro"}
          </span>
        </p>
        <div className="mt-5 grid gap-2">
          <Button asChild className="rounded-lg bg-slate-950 hover:bg-slate-800">
            <Link href={redirectUrl}>Continuer vers {targetLabel}</Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-lg" onClick={signOut}>
            <LogOut className="mr-2 size-4" aria-hidden="true" />
            Se déconnecter
          </Button>
        </div>
      </div>
    )
  }

  if (resetToken) {
    return (
      <form onSubmit={completePasswordReset} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Réinitialisation sécurisée</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Choisir un nouveau mot de passe</h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          Le lien expire rapidement. Après modification, reconnectez-vous avec le nouveau mot de passe et le code de vérification envoyé par courriel.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-800">
            Nouveau mot de passe
            <PasswordInput
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimum 8 caractères"
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-800">
            Confirmer le mot de passe
            <PasswordInput
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              placeholder="Retaper le mot de passe"
              autoComplete="new-password"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {resetMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            {resetMessage}
          </div>
        ) : null}

        <Button type="submit" disabled={isCompletingReset} className="mt-5 w-full rounded-lg bg-slate-950 hover:bg-slate-800">
          {isCompletingReset ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
          Modifier le mot de passe
        </Button>

        <Link href={`/sign-in?role=${role}&redirect_url=${encodeURIComponent(redirectUrl)}${email ? `&email=${encodeURIComponent(email)}` : ""}`} className="mt-4 block text-center text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">
          Retour à la connexion
        </Link>
      </form>
    )
  }

  if (twoFactorChallengeId) {
    return (
      <form onSubmit={verifyTwoFactor} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Connexion en 2 étapes</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Entrez le code de vérification</h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          Un code à 6 chiffres a été envoyé par {twoFactorDeliveryChannel === "sms" ? "SMS" : "courriel"} à {twoFactorEmail ?? (twoFactorDeliveryChannel === "sms" ? "votre téléphone" : "votre courriel")}. Il expire dans 10 minutes.
        </p>

        <label className="mt-5 grid gap-1.5 text-sm font-medium text-slate-800">
          Code de vérification
          <input
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-12 rounded-lg border border-slate-200 bg-white px-3 text-center text-xl font-semibold tracking-[0.35em] outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {resetMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            {resetMessage}
          </div>
        ) : null}

        <Button type="submit" disabled={isVerifyingTwoFactor} className="mt-5 w-full rounded-lg bg-slate-950 hover:bg-slate-800">
          {isVerifyingTwoFactor ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
          Vérifier et entrer
        </Button>

        <button
          type="button"
          onClick={() => {
            setTwoFactorChallengeId(null)
            setTwoFactorCode("")
            setResetMessage(null)
            setError(null)
          }}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Revenir au mot de passe
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Authentification interne</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{helpText}</p>

      <div className="mt-5 grid gap-4">
        {mode === "sign-up" ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-800">
            Nom complet
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="Jean Tremblay"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium text-slate-800">
          Courriel
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder="nom@domaine.com"
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-slate-800">
          {mode === "sign-up" ? "Choisir un mot de passe" : "Mot de passe"}
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 caractères"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
        </label>

        {mode === "sign-up" ? (
          <>
            <label className="grid gap-1.5 text-sm font-medium text-slate-800">
              Confirmer le mot de passe
              <PasswordInput
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="Retaper le mot de passe"
                autoComplete="new-password"
              />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={password.length >= 8 ? "size-4 text-emerald-600" : "size-4 text-slate-300"} aria-hidden="true" />
                <span>Au moins 8 caractères.</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <CheckCircle2 className={password && password === passwordConfirmation ? "size-4 text-emerald-600" : "size-4 text-slate-300"} aria-hidden="true" />
                <span>Les deux mots de passe correspondent.</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {resetMessage ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {resetMessage}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-5 w-full rounded-lg bg-slate-950 hover:bg-slate-800">
        {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
        {submitLabel}
        {!isSubmitting ? <ArrowRight className="ml-2 size-4" aria-hidden="true" /> : null}
      </Button>

      {mode === "sign-in" ? (
        <button
          type="button"
          onClick={resetPassword}
          disabled={isResettingPassword}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResettingPassword ? "Envoi du lien..." : "Recevoir un lien de réinitialisation"}
        </button>
      ) : null}

      <Link href={alternateHref} className="mt-4 block text-center text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">
        {mode === "sign-up" ? "J’ai déjà un accès" : "Créer un accès"}
      </Link>
    </form>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoComplete: string
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <span className="relative block">
      <input
        value={value}
        onChange={onChange}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        placeholder={placeholder}
        type={isVisible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={8}
        required
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={isVisible ? "Masquer" : "Afficher"}
      >
        {isVisible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </span>
  )
}
