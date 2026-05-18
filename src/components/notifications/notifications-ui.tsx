"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCheck,
  CheckSquare,
  Clock,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react"

type Notification = {
  id: string
  type: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  status: "UNREAD" | "READ" | "ARCHIVED" | "DISMISSED"
  title: string
  message: string | null
  actionLabel: string | null
  actionUrl: string | null
  href: string | null
  createdAt: string
  readAt: string | null
}

type NotificationsResponse = {
  items: Notification[]
  total: number
  page: number
  limit: number
  totalPages: number
}

type NotificationFilter = "ALL" | "UNREAD" | "URGENT" | "TASKS" | "DOCUMENTS" | "ALERTS" | "AUTOMATIONS"

async function readResponse(response: Response) {
  const json = await response.json()
  if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Action impossible.")
  return json.data
}

function relativeDate(value: string) {
  const date = new Date(value)
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)
  const formatter = new Intl.RelativeTimeFormat("fr-CA", { numeric: "auto" })
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute")
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour")
  return formatter.format(Math.round(diffHours / 24), "day")
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function NotificationPriorityBadge({ priority }: { priority: Notification["priority"] }) {
  const classes = {
    URGENT: "bg-rose-50 text-rose-700 ring-rose-100",
    HIGH: "bg-orange-50 text-orange-700 ring-orange-100",
    NORMAL: "bg-blue-50 text-blue-700 ring-blue-100",
    LOW: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority]
  const label = {
    URGENT: "Urgent",
    HIGH: "Haute",
    NORMAL: "Normale",
    LOW: "Basse",
  }[priority]
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${classes}`}>{label}</span>
}

export function NotificationTypeIcon({ type }: { type: string }) {
  const Icon = type.includes("TASK") ? CheckSquare : type.includes("DOCUMENT") ? FileText : type.includes("ALERT") ? AlertTriangle : type.includes("AUTOMATION") ? Bot : type.includes("COMPLIANCE") ? ShieldCheck : type.includes("SMS") ? MessageSquare : type.includes("LEAD") ? UserPlus : Bell
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
      <Icon className="size-4" />
    </span>
  )
}

export function NotificationItem({ notification, onRead, onDelete }: { notification: Notification; onRead?: (id: string) => void; onDelete?: (id: string) => void }) {
  const url = notification.actionUrl ?? notification.href
  return (
    <article className={`rounded-2xl border p-3 transition ${notification.status === "UNREAD" ? "border-emerald-100 bg-emerald-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <div className="flex gap-3">
        <NotificationTypeIcon type={notification.type} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-950">{notification.title}</h3>
            <NotificationPriorityBadge priority={notification.priority} />
            {notification.status === "UNREAD" ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Non lue</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{notification.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Clock className="size-3.5" />
            <span title={fullDate(notification.createdAt)}>{relativeDate(notification.createdAt)}</span>
            {notification.actionLabel && url ? <Link href={url} className="font-semibold text-emerald-700 hover:text-emerald-900">{notification.actionLabel}</Link> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {notification.status === "UNREAD" ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onRead?.(notification.id)
              }}
              className="size-9 rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-emerald-700"
              aria-label="Marquer comme lue"
            >
              <CheckCheck className="mx-auto size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onDelete?.(notification.id)
            }}
            className="size-9 rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            aria-label="Supprimer la notification"
          >
            <Trash2 className="mx-auto size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}

export function NotificationEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <Inbox className="mx-auto size-8 text-slate-400" />
      <p className="mt-3 font-semibold text-slate-950">Aucune notification pour le moment.</p>
      <p className="mt-1 text-sm text-slate-500">Les événements importants apparaîtront ici.</p>
    </div>
  )
}

export function NotificationsDropdown({ notifications, loading, onRead, onReadAll, onDelete }: { notifications: Notification[]; loading: boolean; onRead: (id: string) => void; onReadAll: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="absolute right-0 top-14 z-50 w-[min(380px,calc(100vw-2rem))] rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div>
          <p className="font-semibold text-slate-950">Notifications</p>
          <p className="text-xs text-slate-500">Événements récents du CRM</p>
        </div>
        <button type="button" onClick={onReadAll} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
          Tout marquer comme lu
        </button>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Chargement...</p>
      ) : notifications.length === 0 ? (
        <NotificationEmptyState />
      ) : (
        <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
          {notifications.slice(0, 8).map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onRead={onRead} onDelete={onDelete} />
          ))}
        </div>
      )}
      <Link href="/notifications" className="mt-3 flex h-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
        Voir toutes les notifications
      </Link>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = notifications.filter((item) => item.status === "UNREAD" && !item.readAt).length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: NotificationsResponse = await readResponse(await fetch("/api/notifications?limit=10"))
      setNotifications(data.items)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const markRead = async (id: string) => {
    await readResponse(await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }))
    await load()
  }

  const markAllRead = async () => {
    await readResponse(await fetch("/api/notifications/read-all", { method: "PATCH" }))
    await load()
  }

  const deleteItem = async (id: string) => {
    await readResponse(await fetch(`/api/notifications/${id}`, { method: "DELETE" }))
    await load()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-950 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Notifications: ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? <NotificationsDropdown notifications={notifications} loading={loading} onRead={(id) => void markRead(id)} onReadAll={() => void markAllRead()} onDelete={(id) => void deleteItem(id)} /> : null}
    </div>
  )
}

