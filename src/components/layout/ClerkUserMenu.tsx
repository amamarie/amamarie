"use client"

import { UserButton } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, LogOut, Save, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getAdvisorInitials, useAdvisorProfile } from "@/lib/advisor-profile-store"
import { cn } from "@/lib/utils"

type ClerkUserMenuProps = {
  avatarClassName: string
  subtitle: string
  showChevron?: boolean
  textClassName?: string
}

export function ClerkUserMenu({ avatarClassName, subtitle, showChevron = false, textClassName = "min-w-0 flex-1" }: ClerkUserMenuProps) {
  const { advisorProfile, updateAdvisorProfile } = useAdvisorProfile()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [formState, setFormState] = useState({
    firstName: advisorProfile.firstName,
    lastName: advisorProfile.lastName,
    title: advisorProfile.title,
    email: advisorProfile.email,
    phone: advisorProfile.phone,
    specialties: advisorProfile.specialties,
  })
  const displayName = advisorProfile.displayName
  const profileSubtitle = advisorProfile.title?.trim() || subtitle || "Espace sécurisé"
  const usesInternalAuth = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "internal"

  useEffect(() => {
    if (!isProfileOpen) return

    const previousOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    const appShell = document.querySelector<HTMLElement>("[data-finadvisor-app-shell]")
    const previousAppShellInert = appShell?.inert ?? false
    const previousAppShellAriaHidden = appShell?.getAttribute("aria-hidden") ?? null

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    document.documentElement.dataset.finadvisorModalOpen = "advisor-profile"
    if (appShell) {
      appShell.inert = true
      appShell.setAttribute("aria-hidden", "true")
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsProfileOpen(false)
    }

    window.addEventListener("keydown", closeWithEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      delete document.documentElement.dataset.finadvisorModalOpen
      if (appShell) {
        appShell.inert = previousAppShellInert
        if (previousAppShellAriaHidden === null) {
          appShell.removeAttribute("aria-hidden")
        } else {
          appShell.setAttribute("aria-hidden", previousAppShellAriaHidden)
        }
      }
      window.removeEventListener("keydown", closeWithEscape)
    }
  }, [isProfileOpen])

  async function signOutInternal() {
    await fetch("/api/internal-auth/sign-out", { method: "POST" })
    window.location.href = "/sign-in"
  }

  function openProfile() {
    setFormState({
      firstName: advisorProfile.firstName,
      lastName: advisorProfile.lastName,
      title: advisorProfile.title,
      email: advisorProfile.email,
      phone: advisorProfile.phone,
      specialties: advisorProfile.specialties,
    })
    setSaveStatus("idle")
    setIsProfileOpen(true)
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (formState.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      setSaveStatus("error")
      return
    }

    updateAdvisorProfile(formState)
    setSaveStatus("saved")
    window.setTimeout(() => setIsProfileOpen(false), 650)
  }

  const profileContent = (
    <>
      <div className={cn("relative shrink-0", avatarClassName)}>
        {advisorProfile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={advisorProfile.avatarUrl} alt={displayName} className="size-full rounded-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
            {getAdvisorInitials(advisorProfile)}
          </div>
        )}
        {!usesInternalAuth ? (
          <div className="absolute inset-0 opacity-0">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: avatarClassName,
                },
              }}
            />
          </div>
        ) : null}
      </div>
      <div className={textClassName}>
        <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
        <p className="truncate text-xs text-slate-500">{profileSubtitle}</p>
      </div>
      {showChevron ? <ChevronDown className="hidden size-4 text-slate-400 lg:block" aria-hidden="true" /> : null}
    </>
  )

  if (usesInternalAuth) {
    return (
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={openProfile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-haspopup="dialog"
          aria-expanded={isProfileOpen}
        >
          {profileContent}
        </button>

        {isProfileOpen && typeof document !== "undefined" ? createPortal((
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden bg-slate-950 px-3 py-4 sm:px-6"
            role="presentation"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onMouseMove={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <form
              onSubmit={saveProfile}
              className="flex max-h-[min(760px,calc(100svh-24px))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
              role="dialog"
              aria-modal="true"
              aria-label="Modifier le profil conseiller"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Profil conseiller</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">Modifier le nom et les coordonnées</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      Ces informations alimentent l’affichage, les signatures et les communications.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Fermer le profil conseiller"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                      Prénom
                      <input
                        value={formState.firstName}
                        onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                      Nom
                      <input
                        value={formState.lastName}
                        onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                    Titre
                    <input
                      value={formState.title}
                      onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                      className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Conseillère en sécurité financière"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                      Courriel
                      <input
                        value={formState.email}
                        onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        type="email"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                      Téléphone
                      <input
                        value={formState.phone}
                        onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "").slice(0, 15) }))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                    Spécialités de routage
                    <textarea
                      value={formState.specialties}
                      onChange={(event) => setFormState((current) => ({ ...current, specialties: event.target.value }))}
                      className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Ex.: assurance vie, invalidité, placements, retraite, entrepreneurs"
                    />
                    <span className="text-xs font-medium leading-5 text-slate-500">
                      Utilisé par l’automatisation formulaire → qualification IA → routage conseiller.
                    </span>
                  </label>

                  {saveStatus === "saved" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                      Profil enregistré et synchronisé avec le compte.
                    </div>
                  ) : null}
                  {saveStatus === "error" ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                      Vérifiez le courriel avant d’enregistrer.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid shrink-0 gap-2 border-t border-slate-100 bg-white p-4 sm:grid-cols-2 sm:p-5">
                <Button type="submit" className="rounded-lg bg-slate-950 hover:bg-slate-800">
                  <Save className="mr-2 size-4" aria-hidden="true" />
                  Enregistrer
                </Button>
                <Button type="button" variant="outline" className="rounded-lg" onClick={signOutInternal}>
                  <LogOut className="mr-2 size-4" aria-hidden="true" />
                  Se déconnecter
                </Button>
              </div>
            </form>
          </div>
        ), document.body) : null}
      </div>
    )
  }

  return (
    <>
      {profileContent}
    </>
  )
}
