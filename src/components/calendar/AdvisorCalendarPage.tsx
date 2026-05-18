"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  PhoneCall,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CalendarTask = {
  id: string
  title: string
  description?: string | null
  type: "CALL" | "SMS" | "EMAIL" | "MEETING" | "DOCUMENT" | "KYC" | "FOLLOW_UP" | "PRODUCT_REVIEW" | "RENEWAL" | "COMPLIANCE" | "INTERNAL" | "OTHER" | "CAMPAIGN" | "BIRTHDAY" | "ANNUAL_REVIEW" | "OPPORTUNITY" | "REMINDER"
  status: string
  priority: string
  dueDate?: string | null
  startDate?: string | null
  href?: string | null
  sourceLabel?: string | null
  lead?: { id?: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null
  client?: { id?: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null
  owner?: { id: string; name: string; email: string } | null
  context?: string[]
  alerts?: string[]
  opportunities?: string[]
  recommendedAction?: string | null
  priorityReason?: string | null
  calendarEventId?: string | null
}

type CalendarEventRecord = {
  id: string
  title: string
  description?: string | null
  type: string
  status: string
  priority: string
  startAt: string
  endAt: string
  timezone: string
  locationType: "VIDEO" | "PHONE" | "IN_PERSON" | string
  meetingUrl?: string | null
  clientId?: string | null
  leadId?: string | null
  taskId?: string | null
  advisorId: string
  visibility?: string | null
}

type CalendarFilter = "ALL" | "MEETING" | "FOLLOW_UP" | "DEADLINE" | "DOCUMENT" | "CAMPAIGN"

type AvailabilitySlot = {
  id?: string
  advisorId?: string | null
  dayOfWeek: number
  startMinutes: number
  endMinutes: number
  label?: string | null
  isActive: boolean
}

type ClientOption = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  emailPrimary?: string | null
}

type AdvisorOption = {
  id: string
  name: string
  email: string
  title?: string | null
  availabilitySlots?: AvailabilitySlot[]
  _count?: {
    assignedTasks?: number
    availabilitySlots?: number
  }
}

type MeetingTypeOption = {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  slotStepMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeHours: number
  maxBookingsPerDay: number
  locationType: string
  isPublic: boolean
}

type AvailabilityExceptionOption = {
  id: string
  date: string
  startMinutes?: number | null
  endMinutes?: number | null
  type: string
  reason?: string | null
}

type CalendarPermissionOption = {
  id: string
  targetUserId: string
  permissionLevel: string
}

type CurrentUser = {
  id: string
  name: string
  email: string
  title?: string | null
}

const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
const dayFullLabels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
const weekStartHour = 0
const weekEndHour = 24
const weekHourHeight = 56
const weekGridTemplateColumns = "64px repeat(7, minmax(0, 1fr))"
const dayGridTemplateColumns = "80px minmax(0, 1fr)"
const creatableTaskTypes = [
  ["MEETING", "RDV client"],
  ["CALL", "Appel"],
  ["FOLLOW_UP", "Relance"],
  ["DOCUMENT", "Document"],
  ["COMPLIANCE", "Conformité"],
  ["INTERNAL", "Interne"],
  ["OTHER", "Autre"],
] as const

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(date: Date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { day: "2-digit", month: "short" }).format(date)
}

function formatLongDay(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long" }).format(date)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric" }).format(date)
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { hour: "2-digit", minute: "2-digit" }).format(date)
}

function dateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function minutesLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function timeInputValue(minutes: number) {
  return minutesLabel(Math.min(Math.max(minutes, 0), 23 * 60 + 59))
}

function slotKey(slot: Pick<AvailabilitySlot, "dayOfWeek" | "startMinutes" | "endMinutes">) {
  return `${slot.dayOfWeek}-${slot.startMinutes}-${slot.endMinutes}`
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function addMinutesToLabel(startMinutes: number, durationMinutes: number) {
  return minutesLabel(Math.min(startMinutes + durationMinutes, 24 * 60))
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function eventDurationMinutes(task: CalendarTask) {
  const match = task.description?.match(/Fin prévue:\s*([^\n]+)/)
  if (match?.[1] && task.dueDate) {
    const start = new Date(task.dueDate)
    const end = new Date(match[1])
    const duration = Math.round((end.getTime() - start.getTime()) / 60000)
    if (Number.isFinite(duration) && duration > 0) return Math.min(duration, 240)
  }
  if (task.type === "CALL" || task.type === "FOLLOW_UP") return 30
  if (task.type === "MEETING" || task.type === "ANNUAL_REVIEW") return 45
  return 30
}

function eventEndDate(task: CalendarTask) {
  const start = task.dueDate ? new Date(task.dueDate) : new Date()
  const match = task.description?.match(/Fin prévue:\s*([^\n]+)/)
  if (match?.[1]) {
    const end = new Date(match[1])
    if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) return end
  }
  return new Date(start.getTime() + eventDurationMinutes(task) * 60_000)
}

function eventModeFromDescription(task: CalendarTask): "VIDEO" | "PHONE" | "IN_PERSON" {
  const description = task.description ?? ""
  if (description.includes("Mode: Téléphone")) return "PHONE"
  if (description.includes("Mode: Présentiel")) return "IN_PERSON"
  return "VIDEO"
}

function normalizeCalendarTask(task: CalendarTask & {
  assignedTo?: { id: string; name: string; email: string } | null
}): CalendarTask {
  return {
    ...task,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : task.dueDate,
    owner: task.owner ?? task.assignedTo ?? null,
  }
}

function calendarEventToTask(event: CalendarEventRecord, advisors: AdvisorOption[], clients: ClientOption[]): CalendarTask {
  const advisor = advisors.find((item) => item.id === event.advisorId)
  const client = event.clientId ? clients.find((item) => item.id === event.clientId) : null
  return {
    id: event.id,
    calendarEventId: event.id,
    title: event.title,
    description: [
      event.description,
      `Mode: ${event.locationType === "PHONE" ? "Téléphone" : event.locationType === "IN_PERSON" ? "Présentiel" : "Visio"}`,
      `Fin prévue: ${event.endAt}`,
      event.meetingUrl ? `Lien visio: ${event.meetingUrl}` : null,
    ].filter(Boolean).join("\n"),
    type: event.type as CalendarTask["type"],
    status: event.status,
    priority: event.priority,
    dueDate: event.startAt,
    startDate: event.startAt,
    sourceLabel: event.visibility === "FREE_BUSY_ONLY" ? "Occupé / libre" : "Événement calendrier",
    client: client ? { id: client.id, firstName: client.firstName, lastName: client.lastName, email: client.emailPrimary ?? client.email ?? null } : null,
    owner: advisor ? { id: advisor.id, name: advisor.name, email: advisor.email } : null,
    context: [event.timezone, event.meetingUrl ? "Lien visio généré" : ""].filter(Boolean),
    recommendedAction: event.visibility === "FREE_BUSY_ONLY" ? null : "Préparer le rendez-vous et historiser les actions dans le CRM.",
  }
}

function weekEventPosition(task: CalendarTask) {
  const date = task.dueDate ? new Date(task.dueDate) : new Date()
  const startMinutes = minutesSinceMidnight(date)
  const visibleStartMinutes = weekStartHour * 60
  const visibleEndMinutes = weekEndHour * 60
  const duration = eventDurationMinutes(task)
  const clampedStart = Math.max(startMinutes, visibleStartMinutes)
  const clampedEnd = Math.min(startMinutes + duration, visibleEndMinutes)
  const top = ((clampedStart - visibleStartMinutes) / 60) * weekHourHeight
  const height = Math.max(38, ((clampedEnd - clampedStart) / 60) * weekHourHeight)
  return { top, height }
}

function currentTimeTop(now: Date) {
  const minutes = minutesSinceMidnight(now)
  if (minutes < weekStartHour * 60 || minutes > weekEndHour * 60) return null
  return ((minutes - weekStartHour * 60) / 60) * weekHourHeight
}

function taskTone(task: CalendarTask) {
  if (task.status === "OVERDUE" || task.priority === "URGENT") return "border-rose-200 bg-rose-50 text-rose-800"
  if (task.type === "DOCUMENT" || task.type === "KYC" || task.type === "COMPLIANCE") return "border-amber-200 bg-amber-50 text-amber-800"
  if (task.type === "CAMPAIGN") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800"
  if (task.type === "ANNUAL_REVIEW" || task.type === "PRODUCT_REVIEW" || task.type === "RENEWAL") return "border-blue-200 bg-blue-50 text-blue-800"
  if (task.type === "MEETING") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (task.type === "CALL") return "border-sky-200 bg-sky-50 text-sky-800"
  return "border-slate-200 bg-slate-50 text-slate-800"
}

function taskTypeLabel(type: CalendarTask["type"]) {
  const labels: Record<CalendarTask["type"], string> = {
    CALL: "Appel",
    SMS: "SMS",
    EMAIL: "Courriel",
    MEETING: "RDV",
    DOCUMENT: "Document",
    KYC: "Profil",
    FOLLOW_UP: "Suivi",
    PRODUCT_REVIEW: "Produit",
    RENEWAL: "Renouvellement",
    COMPLIANCE: "Conformité",
    INTERNAL: "Interne",
    OTHER: "Autre",
    CAMPAIGN: "Campagne",
    BIRTHDAY: "Anniversaire",
    ANNUAL_REVIEW: "Bilan annuel",
    OPPORTUNITY: "Opportunité",
    REMINDER: "Rappel",
  }
  return labels[type] ?? type
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    URGENT: "Critique",
    HIGH: "Haute",
    NORMAL: "Moyenne",
    LOW: "Basse",
    INFO: "Info",
  }
  return labels[priority] ?? priority
}