export function NotificationSummaryCards({ notifications }: { notifications: Notification[] }) {
  const cards = [
    { label: "Non lues", value: notifications.filter((item) => item.status === "UNREAD").length, icon: Bell },
    { label: "Urgentes", value: notifications.filter((item) => item.priority === "URGENT").length, icon: AlertTriangle },
    { label: "Haute priorité", value: notifications.filter((item) => item.priority === "HIGH").length, icon: ShieldCheck },
    { label: "Automatisations", value: notifications.filter((item) => item.type.includes("AUTOMATION")).length, icon: Bot },
    { label: "Documents", value: notifications.filter((item) => item.type.includes("DOCUMENT")).length, icon: FileText },
    { label: "Tâches", value: notifications.filter((item) => item.type.includes("TASK")).length, icon: CheckSquare },
  ]
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-[1.25rem] border border-white/70 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <Icon className="size-4 text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{card.value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
          </div>
        )
      })}
    </section>
  )
}

export function NotificationFilters({ value, onChange }: { value: NotificationFilter; onChange: (value: NotificationFilter) => void }) {
  const filters: { value: NotificationFilter; label: string }[] = [
    { value: "ALL", label: "Toutes" },
    { value: "UNREAD", label: "Non lues" },
    { value: "URGENT", label: "Urgentes" },
    { value: "TASKS", label: "Tâches" },
    { value: "DOCUMENTS", label: "Documents" },
    { value: "ALERTS", label: "Alertes" },
    { value: "AUTOMATIONS", label: "Automatisations" },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button key={filter.value} type="button" onClick={() => onChange(filter.value)} className={`h-10 shrink-0 rounded-2xl px-4 text-sm font-semibold transition ${value === filter.value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {filter.label}
        </button>
      ))}
    </div>
  )
}

export function NotificationList({ notifications, onRead, onDelete }: { notifications: Notification[]; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  if (notifications.length === 0) return <NotificationEmptyState />
  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRead={onRead} onDelete={onDelete} />
      ))}
    </div>
  )
}

export function MarkAllReadButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
      Tout marquer comme lu
    </button>
  )
}

export function NotificationsPage() {
  const searchParams = useSearchParams()
  const requestedFilter = searchParams.get("filter") as NotificationFilter | null
  const initialFilter: NotificationFilter = requestedFilter && ["ALL", "UNREAD", "URGENT", "TASKS", "DOCUMENTS", "ALERTS", "AUTOMATIONS"].includes(requestedFilter) ? requestedFilter : "ALL"
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>(initialFilter)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "50" })
    if (filter === "UNREAD") {
      params.set("status", "UNREAD")
      params.set("isRead", "false")
    }
    if (filter === "URGENT") params.set("priority", "URGENT")
    return params.toString()
  }, [filter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result: NotificationsResponse = await readResponse(await fetch(`/api/notifications?${query}`))
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const filteredItems = useMemo(() => {
    const items = data?.items ?? []
    if (filter === "TASKS") return items.filter((item) => item.type.includes("TASK"))
    if (filter === "DOCUMENTS") return items.filter((item) => item.type.includes("DOCUMENT"))
    if (filter === "ALERTS") return items.filter((item) => item.type.includes("ALERT"))
    if (filter === "AUTOMATIONS") return items.filter((item) => item.type.includes("AUTOMATION"))
    return items
  }, [data?.items, filter])

  const markRead = async (id: string) => {
    await readResponse(await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }))
    await load()
  }

  const markAllRead = async () => {
    setSaving(true)
    try {
      await readResponse(await fetch("/api/notifications/read-all", { method: "PATCH" }))
      await load()
    } finally {
      setSaving(false)
    }
  }

  const deleteNotification = async (id: string) => {
    const confirmed = window.confirm("Supprimer cette notification? Cette action la retirera définitivement de la liste.")
    if (!confirmed) return
    setSaving(true)
    try {
      await readResponse(await fetch(`/api/notifications/${id}`, { method: "DELETE" }))
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-[1.75rem] border border-white/60 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Notifications</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Centre de notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Suivez les événements importants, les alertes, les tâches et les automatisations qui nécessitent votre attention.
            </p>
          </div>
          <MarkAllReadButton onClick={() => void markAllRead()} loading={saving} />
        </div>
      </header>

      <NotificationSummaryCards notifications={data?.items ?? []} />

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <NotificationFilters value={filter} onChange={setFilter} />
        <div className="mt-5">
          {loading ? (
            <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Chargement des notifications...</p>
          ) : (
            <NotificationList notifications={filteredItems} onRead={(id) => void markRead(id)} onDelete={(id) => void deleteNotification(id)} />
          )}
        </div>
      </section>
    </div>
  )
}
