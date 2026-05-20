"use client"

import { CalendarDays, CheckCircle2, Clock3, Loader2, Mail, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PublicCalendarData } from "@/lib/calendar/public-calendar"

type AvailabilitySlot = PublicCalendarData["slots"][number]
type BookingService = PublicCalendarData["services"][number]

const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function setTime(date: Date, minutes: number) {
  const next = new Date(date)
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long" }).format(date)
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", { hour: "2-digit", minute: "2-digit" }).format(date)
}

function minutesLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function dateParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseDateParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function parseTimeParam(value?: string) {
  if (!value) return ""
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 0 && minutes < 24 * 60 ? String(minutes) : ""
}

function firstDateWithPublishedSlot(slots: AvailabilitySlot[], service?: BookingService) {
  const start = new Date()
  const minimumDuration = service?.durationMinutes ?? 0

  return Array.from({ length: 14 }, (_, index) => addDays(start, index)).find((date) =>
    slots.some((slot) => slot.dayOfWeek === date.getDay() && slot.endMinutes - slot.startMinutes >= minimumDuration)
  )
}

async function readApiData<T>(response: Response) {
  const result = (await response.json()) as { ok?: boolean; data?: T; error?: string | { message?: string } }
  if (!response.ok || result.ok === false) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

function resolveInitialServiceId(data: PublicCalendarData | null, service?: string | null, duration?: string | null) {
  const matching = service
    ? data?.services.find((item) => item.label === service || String(item.durationMinutes) === duration)
    : null
  return (matching ?? data?.services[0])?.id ?? ""
}

function resolveInitialService(data: PublicCalendarData | null, service?: string | null, duration?: string | null) {
  const serviceId = resolveInitialServiceId(data, service, duration)
  return data?.services.find((item) => item.id === serviceId) ?? data?.services[0]
}

function resolveInitialBookingMode(data: PublicCalendarData | null) {
  return data?.slots.length === 0 ? "CLIENT" : "ADVISOR"
}

type PublicBookingPageProps = {
  advisorId: string
  initialData?: PublicCalendarData | null
  initialDate?: string
  initialDuration?: string
  initialMarketingToken?: string
  initialService?: string
  initialTime?: string
}

type BookingResponse = {
  confirmation?: {
    emailSent?: boolean
    smsSent?: boolean
  }
}

type AvailabilityResponse = {
  slots: Array<{ start: string; end: string }>
}

export function PublicBookingPage({
  advisorId,
  initialData = null,
  initialDate = "",
  initialDuration = "",
  initialMarketingToken = "",
  initialService = "",
  initialTime = "",
}: PublicBookingPageProps) {
  const firstService = resolveInitialService(initialData, initialService, initialDuration)
  const firstSelectedDate = parseDateParam(initialDate) ?? firstDateWithPublishedSlot(initialData?.slots ?? [], firstService) ?? new Date()
  const [data, setData] = useState<PublicCalendarData | null>(initialData)
  const [serviceId, setServiceId] = useState<string>(() => firstService?.id ?? "")
  const [selectedDate, setSelectedDate] = useState(() => firstSelectedDate)
  const [selectedTime, setSelectedTime] = useState<string>(() => parseTimeParam(initialTime))
  const [holdId, setHoldId] = useState<string>("")
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || initialData?.advisor.timezone || "America/Toronto")
  const [availableSlots, setAvailableSlots] = useState<AvailabilityResponse["slots"]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [bookingMode, setBookingMode] = useState<"ADVISOR" | "CLIENT">(() => resolveInitialBookingMode(initialData))
  const [proposalDate, setProposalDate] = useState(() => new Date())
  const [proposalTime, setProposalTime] = useState("09:00")
  const [proposedSlots, setProposedSlots] = useState<string[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [meetingMode, setMeetingMode] = useState<"VIDEO" | "PHONE" | "IN_PERSON">("VIDEO")
  const [message, setMessage] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({})
  const [marketingToken] = useState(initialMarketingToken)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    if (initialData) return
    fetch(`/api/public/calendar/${advisorId}`, { cache: "no-store" })
      .then((response) => readApiData<PublicCalendarData>(response))
      .then((nextData) => {
        const initialServiceMatch = resolveInitialService(nextData, initialService, initialDuration)
        setData(nextData)
        setServiceId(initialServiceMatch?.id ?? "")
        setSelectedDate(parseDateParam(initialDate) ?? firstDateWithPublishedSlot(nextData.slots, initialServiceMatch) ?? new Date())
        setSelectedTime(parseTimeParam(initialTime))
        setBookingMode(resolveInitialBookingMode(nextData))
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Calendrier indisponible."))
      .finally(() => setIsLoading(false))
  }, [advisorId, initialData, initialDate, initialDuration, initialService, initialTime])

  const selectedService = data?.services.find((service) => service.id === serviceId) ?? data?.services[0]
  const hasAdvisorAvailability = Boolean(data?.slots.length)
  const nextDays = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(new Date(), index)), [])
  const bookingHref = (params: { date?: Date; time?: number; service?: BookingService }) => {
    const query = new URLSearchParams()
    const service = params.service ?? selectedService
    if (service) {
      query.set("service", service.label)
      query.set("duration", String(service.durationMinutes))
    }
    if (params.date) query.set("date", dateParam(params.date))
    if (typeof params.time === "number") query.set("time", String(params.time))
    if (marketingToken) query.set("marketingToken", marketingToken)
    const suffix = query.toString()
    return `/rendez-vous/${advisorId}${suffix ? `?${suffix}` : ""}#creneaux`
  }
  const hasPublishedSlotForDate = useCallback((date: Date) => Boolean(data?.slots.some((slot) =>
    slot.dayOfWeek === date.getDay() && (!selectedService || slot.endMinutes - slot.startMinutes >= selectedService.durationMinutes)
  )), [data?.slots, selectedService])
  const availableBookingDays = useMemo(
    () => nextDays.filter((day) => hasPublishedSlotForDate(day)),
    [nextDays, hasPublishedSlotForDate],
  )
  useEffect(() => {
    if (!data || !selectedService || bookingMode !== "ADVISOR") return
    const controller = new AbortController()
    const query = new URLSearchParams({
      date: dateParam(selectedDate),
      meetingTypeId: selectedService.id,
      timezone,
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingSlots(true)
    fetch(`/api/public/advisors/${data.advisor.publicSlug ?? advisorId}/availability?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => readApiData<AvailabilityResponse>(response))
      .then((next) => {
        setAvailableSlots(next.slots)
        setSelectedTime((current) => {
          if (!current) return current
          const stillAvailable = next.slots.some((slot) => minutesSinceMidnight(new Date(slot.start)) === Number(current))
          return stillAvailable ? current : ""
        })
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setAvailableSlots([])
          setNotice(error instanceof Error ? error.message : "Créneaux indisponibles.")
        }
      })
      .finally(() => setIsLoadingSlots(false))

    return () => controller.abort()
  }, [advisorId, bookingMode, data, selectedDate, selectedService, timezone])

  const daySlots = useMemo(() => availableSlots.map((slot) => minutesSinceMidnight(new Date(slot.start))), [availableSlots])
  const slotGroups = useMemo(() => [
    { label: "Matin", slots: daySlots.filter((minutes) => minutes < 12 * 60) },
    { label: "Après-midi", slots: daySlots.filter((minutes) => minutes >= 12 * 60 && minutes < 17 * 60) },
    { label: "Soir", slots: daySlots.filter((minutes) => minutes >= 17 * 60) },
  ].filter((group) => group.slots.length > 0), [daySlots])

  async function submitBooking() {
    if (!selectedService) {
      setNotice("Choisissez un type de rencontre.")
      return
    }
    if (bookingMode === "ADVISOR" && !selectedTime) {
      setNotice("Choisissez un créneau.")
      return
    }
    if (bookingMode === "CLIENT" && proposedSlots.length === 0) {
      setNotice("Proposez au moins une disponibilité.")
      return
    }
    if (!phone.trim()) {
      setNotice("Ajoutez un numéro de téléphone pour recevoir la confirmation par SMS.")
      return
    }
    setIsSaving(true)
    setNotice(null)
    try {
      const startAt = bookingMode === "ADVISOR" ? setTime(selectedDate, Number(selectedTime)).toISOString() : null
      const response = await fetch(`/api/public/calendar/${advisorId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          meetingMode,
          service: selectedService.label,
          meetingTypeId: selectedService.id,
          holdId: holdId || undefined,
          startAt,
          proposedSlots: bookingMode === "CLIENT" ? proposedSlots : [],
          durationMinutes: selectedService.durationMinutes,
          timezone,
          questionnaireAnswers,
          message,
          marketingToken: marketingToken || undefined,
          marketingConsent,
        }),
      })
      const result = await readApiData<BookingResponse>(response)
      const emailStatus = result?.confirmation?.emailSent ? "Courriel envoyé." : "Courriel non envoyé automatiquement."
      const smsStatus = result?.confirmation?.smsSent ? "SMS envoyé." : "SMS non envoyé automatiquement. Le conseiller est averti."
      setNotice(bookingMode === "CLIENT"
        ? `Vos disponibilités ont été envoyées. ${emailStatus} ${smsStatus}`
        : `Votre rendez-vous est confirmé. ${emailStatus} ${smsStatus}`)
      setIsSubmitted(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible d’envoyer la demande.")
    } finally {
      setIsSaving(false)
    }
  }

  async function holdSlot(minutes: number) {
    if (!selectedService) return
    const start = setTime(selectedDate, minutes)
    const end = new Date(start.getTime() + selectedService.durationMinutes * 60 * 1000)
    setSelectedTime(String(minutes))
    setHoldId("")
    setNotice(null)
    try {
      const response = await fetch(`/api/public/calendar/${advisorId}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTypeId: selectedService.id,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          timezone,
          clientEmail: email || undefined,
        }),
      })
      const hold = await readApiData<{ id: string; expiresAt: string }>(response)
      setHoldId(hold.id)
      setNotice("Créneau réservé temporairement pendant 5 minutes.")
    } catch (error) {
      setSelectedTime("")
      setNotice(error instanceof Error ? error.message : "Ce créneau n’est plus disponible.")
    }
  }

  function addProposedSlot() {
    const minutes = timeToMinutes(proposalTime)
    if (minutes === null) {
      setNotice("Choisissez une heure valide.")
      return
    }
    const proposedDate = setTime(proposalDate, minutes)
    if (proposedDate.getTime() <= Date.now()) {
      setNotice("Proposez une date et une heure futures.")
      return
    }
    const iso = proposedDate.toISOString()
    setProposedSlots((current) => current.includes(iso) ? current : [...current, iso].sort())
    setNotice("Disponibilité ajoutée.")
  }

  function removeProposedSlot(value: string) {
    setProposedSlots((current) => current.filter((slot) => slot !== value))
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F7FCEB] p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
          <Loader2 className="size-6 animate-spin text-emerald-600" />
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#F7FCEB] p-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] border-2 border-rose-200 bg-white p-8 text-center font-black text-rose-700 shadow-[0_12px_0_#fecdd3]">
          {notice ?? "Ce calendrier n’est pas disponible."}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F7FCEB] p-4 sm:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border-2 border-emerald-200 bg-white p-6 shadow-[0_12px_0_#d9f99d]">
          <div className="grid size-14 place-items-center rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_4px_0_#d9f99d]">
            <CalendarDays className="size-7" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{data.advisor.organization?.name ?? "FinAssuro CRM"}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Réserver un rendez-vous</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Choisissez un créneau publié par le conseiller ou proposez vos disponibilités. Votre demande sera envoyée au cabinet.
          </p>
          <div className="mt-6 rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">{data.advisor.name}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{data.advisor.title ?? "Conseiller"}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
              <ShieldCheck className="size-4" />
              Calendrier sécurisé du cabinet
            </p>
          </div>
        </aside>

        <section className="rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-[0_12px_0_#e2e8f0] sm:p-6">
          {notice ? (
            <div className={`mb-5 rounded-2xl border-2 px-4 py-3 text-sm font-black ${isSubmitted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {notice}
            </div>
          ) : null}

          {isSubmitted ? (
            <div className="mb-5 rounded-[1.5rem] border-2 border-emerald-200 bg-white p-5 shadow-[0_6px_0_#d9f99d]">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    {bookingMode === "CLIENT" ? "Disponibilités envoyées" : "Rendez-vous confirmé"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                    {selectedService?.label ?? "Rendez-vous"} · {bookingMode === "CLIENT" ? `${proposedSlots.length} créneau(x) proposé(s)` : `${formatDate(selectedDate)} à ${selectedTime ? minutesLabel(Number(selectedTime)) : ""}`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <span className="rounded-full bg-emerald-600 px-3 py-1.5 text-white">1 Type</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">2 Date</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">3 Heure</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">4 Confirmation</span>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section>
                <h2 className="text-lg font-black text-slate-950">1. Type de rencontre</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {data.services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        const nextDate = firstDateWithPublishedSlot(data.slots, service) ?? selectedDate
                        setServiceId(service.id)
                        setSelectedDate(nextDate)
                        setSelectedTime("")
                        setHoldId("")
                        setNotice(null)
                        window.history.replaceState(null, "", bookingHref({ date: nextDate, service }))
                      }}
                      className={serviceId === service.id
                        ? "rounded-[1.5rem] border-2 border-emerald-300 bg-emerald-50 p-4 text-left shadow-[0_6px_0_#d9f99d]"
                        : "rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 text-left shadow-[0_6px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-lime-300"}
                    >
                      <p className="font-black text-slate-950">{service.label}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-emerald-700">
                        <Clock3 className="size-3.5" />
                        {service.durationMinutes} min
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">{service.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-black text-slate-950">2. Date</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!hasAdvisorAvailability}
                    onClick={() => hasAdvisorAvailability ? setBookingMode("ADVISOR") : null}
                    className={bookingMode === "ADVISOR"
                      ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-sm font-black text-emerald-800 shadow-[0_4px_0_#d9f99d] disabled:cursor-not-allowed disabled:opacity-50"
                      : "rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-sm font-black text-slate-700 shadow-[0_4px_0_#e2e8f0] disabled:cursor-not-allowed disabled:opacity-50"}
                  >
                    {hasAdvisorAvailability ? "Choisir une disponibilité du conseiller" : "Aucun créneau publié"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode("CLIENT")}
                    className={bookingMode === "CLIENT" ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-sm font-black text-emerald-800 shadow-[0_4px_0_#d9f99d]" : "rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-sm font-black text-slate-700 shadow-[0_4px_0_#e2e8f0]"}
                  >
                    Proposer mes disponibilités
                  </button>
                </div>
              </section>

              {bookingMode === "ADVISOR" ? (
                <section id="creneaux">
                  <h2 className="text-lg font-black text-slate-950">3. Choisir une date</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {availableBookingDays.length === 0 ? (
                    <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                      Aucun jour ouvert pour ce type de rendez-vous.
                    </div>
                  ) : availableBookingDays.map((day) => {
                    const selected = day.toDateString() === selectedDate.toDateString()
                    return (
                      <a
                        key={day.toISOString()}
                        href={bookingHref({ date: day })}
                        onClick={(event) => {
                          event.preventDefault()
                          setSelectedDate(day)
                          setSelectedTime("")
                          setHoldId("")
                          setNotice(null)
                          window.history.replaceState(null, "", bookingHref({ date: day }))
                        }}
                        className={selected
                          ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-3 text-left shadow-[0_4px_0_#d9f99d]"
                          : "rounded-2xl border-2 border-emerald-100 bg-white px-3 py-3 text-left shadow-[0_4px_0_#e2e8f0] hover:border-emerald-300"}
                      >
                        <span className="block text-xs font-black uppercase text-slate-500">{dayNames[day.getDay()]}</span>
                        <span className="block text-sm font-black text-slate-950">{new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(day)}</span>
                      </a>
                    )
                  })}
                </div>
                </section>
              ) : (
                <section>
                  <h2 className="text-lg font-black text-slate-950">3. Vos disponibilités</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Sélectionnez une date, indiquez vos heures possibles, puis ajoutez-les à la demande.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {nextDays.map((day) => {
                      const selected = day.toDateString() === proposalDate.toDateString()
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => setProposalDate(day)}
                          className={selected ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-3 text-left shadow-[0_4px_0_#d9f99d]" : "rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-left shadow-[0_4px_0_#e2e8f0]"}
                        >
                          <span className="block text-xs font-black uppercase text-slate-500">{dayNames[day.getDay()]}</span>
                          <span className="block text-sm font-black text-slate-950">{new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(day)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Heure proposée</span>
                      <input
                        type="time"
                        value={proposalTime}
                        onChange={(event) => setProposalTime(event.target.value)}
                        className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-black shadow-[0_3px_0_#e2e8f0] outline-none focus:border-emerald-300"
                      />
                    </label>
                    <div className="flex items-end">
                      <Button type="button" className="h-11 w-full" onClick={addProposedSlot}>
                        Ajouter cette heure
                      </Button>
                    </div>
                  </div>
                  {proposedSlots.length ? (
                    <div className="mt-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm font-black text-emerald-800">{proposedSlots.length} disponibilité(s) proposée(s)</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {proposedSlots.map((slot) => {
                          const date = new Date(slot)
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => removeProposedSlot(slot)}
                              className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800 ring-2 ring-emerald-200"
                            >
                              {formatDate(date)} · {formatTime(date)} ×
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              )}

              {bookingMode === "ADVISOR" ? (
                <section>
                <h2 className="text-lg font-black text-slate-950">4. Heure disponible</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Les créneaux tiennent compte des rendez-vous existants et du préavis minimum de {selectedService?.minimumNoticeHours ?? 24} h.
                </p>
                <div className="mt-3 space-y-4">
                  {slotGroups.length === 0 ? (
                    <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                      {isLoadingSlots ? "Chargement des créneaux..." : "Aucun créneau disponible cette journée. Vous pouvez choisir une autre date ou proposer vos disponibilités."}
                    </div>
                  ) : slotGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {group.slots.map((minutes) => (
                          <a
                            key={minutes}
                            href={bookingHref({ date: selectedDate, time: minutes })}
                            onClick={(event) => {
                              event.preventDefault()
                              window.history.replaceState(null, "", bookingHref({ date: selectedDate, time: minutes }))
                              void holdSlot(minutes)
                            }}
                            className={selectedTime === String(minutes)
                              ? "rounded-2xl border-2 border-emerald-300 bg-emerald-600 px-3 py-3 text-center text-sm font-black text-white shadow-[0_4px_0_#16a34a]"
                              : "rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-center text-sm font-black text-slate-700 shadow-[0_4px_0_#e2e8f0] hover:border-lime-300"}
                          >
                            {minutesLabel(minutes)}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                </section>
              ) : null}
            </div>

            <aside className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-black text-slate-950">Vos coordonnées</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 text-xs font-black text-slate-600">
                  <label className="block">
                    <span className="mb-1 block uppercase tracking-[0.12em] text-slate-500">Fuseau horaire affiché</span>
                    <select
                      value={timezone}
                      onChange={(event) => {
                        setTimezone(event.target.value)
                        setSelectedTime("")
                        setHoldId("")
                      }}
                      className="mt-1 h-10 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-emerald-300"
                    >
                      {[timezone, "America/Toronto", "America/Montreal", "Europe/Paris", "UTC"].filter((item, index, list) => list.indexOf(item) === index).map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["VIDEO", "Visio"],
                    ["PHONE", "Téléphone"],
                    ["IN_PERSON", "Présentiel"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMeetingMode(value)}
                      className={meetingMode === value
                        ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-2 py-2 text-xs font-black text-emerald-800 shadow-[0_3px_0_#d9f99d]"
                        : "rounded-2xl border-2 border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-600 shadow-[0_3px_0_#e2e8f0]"}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input placeholder="Nom complet" value={name} onChange={(event) => setName(event.target.value)} />
                <Input placeholder="Courriel" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <Input placeholder="Téléphone pour confirmation SMS" value={phone} onChange={(event) => setPhone(event.target.value)} />
                <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-sm font-semibold leading-5 text-slate-700 shadow-[0_3px_0_#e2e8f0]">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(event) => setMarketingConsent(event.target.checked)}
                    className="mt-1 size-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>
                    J’accepte de recevoir des informations et relances utiles liées à ma demande. Je pourrai me désinscrire à tout moment.
                  </span>
                </label>
                {selectedService?.questionnaire?.map((question) => (
                  <label key={question.key} className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">{question.label}</span>
                    {question.type === "select" ? (
                      <select
                        className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-black shadow-[0_3px_0_#e2e8f0] outline-none focus:border-emerald-300"
                        value={questionnaireAnswers[question.key] ?? ""}
                        onChange={(event) => setQuestionnaireAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                      >
                        <option value="">Choisir</option>
                        {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <Input value={questionnaireAnswers[question.key] ?? ""} onChange={(event) => setQuestionnaireAnswers((current) => ({ ...current, [question.key]: event.target.value }))} />
                    )}
                  </label>
                ))}
                <textarea
                  className="min-h-24 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-[0_3px_0_#e2e8f0] outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Message optionnel"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>
              <div className="mt-4 rounded-2xl border-2 border-emerald-200 bg-white p-3 text-sm font-semibold text-slate-700">
                <p className="font-black text-slate-950">Résumé</p>
                <p className="mt-1">{selectedService?.label ?? "Rencontre"} · {selectedService?.durationMinutes ?? 30} min</p>
                <p>{bookingMode === "CLIENT" ? `${proposedSlots.length} disponibilité(s) proposée(s)` : `${formatDate(selectedDate)} ${selectedTime ? `à ${minutesLabel(Number(selectedTime))}` : ""}`}</p>
              </div>
              <Button type="button" className="mt-4 w-full" disabled={isSaving || isSubmitted} onClick={() => void submitBooking()}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {isSubmitted ? "Envoyé" : bookingMode === "CLIENT" ? "Envoyer mes disponibilités" : "Confirmer mon rendez-vous"}
              </Button>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Mail className="size-3.5" />
                Le conseiller confirmera la rencontre après réception.
              </p>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
