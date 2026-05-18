"use client"

import { CheckCircle2, Loader2, Send } from "lucide-react"
import { FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"

type LeadFormField = {
  name: string
  label: string
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox"
  required?: boolean
  options?: string[]
}

type PublicLeadFormPageClientProps = {
  slug: string
  title: string
  description?: string | null
  advisorName: string
  organizationName: string
  fields?: unknown
}

const defaultFields: LeadFormField[] = [
  { name: "firstName", label: "Prénom", type: "text", required: true },
  { name: "lastName", label: "Nom", type: "text", required: true },
  { name: "email", label: "Courriel", type: "email", required: true },
  { name: "phone", label: "Téléphone", type: "tel", required: true },
  { name: "interestType", label: "Type d’assurance recherché", type: "select", required: true, options: ["Assurance vie", "Assurance invalidité", "Assurance maladies graves", "Assurance collective", "Placements", "Autre"] },
  { name: "message", label: "Message", type: "textarea" },
  { name: "consent", label: "J’accepte d’être contacté par ce conseiller au sujet de ma demande.", type: "checkbox", required: true },
]

function normalizeFields(value: unknown): LeadFormField[] {
  if (!Array.isArray(value)) return defaultFields
  const fields = value.filter((field): field is LeadFormField => {
    if (!field || typeof field !== "object") return false
    const candidate = field as Partial<LeadFormField>
    return Boolean(candidate.name && candidate.label && candidate.type)
  })
  return fields.length ? fields : defaultFields
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { ok?: boolean; data?: T; error?: string | { message?: string } }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

export function PublicLeadFormPageClient({ slug, title, description, advisorName, organizationName, fields }: PublicLeadFormPageClientProps) {
  const formFields = normalizeFields(fields)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSubmitting(true)
    setError(null)
    try {
      const data = await readJson<{ message: string }>(await fetch(`/api/public/lead-forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(
          Array.from(formData.entries()).map(([key, value]) => [key, value === "on" ? true : String(value)])
        )),
      }))
      form.reset()
      setSuccess(data.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d’envoyer votre demande.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
            <h1 className="mt-5 text-2xl font-black text-slate-950">Demande envoyée</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{success}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_45%,#eef2ff_100%)] px-4 py-8">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="pt-6">
          <p className="inline-flex rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">{organizationName}</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">{title}</h1>
          {description ? <p className="mt-4 text-base font-semibold leading-7 text-slate-600">{description}</p> : null}
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm font-semibold leading-6 text-slate-600 shadow-sm">
            Conseiller : <span className="font-black text-slate-950">{advisorName}</span>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
          {error ? <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {formFields.map((field) => (
              <DynamicField key={field.name} field={field} />
            ))}
          </div>
          <Button disabled={isSubmitting} className="mt-5 h-12 w-full rounded-full bg-emerald-600 font-black hover:bg-emerald-700">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer ma demande
          </Button>
        </form>
      </section>
    </main>
  )
}

function DynamicField({ field }: { field: LeadFormField }) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600 sm:col-span-2">
        <input name={field.name} type="checkbox" required={field.required} className="mt-1 size-4 accent-emerald-600" />
        {field.label}
      </label>
    )
  }

  if (field.type === "textarea") {
    return (
      <label className="grid gap-1.5 text-sm font-bold text-slate-700 sm:col-span-2">
        {field.label}
        <textarea name={field.name} rows={5} required={field.required} className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Décrivez brièvement votre besoin." />
      </label>
    )
  }

  if (field.type === "select") {
    return (
      <label className="grid gap-1.5 text-sm font-bold text-slate-700 sm:col-span-2">
        {field.label}
        <select name={field.name} required={field.required} className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="">Sélectionner</option>
          {(field.options ?? []).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    )
  }

  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {field.label}
      <input name={field.name} type={field.type} required={field.required} className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
    </label>
  )
}
