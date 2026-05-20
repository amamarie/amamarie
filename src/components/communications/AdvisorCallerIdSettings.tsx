"use client"

import { CheckCircle2, Loader2, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react"
import { FormEvent, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AdvisorCallerId = {
  id: string
  phoneNumber: string
  friendlyName: string | null
  twilioCallerIdSid: string | null
  validationCode: string | null
  status: string
  verifiedAt: string | null
  lastAttemptAt: string | null
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string | { message?: string; code?: string } }
  if (!response.ok) {
    const message = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message
    throw new Error(message ?? "Action impossible.")
  }
  return payload.data as T
}

export function AdvisorCallerIdSettings() {
  const [callerIds, setCallerIds] = useState<AdvisorCallerId[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  async function loadCallerIds() {
    const data = await readJson<AdvisorCallerId[]>(await fetch("/api/twilio/caller-ids", { cache: "no-store" }))
    setCallerIds(data)
  }

  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCallerIds()
      .catch((error) => {
        if (mounted) setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger les numéros personnels." })
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSubmitting(true)
    setNotice(null)
    try {
      const callerId = await readJson<AdvisorCallerId>(await fetch("/api/twilio/caller-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: String(formData.get("phoneNumber") ?? ""),
          friendlyName: String(formData.get("friendlyName") ?? ""),
        }),
      }))
      setCallerIds((items) => [callerId, ...items.filter((item) => item.id !== callerId.id)])
      setNotice({
        type: "success",
        message: callerId.status === "VERIFIED"
          ? "Ce numéro était déjà vérifié dans Twilio."
          : "Twilio va appeler ce numéro. Le conseiller doit saisir le code affiché pendant l’appel.",
      })
      form.reset()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de lancer la vérification Twilio." })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function refresh(id: string) {
    setRefreshingId(id)
    setNotice(null)
    try {
      const callerId = await readJson<AdvisorCallerId>(await fetch(`/api/twilio/caller-ids/${id}/refresh`, { method: "POST" }))
      setCallerIds((items) => items.map((item) => item.id === callerId.id ? callerId : item))
      setNotice({
        type: callerId.status === "VERIFIED" ? "success" : "error",
        message: callerId.status === "VERIFIED"
          ? "Numéro personnel confirmé dans Twilio."
          : "Twilio ne marque pas encore ce numéro comme vérifié.",
      })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de vérifier le statut Twilio." })
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
            <ShieldCheck className="size-4" />
            Numéro personnel du conseiller
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Caller ID vérifié Twilio</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Le conseiller peut faire vérifier son numéro personnel par Twilio pour l’utiliser comme identité d’appel sortant. Twilio appelle le numéro et demande le code affiché ici.
          </p>
        </div>
      </div>

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${notice.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
          {notice.message}
        </div>
      ) : null}

      <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Numéro personnel
          <Input name="phoneNumber" placeholder="+1 514 555 1234" className="rounded-2xl" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Nom affiché dans Twilio
          <Input name="friendlyName" placeholder="Marie Aubergiste - mobile" className="rounded-2xl" />
        </label>
        <Button disabled={isSubmitting} className="mt-auto h-11 rounded-full bg-emerald-600 px-5 font-black hover:bg-emerald-700">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
          Vérifier
        </Button>
      </form>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
        Important : un numéro personnel vérifié sert aux appels vocaux sortants Twilio. Il ne remplace pas le numéro Twilio du cabinet pour recevoir les SMS/appels, et il ne peut pas être utilisé comme expéditeur SMS.
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Chargement...
          </div>
        ) : callerIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
            Aucun numéro personnel vérifié pour ce conseiller.
          </div>
        ) : callerIds.map((callerId) => (
          <div key={callerId.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-black text-slate-950">{callerId.friendlyName || "Numéro personnel"}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${callerId.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {callerId.status === "VERIFIED" ? "Vérifié" : "En attente"}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-600">{callerId.phoneNumber}</p>
              {callerId.validationCode ? (
                <p className="text-sm font-black text-slate-950">
                  Code à saisir pendant l’appel Twilio : <span className="rounded-lg bg-white px-2 py-1 text-emerald-700">{callerId.validationCode}</span>
                </p>
              ) : null}
            </div>
            {callerId.status === "VERIFIED" ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                <CheckCircle2 className="size-4" />
                Actif
              </div>
            ) : (
              <Button type="button" variant="outline" disabled={refreshingId === callerId.id} onClick={() => refresh(callerId.id)} className="h-auto rounded-full border-slate-200 px-4 py-2 font-black">
                {refreshingId === callerId.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Actualiser
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
