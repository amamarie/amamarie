"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Loader2, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type BookingDetails = {
  id: string
  startAt: string
  endAt: string
  timezone: string
  status: string
  clientName: string
  clientEmail: string
  clientPhone: string | null
  message: string | null
  advisorName: string
  advisorEmail: string
  canReschedule: boolean
  canCancel: boolean
}

function dateInputValue(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function timeInputValue(value: string) {
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function combineDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number)
  const [hours, minutes] = timeValue.split(":").map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

export function BookingManagementClient({ token }: { token: string }) {
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [dateValue, setDateValue] = useState("")
  const [startValue, setStartValue] = useState("")
  const [endValue, setEndValue] = useState("")

  useEffect(() => {
    let ignore = false
    async function loadBooking() {
      setIsLoading(true)
      const response = await fetch(`/api/public/bookings/${token}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (ignore) return
      if (!response.ok || !payload?.ok) {
        setNotice(payload?.error?.message ?? "Impossible de charger ce rendez-vous.")
        setBooking(null)
      } else {
        const details = payload.data as BookingDetails
        setBooking(details)
        setDateValue(dateInputValue(details.startAt))
        setStartValue(timeInputValue(details.startAt))
        setEndValue(timeInputValue(details.endAt))
      }
      setIsLoading(false)
    }
    void loadBooking()
    return () => {
      ignore = true
    }
  }, [token])

  const formattedDate = useMemo(() => {
    if (!booking) return ""
    return new Date(booking.startAt).toLocaleString("fr-CA", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: booking.timezone,
    })
  }, [booking])

  async function cancelBooking() {
    setIsSaving(true)
    setNotice("")
    const response = await fetch(`/api/public/bookings/${token}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    setIsSaving(false)
    if (!response.ok || !payload?.ok) {
      setNotice(payload?.error?.message ?? "Annulation impossible.")
      return
    }
    setBooking((current) => current ? { ...current, status: "CANCELLED", canCancel: false, canReschedule: false } : current)
    setNotice("Votre rendez-vous a été annulé.")
  }

  async function rescheduleBooking() {
    if (!booking) return
    setIsSaving(true)
    setNotice("")
    const startAt = combineDateTime(dateValue, startValue)
    const endAt = combineDateTime(dateValue, endValue)
    const response = await fetch(`/api/public/bookings/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        timezone: booking.timezone,
      }),
    })
    const payload = await response.json().catch(() => null)
    setIsSaving(false)
    if (!response.ok || !payload?.ok) {
      setNotice(payload?.error?.message ?? "Modification impossible.")
      return
    }
    const details = payload.data as BookingDetails
    setBooking(details)
    setDateValue(dateInputValue(details.startAt))
    setStartValue(timeInputValue(details.startAt))
    setEndValue(timeInputValue(details.endAt))
    setNotice("Votre rendez-vous a été modifié.")
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto w-full max-w-2xl rounded-[1.25rem] border-2 border-slate-200 bg-white p-5 shadow-[0_4px_0_#e2e8f0]">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
            <CalendarClock className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Rendez-vous</p>
            <h1 className="mt-1 text-2xl font-black">Modifier ou annuler</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Gérez votre réservation sans voir le calendrier privé du conseiller.
            </p>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">
            {notice}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-600">
            <Loader2 className="size-4 animate-spin text-emerald-600" />
            Chargement du rendez-vous...
          </div>
        ) : booking ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">{booking.clientName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{booking.clientEmail}</p>
              <p className="mt-3 text-sm font-black text-slate-950">Avec {booking.advisorName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{formattedDate}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-slate-500">Statut : {booking.status}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Date</span>
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  disabled={!booking.canReschedule}
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300 disabled:bg-slate-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Début</span>
                <input
                  type="time"
                  value={startValue}
                  onChange={(event) => setStartValue(event.target.value)}
                  disabled={!booking.canReschedule}
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300 disabled:bg-slate-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-slate-500">Fin</span>
                <input
                  type="time"
                  value={endValue}
                  onChange={(event) => setEndValue(event.target.value)}
                  disabled={!booking.canReschedule}
                  className="h-11 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-emerald-300 disabled:bg-slate-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t-2 border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={() => void cancelBooking()} disabled={!booking.canCancel || isSaving}>
                <Trash2 className="size-4" />
                Annuler
              </Button>
              <Button type="button" onClick={() => void rescheduleBooking()} disabled={!booking.canReschedule || isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
