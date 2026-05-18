"use client"

import { ArrowDown, ArrowUp, CheckCircle2, Clipboard, ExternalLink, FileInput, GripVertical, Loader2, Mail, MessageSquareText, PenLine, Phone, Plus, Power, Sheet, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { ChangeEventHandler, FormEvent, useCallback, useEffect, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LeadFormRow = {
  id: string
  name: string
  slug: string
  publicTitle: string
  publicDescription?: string | null
  isActive: boolean
  googleSheetId?: string | null
  googleSheetName?: string | null
  fields?: LeadFormField[]
  createdAt: string
  submissions?: LeadFormSubmissionRow[]
  _count?: { submissions: number }
}

type LeadFormField = {
  name: string
  label: string
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox"
  required?: boolean
  options?: string[]
}

type LeadFormSubmissionRow = {
  id: string
  createdAt: string
  syncedToGoogleSheets: boolean
  syncError?: string | null
  payload?: {
    [key: string]: unknown
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    interestType?: string
    message?: string
  } | null
  lead?: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone: string
    status: string
  } | null
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { ok?: boolean; data?: T; error?: string | { message?: string } }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
}

function publicUrl(slug: string) {
  if (typeof window === "undefined") return `/f/${slug}/contact`
  return `${window.location.origin}/f/${slug}/contact`
}

const defaultFields: LeadFormField[] = [
  { name: "firstName", label: "Prénom", type: "text", required: true },
  { name: "lastName", label: "Nom", type: "text", required: true },
  { name: "email", label: "Courriel", type: "email", required: true },
  { name: "phone", label: "Téléphone", type: "tel", required: true },
  { name: "interestType", label: "Type d’assurance recherché", type: "select", required: true, options: ["Assurance vie", "Assurance invalidité", "Assurance maladies graves", "Assurance collective", "Placements", "Autre"] },
  { name: "message", label: "Message", type: "textarea", required: false },
  { name: "consent", label: "J’accepte d’être contacté par ce conseiller.", type: "checkbox", required: true },
]

const lockedQuestionNames = new Set(["firstName", "lastName", "email", "phone", "interestType", "consent"])

function normalizeFields(fields?: LeadFormField[] | null) {
  return fields?.length ? fields : defaultFields
}

function questionNameFromLabel(label: string) {
  const slug = slugify(label).replace(/-/g, "_")
  return `question_${slug || Date.now()}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function customAnswers(payload: LeadFormSubmissionRow["payload"]) {
  const baseKeys = new Set(["firstName", "lastName", "email", "phone", "interestType", "message", "consent"])
  return Object.entries(payload ?? {})
    .filter(([key, value]) => !baseKeys.has(key) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key.replace(/^question_/, "").replace(/_/g, " "), value === true ? "Oui" : String(value)] as const)
}

export function LeadFormsPageClient() {
  const [forms, setForms] = useState<LeadFormRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<LeadFormRow | null>(null)
  const [editingFields, setEditingFields] = useState<LeadFormField[]>(defaultFields)
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const loadForms = useCallback(async () => {
    setIsLoading(true)
    try {
      setForms(await readJson<LeadFormRow[]>(await fetch("/api/lead-forms", { cache: "no-store" })))
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger les formulaires." })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadForms()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadForms])

  async function createForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSaving(true)
    setNotice(null)
    try {
      const name = String(formData.get("name") ?? "").trim()
      const slug = String(formData.get("slug") ?? "").trim() || slugify(name)
      await readJson<LeadFormRow>(await fetch("/api/lead-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          subdomainSlug: String(formData.get("subdomainSlug") ?? "").trim(),
          publicTitle: String(formData.get("publicTitle") ?? "").trim() || name,
          publicDescription: String(formData.get("publicDescription") ?? "").trim(),
          successMessage: String(formData.get("successMessage") ?? "").trim(),
          googleSheetId: String(formData.get("googleSheetId") ?? "").trim(),
          googleSheetName: String(formData.get("googleSheetName") ?? "").trim() || "Leads",
        }),
      }))
      form.reset()
      setModalOpen(false)
      setNotice({ type: "success", message: "Formulaire créé. FinAdvisor crée aussi le Google Sheet si Google Workspace est connecté." })
      await loadForms()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de créer le formulaire." })
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleForm(form: LeadFormRow) {
    setIsSaving(true)
    try {
      await readJson<LeadFormRow>(await fetch(`/api/lead-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !form.isActive }),
      }))
      await loadForms()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de modifier le formulaire." })
    } finally {
      setIsSaving(false)
    }
  }

  function openQuestions(form: LeadFormRow) {
    setEditingForm(form)
    setEditingFields(normalizeFields(form.fields).map((field) => ({ ...field, options: field.options ? [...field.options] : undefined })))
    setQuestionsModalOpen(true)
  }

  function updateQuestion(index: number, patch: Partial<LeadFormField>) {
    setEditingFields((current) => current.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field
      const next = { ...field, ...patch }
      if (patch.label && !lockedQuestionNames.has(field.name)) next.name = questionNameFromLabel(patch.label)
      if (patch.type && patch.type !== "select") next.options = undefined
      if (patch.type === "select" && !next.options?.length) next.options = ["Option 1", "Option 2"]
      return next
    }))
  }

  function addQuestion() {
    setEditingFields((current) => [
      ...current,
      {
        name: `question_${Date.now()}`,
        label: "Nouvelle question",
        type: "text",
        required: false,
      },
    ])
  }

  function removeQuestion(index: number) {
    setEditingFields((current) => current.filter((field, fieldIndex) => fieldIndex !== index || lockedQuestionNames.has(field.name)))
  }

  function moveQuestion(fromIndex: number, toIndex: number) {
    setEditingFields((current) => {
      if (toIndex < 0 || toIndex >= current.length || fromIndex === toIndex) return current
      const next = [...current]
      const [field] = next.splice(fromIndex, 1)
      if (!field) return current
      next.splice(toIndex, 0, field)
      return next
    })
  }

  function dropQuestion(targetIndex: number) {
    if (draggedQuestionIndex === null) return
    moveQuestion(draggedQuestionIndex, targetIndex)
    setDraggedQuestionIndex(null)
  }

  async function saveQuestions() {
    if (!editingForm) return
    setIsSaving(true)
    setNotice(null)
    try {
      await readJson<LeadFormRow>(await fetch(`/api/lead-forms/${editingForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: editingFields }),
      }))
      setQuestionsModalOpen(false)
      setEditingForm(null)
      setNotice({ type: "success", message: "Questions du formulaire mises à jour." })
      await loadForms()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de modifier les questions." })
    } finally {
      setIsSaving(false)
    }
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(publicUrl(slug))
    setNotice({ type: "success", message: "Lien du formulaire copié." })
  }

  return (
    <PageShell eyebrow="Acquisition" title="Formulaires" description="Créez des formulaires publics qui alimentent Google Sheets et créent automatiquement des prospects.">
      {notice ? <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>{notice.message}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border-2 border-emerald-100 bg-emerald-50 p-5 shadow-[0_8px_0_rgba(5,150,105,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Formulaires publics</p>
              <h2 className="mt-3 text-2xl font-black text-slate-950">Un lien par conseiller ou cabinet</h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-emerald-900">
                Le client remplit le formulaire, FinAdvisor crée le prospect, assigne le conseiller, crée une tâche et synchronise Google Sheets si configuré.
              </p>
            </div>
            <Button className="rounded-full bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Nouveau formulaire
            </Button>
          </div>
        </div>
        <ContentCard title="URL professionnelle">
          <div className="space-y-3 text-sm font-semibold text-slate-600">
            <p>Développement : <span className="text-slate-950">/f/slug/contact</span></p>
            <p>Production prévue : <span className="text-slate-950">conseiller.finadvisor.ca/contact</span></p>
            <p className="text-xs leading-5 text-slate-500">Le slug permet déjà d’isoler le bon conseiller. Le sous-domaine sera branché au DNS en production.</p>
          </div>
        </ContentCard>
      </section>

      <ContentCard title="Mes formulaires" description="Liens publics, soumissions et synchronisation Google Sheets.">
        {isLoading ? <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="size-4 animate-spin" />Chargement...</div> : null}
        {!isLoading && forms.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <FileInput className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 font-black text-slate-950">Aucun formulaire</p>
            <p className="mt-1 text-sm font-medium text-slate-500">Créez un premier formulaire de contact pour recevoir des prospects.</p>
          </div>
        ) : null}
        <div className="grid gap-3">
          {forms.map((form) => (
            <article key={form.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-slate-950">{form.name}</h3>
                    <StatusBadge tone={form.isActive ? "emerald" : "slate"}>{form.isActive ? "Actif" : "Inactif"}</StatusBadge>
                    <StatusBadge tone={form.googleSheetId ? "sky" : "amber"}>{form.googleSheetId ? "Sheets créé" : "Google à connecter"}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{form.publicTitle}</p>
                  <p className="mt-3 truncate rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-100">{publicUrl(form.slug)}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={() => void copyLink(form.slug)}>
                    <Clipboard className="size-3.5" />
                    Copier
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full bg-white" asChild>
                    <Link href={`/f/${form.slug}/contact`} target="_blank">
                      <ExternalLink className="size-3.5" />
                      Ouvrir
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={() => void toggleForm(form)} disabled={isSaving}>
                    <Power className="size-3.5" />
                    {form.isActive ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={() => openQuestions(form)}>
                    <PenLine className="size-3.5" />
                    Questions
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">Soumissions : {form._count?.submissions ?? 0}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">Slug : {form.slug}</span>
                <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100"><Sheet className="mr-1 inline size-3.5" />Onglet : {form.googleSheetName ?? "Leads"}</span>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Réponses récentes</p>
                  <span className="text-xs font-bold text-slate-400">{form.submissions?.length ?? 0} affichée(s)</span>
                </div>
                {form.submissions?.length ? (
                  <div className="mt-3 grid gap-2">
                    {form.submissions.map((submission) => {
                      const payload = submission.payload ?? {}
                      const leadName = submission.lead ? `${submission.lead.firstName} ${submission.lead.lastName}` : `${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim()
                      return (
                        <div key={submission.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <UserRound className="size-4 text-emerald-600" />
                                {submission.lead ? (
                                  <Link href={`/prospects/${submission.lead.id}`} className="font-black text-slate-950 hover:text-emerald-700">
                                    {leadName}
                                  </Link>
                                ) : (
                                  <span className="font-black text-slate-950">{leadName || "Réponse sans nom"}</span>
                                )}
                                <StatusBadge tone="emerald">Prospect créé</StatusBadge>
                                <StatusBadge tone={submission.syncedToGoogleSheets ? "sky" : "amber"}>
                                  {submission.syncedToGoogleSheets ? "Sheets synchronisé" : "Sheets en attente"}
                                </StatusBadge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                {payload.email ? <span><Mail className="mr-1 inline size-3.5" />{payload.email}</span> : null}
                                {payload.phone ? <span><Phone className="mr-1 inline size-3.5" />{payload.phone}</span> : null}
                                {payload.interestType ? <span><CheckCircle2 className="mr-1 inline size-3.5" />{payload.interestType}</span> : null}
                              </div>
                              {payload.message ? (
                                <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-slate-600">
                                  <MessageSquareText className="mr-1 inline size-4 text-slate-400" />
                                  {payload.message}
                                </p>
                              ) : null}
                              {customAnswers(payload).length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {customAnswers(payload).map(([key, value]) => (
                                    <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100">
                                      {key}: {value}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {submission.syncError ? <p className="mt-1 text-xs font-semibold text-amber-700">{submission.syncError}</p> : null}
                            </div>
                            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDate(submission.createdAt)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">Aucune réponse encore.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </ContentCard>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Nouveau formulaire</h2>
                <p className="mt-1 text-sm text-slate-500">Les champs client essentiels sont inclus automatiquement.</p>
              </div>
              <Button variant="outline" className="rounded-full bg-white" onClick={() => setModalOpen(false)}>Fermer</Button>
            </div>
            <form onSubmit={createForm} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Nom interne" required placeholder="Contact assurance vie" />
                <Field name="slug" label="Slug public" placeholder="marie-assurance-vie" />
              </div>
              <Field name="subdomainSlug" label="Sous-domaine futur" placeholder="marie-dupont" />
              <Field name="publicTitle" label="Titre public" required placeholder="Parlons de votre protection financière" />
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Description publique
                <textarea name="publicDescription" rows={3} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Remplissez ce court formulaire et je vous reviens rapidement." />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="googleSheetId" label="Google Sheet existant (optionnel)" placeholder="Laisser vide pour créer automatiquement" />
                <Field name="googleSheetName" label="Onglet" placeholder="Leads" />
              </div>
              <Field name="successMessage" label="Message de confirmation" placeholder="Merci. Votre demande a été envoyée." />
              <Button disabled={isSaving} className="rounded-full bg-emerald-600 font-black hover:bg-emerald-700">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Créer le formulaire
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {questionsModalOpen && editingForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">Questions du formulaire</h2>
                <p className="mt-1 text-sm text-slate-500">{editingForm.name}</p>
              </div>
              <Button variant="outline" className="rounded-full bg-white" onClick={() => setQuestionsModalOpen(false)}>Fermer</Button>
            </div>

            <div className="grid gap-3">
              {editingFields.map((field, index) => {
                const locked = lockedQuestionNames.has(field.name)
                return (
                  <div
                    key={`${field.name}-${index}`}
                    draggable
                    onDragStart={(event) => {
                      setDraggedQuestionIndex(index)
                      event.dataTransfer.effectAllowed = "move"
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropQuestion(index)}
                    onDragEnd={() => setDraggedQuestionIndex(null)}
                    className={`rounded-2xl border p-3 transition ${draggedQuestionIndex === index ? "border-emerald-200 bg-emerald-50 opacity-70" : "border-slate-100 bg-slate-50"}`}
                  >
                    <div className="grid gap-3 lg:grid-cols-[auto_1fr_150px_120px_auto] lg:items-end">
                      <div className="flex items-center gap-1 lg:pb-1">
                        <button
                          type="button"
                          className="grid size-10 cursor-grab place-items-center rounded-full bg-white text-slate-400 ring-1 ring-slate-100 active:cursor-grabbing"
                          aria-label="Glisser pour déplacer la question"
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <div className="flex gap-1 lg:flex-col">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveQuestion(index, index - 1)}
                            className="grid size-8 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-100 transition hover:text-emerald-700 disabled:opacity-40"
                            aria-label="Monter la question"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === editingFields.length - 1}
                            onClick={() => moveQuestion(index, index + 1)}
                            className="grid size-8 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-100 transition hover:text-emerald-700 disabled:opacity-40"
                            aria-label="Descendre la question"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <Field
                        name={`label-${index}`}
                        label="Question"
                        value={field.label}
                        onChange={(event) => updateQuestion(index, { label: event.currentTarget.value })}
                      />
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        Type
                        <select
                          value={field.type}
                          disabled={locked}
                          onChange={(event) => updateQuestion(index, { type: event.currentTarget.value as LeadFormField["type"] })}
                          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                        >
                          <option value="text">Texte</option>
                          <option value="email">Courriel</option>
                          <option value="tel">Téléphone</option>
                          <option value="textarea">Long texte</option>
                          <option value="select">Choix</option>
                          <option value="checkbox">Case à cocher</option>
                        </select>
                      </label>
                      <label className="flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          disabled={locked}
                          onChange={(event) => updateQuestion(index, { required: event.currentTarget.checked })}
                          className="size-4 accent-emerald-600 disabled:opacity-60"
                        />
                        Obligatoire
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full bg-white"
                        disabled={locked}
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 className="size-4" />
                        Retirer
                      </Button>
                    </div>
                    {field.type === "select" ? (
                      <label className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700">
                        Options, séparées par des virgules
                        <Input
                          value={(field.options ?? []).join(", ")}
                          onChange={(event) => updateQuestion(index, {
                            options: event.currentTarget.value.split(",").map((option) => option.trim()).filter(Boolean),
                          })}
                          className="rounded-2xl bg-white"
                        />
                      </label>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {locked ? "Champ essentiel pour créer le prospect. " : null}
                      Glissez la question ou utilisez les flèches pour changer l’ordre.
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="rounded-full bg-white" onClick={addQuestion}>
                <Plus className="size-4" />
                Ajouter une question
              </Button>
              <Button disabled={isSaving} className="rounded-full bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => void saveQuestions()}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                Enregistrer les questions
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

function Field({
  name,
  label,
  placeholder,
  required,
  value,
  onChange,
}: {
  name: string
  label: string
  placeholder?: string
  required?: boolean
  value?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <Input name={name} required={required} placeholder={placeholder} value={value} onChange={onChange} className="rounded-2xl" />
    </label>
  )
}
