"use client"

import { CheckCircle2, FileAudio, Loader2, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type SuggestedTask = {
  title: string
  description?: string
  priority?: "LOW" | "MEDIUM" | "NORMAL" | "HIGH" | "URGENT"
  dueInDays?: number
}

type StructuredNote = {
  summary?: string
  needs?: string[]
  context?: string[]
  objections?: string[]
  nextSteps?: string[]
  tasks?: SuggestedTask[]
  disclaimer?: string
}

export type CallTranscription = {
  id: string
  status: string
  rawTranscript?: string | null
  editedTranscript?: string | null
  aiStructuredNote?: StructuredNote | null
  error?: string | null
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

function transcriptionTone(status?: string | null) {
  if (status === "FAILED") return "rose"
  if (status === "COMPLETED") return "emerald"
  if (status === "APPROVED") return "emerald"
  if (status === "PROCESSING" || status === "QUEUED") return "sky"
  return "slate"
}

function transcriptionLabel(status?: string | null) {
  if (status === "COMPLETED") return "Prêt à valider"
  if (status === "APPROVED") return "Validé"
  if (status === "PROCESSING") return "En cours"
  if (status === "FAILED") return "Échec"
  return "Non transcrit"
}

function toNoteContent(note: StructuredNote | null | undefined, transcript: string) {
  if (!note?.summary) return transcript
  const sections: Array<[string, string[] | undefined]> = [
    ["Résumé", [note.summary]],
    ["Besoins", note.needs],
    ["Contexte", note.context],
    ["Objections", note.objections],
    ["Prochaines étapes", note.nextSteps],
  ]
  return sections
    .filter(([, values]) => values?.length)
    .map(([title, values]) => `${title}:\n${values?.map((value) => `- ${value}`).join("\n")}`)
    .join("\n\n")
}

function normalizePriority(priority?: string) {
  if (priority === "MEDIUM") return "NORMAL"
  if (priority === "LOW" || priority === "NORMAL" || priority === "HIGH" || priority === "URGENT") return priority
  return "NORMAL"
}

export function CallTranscriptionPanel({
  callId,
  hasRecording,
  initialTranscription,
  initialStatus,
  onChanged,
}: {
  callId: string
  hasRecording: boolean
  initialTranscription?: CallTranscription | null
  initialStatus?: string | null
  onChanged?: () => Promise<void> | void
}) {
  const [transcription, setTranscription] = useState<CallTranscription | null>(initialTranscription ?? null)
  const [status, setStatus] = useState(initialTranscription?.status ?? initialStatus ?? "NOT_STARTED")
  const [isOpen, setIsOpen] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editedTranscript, setEditedTranscript] = useState(initialTranscription?.editedTranscript ?? initialTranscription?.rawTranscript ?? "")
  const [noteContent, setNoteContent] = useState(toNoteContent(initialTranscription?.aiStructuredNote, initialTranscription?.editedTranscript ?? initialTranscription?.rawTranscript ?? ""))

  const suggestedTasks = useMemo(() => transcription?.aiStructuredNote?.tasks ?? [], [transcription])
  const canTranscribe = hasRecording && !["PROCESSING", "COMPLETED", "APPROVED"].includes(status)
  const canApprove = status === "COMPLETED" && transcription

  async function refresh() {
    const data = await readJson<CallTranscription | null>(await fetch(`/api/calls/${callId}/transcription`, { cache: "no-store" }))
    setTranscription(data)
    setStatus(data?.status ?? "NOT_STARTED")
    setEditedTranscript(data?.editedTranscript ?? data?.rawTranscript ?? "")
    setNoteContent(toNoteContent(data?.aiStructuredNote, data?.editedTranscript ?? data?.rawTranscript ?? ""))
  }

  async function transcribe() {
    setIsWorking(true)
    setError(null)
    try {
      setStatus("PROCESSING")
      const data = await readJson<CallTranscription>(await fetch(`/api/calls/${callId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "fr" }),
      }))
      setTranscription(data)
      setStatus(data.status)
      setEditedTranscript(data.editedTranscript ?? data.rawTranscript ?? "")
      setNoteContent(toNoteContent(data.aiStructuredNote, data.editedTranscript ?? data.rawTranscript ?? ""))
      setIsOpen(true)
      await onChanged?.()
    } catch (transcribeError) {
      setStatus("FAILED")
      setError(transcribeError instanceof Error ? transcribeError.message : "Impossible de transcrire cet appel.")
    } finally {
      setIsWorking(false)
    }
  }

  async function approve() {
    if (!transcription) return
    setIsWorking(true)
    setError(null)
    try {
      const selectedTasks = suggestedTasks.map((task) => ({
        title: task.title,
        description: task.description,
        priority: normalizePriority(task.priority),
        dueInDays: task.dueInDays ?? 2,
      }))
      const data = await readJson<{ transcription: CallTranscription }>(await fetch(`/api/calls/${callId}/transcription/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedTranscript, noteContent, createTasks: selectedTasks.length > 0, selectedTasks }),
      }))
      setTranscription(data.transcription)
      setStatus(data.transcription.status)
      setIsOpen(false)
      await onChanged?.()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Impossible d’approuver la transcription.")
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileAudio className="size-4 text-slate-500" />
          <StatusBadge tone={transcriptionTone(status)}>{transcriptionLabel(status)}</StatusBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          {transcription?.rawTranscript ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setIsOpen((value) => !value)}>
              Voir
            </Button>
          ) : null}
          <Button type="button" size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800" disabled={!canTranscribe || isWorking} onClick={transcribe}>
            {isWorking && status === "PROCESSING" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Transcrire
          </Button>
        </div>
      </div>
      {!hasRecording ? <p className="mt-2 text-xs text-slate-500">Aucun enregistrement disponible pour cet appel.</p> : null}
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
      {isOpen && transcription ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">La transcription peut contenir des erreurs. Vérifiez avant d’enregistrer.</p>
          {transcription.aiStructuredNote?.summary ? (
            <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Résumé IA</p>
              <p className="mt-1 text-sm text-slate-700">{transcription.aiStructuredNote.summary}</p>
            </div>
          ) : null}
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Transcription
            <textarea value={editedTranscript} onChange={(event) => setEditedTranscript(event.target.value)} rows={7} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Note à enregistrer
            <textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} rows={6} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
          </label>
          {suggestedTasks.length ? (
            <div className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Tâches suggérées</p>
              <div className="mt-2 space-y-2">
                {suggestedTasks.map((task) => (
                  <div key={`${task.title}-${task.dueInDays}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">{task.title}</span>
                    <span className="text-slate-400"> · {normalizePriority(task.priority)} · {task.dueInDays ?? 2} j</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={refresh} disabled={isWorking}>Rafraîchir</Button>
            <Button type="button" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={!canApprove || isWorking || !noteContent.trim()} onClick={approve}>
              {isWorking ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Approuver et enregistrer
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
