export function getStartOfToday(date = new Date()) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function getEndOfToday(date = new Date()) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getEndOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function getStartOfPreviousMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

export function getEndOfPreviousMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999)
}

export function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}
