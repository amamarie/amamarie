"use client"

import { MessageSquare, Phone, Send } from "lucide-react"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { CallTranscriptionPanel, type CallTranscription } from "@/components/communications/CallTranscriptionPanel"
import { Input } from "@/components/ui/input"

type CommunicationItem = {
  id: string
  direction: string
  status: string
  fromNumber?: string | null
  toNumber?: string | null
  phoneNumber?: string | null
  body?: string | null
  durationSeconds?: number | null
  recordingSid?: string | null
  hasRecording?: boolean
  transcriptionStatus?: string | null
  transcription?: CallTranscription | null
  createdAt: string
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function statusTone(status: string) {
  if (["FAILED", "UNDELIVERED", "MISSED", "NO_ANSWER"].includes(status)) return "rose"
  if (["DELIVERED", "SENT", "COMPLETED", "RECEIVED"].includes(status)) return "emerald"
  return "slate"
}

export function CommunicationsPanel({ clientId, leadId, defaultPhone }: { clientId?: string; leadId?: string; defaultPhone?: string | null }) {
  const [calls, setCalls] = useState<CommunicationItem[]>([])
  const [sms, setSms] = useState<CommunicationItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [replyTo, setReplyTo] = useState(defaultPhone ?? "")
  const [replyContext, setReplyContext] = useState<CommunicationItem | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    if (leadId) params.set("leadId", leadId)
    params.set("limit", "20")
    return params.toString()
  }, [clientId, leadId])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [callData, smsData] = await Promise.all([
        fetch(`/api/communications/calls?${query}`, { cache: "no-store" }).then((response) => readJson<{ items: CommunicationItem[] }>(response)),
        fetch(`/api/communications/sms?${query}`, { cache: "no-store" }).then((response) => readJson<{ items: CommunicationItem[] }>(response)),
      ])
      setCalls(callData.items)
      setSms(smsData.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les communications.")
    }
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function sendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const body = String(formData.get("body") ?? "").trim()
    const to = String(formData.get("to") ?? replyTo ?? defaultPhone ?? "").trim()
    if (!body || !to) return
    setIsSending(true)
    setNotice(null)
    setError(null)
    try {
      await readJson(await fetch("/api/communications/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body, clientId, leadId }),
      }))
      setNotice("SMS envoyé à Twilio.")
      form.reset()
      setReplyContext(null)
      setReplyTo(defaultPhone ?? "")
      await load()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Impossible d'envoyer le SMS.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <ContentCard title="Envoyer un SMS">
        {notice ? <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
        {replyContext ? (
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-black">Réponse à {replyContext.direction === "INBOUND" ? replyContext.fromNumber : replyContext.toNumber}</p>
            <p className="mt-1 line-clamp-2 text-emerald-800">{replyContext.body}</p>
          </div>
        ) : null}
        <form className="space-y-3" onSubmit={sendSms}>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Numéro
            <Input name="to" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="+15145550123" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Message
            <textarea name="body" rows={5} maxLength={1000} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Message administratif ou suivi de rendez-vous." />
          </label>
          <Button disabled={isSending} className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"><Send className="size-4" />Envoyer</Button>
        </form>
      </ContentCard>

      <ContentCard title="SMS récents">
        <div className="space-y-3">
          {sms.length === 0 ? <p className="text-sm text-slate-500">Aucun SMS enregistré.</p> : null}
          {sms.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2"><MessageSquare className="size-4 text-slate-400" /><p className="truncate text-sm font-semibold text-slate-900">{item.direction === "INBOUND" ? item.fromNumber : item.toNumber}</p></div>
                <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 rounded-full bg-white"
                onClick={() => {
                  setReplyContext(item)
                  setReplyTo(item.direction === "INBOUND" ? item.fromNumber ?? "" : item.toNumber ?? "")
                }}
              >
                <Send className="size-3.5" />
                Répondre
              </Button>
            </div>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Appels récents">
        <div className="space-y-3">
          {calls.length === 0 ? <p className="text-sm text-slate-500">Aucun appel enregistré.</p> : null}
          {calls.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2"><Phone className="size-4 text-slate-400" /><p className="truncate text-sm font-semibold text-slate-900">{item.direction === "INBOUND" ? item.fromNumber : item.toNumber}</p></div>
                <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
              </div>
              <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}{item.durationSeconds ? ` · ${item.durationSeconds}s` : ""}</p>
              <CallTranscriptionPanel
                callId={item.id}
                hasRecording={Boolean(item.hasRecording || item.recordingSid)}
                initialStatus={item.transcriptionStatus}
                initialTranscription={item.transcription}
                onChanged={load}
              />
            </div>
          ))}
        </div>
      </ContentCard>
    </section>
  )
}
