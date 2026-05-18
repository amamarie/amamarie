"use client"

import { Archive, Edit3, Pin, PinOff, Plus, RotateCcw, Search, Trash2, X } from "lucide-react"
import type { ReactNode } from "react"
import { FormEvent, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type NoteItem = {
  id: string
  title: string | null
  content: string
  type?: string
  visibility?: string
  status?: string
  isPinned?: boolean
  isSensitive?: boolean
  meetingDate?: string | null
  followUpDate?: string | null
  createdAt: string
  user?: { name: string | null } | null
}

type NotesSectionProps = {
  entity: "client" | "lead"
  entityId: string
  initialNotes?: NoteItem[]
  onChanged?: () => Promise<void> | void
}

const noteTypeLabels: Record<string, string> = {
  GENERAL: "Générale",
  MEETING: "Rencontre",
  CALL: "Appel",
  SMS: "SMS",
  EMAIL: "Courriel",
  COMPLIANCE: "Conformité",
  INTERNAL: "Interne",
  FOLLOW_UP: "Suivi",
  PRODUCT: "Produit",
  KYC: "Profil client",
  DOCUMENT: "Document",
  OTHER: "Autre",
}

const visibilityLabels: Record<string, string> = {
  PRIVATE: "Privée",
  TEAM: "Équipe",
  COMPLIANCE_ONLY: "Conformité seulement",
}

const noteTemplates: Record<string, string> = {
  MEETING: "Résumé de la rencontre:\n\nDécisions:\n\nQuestions du client:\n\nActions à faire:\n\nProchaine étape:",
  CALL: "Résumé de l’appel:\n\nBesoin exprimé:\n\nObjections/questions:\n\nProchaine action:\n\nDate de suivi:",
  COMPLIANCE: "Élément vérifié:\n\nInformation obtenue:\n\nDocument lié:\n\nDécision/validation:\n\nProchaine action conformité:",
  INTERNAL: "Contexte interne:\n\nDécision:\n\nSuivi requis:",
  FOLLOW_UP: "Résumé du suivi:\n\nRésultat:\n\nProchaine action:",
}

function formatDate(value?: string | null) {
  if (!value) return "Date à compléter"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

async function readApi<T>(response: Response) {
  const result = (await response.json()) as { ok?: boolean; data?: T; error?: { message?: string }; errorMessage?: string }
  if (!response.ok) throw new Error(result.error?.message ?? result.errorMessage ?? "Action impossible.")
  return result.data as T
}

export function NotesSection({ entity, entityId, initialNotes = [], onChanged }: NotesSectionProps) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const filteredNotes = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return notes
      .filter((note) => note.status !== "DELETED")
      .filter((note) => typeFilter === "ALL" || (note.type ?? "GENERAL") === typeFilter)
      .filter((note) => !needle || `${note.title ?? ""} ${note.content}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [notes, search, typeFilter])

  const pinnedNotes = filteredNotes.filter((note) => note.isPinned || note.status === "PINNED")
  const recentNotes = filteredNotes.filter((note) => !note.isPinned && note.status !== "PINNED")

  async function refresh() {
    const params = new URLSearchParams({ [`${entity === "client" ? "clientId" : "leadId"}`]: entityId, limit: "100" })
    const data = await readApi<{ items: NoteItem[] }>(await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" }))
    setNotes(data.items)
    await onChanged?.()
  }

  async function mutate(path: string, method = "PATCH", message = "Note mise à jour.") {
    setIsSaving(true)
    setNotice(null)
    try {
      await readApi<NoteItem>(await fetch(path, { method }))
      setNotice({ type: "success", message })
      await refresh()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Action impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  async function saveNote(payload: Record<string, unknown>) {
    setIsSaving(true)
    setNotice(null)
    try {
      const path = editingNote ? `/api/notes/${editingNote.id}` : "/api/notes"
      const method = editingNote ? "PATCH" : "POST"
      const body = { ...payload, [entity === "client" ? "clientId" : "leadId"]: entityId }
      await readApi<NoteItem>(
        await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      )
      setNotice({ type: "success", message: editingNote ? "Note modifiée." : "Note ajoutée." })
      setModalOpen(false)
      setEditingNote(null)
      await refresh()
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible d’enregistrer la note." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
          <p className="mt-1 text-sm text-slate-500">Historique des échanges, suivis, décisions internes et éléments de conformité.</p>
        </div>
        <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingNote(null); setModalOpen(true) }}>
          <Plus className="size-4" /> Ajouter une note
        </Button>
      </div>

      {notice ? (
        <div className={notice.type === "success" ? "mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" : "mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"}>
          {notice.message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans les notes..." className="h-11 rounded-2xl pl-10" />
        </label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <option value="ALL">Tous les types</option>
          {Object.entries(noteTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="mt-6 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-slate-900">Aucune note pour l’instant.</p>
          <p className="mt-2 text-sm text-slate-500">Ajoutez une note pour conserver l’historique du dossier.</p>
          <Button className="mt-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setModalOpen(true)}>Ajouter une note</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {pinnedNotes.length > 0 ? (
            <NoteGroup title="Notes épinglées" notes={pinnedNotes} isSaving={isSaving} onEdit={(note) => { setEditingNote(note); setModalOpen(true) }} onAction={mutate} />
          ) : null}
          <NoteGroup title="Notes récentes" notes={recentNotes} isSaving={isSaving} onEdit={(note) => { setEditingNote(note); setModalOpen(true) }} onAction={mutate} />
        </div>
      )}

      {modalOpen ? (
        <NoteFormModal note={editingNote} isSaving={isSaving} onClose={() => { setModalOpen(false); setEditingNote(null) }} onSave={saveNote} />
      ) : null}
    </section>
  )
}

function NoteGroup({ title, notes, isSaving, onEdit, onAction }: { title: string; notes: NoteItem[]; isSaving: boolean; onEdit: (note: NoteItem) => void; onAction: (path: string, method?: string, message?: string) => Promise<void> }) {
  if (notes.length === 0) return null
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-3">
        {notes.map((note) => <NoteCard key={note.id} note={note} isSaving={isSaving} onEdit={() => onEdit(note)} onAction={onAction} />)}
      </div>
    </div>
  )
}

function NoteCard({ note, isSaving, onEdit, onAction }: { note: NoteItem; isSaving: boolean; onEdit: () => void; onAction: (path: string, method?: string, message?: string) => Promise<void> }) {
  const pinned = Boolean(note.isPinned) || note.status === "PINNED"
  return (
    <article className="min-w-0 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge>{noteTypeLabels[note.type ?? "GENERAL"] ?? "Note"}</Badge>
            <Badge>{visibilityLabels[note.visibility ?? "TEAM"] ?? "Équipe"}</Badge>
            {pinned ? <Badge tone="emerald">Épinglée</Badge> : null}
            {note.isSensitive ? <Badge tone="amber">Sensible</Badge> : null}
          </div>
          <h4 className="font-semibold text-slate-950">{note.title || "Note sans titre"}</h4>
          <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-650">{note.content}</p>
          <p className="text-xs text-slate-500">{note.user?.name ?? "Utilisateur"} · {formatDate(note.createdAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={onEdit}><Edit3 className="size-4" />Modifier</Button>
          {pinned ? (
            <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => onAction(`/api/notes/${note.id}/unpin`, "PATCH", "Note désépinglée.")}><PinOff className="size-4" />Désépingler</Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => onAction(`/api/notes/${note.id}/pin`, "PATCH", "Note épinglée.")}><Pin className="size-4" />Épingler</Button>
          )}
          {note.status === "ARCHIVED" ? (
            <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => onAction(`/api/notes/${note.id}/restore`, "PATCH", "Note restaurée.")}><RotateCcw className="size-4" />Restaurer</Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => window.confirm("Archiver cette note?") && onAction(`/api/notes/${note.id}/archive`, "PATCH", "Note archivée.")}><Archive className="size-4" />Archiver</Button>
          )}
          <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" disabled={isSaving} onClick={() => window.confirm("Supprimer logiquement cette note?") && onAction(`/api/notes/${note.id}`, "DELETE", "Note supprimée.")}><Trash2 className="size-4" />Supprimer</Button>
        </div>
      </div>
    </article>
  )
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "emerald" | "amber" }) {
  const styles = tone === "emerald" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-white text-slate-600 ring-slate-200"
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles}`}>{children}</span>
}

function NoteFormModal({ note, isSaving, onClose, onSave }: { note: NoteItem | null; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [type, setType] = useState(note?.type ?? "GENERAL")
  const [content, setContent] = useState(note?.content ?? "")
  const [error, setError] = useState<string | null>(null)

  function applyTemplate(nextType: string) {
    setType(nextType)
    if (!note && !content.trim() && noteTemplates[nextType]) setContent(noteTemplates[nextType])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (content.trim().length < 2) {
      setError("La note doit contenir au moins 2 caractères.")
      return
    }
    const formData = new FormData(event.currentTarget)
    await onSave({
      title: String(formData.get("title") ?? ""),
      content,
      type,
      visibility: String(formData.get("visibility") ?? "TEAM"),
      isPinned: formData.get("isPinned") === "on",
      isSensitive: formData.get("isSensitive") === "on",
      meetingDate: String(formData.get("meetingDate") ?? ""),
      followUpDate: String(formData.get("followUpDate") ?? ""),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:rounded-[1.5rem]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">{note ? "Modifier la note" : "Ajouter une note"}</h3>
            <p className="text-sm text-slate-500">Classez la note et gardez une trace claire du suivi.</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-4 overflow-y-auto px-5 py-5">
            {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Titre
              <Input name="title" defaultValue={note?.title ?? ""} className="rounded-2xl" placeholder="Ex: Suivi après appel" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Type
                <select value={type} onChange={(event) => applyTemplate(event.target.value)} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  {Object.entries(noteTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Visibilité
                <select name="visibility" defaultValue={note?.visibility ?? "TEAM"} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  <option value="TEAM">Équipe</option>
                  <option value="PRIVATE">Privée</option>
                  <option value="COMPLIANCE_ONLY">Conformité seulement</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Contenu
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={9} className="min-h-56 rounded-2xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">Date de rencontre<input name="meetingDate" type="datetime-local" className="h-10 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">Date de suivi<input name="followUpDate" type="datetime-local" className="h-10 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label>
            </div>
            <div className="flex flex-wrap gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2"><input name="isPinned" type="checkbox" defaultChecked={Boolean(note?.isPinned)} className="size-4 rounded border-slate-300" />Épingler</label>
              <label className="inline-flex items-center gap-2"><input name="isSensitive" type="checkbox" defaultChecked={Boolean(note?.isSensitive)} className="size-4 rounded border-slate-300" />Note sensible</label>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
