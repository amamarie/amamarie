"use client"

import { Loader2, Sparkles, X } from "lucide-react"
import { FormEvent, useState } from "react"

import { StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type CallNote = {
  summary: string
  needs: string[]
  context: string[]
  objections: string[]
  nextSteps: string[]
  tasks: { title: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; dueInDays: number }[]
  followUpDate: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  disclaimer: string
}

const emptyNote: CallNote = {
  summary: "",
  needs: [],
  context: [],
  objections: [],
  nextSteps: [],
  tasks: [],
  followUpDate: null,
  priority: "MEDIUM",
  disclaimer: "Aide interne seulement. Validation humaine obligatoire. Ne remplace pas l’analyse professionnelle du conseiller.",
}

function linesToArray(value: string) {
  return value.split("\n").map((line) => line.replace(/^- /, "").trim()).filter(Boolean)
}

function arrayToLines(value: string[]) {
  return value.map((item) => `- ${item}`).join("\n")
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string }
  if (!response.ok) throw new Error(payload.error ?? "Action impossible.")
  return payload.data as T
}

export function CallSummaryModal({
  entityType,
  entityId,
  onClose,
  onSaved,
}: {
  entityType: "client" | "lead"
  entityId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [rawNote, setRawNote] = useState("")
  const [note, setNote] = useState<CallNote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await readJson<{ note: CallNote }>(await fetch("/api/ai/call-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", rawNote, [entityType === "client" ? "clientId" : "leadId"]: entityId }),
      }))
      setNote(data.note)
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Génération impossible.")
    } finally {
      setIsLoading(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const edited: CallNote = {
      ...emptyNote,
      ...note,
      summary: String(form.get("summary") ?? ""),
      needs: linesToArray(String(form.get("needs") ?? "")),
      context: linesToArray(String(form.get("context") ?? "")),
      objections: linesToArray(String(form.get("objections") ?? "")),
      nextSteps: linesToArray(String(form.get("nextSteps") ?? "")),
      priority: String(form.get("priority") ?? "MEDIUM") as CallNote["priority"],
      followUpDate: String(form.get("followUpDate") || "") || null,
      tasks: note?.tasks ?? [],
    }

    setIsLoading(true)
    setError(null)
    try {
      await readJson(await fetch("/api/ai/call-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "save", note: edited, [entityType === "client" ? "clientId" : "leadId"]: entityId }),
      }))
      onSaved()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Résumé appel IA">
      <div className="flex h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Note d’appel IA</h2>
            <p className="text-sm text-slate-500">Génère une note, corrige-la, puis enregistre-la dans l’historique.</p>
          </div>
          <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}

          {!note ? (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Note brute ou transcription
                <textarea
                  value={rawNote}
                  onChange={(event) => setRawNote(event.target.value)}
                  rows={10}
                  placeholder="Ex: client veut assurance vie, 2 enfants, budget limité, veut comparer..."
                  className="min-h-56 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </label>
              <Button type="button" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={generate} disabled={isLoading || rawNote.trim().length < 3}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Générer note structurée
              </Button>
            </div>
          ) : (
            <form onSubmit={save} className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={note.priority === "URGENT" ? "rose" : note.priority === "HIGH" ? "amber" : "sky"}>{note.priority}</StatusBadge>
                <span className="text-xs font-medium text-slate-500">Brouillon modifiable avant sauvegarde.</span>
              </div>
              <TextAreaField name="summary" label="Résumé" defaultValue={note.summary} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField name="needs" label="Besoins" defaultValue={arrayToLines(note.needs)} />
                <TextAreaField name="context" label="Contexte" defaultValue={arrayToLines(note.context)} />
                <TextAreaField name="objections" label="Objections" defaultValue={arrayToLines(note.objections)} />
                <TextAreaField name="nextSteps" label="Prochaines étapes" defaultValue={arrayToLines(note.nextSteps)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Priorité
                  <select name="priority" defaultValue={note.priority} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Date de suivi
                  <input name="followUpDate" type="date" defaultValue={note.followUpDate ?? ""} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
                </label>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">Tâches suggérées</p>
                <div className="mt-3 space-y-2">
                  {note.tasks.length ? note.tasks.map((task) => (
                    <div key={task.title} className="rounded-xl bg-white p-3 text-sm text-slate-700">
                      <strong>{task.title}</strong> · {task.priority} · +{task.dueInDays} jour(s)
                    </div>
                  )) : <p className="text-sm text-slate-500">Aucune tâche suggérée.</p>}
                </div>
              </div>
              <p className="rounded-2xl bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">{note.disclaimer}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setNote(null)}>Retour</Button>
                <Button type="submit" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Enregistrer note + tâches
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function TextAreaField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}
      <textarea name={name} rows={5} defaultValue={defaultValue} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
    </label>
  )
}
