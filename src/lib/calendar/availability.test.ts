import assert from "node:assert/strict"
import test from "node:test"

import { getAvailableSlots } from "./availability"

const rules = {
  durationMinutes: 30,
  slotStepMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
  minimumNoticeHours: 0,
  maxBookingsPerDay: 6,
}

function dateAt(hour: number, minute = 0) {
  return new Date(2026, 4, 20, hour, minute, 0, 0)
}

test("returns slots inside active availability windows", () => {
  const slots = getAvailableSlots({
    date: dateAt(0),
    availabilitySlots: [{ dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 10 * 60, isActive: true }],
    busyRanges: [],
    rules,
    now: dateAt(8),
  })

  assert.deepEqual(slots.map((slot) => slot.start.getHours() * 60 + slot.start.getMinutes()), [540, 570])
})

test("removes slots that overlap busy ranges and buffers", () => {
  const slots = getAvailableSlots({
    date: dateAt(0),
    availabilitySlots: [{ dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 11 * 60, isActive: true }],
    busyRanges: [{ start: dateAt(9, 30), end: dateAt(10) }],
    rules,
    now: dateAt(8),
  })

  assert.deepEqual(slots.map((slot) => slot.start.getHours() * 60 + slot.start.getMinutes()), [540, 630])
})

test("blocks active holds and full-day exceptions", () => {
  const slots = getAvailableSlots({
    date: dateAt(0),
    availabilitySlots: [{ dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 10 * 60, isActive: true }],
    busyRanges: [],
    holds: [{ start: dateAt(9), end: dateAt(9, 30) }],
    exceptions: [{ date: dateAt(0), type: "UNAVAILABLE" }],
    rules,
    now: dateAt(8),
  })

  assert.equal(slots.length, 0)
})

test("respects booking quota and minimum notice", () => {
  const quotaBlocked = getAvailableSlots({
    date: dateAt(0),
    availabilitySlots: [{ dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 11 * 60, isActive: true }],
    busyRanges: [],
    rules: { ...rules, maxBookingsPerDay: 1 },
    bookingCount: 1,
    now: dateAt(8),
  })
  const noticeBlocked = getAvailableSlots({
    date: dateAt(0),
    availabilitySlots: [{ dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 11 * 60, isActive: true }],
    busyRanges: [],
    rules: { ...rules, minimumNoticeHours: 2 },
    now: dateAt(8),
  })

  assert.equal(quotaBlocked.length, 0)
  assert.deepEqual(noticeBlocked.map((slot) => slot.start.getHours() * 60 + slot.start.getMinutes()), [630])
})