function priorityTone(priority: string): "emerald" | "sky" | "violet" | "amber" | "rose" | "slate" {
  if (priority === "URGENT") return "rose"
  if (priority === "HIGH") return "amber"
  if (priority === "INFO") return "sky"
  if (priority === "LOW") return "slate"
  return "violet"
}

function eventContactName(task: CalendarTask) {
  if (task.client) return `${task.client.firstName} ${task.client.lastName}`
  if (task.lead) return `${task.lead.firstName} ${task.lead.lastName}`
  return "Interne"
}

function eventPhone(task: CalendarTask) {
  return task.client?.phone ?? task.lead?.phone ?? null
}

function eventEmail(task: CalendarTask) {
  return task.client?.email ?? task.lead?.email ?? null
}

function eventSearchText(task: CalendarTask) {
  return [
    task.title,
    task.description,
    task.sourceLabel,
    task.owner?.name,
    task.client ? `${task.client.firstName} ${task.client.lastName}` : "",
    task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : "",
    ...(task.context ?? []),
    ...(task.alerts ?? []),
    ...(task.opportunities ?? []),
  ].filter(Boolean).join(" ").toLowerCase()
}

function matchesCalendarFilter(task: CalendarTask, filter: CalendarFilter) {
  if (filter === "ALL") return true
  if (filter === "MEETING") return task.type === "MEETING"
  if (filter === "FOLLOW_UP") return ["CALL", "SMS", "EMAIL", "FOLLOW_UP", "REMINDER", "OPPORTUNITY"].includes(task.type)
  if (filter === "DEADLINE") return ["RENEWAL", "PRODUCT_REVIEW", "ANNUAL_REVIEW", "COMPLIANCE"].includes(task.type)
  if (filter === "DOCUMENT") return ["DOCUMENT", "KYC"].includes(task.type)
  if (filter === "CAMPAIGN") return task.type === "CAMPAIGN"
  return true
}

function isEditableCalendarTask(task: CalendarTask) {
  return !task.sourceLabel || task.sourceLabel === "Tâche CRM" || task.sourceLabel === "Automatisation" || task.sourceLabel === "Événement calendrier"
}

async function readApiData<T>(response: Response) {
  const result = (await response.json()) as { ok?: boolean; data?: T; error?: string | { message?: string } }
  if (!response.ok || result.ok === false) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement("textarea")
  textArea.value = value
  textArea.setAttribute("readonly", "")
  textArea.style.position = "fixed"
  textArea.style.opacity = "0"
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand("copy")
  document.body.removeChild(textArea)
}

function EventActions({
  task,
  isCompleting,
  onComplete,
  isRescheduling,
  onReschedule,
}: {
  task: CalendarTask
  isCompleting: boolean
  onComplete: (task: CalendarTask) => void
  isRescheduling: boolean
  onReschedule: (task: CalendarTask) => void
}) {
  const phone = eventPhone(task)
  const email = eventEmail(task)
  const canComplete = !["DONE", "CANCELLED", "ARCHIVED"].includes(task.status)

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {phone ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`tel:${phone}`}>
            <PhoneCall className="size-4" />
            Appeler
          </a>
        </Button>
      ) : null}
      {email ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`mailto:${email}`}>
            <Mail className="size-4" />
            Email
          </a>
        </Button>
      ) : null}
      {task.href ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={task.href}>
            <ExternalLink className="size-4" />
            Ouvrir
          </a>
        </Button>
      ) : null}
      {task.client?.id ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`/clients/${task.client.id}`}>Fiche client</a>
        </Button>
      ) : null}
      {(task.type === "DOCUMENT" || task.type === "KYC") && task.client?.id ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`/clients/${task.client.id}`}>Demander document</a>
        </Button>
      ) : null}
      {canComplete ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onReschedule(task)} disabled={isRescheduling}>
          {isRescheduling ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
          Reporter demain
        </Button>
      ) : null}
      {canComplete ? (
        <Button type="button" size="sm" onClick={() => onComplete(task)} disabled={isCompleting}>
          {isCompleting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Terminer
        </Button>
      ) : null}
    </div>
  )
}

