"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { useClerk } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"

type SignedInAuthNoticeProps = {
  currentEmail?: string | null
  currentName?: string | null
  redirectUrl: string
  signOutRedirectUrl: string
  targetLabel: string
}

export function SignedInAuthNotice({
  currentEmail,
  currentName,
  redirectUrl,
  signOutRedirectUrl,
  targetLabel,
}: SignedInAuthNoticeProps) {
  const { signOut } = useClerk()

  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">Session déjà ouverte</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        Vous êtes déjà connecté.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Chrome utilise actuellement le compte{" "}
        <span className="font-semibold text-slate-950">{currentName || currentEmail || "connecté"}</span>.
        Pour créer ou ouvrir un accès <span className="font-semibold text-slate-950">{targetLabel}</span>,
        choisissez l’action appropriée.
      </p>

      <div className="mt-5 grid gap-2">
        <Button asChild className="rounded-lg bg-slate-950 hover:bg-slate-800">
          <Link href={redirectUrl}>Continuer avec cette session</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          onClick={() => signOut({ redirectUrl: signOutRedirectUrl })}
        >
          <LogOut className="mr-2 size-4" aria-hidden="true" />
          Se déconnecter et créer l’accès demandé
        </Button>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Pour tester un lien client sans quitter le compte conseiller, ouvrez le lien en navigation privée.
      </p>
    </div>
  )
}
