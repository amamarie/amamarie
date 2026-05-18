"use client"

import { Bell, Bot, Loader2, Phone, Save, ShieldCheck } from "lucide-react"
import { FormEvent, ReactNode, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CommunicationSettings = {
  twilioPhoneNumber?: string | null
  advisorSmsNotificationNumber?: string | null
  autoReplyEnabled: boolean
  inboundCallAutoCreateLead: boolean
  inboundSmsAutoCreateLead: boolean
  autoTranscribeCalls: boolean
  transcriptionLanguage: "fr" | "en"
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

export function CommunicationSettingsForm() {
  const [settings, setSettings] = useState<CommunicationSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/communications/settings", { cache: "no-store" })
      .then((response) => readJson<CommunicationSettings>(response))
      .then((data) => {
        if (mounted) setSettings(data)
      })
      .catch((error) => {
        if (mounted) setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger les paramètres." })
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
    const formData = new FormData(event.currentTarget)
    setIsSaving(true)
    setNotice(null)
    try {
      const data = await readJson<CommunicationSettings>(await fetch("/api/communications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twilioPhoneNumber: String(formData.get("twilioPhoneNumber") ?? ""),
          advisorSmsNotificationNumber: String(formData.get("advisorSmsNotificationNumber") ?? ""),
          autoReplyEnabled: formData.get("autoReplyEnabled") === "on",
          inboundCallAutoCreateLead: formData.get("inboundCallAutoCreateLead") === "on",
          inboundSmsAutoCreateLead: formData.get("inboundSmsAutoCreateLead") === "on",
          autoTranscribeCalls: formData.get("autoTranscribeCalls") === "on",
          transcriptionLanguage: String(formData.get("transcriptionLanguage") ?? "fr"),
        }),
      }))
      setSettings(data)
      setNotice({ type: "success", message: "Paramètres de communication enregistrés." })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible d’enregistrer les paramètres." })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Chargement des paramètres...
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Phone className="size-4 text-emerald-600" />Numéro Twilio du cabinet</span>
          <Input name="twilioPhoneNumber" defaultValue={settings?.twilioPhoneNumber ?? ""} placeholder="+1 438 000 0000" className="rounded-2xl" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Bell className="size-4 text-emerald-600" />SMS alerte conseiller</span>
          <Input name="advisorSmsNotificationNumber" defaultValue={settings?.advisorSmsNotificationNumber ?? ""} placeholder="+1 514 000 0000" className="rounded-2xl" />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Toggle name="autoReplyEnabled" defaultChecked={settings?.autoReplyEnabled ?? true} icon={<ShieldCheck className="size-4" />} label="Envoyer un SMS de confirmation au client" />
        <Toggle name="inboundCallAutoCreateLead" defaultChecked={settings?.inboundCallAutoCreateLead ?? true} icon={<Phone className="size-4" />} label="Créer un prospect si le numéro est inconnu" />
        <Toggle name="inboundSmsAutoCreateLead" defaultChecked={settings?.inboundSmsAutoCreateLead ?? true} icon={<Bell className="size-4" />} label="Créer un prospect depuis SMS entrant inconnu" />
        <Toggle name="autoTranscribeCalls" defaultChecked={settings?.autoTranscribeCalls ?? false} icon={<Bot className="size-4" />} label="Transcrire automatiquement les messages vocaux" />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Langue de transcription
        <select name="transcriptionLanguage" defaultValue={settings?.transcriptionLanguage ?? "fr"} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
        </select>
      </label>

      <Button disabled={isSaving} className="rounded-full bg-emerald-600 font-black hover:bg-emerald-700">
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Enregistrer
      </Button>
    </form>
  )
}

function Toggle({ name, label, icon, defaultChecked }: { name: string; label: string; icon: ReactNode; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-2 text-slate-700">
        <span className="text-emerald-600">{icon}</span>
        {label}
      </span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-emerald-600" />
    </label>
  )
}