function AgendaEvent({
  task,
  isCompleting,
  onComplete,
  isRescheduling,
  onReschedule,
}: {
  task: CalendarTask
  isCompleting: boolean
  onComplete: (task: CalendarTask) => void
  isRescheduling: boolean
  onReschedule: (task: CalendarTask) => void
}) {
  return (
    <article className={`rounded-2xl border-2 p-3 shadow-[0_4px_0_#e2e8f0] ${taskTone(task)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase">
            {task.dueDate ? formatTime(new Date(task.dueDate)) : "Heure à préciser"} · {taskTypeLabel(task.type)}
          </p>
          <h4 className="mt-1 font-black">{task.title}</h4>
          <p className="mt-1 text-sm font-semibold opacity-80">{eventContactName(task)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={priorityTone(task.priority)}>{priorityLabel(task.priority)}</StatusBadge>
          {task.status === "OVERDUE" ? <StatusBadge tone="rose">En retard</StatusBadge> : null}
        </div>
      </div>

      {task.context?.length || task.alerts?.length || task.opportunities?.length ? (
        <div className="mt-3 grid gap-2 xl:grid-cols-3">
          {task.context?.length ? (
            <div className="rounded-2xl bg-white/75 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] opacity-70">Contexte</p>
              <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
                {task.context.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          ) : null}
          {task.alerts?.length ? (
            <div className="rounded-2xl bg-white/75 p-3">
              <p className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.08em] opacity-70">
                <AlertTriangle className="size-3.5" />
                Alertes
              </p>
              <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
                {task.alerts.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          ) : null}
          {task.opportunities?.length ? (
            <div className="rounded-2xl bg-white/75 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] opacity-70">Opportunités</p>
              <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
                {task.opportunities.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {task.recommendedAction ? (
        <div className="mt-3 rounded-2xl bg-white/75 p-3 text-xs font-black leading-5">
          Action recommandée : {task.recommendedAction}
        </div>
      ) : null}

      <EventActions
        task={task}
        isCompleting={isCompleting}
        onComplete={onComplete}
        isRescheduling={isRescheduling}
        onReschedule={onReschedule}
      />
    </article>
  )
}

export function AdvisorCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [calendarView, setCalendarView] = useState<"DAY" | "WEEK" | "MONTH" | "TEAM">("WEEK")
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([])
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeOption[]>([])
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityExceptionOption[]>([])
  const [calendarPermissions, setCalendarPermissions] = useState<CalendarPermissionOption[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isCopyingLink, setIsCopyingLink] = useState(false)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [selectedCalendarTask, setSelectedCalendarTask] = useState<CalendarTask | null>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("ALL")
  const [advisorFilter, setAdvisorFilter] = useState("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [availabilityDay, setAvailabilityDay] = useState(1)
  const [availabilityStart, setAvailabilityStart] = useState("09:00")
  const [availabilityEnd, setAvailabilityEnd] = useState("10:00")
  const [eventType, setEventType] = useState<(typeof creatableTaskTypes)[number][0]>("MEETING")
  const [eventTitle, setEventTitle] = useState("")
  const [eventClientId, setEventClientId] = useState("")
  const [eventAdvisorId, setEventAdvisorId] = useState("")
  const [eventDate, setEventDate] = useState(() => dateInputValue(new Date()))
  const [eventStart, setEventStart] = useState("09:00")
  const [eventEnd, setEventEnd] = useState("09:45")
  const [eventMode, setEventMode] = useState<"VIDEO" | "PHONE" | "IN_PERSON">("VIDEO")
  const [slotFinderDuration, setSlotFinderDuration] = useState(45)
  const [meetingTypeName, setMeetingTypeName] = useState("Bilan retraite")
  const [meetingTypeDuration, setMeetingTypeDuration] = useState(45)
  const [meetingTypeStep, setMeetingTypeStep] = useState(30)
  const [meetingTypeBuffer, setMeetingTypeBuffer] = useState(15)
  const [meetingTypeNotice, setMeetingTypeNotice] = useState(24)
  const [meetingTypeMaxPerDay, setMeetingTypeMaxPerDay] = useState(4)
  const [meetingTypeLocation, setMeetingTypeLocation] = useState<"VIDEO" | "PHONE" | "IN_PERSON">("VIDEO")
  const [exceptionDate, setExceptionDate] = useState(() => dateInputValue(new Date()))
  const [exceptionStart, setExceptionStart] = useState("09:00")
  const [exceptionEnd, setExceptionEnd] = useState("18:00")
  const [exceptionReason, setExceptionReason] = useState("Indisponible")
  const [permissionTargetUserId, setPermissionTargetUserId] = useState("")
  const [permissionLevel, setPermissionLevel] = useState("FREE_BUSY_ONLY")
  const [now, setNow] = useState(() => new Date())

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekHours = useMemo(() => Array.from({ length: weekEndHour - weekStartHour + 1 }, (_, index) => (weekStartHour + index) * 60), [])
  const weekSlots = useMemo(() => Array.from({ length: (weekEndHour - weekStartHour) * 2 }, (_, index) => weekStartHour * 60 + index * 30), [])
  const nowTop = useMemo(() => currentTimeTop(now), [now])
  const monthDays = useMemo(() => {
    const first = startOfMonth(monthCursor)
    const firstGridDay = addDays(first, -first.getDay())
    return Array.from({ length: 42 }, (_, index) => addDays(firstGridDay, index))
  }, [monthCursor])

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return tasks.filter((task) => (
      matchesCalendarFilter(task, calendarFilter) &&
      (advisorFilter === "ALL" || task.owner?.id === advisorFilter) &&
      (!query || eventSearchText(task).includes(query))
    ))
  }, [advisorFilter, calendarFilter, searchTerm, tasks])

  const selectedDayTasks = useMemo(() => filteredTasks
    .filter((task) => task.dueDate && sameDay(new Date(task.dueDate), selectedDay))
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime()), [filteredTasks, selectedDay])

  const selectedDaySlots = useMemo(() => availability
    .filter((slot) => slot.isActive && slot.dayOfWeek === selectedDay.getDay())
    .sort((a, b) => a.startMinutes - b.startMinutes), [availability, selectedDay])

  const availabilityByDay = useMemo(() => dayFullLabels.map((label, dayOfWeek) => ({
    label,
    slots: availability
      .filter((slot) => slot.isActive && slot.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startMinutes - b.startMinutes),
  })), [availability])

  const selectedDayByAdvisor = useMemo(() => advisors.map((advisor) => ({
    advisor,
    tasks: tasks
      .filter((task) => task.owner?.id === advisor.id && task.dueDate && sameDay(new Date(task.dueDate), selectedDay))
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime()),
    slots: (advisor.availabilitySlots ?? [])
      .filter((slot) => slot.isActive && slot.dayOfWeek === selectedDay.getDay())
      .sort((a, b) => a.startMinutes - b.startMinutes),
  })), [advisors, selectedDay, tasks])

  const availableTeamSlots = useMemo(() => selectedDayByAdvisor.map(({ advisor, tasks: advisorTasks, slots }) => {
    const busyRanges = advisorTasks
      .filter((task) => task.dueDate)
      .map((task) => {
        const dueDate = new Date(task.dueDate as string)
        const startMinutes = dueDate.getHours() * 60 + dueDate.getMinutes()
        return { startMinutes, endMinutes: startMinutes + 45 }
      })

    const starts = slots.flatMap((slot) => {
      const candidates: number[] = []
      for (let minutes = slot.startMinutes; minutes + slotFinderDuration <= slot.endMinutes; minutes += 30) {
        const hasConflict = busyRanges.some((busy) => minutes < busy.endMinutes && minutes + slotFinderDuration > busy.startMinutes)
        if (!hasConflict) candidates.push(minutes)
      }
      return candidates
    })

    return { advisor, starts: starts.slice(0, 4) }
  }).filter((item) => item.starts.length > 0), [selectedDayByAdvisor, slotFinderDuration])

  const recommendedPriority = useMemo(() => filteredTasks
    .filter((task) => task.dueDate && (task.status === "OVERDUE" || ["URGENT", "HIGH"].includes(task.priority)))
    .sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3, INFO: 4 } as Record<string, number>
      return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) ||
        new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime()
    })[0] ?? null, [filteredTasks])

  const loadCalendar = useCallback(async () => {
    setIsLoading(true)
    setNotice(null)
    try {
      const [tasksResponse, calendarEventsResponse, availabilityResponse, clientsResponse, advisorsResponse, profileResponse, meetingTypesResponse, exceptionsResponse, permissionsResponse] = await Promise.all([
        fetch("/api/calendar/intelligence?range=90", { cache: "no-store" }),
        fetch("/api/calendar/events", { cache: "no-store" }),
        fetch("/api/calendar/availability", { cache: "no-store" }),
        fetch("/api/clients?pageSize=100", { cache: "no-store" }),
        fetch("/api/team/advisors", { cache: "no-store" }),
        fetch("/api/me/profile", { cache: "no-store" }),
        fetch("/api/calendar/meeting-types", { cache: "no-store" }),
        fetch("/api/calendar/exceptions", { cache: "no-store" }),
        fetch("/api/calendar/permissions", { cache: "no-store" }),
      ])
      const [nextTasks, nextCalendarEvents, nextAvailability, nextClients, nextAdvisors, nextProfile, nextMeetingTypes, nextExceptions, nextPermissions] = await Promise.all([
        readApiData<CalendarTask[]>(tasksResponse),
        readApiData<CalendarEventRecord[]>(calendarEventsResponse),
        readApiData<AvailabilitySlot[]>(availabilityResponse),
        readApiData<ClientOption[]>(clientsResponse),
        readApiData<AdvisorOption[]>(advisorsResponse),
        readApiData<CurrentUser>(profileResponse),
        readApiData<MeetingTypeOption[]>(meetingTypesResponse),
        readApiData<AvailabilityExceptionOption[]>(exceptionsResponse),
        readApiData<CalendarPermissionOption[]>(permissionsResponse),
      ])
      setTasks([
        ...nextTasks.filter((task) => task.dueDate),
        ...nextCalendarEvents.filter((event) => event.status !== "CANCELLED").map((event) => calendarEventToTask(event, nextAdvisors, nextClients)),
      ])
      setAvailability(nextAvailability)
      setClients(nextClients)
      setAdvisors(nextAdvisors)
      setMeetingTypes(nextMeetingTypes)
      setAvailabilityExceptions(nextExceptions)
      setCalendarPermissions(nextPermissions)
      setCurrentUser(nextProfile)
      setEventClientId((current) => current || nextClients[0]?.id || "")
      setEventAdvisorId((current) => current || nextAdvisors[0]?.id || "")
      setPermissionTargetUserId((current) => current || nextAdvisors.find((advisor) => advisor.id !== nextProfile.id)?.id || "")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de charger le calendrier.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar])

  useEffect(() => {
    if (!isEventDialogOpen) setEventDate(dateInputValue(selectedDay))
  }, [isEventDialogOpen, selectedDay])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  function openCreateEventDialog(day: Date, startMinutes: number, advisorId?: string) {
    setEditingTaskId(null)
    setSelectedCalendarTask(null)
    setNotice(null)
    setSelectedDay(day)
    setWeekStart(startOfWeek(day))
    setMonthCursor(startOfMonth(day))
    setEventDate(dateInputValue(day))
    setEventStart(timeInputValue(startMinutes))
    setEventEnd(timeInputValue(startMinutes + 45))
    setEventType("MEETING")
    setEventAdvisorId(advisorId || eventAdvisorId || currentUser?.id || advisors[0]?.id || "")
    setEventTitle("Rendez-vous client")
    setEventClientId("")
    setEventMode("VIDEO")
    setIsEventDialogOpen(true)
  }

  function openEditEventDialog(task: CalendarTask) {
    const start = task.dueDate ? new Date(task.dueDate) : selectedDay
    const end = eventEndDate(task)
    const canEditTask = isEditableCalendarTask(task)
    setEditingTaskId(canEditTask ? task.id : null)
    setSelectedCalendarTask(task)
    setNotice(canEditTask ? null : "Cet élément vient d’une alerte automatique. Vous pouvez créer un vrai événement à partir de ces informations, mais il ne peut pas être supprimé ici.")
    setSelectedDay(start)
    setWeekStart(startOfWeek(start))
    setMonthCursor(startOfMonth(start))
    setEventDate(dateInputValue(start))
    setEventStart(timeInputValue(minutesSinceMidnight(start)))
    setEventEnd(timeInputValue(minutesSinceMidnight(end)))
    setEventType((creatableTaskTypes.some(([type]) => type === task.type) ? task.type : "OTHER") as (typeof creatableTaskTypes)[number][0])
    setEventTitle(task.title)
    setEventClientId(task.client?.id ?? "")
    setEventAdvisorId(task.owner?.id ?? currentUser?.id ?? advisors[0]?.id ?? "")
    setEventMode(eventModeFromDescription(task))
    setIsEventDialogOpen(true)
  }

  function closeEventDialog() {
    setIsEventDialogOpen(false)
    setEditingTaskId(null)
    setSelectedCalendarTask(null)
  }

  function addAvailabilitySlot() {
    const startMinutes = timeToMinutes(availabilityStart)
    const endMinutes = timeToMinutes(availabilityEnd)
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setNotice("Choisissez une heure de fin après l’heure de début.")
      return
    }

    const nextSlot = { dayOfWeek: availabilityDay, startMinutes, endMinutes, isActive: true }
    setAvailability((current) => {
      const withoutDuplicate = current.filter((slot) => slotKey(slot) !== slotKey(nextSlot))
      return [...withoutDuplicate, nextSlot].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinutes - b.startMinutes)
    })
    setNotice("Créneau ajouté. Cliquez sur Sauvegarder pour le publier.")
  }

  function removeAvailabilitySlot(slot: AvailabilitySlot) {
    setAvailability((current) => current.filter((item) => slotKey(item) !== slotKey(slot)))
    setNotice("Créneau retiré. Cliquez sur Sauvegarder pour confirmer.")
  }

  async function saveAvailability() {
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch("/api/calendar/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: availability }),
      })
      const saved = await readApiData<AvailabilitySlot[]>(response)
      setAvailability(saved)
      setNotice("Disponibilités sauvegardées.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de sauvegarder les disponibilités.")
    } finally {
      setIsSaving(false)
    }
  }

  async function createMeetingType() {
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch("/api/calendar/meeting-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meetingTypeName,
          description: "Type de rendez-vous configurable par le conseiller.",
          durationMinutes: meetingTypeDuration,
          slotStepMinutes: meetingTypeStep,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: meetingTypeBuffer,
          minimumNoticeHours: meetingTypeNotice,
          maxBookingsPerDay: meetingTypeMaxPerDay,
          locationType: meetingTypeLocation,
          isPublic: true,
          questionnaire: [
            { key: "objectif", label: "Quel est votre objectif principal ?", type: "text" },
          ],
        }),
      })
      const created = await readApiData<MeetingTypeOption>(response)
      setMeetingTypes((current) => [...current, created])
      setNotice("Type de rendez-vous ajouté.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d’ajouter ce type de rendez-vous.")
    } finally {
      setIsSaving(false)
    }
  }

  async function createAvailabilityException() {
    const startMinutes = timeToMinutes(exceptionStart)
    const endMinutes = timeToMinutes(exceptionEnd)
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setNotice("Choisissez une plage d’indisponibilité valide.")
      return
    }
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch("/api/calendar/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(`${exceptionDate}T00:00:00`).toISOString(),
          startMinutes,
          endMinutes,
          type: "UNAVAILABLE",
          reason: exceptionReason,
        }),
      })
      const created = await readApiData<AvailabilityExceptionOption>(response)
      setAvailabilityExceptions((current) => [...current, created])
      setNotice("Exception ajoutée.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d’ajouter cette exception.")
    } finally {
      setIsSaving(false)
    }
  }

  async function saveCalendarPermission() {
    if (!permissionTargetUserId) {
      setNotice("Choisissez un membre du cabinet.")
      return
    }
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch("/api/calendar/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: permissionTargetUserId, permissionLevel }),
      })
      const saved = await readApiData<CalendarPermissionOption | { permissionLevel: string }>(response)
      setCalendarPermissions((current) => [
        ...current.filter((permission) => permission.targetUserId !== permissionTargetUserId),
        ...("id" in saved ? [saved] : []),
      ])
      setNotice("Permission calendrier mise à jour.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de sauvegarder cette permission.")
    } finally {
      setIsSaving(false)
    }
  }

  function calendarEventPayload(startAt: Date, endAt: Date) {
    return {
      title: eventTitle.trim(),
      type: eventType,
      priority: eventType === "MEETING" ? "HIGH" : "NORMAL",
      status: "TODO",
      startDate: startAt.toISOString(),
      dueDate: startAt.toISOString(),
      assignedToId: eventAdvisorId || undefined,
      clientId: eventClientId || undefined,
      description: [
        `Mode: ${eventMode === "PHONE" ? "Téléphone" : eventMode === "IN_PERSON" ? "Présentiel" : "Visio"}`,
        `Fin prévue: ${endAt.toISOString()}`,
        editingTaskId ? "Modifié depuis le calendrier." : "Créé depuis le calendrier.",
      ].join("\n"),
    }
  }

  function dedicatedCalendarEventPayload(startAt: Date, endAt: Date) {
    return {
      title: eventTitle.trim(),
      description: `Mode: ${eventMode === "PHONE" ? "Téléphone" : eventMode === "IN_PERSON" ? "Présentiel" : "Visio"}`,
      type: eventType,
      priority: eventType === "MEETING" ? "HIGH" : "NORMAL",
      status: "CONFIRMED",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto",
      locationType: eventMode,
      meetingProvider: eventMode === "VIDEO" ? "GOOGLE_MEET" : undefined,
      advisorId: eventAdvisorId || undefined,
      clientId: eventClientId || undefined,
      visibility: "DETAILS",
    }
  }

  function validateEventDates() {
    const startMinutes = timeToMinutes(eventStart)
    const endMinutes = timeToMinutes(eventEnd)
    if (!eventTitle.trim()) {
      setNotice("Le titre de l’événement est requis.")
      return null
    }
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setNotice("Choisissez une heure de fin après l’heure de début.")
      return null
    }
    const startAt = new Date(`${eventDate}T${eventStart}:00`)
    const endAt = new Date(`${eventDate}T${eventEnd}:00`)
    if (!editingTaskId && startAt.getTime() <= Date.now()) {
      setNotice("Créez un événement dans le futur.")
      return null
    }
    return { startAt, endAt }
  }

  async function createCalendarEvent() {
    const dates = validateEventDates()
    if (!dates) return
    const { startAt, endAt } = dates
    setIsCreating(true)
    setNotice(null)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calendarEventPayload(startAt, endAt)),
      })
      const createdTask = normalizeCalendarTask(await readApiData<CalendarTask>(response))
      const eventResponse = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dedicatedCalendarEventPayload(startAt, endAt), taskId: createdTask.id }),
      })
      const createdEvent = calendarEventToTask(await readApiData<CalendarEventRecord>(eventResponse), advisors, clients)
      setTasks((current) => [...current, createdEvent])
      setSelectedDay(startAt)
      setWeekStart(startOfWeek(startAt))
      setMonthCursor(startOfMonth(startAt))
      setEventTitle("")
      setEditingTaskId(null)
      setSelectedCalendarTask(null)
      setIsEventDialogOpen(false)
      setNotice("Événement créé dans le calendrier.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de créer l’événement.")
    } finally {
      setIsCreating(false)
    }
  }

  async function updateCalendarEvent() {
    if (!editingTaskId) return
    const dates = validateEventDates()
    if (!dates) return
    const { startAt, endAt } = dates
    setIsCreating(true)
    setNotice(null)
    try {
      const isDedicatedCalendarEvent = selectedCalendarTask?.calendarEventId
      const response = await fetch(isDedicatedCalendarEvent ? `/api/calendar/events/${selectedCalendarTask.calendarEventId}` : `/api/tasks/${editingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isDedicatedCalendarEvent ? dedicatedCalendarEventPayload(startAt, endAt) : calendarEventPayload(startAt, endAt)),
      })
      const updated = isDedicatedCalendarEvent
        ? calendarEventToTask(await readApiData<CalendarEventRecord>(response), advisors, clients)
        : normalizeCalendarTask(await readApiData<CalendarTask>(response))
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task))
      setSelectedDay(startAt)
      setWeekStart(startOfWeek(startAt))
      setMonthCursor(startOfMonth(startAt))
      setEditingTaskId(null)
      setSelectedCalendarTask(null)
      setIsEventDialogOpen(false)
      setNotice("Événement modifié.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de modifier l’événement.")
    } finally {
      setIsCreating(false)
    }
  }

  async function deleteCalendarEvent() {
    if (!editingTaskId) {
      setNotice("Cet élément ne peut pas être supprimé depuis le calendrier.")
      return
    }
    const taskId = editingTaskId
    setIsDeletingEvent(true)
    setNotice(null)
    try {
      const response = await fetch(selectedCalendarTask?.calendarEventId ? `/api/calendar/events/${selectedCalendarTask.calendarEventId}` : `/api/tasks/${taskId}`, { method: "DELETE" })
      await readApiData<CalendarTask | CalendarEventRecord>(response)
      setTasks((current) => current.filter((task) => task.id !== taskId))
      setEditingTaskId(null)
      setSelectedCalendarTask(null)
      setIsEventDialogOpen(false)
      setNotice("Événement supprimé.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de supprimer l’événement.")
    } finally {
      setIsDeletingEvent(false)
    }
  }

  async function saveCalendarEvent() {
    if (editingTaskId) {
      await updateCalendarEvent()
      return
    }
    await createCalendarEvent()
  }

  async function completeCalendarTask(task: CalendarTask) {
    setCompletingTaskId(task.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "Terminé depuis le calendrier." }),
      })
      const updated = await readApiData<CalendarTask>(response)
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice("Action marquée comme terminée.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de terminer cette action.")
    } finally {
      setCompletingTaskId(null)
    }
  }

  async function rescheduleCalendarTask(task: CalendarTask) {
    const currentDate = task.dueDate ? new Date(task.dueDate) : selectedDay
    const nextDate = addDays(currentDate, 1)
    setReschedulingTaskId(task.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: nextDate.toISOString(),
          startDate: nextDate.toISOString(),
          status: "TODO",
        }),
      })
      const updated = await readApiData<CalendarTask>(response)
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Action reportée au ${formatLongDay(nextDate)} à ${formatTime(nextDate)}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de reporter cette action.")
    } finally {
      setReschedulingTaskId(null)
    }
  }

  async function copyPublicBookingLink() {
    const advisorId = currentUser?.id ?? eventAdvisorId
    if (!advisorId) {
      setNotice("Aucun conseiller disponible pour générer le lien.")
      return
    }
    const origin = window.location.origin
    const url = `${origin}/rendez-vous/${advisorId}`
    setIsCopyingLink(true)
    setNotice(null)
    try {
      await copyToClipboard(url)
      setNotice("Lien public de réservation copié.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de copier le lien.")
    } finally {
      setIsCopyingLink(false)
    }
  }

  const isEditingPersistedEvent = Boolean(editingTaskId)
  const isCreatingFromCalendarSuggestion = Boolean(selectedCalendarTask && !editingTaskId)
  const fullCalendarView = calendarView === "MONTH" ? "dayGridMonth" : calendarView === "DAY" ? "timeGridDay" : "timeGridWeek"
  const fullCalendarEvents = useMemo(() => filteredTasks
    .filter((task) => task.dueDate)
    .map((task) => ({
      id: task.id,
      title: task.title,
      start: task.dueDate as string,
      end: eventEndDate(task).toISOString(),
      backgroundColor: task.priority === "URGENT" ? "#fee2e2" : task.priority === "HIGH" ? "#fef3c7" : task.sourceLabel === "Événement calendrier" ? "#dcfce7" : "#f8fafc",
      borderColor: task.priority === "URGENT" ? "#fb7185" : task.priority === "HIGH" ? "#fbbf24" : task.sourceLabel === "Événement calendrier" ? "#22c55e" : "#cbd5e1",
      textColor: "#0f172a",
      extendedProps: { task },
    })), [filteredTasks])

  async function updateEventDatesFromCalendar(task: CalendarTask, start: Date, end: Date) {
    setNotice(null)
    const payload = task.calendarEventId
      ? {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }
      : {
        dueDate: start.toISOString(),
        startDate: start.toISOString(),
        description: [
          task.description,
          `Fin prévue: ${end.toISOString()}`,
        ].filter(Boolean).join("\n"),
      }
    try {
      const response = await fetch(task.calendarEventId ? `/api/calendar/events/${task.calendarEventId}` : `/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const updated = task.calendarEventId
        ? calendarEventToTask(await readApiData<CalendarEventRecord>(response), advisors, clients)
        : normalizeCalendarTask(await readApiData<CalendarTask>(response))
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item))
      setNotice("Événement déplacé dans le calendrier.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de déplacer cet événement.")
      throw error
    }
  }

  return (
    <PageShell
      eyebrow="Calendrier"
      title="Calendrier intelligent"
      description="Une vue pleine page pour organiser les rendez-vous, relances, échéances et disponibilités du conseiller."
      showIntro={false}
    >
      {notice ? (
        <div className="rounded-[1.25rem] border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-[0_4px_0_#d9f99d]">
          {notice}
        </div>
      ) : null}

      <ContentCard
        title="Calendrier conseiller"
        description="Le calendrier occupe toute la largeur. Les disponibilités sont définies manuellement par le conseiller, sans créneaux imposés."
        className="min-h-[calc(100vh-260px)]"
      >
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher client, PER, bilan annuel, document, campagne..."
              className="h-11 rounded-2xl border-2 border-slate-200 bg-white pl-11 text-sm font-semibold shadow-[0_3px_0_#e2e8f0]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-full border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-[0_3px_0_#e2e8f0] outline-none focus:border-emerald-300"
              value={advisorFilter}
              onChange={(event) => setAdvisorFilter(event.target.value)}
            >
              <option value="ALL">Tous les conseillers</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
              ))}
            </select>
            <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-slate-500">
              <Filter className="size-3.5" />
              Filtres
            </span>
            {([
              ["ALL", "Tout"],
              ["MEETING", "RDV"],
              ["FOLLOW_UP", "Relances"],
              ["DEADLINE", "Échéances"],
              ["DOCUMENT", "Documents"],
              ["CAMPAIGN", "Campagnes"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCalendarFilter(value)}
                className={calendarFilter === value
                  ? "rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-[0_3px_0_#16a34a]"
                  : "rounded-full border-2 border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-[0_3px_0_#e2e8f0]"}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (calendarView === "MONTH") setMonthCursor((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))
                else if (calendarView === "WEEK") setWeekStart((current) => addDays(current, -7))
                else setSelectedDay((current) => addDays(current, -1))
              }}
            >
              Précédente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const today = new Date()
                setSelectedDay(today)
                setWeekStart(startOfWeek(today))
                setMonthCursor(startOfMonth(today))
              }}
            >
              Aujourd’hui
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (calendarView === "MONTH") setMonthCursor((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))
                else if (calendarView === "WEEK") setWeekStart((current) => addDays(current, 7))
                else setSelectedDay((current) => addDays(current, 1))
              }}
            >
              Suivante
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border-2 border-slate-200 bg-white p-1 shadow-[0_3px_0_#e2e8f0]">
              {(["DAY", "WEEK", "MONTH", "TEAM"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCalendarView(view)}
                  className={calendarView === view ? "rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white" : "rounded-full px-3 py-1.5 text-xs font-black text-slate-600"}
                >
                  {view === "DAY" ? "Jour" : view === "WEEK" ? "Semaine" : view === "MONTH" ? "Mois" : "Équipe"}
                </button>
              ))}
            </div>
            <StatusBadge tone="sky">
              {calendarView === "MONTH"
                ? formatMonth(monthCursor)
                : calendarView === "WEEK"
                  ? `${formatDay(weekDays[0])} - ${formatDay(weekDays[6])}`
                  : formatLongDay(selectedDay)}
            </StatusBadge>
            <Button type="button" onClick={() => openCreateEventDialog(selectedDay, 9 * 60)}>
              <Plus className="size-4" />
              Créer
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsAvailabilityDialogOpen(true)}>
              <CalendarClock className="size-4" />
              Disponibilités
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyPublicBookingLink()} disabled={isCopyingLink}>
              {isCopyingLink ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              Lien public
            </Button>
          </div>
        </div>

        {recommendedPriority ? (
          <div className="mb-4 rounded-[1.25rem] border-2 border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            <span className="font-black">Priorité : </span>
            {recommendedPriority.title}
            {recommendedPriority.recommendedAction ? ` · ${recommendedPriority.recommendedAction}` : ""}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-5 text-sm font-black text-slate-600">
            <Loader2 className="size-4 animate-spin text-emerald-600" />
            Chargement du calendrier...
          </div>
        ) : (
          <div className="min-h-[760px]">
            <div className="min-w-0">
              {calendarView !== "TEAM" ? (
                <div className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-3 shadow-[0_4px_0_#e2e8f0]">
                  <FullCalendar
                    key={fullCalendarView}
                    plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                    initialView={fullCalendarView}
                    headerToolbar={false}
                    locale="fr"
                    height="auto"
                    allDaySlot={false}
                    nowIndicator
                    selectable
                    editable
                    eventResizableFromStart
                    slotMinTime="00:00:00"
                    slotMaxTime="24:00:00"
                    slotDuration="00:30:00"
                    firstDay={1}
                    expandRows
                    dayMaxEvents={4}
                    events={fullCalendarEvents}
                    select={(info) => {
                      openCreateEventDialog(info.start, minutesSinceMidnight(info.start), currentUser?.id)
                    }}
                    dateClick={(info) => {
                      openCreateEventDialog(info.date, minutesSinceMidnight(info.date) || 9 * 60, currentUser?.id)
                    }}
                    eventClick={(info) => {
                      const task = info.event.extendedProps.task as CalendarTask | undefined
                      if (task) openEditEventDialog(task)
                    }}
                    eventDrop={(info) => {
                      const task = info.event.extendedProps.task as CalendarTask | undefined
                      if (!task || !info.event.start) return
                      const end = info.event.end ?? new Date(info.event.start.getTime() + eventDurationMinutes(task) * 60_000)
                      void updateEventDatesFromCalendar(task, info.event.start, end).catch(() => info.revert())
                    }}
                    eventResize={(info) => {
                      const task = info.event.extendedProps.task as CalendarTask | undefined
                      if (!task || !info.event.start || !info.event.end) return
                      void updateEventDatesFromCalendar(task, info.event.start, info.event.end).catch(() => info.revert())
                    }}
                    businessHours={availability.map((slot) => ({
                      daysOfWeek: [slot.dayOfWeek],
                      startTime: minutesLabel(slot.startMinutes),
                      endTime: minutesLabel(slot.endMinutes),
                    }))}
                    buttonText={{ today: "Aujourd’hui", month: "Mois", week: "Semaine", day: "Jour" }}
                  />
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {selectedDayByAdvisor.length === 0 ? (
                    <div className="rounded-[1.25rem] border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                      Aucun conseiller trouvé pour cette vue équipe.
                    </div>
                  ) : selectedDayByAdvisor.map(({ advisor, tasks: advisorTasks, slots }) => (
                    <section key={advisor.id} className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-4 shadow-[0_4px_0_#e2e8f0]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black text-slate-950">{advisor.name}</h3>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{advisor.title ?? advisor.email}</p>
                        </div>
                        <StatusBadge tone={advisorTasks.length >= 6 ? "rose" : advisorTasks.length >= 3 ? "amber" : "emerald"}>
                          {advisorTasks.length >= 6 ? "Chargé" : advisorTasks.length >= 3 ? "Actif" : "Disponible"}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slots.length ? slots.map((slot) => (
                          <span key={slotKey(slot)} className="rounded-full bg-lime-50 px-3 py-1 text-xs font-black text-emerald-800 ring-2 ring-emerald-100">
                            {minutesLabel(slot.startMinutes)} - {minutesLabel(slot.endMinutes)}
                          </span>
                        )) : <span className="text-xs font-semibold text-slate-500">Aucune disponibilité publiée ce jour.</span>}
                      </div>
                      <div className="mt-4 space-y-2">
                        {advisorTasks.length ? advisorTasks.map((task) => (
                          <button key={task.id} type="button" onClick={() => openEditEventDialog(task)} className={`block w-full rounded-2xl border-2 p-3 text-left ${taskTone(task)}`}>
                            <p className="text-xs font-black">{formatTime(new Date(task.dueDate as string))} · {taskTypeLabel(task.type)}</p>
                            <p className="mt-1 line-clamp-2 text-sm font-black">{task.title}</p>
                          </button>
                        )) : (
                          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">Libre sur le calendrier interne.</div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </ContentCard>

      {isEventDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-[1.5rem] border-2 border-slate-200 bg-white p-5 shadow-[0_18px_0_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                  {isEditingPersistedEvent ? "Événement existant" : isCreatingFromCalendarSuggestion ? "Alerte calendrier" : "Nouveau créneau"}
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {isEditingPersistedEvent ? "Modifier l’événement" : isCreatingFromCalendarSuggestion ? "Créer un événement lié" : "Créer un événement"}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {eventDate} · {eventStart} - {eventEnd}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeEventDialog}>
                Fermer
              </Button>
            </div>

            {notice ? (
              <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
                {notice}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Type</span>
                  <select
                    className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value as (typeof creatableTaskTypes)[number][0])}
                  >
                    {creatableTaskTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Conseiller</span>
                  <select
                    className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                    value={eventAdvisorId}
                    onChange={(event) => setEventAdvisorId(event.target.value)}
                  >
                    <option value="">Conseiller courant</option>
                    {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.name}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Titre</span>
                <Input placeholder="Bilan annuel Jean Martin" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Client lié</span>
                <select
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                  value={eventClientId}
                  onChange={(event) => setEventClientId(event.target.value)}
                >
                  <option value="">Aucun client lié</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>)}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Date</span>
                  <input type="date" className="h-11 w-full rounded-2xl border-2 border-slate-200 px-3 text-sm font-black outline-none focus:border-emerald-300" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Début</span>
                  <input type="time" className="h-11 w-full rounded-2xl border-2 border-slate-200 px-3 text-sm font-black outline-none focus:border-emerald-300" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Fin</span>
                  <input type="time" className="h-11 w-full rounded-2xl border-2 border-slate-200 px-3 text-sm font-black outline-none focus:border-emerald-300" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Mode</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["VIDEO", "PHONE", "IN_PERSON"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEventMode(mode)}
                      className={eventMode === mode
                        ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-2 py-2 text-xs font-black text-emerald-800"
                        : "rounded-2xl border-2 border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"}
                    >
                      {mode === "VIDEO" ? "Visio" : mode === "PHONE" ? "Téléphone" : "Présentiel"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-slate-100 pt-4">
              <div>
                {isEditingPersistedEvent ? (
                  <Button type="button" variant="outline" disabled={isDeletingEvent || isCreating} onClick={() => void deleteCalendarEvent()}>
                    {isDeletingEvent ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Supprimer
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEventDialog}>
                  Annuler
                </Button>
                <Button type="button" disabled={isCreating || isDeletingEvent} onClick={() => void saveCalendarEvent()}>
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : isEditingPersistedEvent ? <Save className="size-4" /> : <Plus className="size-4" />}
                  {isEditingPersistedEvent ? "Enregistrer" : isCreatingFromCalendarSuggestion ? "Créer l’événement lié" : "Créer l’événement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAvailabilityDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[1.5rem] border-2 border-slate-200 bg-white p-5 shadow-[0_18px_0_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Disponibilités</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Définir mes créneaux</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Le conseiller choisit lui-même ses horaires. Aucun créneau n’est imposé par l’application.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAvailabilityDialogOpen(false)}>
                Fermer
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-[1.25rem] border-2 border-slate-200 bg-slate-50 p-3">
              <Button type="button" variant="outline" onClick={() => { window.location.href = "/api/integrations/google/gmail/connect" }}>
                <ExternalLink className="size-4" />
                Connecter Google Calendar
              </Button>
              <Button type="button" variant="outline" onClick={() => { window.location.href = "/api/integrations/microsoft/calendar/connect" }}>
                <ExternalLink className="size-4" />
                Connecter Outlook Calendar
              </Button>
              <p className="text-xs font-semibold text-slate-600">
                Les créneaux Google / Outlook connectés sont lus comme indisponibles dans la réservation publique.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Jour</span>
                <select
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                  value={availabilityDay}
                  onChange={(event) => setAvailabilityDay(Number(event.target.value))}
                >
                  {dayFullLabels.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Début</span>
                <input
                  type="time"
                  value={availabilityStart}
                  onChange={(event) => setAvailabilityStart(event.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Fin</span>
                <input
                  type="time"
                  value={availabilityEnd}
                  onChange={(event) => setAvailabilityEnd(event.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300"
                />
              </label>
              <div className="flex items-end">
                <Button type="button" className="h-11 w-full" onClick={addAvailabilitySlot}>
                  <Plus className="size-4" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <section className="rounded-[1.25rem] border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                  {dayFullLabels[selectedDay.getDay()]} sélectionné
                </p>
                <div className="mt-3 space-y-2">
                  {selectedDaySlots.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600">
                      Aucun créneau défini pour cette journée.
                    </div>
                  ) : selectedDaySlots.map((slot) => (
                    <div key={slotKey(slot)} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2">
                      <span className="text-sm font-black text-slate-800">
                        {minutesLabel(slot.startMinutes)} - {minutesLabel(slot.endMinutes)}
                      </span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeAvailabilitySlot(slot)} aria-label="Supprimer ce créneau">
                        <Trash2 className="size-4 text-rose-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.25rem] border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Tous les créneaux publiés</p>
                <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                  {availability.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600">
                      Aucun créneau publié. Ajoutez vos disponibilités manuellement.
                    </div>
                  ) : availabilityByDay.map((day) => day.slots.length ? (
                    <div key={day.label} className="rounded-2xl border-2 border-slate-200 bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{day.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {day.slots.map((slot) => (
                          <span key={slotKey(slot)} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 ring-2 ring-slate-200">
                            {minutesLabel(slot.startMinutes)} - {minutesLabel(slot.endMinutes)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null)}
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <section className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Types de rendez-vous</p>
                <div className="mt-3 grid gap-2">
                  <Input value={meetingTypeName} onChange={(event) => setMeetingTypeName(event.target.value)} placeholder="Nom du rendez-vous" />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Durée</span>
                      <input type="number" min={15} max={180} value={meetingTypeDuration} onChange={(event) => setMeetingTypeDuration(Number(event.target.value))} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Pas</span>
                      <input type="number" min={15} max={120} value={meetingTypeStep} onChange={(event) => setMeetingTypeStep(Number(event.target.value))} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Tampon</span>
                      <input type="number" min={0} max={120} value={meetingTypeBuffer} onChange={(event) => setMeetingTypeBuffer(Number(event.target.value))} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Préavis h</span>
                      <input type="number" min={0} max={720} value={meetingTypeNotice} onChange={(event) => setMeetingTypeNotice(Number(event.target.value))} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Max/jour</span>
                      <input type="number" min={1} max={30} value={meetingTypeMaxPerDay} onChange={(event) => setMeetingTypeMaxPerDay(Number(event.target.value))} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Lieu</span>
                      <select value={meetingTypeLocation} onChange={(event) => setMeetingTypeLocation(event.target.value as "VIDEO" | "PHONE" | "IN_PERSON")} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black">
                        <option value="VIDEO">Visio</option>
                        <option value="PHONE">Téléphone</option>
                        <option value="IN_PERSON">Présentiel</option>
                      </select>
                    </label>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void createMeetingType()} disabled={isSaving}>
                    <Plus className="size-4" />
                    Ajouter le type
                  </Button>
                </div>
                <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                  {meetingTypes.map((type) => (
                    <div key={type.id} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-2 text-xs font-black text-slate-700">
                      {type.name} · {type.durationMinutes} min · préavis {type.minimumNoticeHours} h
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Congés et exceptions</p>
                <div className="mt-3 grid gap-2">
                  <input type="date" value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={exceptionStart} onChange={(event) => setExceptionStart(event.target.value)} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                    <input type="time" value={exceptionEnd} onChange={(event) => setExceptionEnd(event.target.value)} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black" />
                  </div>
                  <Input value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Motif" />
                  <Button type="button" variant="outline" onClick={() => void createAvailabilityException()} disabled={isSaving}>
                    <Plus className="size-4" />
                    Ajouter l’exception
                  </Button>
                </div>
                <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                  {availabilityExceptions.map((exception) => (
                    <div key={exception.id} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-2 text-xs font-black text-slate-700">
                      {new Date(exception.date).toLocaleDateString("fr-CA")} · {minutesLabel(exception.startMinutes ?? 0)} - {minutesLabel(exception.endMinutes ?? 24 * 60)} · {exception.reason ?? exception.type}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.25rem] border-2 border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Permissions cabinet</p>
                <div className="mt-3 grid gap-2">
                  <select value={permissionTargetUserId} onChange={(event) => setPermissionTargetUserId(event.target.value)} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black">
                    <option value="">Choisir un membre</option>
                    {advisors.filter((advisor) => advisor.id !== currentUser?.id).map((advisor) => (
                      <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
                    ))}
                  </select>
                  <select value={permissionLevel} onChange={(event) => setPermissionLevel(event.target.value)} className="h-10 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-black">
                    <option value="NONE">Aucun accès</option>
                    <option value="FREE_BUSY_ONLY">Occupé seulement</option>
                    <option value="LIMITED_DETAILS">Détails limités</option>
                    <option value="VIEW_DETAILS">Détails complets</option>
                    <option value="EDIT_EVENTS">Édition</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <Button type="button" variant="outline" onClick={() => void saveCalendarPermission()} disabled={isSaving}>
                    <Save className="size-4" />
                    Sauvegarder la permission
                  </Button>
                </div>
                <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                  {calendarPermissions.map((permission) => {
                    const advisor = advisors.find((item) => item.id === permission.targetUserId)
                    return (
                      <div key={permission.id} className="rounded-xl border-2 border-slate-100 bg-slate-50 p-2 text-xs font-black text-slate-700">
                        {advisor?.name ?? "Membre"} · {permission.permissionLevel}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t-2 border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAvailabilityDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={() => void saveAvailability()} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
