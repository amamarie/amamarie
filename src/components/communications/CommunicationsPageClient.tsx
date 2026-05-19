"use client"

import { AlertTriangle, Archive, CheckCircle2, FileText, Inbox, Mail, MessageSquare, PhoneCall, RefreshCw, Search, Send, Settings, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"

type ConversationEvent = {
  id: string
  channel: "SMS" | "EMAIL" | "CALL"
  direction: string
  status: string
  inboxStatus?: string | null
  inboxType?: string | null
  priority?: string | null
  summary?: string | null
  recommendedAction?: string | null
  title: string
  body: string | null
  from: string | null
  to: string | null
  createdAt: string
  href: string
}

type InboxFilter = "to-process" | "urgent" | "unassigned" | "documents" | "planned" | "archived" | "all"

type Conversation = {
  key: string
  type: "CLIENT" | "LEAD" | "UNASSIGNED"
  name: string
  phone: string | null
  email: string | null
  href: string
  latestAt: string | null
  latestPreview: string
  unreadCount: number
  attentionCount: number
  events: ConversationEvent[]
  client?: { id: string; firstName: string; lastName: string } | null
  lead?: { id: string; firstName: string; lastName: string } | null
}

async function readConversations(path: string) {
  const response = await fetch(path, { cache: "no-store" })
  const payload = (await response.json()) as { data?: { items: Conversation[] }; error?: { message?: string } | string }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Chargement impossible.")
  return payload.data?.items ?? []
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

function statusTone(status: string) {
  if (["FAILED", "UNDELIVERED", "MISSED", "NO_ANSWER"].includes(status)) return "rose"
  if (["DELIVERED", "SENT", "COMPLETED", "RECEIVED", "DONE", "ARCHIVED", "ANSWERED", "CLASSIFIED"].includes(status)) return "emerald"
  if (["QUEUED", "RINGING", "IN_PROGRESS", "TO_PROCESS", "PLANNED", "WAITING"].includes(status)) return "sky"
  return "slate"
}

export function CommunicationsPageClient() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null)
  const [conversationSearch, setConversationSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [selectedCorrespondentKeys, setSelectedCorrespondentKeys] = useState<Set<string>>(() => new Set())
  const [isDeletingConversations, setIsDeletingConversations] = useState(false)
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("to-process")
  const [isSyncingGmail, setIsSyncingGmail] = useState(false)
  const [updatingEmailId, setUpdatingEmailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextConversations = await readConversations("/api/communications/inbox?limit=200")
      setConversations(nextConversations)
      setSelectedConversationKey((current) => current && nextConversations.some((conversation) => conversation.key === current) ? current : nextConversations[0]?.key ?? null)
      setSelectedCorrespondentKeys((current) => {
        if (current.size === 0) return current
        const availableKeys = new Set(nextConversations.map((conversation) => conversation.key))
        return new Set([...current].filter((key) => availableKeys.has(key)))
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase()
    return conversations.filter((conversation) => {
      const events = conversation.events
      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "to-process"
            ? events.some((event) => event.channel === "EMAIL" && event.inboxStatus !== "DONE" && event.inboxStatus !== "ARCHIVED")
            : activeFilter === "urgent"
              ? events.some((event) => event.priority === "HIGH" || event.inboxType === "URGENT")
              : activeFilter === "unassigned"
                ? conversation.type === "UNASSIGNED"
                : activeFilter === "documents"
                  ? events.some((event) => event.inboxType === "DOCUMENT")
                  : activeFilter === "planned"
                    ? events.some((event) => event.inboxStatus === "PLANNED" || event.inboxStatus === "WAITING")
                    : events.some((event) => event.inboxStatus === "ARCHIVED" || event.inboxStatus === "DONE")

      if (!matchesFilter) return false
      if (!query) return true
      return (
      [
        conversation.name,
        conversation.phone ?? "",
        conversation.email ?? "",
        conversation.latestPreview ?? "",
        ...conversation.events.flatMap((event) => [event.title, event.summary ?? "", event.recommendedAction ?? ""]),
      ].some((value) => value.toLowerCase().includes(query))
      )
    })
  }, [activeFilter, conversationSearch, conversations])

  const selectedConversation = useMemo(
    () => filteredConversations.find((conversation) => conversation.key === selectedConversationKey) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationKey]
  )

  const attentionCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.attentionCount, 0),
    [conversations]
  )

  const inboundCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations]
  )

  const inboxStats = useMemo(() => {
    const emailEvents = conversations.flatMap((conversation) => conversation.events.map((event) => ({ event, conversation }))).filter(({ event }) => event.channel === "EMAIL")
    return {
      toProcess: emailEvents.filter(({ event }) => event.inboxStatus !== "DONE" && event.inboxStatus !== "ARCHIVED").length,
      urgent: emailEvents.filter(({ event }) => event.priority === "HIGH" || event.inboxType === "URGENT").length,
      unassigned: conversations.filter((conversation) => conversation.type === "UNASSIGNED").length,
      documents: emailEvents.filter(({ event }) => event.inboxType === "DOCUMENT").length,
      archived: emailEvents.filter(({ event }) => event.inboxStatus === "DONE" || event.inboxStatus === "ARCHIVED").length,
    }
  }, [conversations])

  const selectedCorrespondents = useMemo(
    () => conversations.filter((conversation) => selectedCorrespondentKeys.has(conversation.key)),
    [conversations, selectedCorrespondentKeys]
  )

  const selectedCorrespondentMessageCount = useMemo(
    () => selectedCorrespondents.reduce((total, conversation) => total + conversation.events.length, 0),
    [selectedCorrespondents]
  )

  function toggleCorrespondentSelection(conversation: Conversation) {
    setSelectedCorrespondentKeys((current) => {
      const next = new Set(current)
      if (next.has(conversation.key)) {
        next.delete(conversation.key)
      } else {
        next.add(conversation.key)
      }
      return next
    })
  }

  function selectVisibleCorrespondents() {
    setSelectedCorrespondentKeys(new Set(filteredConversations.map((conversation) => conversation.key)))
  }

  function clearSelection() {
    setSelectedCorrespondentKeys(new Set())
  }

  async function deleteSelectedCorrespondentsCommunications() {
    if (selectedCorrespondents.length === 0) return
    const confirmed = window.confirm(`Effacer les communications de ${selectedCorrespondents.length} correspondant(s) sélectionné(s) ? Cette action retire leurs SMS, appels et courriels de FinAssuro.`)
    if (!confirmed) return

    setIsDeletingConversations(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readJson<{ deletedCount: number }>(await fetch("/api/communications/conversations/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversations: selectedCorrespondents.map((conversation) => ({
            key: conversation.key,
            type: conversation.type,
            clientId: conversation.client?.id ?? null,
            leadId: conversation.lead?.id ?? null,
            events: conversation.events.map((event) => ({ id: event.id, channel: event.channel })),
          })),
        }),
      }))
      setSelectedCorrespondentKeys(new Set())
      setNotice(`${result.deletedCount} communication(s) effacée(s).`)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible d’effacer les communications.")
    } finally {
      setIsDeletingConversations(false)
    }
  }

  async function syncGmail() {
    setIsSyncingGmail(true)
    setError(null)
    setNotice(null)
    try {
      const result = await readJson<{ checked?: number; imported?: number; skipped?: number }>(await fetch("/api/integrations/google/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 25 }),
      }))
      setNotice(`${result.imported ?? 0} courriel(s) ajouté(s) à la boîte de traitement. ${result.skipped ?? 0} ignoré(s).`)
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Impossible de synchroniser Gmail.")
    } finally {
      setIsSyncingGmail(false)
    }
  }

  async function updateEmailStatus(eventId: string, status: "DONE" | "ARCHIVED" | "PLANNED" | "WAITING") {
    setUpdatingEmailId(eventId)
    setError(null)
    setNotice(null)
    try {
      await readJson(await fetch(`/api/communications/email-activities/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }))
      setNotice(status === "ARCHIVED" || status === "DONE" ? "Courriel retiré de la boîte à traiter." : "Courriel reporté.")
      await load()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Impossible de mettre à jour le courriel.")
    } finally {
      setUpdatingEmailId(null)
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedConversation) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const to = String(formData.get("to") ?? selectedConversation.phone ?? "").trim()
    const body = String(formData.get("body") ?? "").trim()
    if (!to || !body) return

    setIsSendingReply(true)
    setError(null)
    setNotice(null)
    try {
      await readJson(await fetch("/api/communications/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          body,
          clientId: selectedConversation.client?.id,
          leadId: selectedConversation.lead?.id,
        }),
      }))
      form.reset()
      setNotice(`Réponse envoyée à ${selectedConversation.name}.`)
      await load()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Impossible d'envoyer la réponse.")
    } finally {
      setIsSendingReply(false)
    }
  }

  return (
    <PageShell
      eyebrow="Communications"
      title="Inbox intelligente"
      description="Boîte de traitement CRM pour transformer les courriels en tâches, documents, rendez-vous ou opportunités."
      showIntro={false}
    >
      {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <section className="isolate min-w-0 overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
            <CommunicationHero
              conversationsCount={conversations.length}
              inboundCount={inboundCount}
              attentionCount={attentionCount}
              selectedCount={selectedCorrespondents.length}
              selectedMessageCount={selectedCorrespondentMessageCount}
              onRefresh={() => void load()}
              onSyncGmail={() => void syncGmail()}
              isSyncingGmail={isSyncingGmail}
            />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CommunicationMetricCard icon={Inbox} label="À traiter" value={inboxStats.toProcess} detail="Courriels actifs" tone="bg-emerald-50 text-emerald-800 border-emerald-200 shadow-[0_6px_0_#bbf7d0]" />
            <CommunicationMetricCard icon={AlertTriangle} label="Urgents" value={inboxStats.urgent} detail="Réclamation, résiliation, urgence" tone="bg-rose-50 text-rose-800 border-rose-200 shadow-[0_6px_0_#fecdd3]" />
            <CommunicationMetricCard icon={FileText} label="Documents" value={inboxStats.documents} detail="Pièces à classer" tone="bg-amber-50 text-amber-800 border-amber-200 shadow-[0_6px_0_#fde68a]" />
            <CommunicationMetricCard icon={Sparkles} label="Non assignés" value={inboxStats.unassigned} detail="À lier au CRM" tone="bg-violet-50 text-violet-800 border-violet-200 shadow-[0_6px_0_#ddd6fe]" />
            <CommunicationMetricCard icon={CheckCircle2} label="Traités" value={inboxStats.archived} detail="Retirés de la boîte" tone="bg-slate-50 text-slate-800 border-slate-200 shadow-[0_6px_0_#e2e8f0]" />
          </div>
        </div>

        <div className="min-h-[640px] p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Emplacement actuel</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Boîte de réception par correspondant</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Traitez chaque courriel, liez-le au CRM, créez une action si nécessaire, puis archivez-le.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void load()} className="rounded-full border-2 bg-white font-black">
                <RefreshCw className="size-4" />
                Rafraîchir
              </Button>
              <Button type="button" variant="outline" onClick={() => void syncGmail()} disabled={isSyncingGmail} className="rounded-full border-2 bg-white font-black">
                {isSyncingGmail ? <RefreshCw className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Synchroniser Gmail
              </Button>
              <Button type="button" asChild className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800">
                <Link href="/settings/communications">
                  <Settings className="size-4" />
                  Configurer
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid min-h-[680px] min-w-0 overflow-hidden rounded-[1.75rem] border-2 border-slate-200 bg-white shadow-[0_8px_0_#f1f5f9] md:grid-cols-[minmax(340px,390px)_minmax(0,1fr)] lg:h-[calc(100svh-330px)] lg:min-h-[640px] xl:grid-cols-[minmax(380px,420px)_minmax(0,1fr)]">
          <aside className="flex w-full min-w-0 flex-col border-b border-slate-100 bg-slate-50 lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50 p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="Rechercher un nom, téléphone, courriel..."
                  className="h-12 w-full rounded-full border-2 border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </label>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {[
                  { label: "À traiter", value: "to-process" as const, count: inboxStats.toProcess },
                  { label: "Urgents", value: "urgent" as const, count: inboxStats.urgent },
                  { label: "Non assignés", value: "unassigned" as const, count: inboxStats.unassigned },
                  { label: "Documents", value: "documents" as const, count: inboxStats.documents },
                  { label: "Reportés", value: "planned" as const, count: 0 },
                  { label: "Archivés", value: "archived" as const, count: inboxStats.archived },
                  { label: "Tous", value: "all" as const, count: conversations.length },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={activeFilter === filter.value
                      ? "shrink-0 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
                      : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"}
                  >
                    {filter.label}{filter.count ? ` · ${filter.count}` : ""}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Correspondants</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">
                      {selectedCorrespondents.length > 0
                        ? `${selectedCorrespondents.length} sélectionné(s), ${selectedCorrespondentMessageCount} communication(s)`
                        : "Cochez les noms à effacer"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={selectedCorrespondents.length === 0 || isDeletingConversations}
                    onClick={() => void deleteSelectedCorrespondentsCommunications()}
                    className="shrink-0 rounded-full bg-rose-600 font-black hover:bg-rose-700"
                  >
                    <Trash2 className="size-3.5" />
                    Effacer
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="rounded-full bg-white" onClick={selectVisibleCorrespondents}>
                    Tout sélectionner
                  </Button>
                  {selectedCorrespondents.length > 0 ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-full bg-white" onClick={clearSelection}>
                      Annuler
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && filteredConversations.length === 0 ? <EmptyPanel title="Aucune conversation" description="Les messages liés aux dossiers apparaîtront ici." /> : null}
              {!isLoading && filteredConversations.length > 0 ? (
                <div className="grid min-w-0 gap-3 pb-2">
                  {filteredConversations.map((conversation) => (
                    <ConversationButton
                      key={conversation.key}
                      conversation={conversation}
                      active={selectedConversation?.key === conversation.key}
                      selected={selectedCorrespondentKeys.has(conversation.key)}
                      onClick={() => setSelectedConversationKey(conversation.key)}
                      onToggleSelected={() => toggleCorrespondentSelection(conversation)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </aside>

          <main className="flex min-w-0 flex-col bg-white">
            <ConversationThread conversation={selectedConversation} updatingEmailId={updatingEmailId} onUpdateEmailStatus={updateEmailStatus} />
            {selectedConversation ? <ReplyComposer conversation={selectedConversation} isSendingReply={isSendingReply} onSubmit={sendReply} /> : null}
          </main>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

function formatCommunicationDate(value?: string | null) {
  if (!value) return "Date inconnue"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function channelIcon(channel: ConversationEvent["channel"]) {
  if (channel === "EMAIL") return Mail
  if (channel === "CALL") return PhoneCall
  return MessageSquare
}

function CommunicationHero({
  conversationsCount,
  inboundCount,
  attentionCount,
  selectedCount,
  selectedMessageCount,
  onRefresh,
  onSyncGmail,
  isSyncingGmail,
}: {
  conversationsCount: number
  inboundCount: number
  attentionCount: number
  selectedCount: number
  selectedMessageCount: number
  onRefresh: () => void
  onSyncGmail: () => void
  isSyncingGmail: boolean
}) {
  const stages = ["À traiter", "Urgents", "Documents", "Non assignés", "Répondre", "Archiver"]

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-stretch">
      <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Inbox zéro CRM</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight">Chaque courriel devient une action claire</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
          Ne remplacez pas Gmail ou Outlook : utilisez-les comme source, puis traitez, classez, reliez au CRM et archivez dans FinAssuro.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stages.map((stage) => (
            <span key={stage} className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-black text-white">
              {stage}
            </span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={onRefresh}>
            <RefreshCw className="size-4" />
            Rafraîchir
          </Button>
          <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={onSyncGmail} disabled={isSyncingGmail}>
            {isSyncingGmail ? <RefreshCw className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Synchroniser Gmail
          </Button>
          <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" asChild>
            <Link href="/settings/communications">
              <Settings className="size-4" />
              Paramètres
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Boîte active</p>
        <p className="mt-2 text-4xl font-black text-slate-950">{conversationsCount}</p>
        <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(conversationsCount * 8, 100)}%` }} />
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          {inboundCount} message(s) à traiter · {attentionCount} élément(s) urgent(s) ou à vérifier.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-amber-700">{inboundCount}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Entrants</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-rose-700">{attentionCount}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">À vérifier</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-violet-700">{selectedCount}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">{selectedMessageCount} msgs</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommunicationMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Inbox
  label: string
  value: number
  detail: string
  tone: string
}) {
  return (
    <div className={`rounded-[1.5rem] border-2 p-4 text-left ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">{label}</p>
        <Icon className="size-5 shrink-0" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </div>
  )
}

function ConversationButton({
  conversation,
  active,
  selected,
  onClick,
  onToggleSelected,
}: {
  conversation: Conversation
  active: boolean
  selected: boolean
  onClick: () => void
  onToggleSelected: () => void
}) {
  const latest = conversation.events[0]
  const Icon = latest ? channelIcon(latest.channel) : Inbox
  return (
    <div
      className={
        selected
          ? "flex w-full min-w-0 items-start gap-3 rounded-[1.25rem] border-2 border-rose-300 bg-rose-50 p-3 shadow-[0_5px_0_#fecdd3]"
          : active
            ? "flex w-full min-w-0 items-start gap-3 rounded-[1.25rem] border-2 border-emerald-300 bg-emerald-50 p-3 shadow-[0_5px_0_#bbf7d0]"
            : "flex w-full min-w-0 items-start gap-3 rounded-[1.25rem] border-2 border-transparent bg-white p-3 transition hover:border-emerald-100 hover:bg-emerald-50"
      }
    >
      <label className="mt-2 grid size-5 shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          aria-label={`Sélectionner ${conversation.name}`}
        />
      </label>
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-50 text-emerald-700 shadow-sm">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-black text-slate-950">{conversation.name}</p>
            {conversation.attentionCount > 0 ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700">{conversation.attentionCount}</span> : null}
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{conversation.phone ?? conversation.email ?? "Coordonnée à compléter"}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{conversation.latestPreview || latest?.title || "Aucun aperçu disponible"}</p>
          {latest?.channel === "EMAIL" && latest.summary ? (
            <p className="mt-2 line-clamp-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
              {latest.summary}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={conversation.type === "CLIENT" ? "emerald" : conversation.type === "LEAD" ? "sky" : "slate"}>
              {conversation.type === "CLIENT" ? "Client" : conversation.type === "LEAD" ? "Prospect" : "Non associé"}
            </StatusBadge>
            {conversation.unreadCount > 0 ? <StatusBadge tone="amber">{conversation.unreadCount} entrant(s)</StatusBadge> : null}
            {latest?.inboxType ? <StatusBadge tone={latest.inboxType === "URGENT" ? "rose" : latest.inboxType === "DOCUMENT" ? "amber" : "sky"}>{latest.inboxType}</StatusBadge> : null}
          </div>
        </div>
      </div>
      </button>
    </div>
  )
}

function ConversationThread({
  conversation,
  updatingEmailId,
  onUpdateEmailStatus,
}: {
  conversation: Conversation | null
  updatingEmailId: string | null
  onUpdateEmailStatus: (eventId: string, status: "DONE" | "ARCHIVED" | "PLANNED" | "WAITING") => Promise<void>
}) {
  if (!conversation) {
    return (
      <div className="p-4">
        <EmptyPanel title="Aucune conversation sélectionnée" description="Choisissez un client ou un prospect dans la boîte de réception." />
      </div>
    )
  }

  const events = [...conversation.events].reverse()

  return (
    <div className="flex min-h-[540px] flex-col">
      <div className="border-b border-slate-100 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Conversation dossier</p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-950">{conversation.name}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {conversation.phone ?? "Téléphone non défini"} {conversation.email ? `· ${conversation.email}` : ""}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" className="rounded-full bg-white" asChild>
            <Link href={conversation.href}>Ouvrir dossier</Link>
          </Button>
        </div>
      </div>

      <div className="max-h-[560px] flex-1 overflow-y-auto bg-slate-50/60 p-4">
        <div className="grid gap-3">
          {events.map((event) => {
            const Icon = channelIcon(event.channel)
            const outbound = event.direction === "OUTBOUND"
            return (
              <article
                key={`${event.channel}-${event.id}`}
                className={
                  outbound
                    ? "ml-auto w-fit max-w-[86%] rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm"
                    : "mr-auto w-fit max-w-[86%] rounded-[1.25rem] border border-slate-100 bg-white p-4 shadow-sm"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{event.title}</p>
                      <p className="text-xs font-semibold text-slate-400">{formatCommunicationDate(event.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <StatusBadge tone={outbound ? "emerald" : "sky"}>{outbound ? "Sortant" : "Entrant"}</StatusBadge>
                    <StatusBadge tone={statusTone(event.status)}>{event.channel}</StatusBadge>
                  </div>
                </div>

                {event.body ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.body}</p>
                ) : (
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Aucun contenu texte disponible pour cette communication.</p>
                )}

                {event.channel === "EMAIL" ? (
                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Résumé et action recommandée</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{event.summary ?? event.body ?? event.title}</p>
                        {event.recommendedAction ? <p className="mt-1 text-xs font-bold leading-5 text-emerald-800">{event.recommendedAction}</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={updatingEmailId === event.id} className="rounded-full bg-white font-black" onClick={() => void onUpdateEmailStatus(event.id, "DONE")}>
                        <CheckCircle2 className="size-3.5" />
                        Traité
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={updatingEmailId === event.id} className="rounded-full bg-white font-black" onClick={() => void onUpdateEmailStatus(event.id, "PLANNED")}>
                        <RefreshCw className="size-3.5" />
                        Reporter
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={updatingEmailId === event.id} className="rounded-full bg-white font-black" onClick={() => void onUpdateEmailStatus(event.id, "ARCHIVED")}>
                        <Archive className="size-3.5" />
                        Archiver
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  {event.from ? <span>De: {event.from}</span> : null}
                  {event.to ? <span>À: {event.to}</span> : null}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReplyComposer({
  conversation,
  isSendingReply,
  onSubmit,
}: {
  conversation: Conversation
  isSendingReply: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-slate-100 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Numéro
          <input
            name="to"
            defaultValue={conversation.phone ?? ""}
            placeholder="Téléphone à compléter"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Réponse
          <textarea
            name="body"
            rows={2}
            maxLength={1000}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="Écrivez une réponse administrative claire et professionnelle."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isSendingReply || !conversation.phone} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            <Send className="size-4" />
            Envoyer
          </Button>
          <Button type="button" variant="outline" className="rounded-full bg-white" asChild>
            <Link href={conversation.href}>Dossier</Link>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">
        Les réponses SMS doivent rester administratives: suivi, confirmation, document ou rendez-vous.
      </p>
    </form>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white p-8 text-center">
      <Inbox className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-base font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-[1.5rem] bg-white" />
      ))}
    </div>
  )
}
