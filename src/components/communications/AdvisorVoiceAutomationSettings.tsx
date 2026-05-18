"use client"

import { Bot, CheckCircle2, Loader2, MessageSquareText, PhoneCall, Save, Settings2 } from "lucide-react"
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type VoiceSettings = {
  id: string
  isEnabled: boolean
  greetingMessage: string
  smsNotice: string
  tone: string
  language: string
  callDelayMinutes: number
  availabilityPreference: string
  qualificationType: string
  bookingLink: string
  specialties: string
  customInstructions: string
}

const sampleVariables = {
  first_name: "Marc",
  last_name: "Tremblay",
  advisor_name: "Marie Aubergiste",
  advisor_booking_link: "https://finadvisor.app/rendez-vous/marie",
  advisor_specialties: "assurance vie, retraite, planification financiere",
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string | { message?: string; code?: string } }
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : payload.error?.message
    throw new Error(message ?? "Action impossible.")
  }
  return payload.data as T
}

function renderPreview(template: string) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: keyof typeof sampleVariables) => sampleVariables[key] ?? "")
}

export function AdvisorVoiceAutomationSettings() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/advisor/voice-automation-settings", { cache: "no-store" })
      .then((response) => readJson<VoiceSettings>(response))
      .then((data) => {
        if (mounted) setSettings(data)
      })
      .catch((error) => {
        if (mounted) setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger l’agent vocal." })
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const greetingPreview = useMemo(() => renderPreview(settings?.greetingMessage ?? ""), [settings?.greetingMessage])
  const smsPreview = useMemo(() => renderPreview(settings?.smsNotice ?? ""), [settings?.smsNotice])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsSaving(true)
    setNotice(null)
    try {
      const data = await readJson<VoiceSettings>(await fetch("/api/advisor/voice-automation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: formData.get("isEnabled") === "on",
          greetingMessage: String(formData.get("greetingMessage") ?? ""),
          smsNotice: String(formData.get("smsNotice") ?? ""),
          tone: String(formData.get("tone") ?? "professionnel_chaleureux"),
          language: String(formData.get("language") ?? "fr-CA"),
          callDelayMinutes: Number(formData.get("callDelayMinutes") ?? 5),
          availabilityPreference: String(formData.get("availabilityPreference") ?? "heures_ouvrables"),
          qualificationType: String(formData.get("qualificationType") ?? "assurance_et_planification"),
          bookingLink: String(formData.get("bookingLink") ?? ""),
          specialties: String(formData.get("specialties") ?? ""),
          customInstructions: String(formData.get("customInstructions") ?? ""),
        }),
      }))
      setSettings(data)
      setNotice({ type: "success", message: data.isEnabled ? "Agent vocal activé avec vos paramètres." : "Paramètres enregistrés. L’agent vocal reste désactivé." })
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible d’enregistrer l’agent vocal." })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Chargement de l’agent vocal...
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
            <Bot className="size-4" />
            Mes paramètres d’agent vocal
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Message, SMS, ton et règles par conseiller</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ces paramètres sont envoyés à n8n et RetellAI à chaque appel. Le workflow reste global, mais le message et le comportement changent selon le conseiller assigné.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black ${settings?.isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          <CheckCircle2 className="size-4" />
          {settings?.isEnabled ? "Activé" : "Désactivé"}
        </div>
      </div>

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${notice.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
          {notice.message}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <span className="flex min-w-0 items-center gap-2">
            <PhoneCall className="size-4 shrink-0 text-emerald-600" />
            <span className="min-w-0">Activer l’agent vocal pour mes prospects</span>
          </span>
          <input name="isEnabled" type="checkbox" checked={settings?.isEnabled ?? false} onChange={(event) => setSettings((current) => current ? { ...current, isEnabled: event.target.checked } : current)} className="size-5 shrink-0 accent-emerald-600" />
        </label>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <TextAreaField
              name="greetingMessage"
              label="Message d’accueil Retell"
              icon={<MessageSquareText className="size-4 text-emerald-600" />}
              value={settings?.greetingMessage ?? ""}
              minRows={4}
              onChange={(value) => setSettings((current) => current ? { ...current, greetingMessage: value } : current)}
            />
            <TextAreaField
              name="smsNotice"
              label="SMS de préavis"
              icon={<MessageSquareText className="size-4 text-emerald-600" />}
              value={settings?.smsNotice ?? ""}
              minRows={3}
              onChange={(value) => setSettings((current) => current ? { ...current, smsNotice: value } : current)}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField name="tone" label="Ton" value={settings?.tone ?? "professionnel_chaleureux"} onChange={(value) => setSettings((current) => current ? { ...current, tone: value } : current)}>
                <option value="professionnel_chaleureux">Professionnel et chaleureux</option>
                <option value="court_direct">Court et direct</option>
                <option value="pedagogique">Pédagogique</option>
                <option value="premium_discret">Premium et discret</option>
              </SelectField>
              <SelectField name="language" label="Langue" value={settings?.language ?? "fr-CA"} onChange={(value) => setSettings((current) => current ? { ...current, language: value } : current)}>
                <option value="fr-CA">Français Canada</option>
                <option value="fr-FR">Français France</option>
                <option value="en-CA">Anglais Canada</option>
                <option value="en-US">Anglais US</option>
              </SelectField>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Délai avant appel
                <Input name="callDelayMinutes" type="number" min={0} max={60} value={settings?.callDelayMinutes ?? 5} onChange={(event) => setSettings((current) => current ? { ...current, callDelayMinutes: Number(event.target.value) } : current)} className="rounded-2xl" />
              </label>
              <SelectField name="qualificationType" label="Type de qualification" value={settings?.qualificationType ?? "assurance_et_planification"} onChange={(value) => setSettings((current) => current ? { ...current, qualificationType: value } : current)}>
                <option value="assurance_et_planification">Assurance + planification</option>
                <option value="assurance_personnes">Assurance de personnes</option>
                <option value="assurance_dommages">Assurance de dommages</option>
                <option value="planification_financiere">Planification financière</option>
                <option value="prise_rendez_vous">Prise de rendez-vous seulement</option>
              </SelectField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Lien de rendez-vous
                <Input name="bookingLink" value={settings?.bookingLink ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, bookingLink: event.target.value } : current)} placeholder="https://..." className="rounded-2xl" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Spécialités
                <Input name="specialties" value={settings?.specialties ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, specialties: event.target.value } : current)} placeholder="retraite, assurance vie, entreprise" className="rounded-2xl" />
              </label>
            </div>

            <TextAreaField
              name="availabilityPreference"
              label="Disponibilités à annoncer"
              icon={<Settings2 className="size-4 text-emerald-600" />}
              value={settings?.availabilityPreference ?? ""}
              minRows={2}
              onChange={(value) => setSettings((current) => current ? { ...current, availabilityPreference: value } : current)}
            />
            <TextAreaField
              name="customInstructions"
              label="Consignes personnalisées"
              icon={<Settings2 className="size-4 text-emerald-600" />}
              value={settings?.customInstructions ?? ""}
              minRows={3}
              onChange={(value) => setSettings((current) => current ? { ...current, customInstructions: value } : current)}
            />
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-black text-slate-950">Prévisualisation</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Exemple avec Marc Tremblay comme prospect.</p>
            </div>
            <PreviewBlock title="Retell dira" text={greetingPreview} />
            <PreviewBlock title="SMS envoyé" text={smsPreview} />
            <div className="rounded-2xl border border-white bg-white p-3 text-xs font-semibold leading-5 text-slate-600">
              Variables envoyées : advisor_greeting, advisor_sms_notice, advisor_tone, advisor_booking_link, advisor_specialties.
            </div>
          </aside>
        </div>

        <Button disabled={isSaving} className="h-11 rounded-full bg-emerald-600 px-5 font-black hover:bg-emerald-700">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer mes paramètres vocaux
        </Button>
      </form>
    </section>
  )
}

function TextAreaField({ name, label, icon, value, minRows, onChange }: { name: string; label: string; icon: ReactNode; value: string; minRows: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-2">{icon}{label}</span>
      <textarea
        name={name}
        value={value}
        rows={minRows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500"
      />
    </label>
  )
}

function SelectField({ name, label, value, onChange, children }: { name: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500">
        {children}
      </select>
    </label>
  )
}

function PreviewBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-3">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-700">{text || "Aucun message."}</p>
    </div>
  )
}
