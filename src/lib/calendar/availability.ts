type Slot = {
  dayOfWeek: number
  startMinutes: number
  endMinutes: number
  isActive?: boolean
}

type BusyRange = {
  start: Date
  end: Date
}

type MeetingTypeRules = {
  durationMinutes: number
  slotStepMinutes: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  minimumNoticeHours?: number
  maxBookingsPerDay?: number
}

function setTime(date: Date, minutes: number) {
  const next = new Date(date)
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export function getAvailableSlots({
  date,
  availabilitySlots,
  busyRanges,
  holds,
  exceptions,
  rules,
  bookingCount,
  now = new Date(),
}: {
  date: Date
  availabilitySlots: Slot[]
  busyRanges: BusyRange[]
  holds?: BusyRange[]
  exceptions?: Array<{ date: Date; startMinutes?: number | null; endMinutes?: number | null; type: string }>
  rules: MeetingTypeRules
  bookingCount?: number
  now?: Date
}) {
  const minimumNoticeMs = (rules.minimumNoticeHours ?? 24) * 60 * 60 * 1000
  const bufferBeforeMs = (rules.bufferBeforeMinutes ?? 0) * 60 * 1000
  const bufferAfterMs = (rules.bufferAfterMinutes ?? 0) * 60 * 1000
  const dayAvailability = availabilitySlots.filter((slot) => slot.isActive !== false && slot.dayOfWeek === date.getDay())
  const dayExceptions = (exceptions ?? []).filter((exception) => sameDay(exception.date, date))
  const fullDayBlocked = dayExceptions.some((exception) => exception.type === "UNAVAILABLE" && exception.startMinutes == null && exception.endMinutes == null)
  if (fullDayBlocked) return []

  const currentBookingCount = bookingCount ?? busyRanges.filter((range) => sameDay(range.start, date)).length
  if ((rules.maxBookingsPerDay ?? 0) > 0 && currentBookingCount >= (rules.maxBookingsPerDay ?? 0)) return []

  const busyWithBuffers = [...busyRanges, ...(holds ?? [])].map((range) => ({
    start: new Date(range.start.getTime() - bufferBeforeMs),
    end: new Date(range.end.getTime() + bufferAfterMs),
  }))

  for (const exception of dayExceptions) {
    if (exception.type === "UNAVAILABLE" && exception.startMinutes != null && exception.endMinutes != null) {
      busyWithBuffers.push({
        start: setTime(date, exception.startMinutes),
        end: setTime(date, exception.endMinutes),
      })
    }
  }

  const starts: Array<{ start: Date; end: Date }> = []
  for (const slot of dayAvailability) {
    for (let minutes = slot.startMinutes; minutes + rules.durationMinutes <= slot.endMinutes; minutes += rules.slotStepMinutes) {
      const start = setTime(date, minutes)
      const end = new Date(start.getTime() + rules.durationMinutes * 60 * 1000)
      if (start.getTime() <= now.getTime() + minimumNoticeMs) continue
      if (busyWithBuffers.some((busy) => rangesOverlap(start, end, busy.start, busy.end))) continue
      starts.push({ start, end })
    }
  }

  return starts
}
