export function daysUntil(date?: Date | null) {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000)
}

export function daysSince(date?: Date | null) {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

export function minScoreForSeverity(severity: string) {
  if (severity === "CRITICAL") return 90
  if (severity === "HIGH") return 75
  if (severity === "MEDIUM") return 50
  return 15
}

export function commercialScoreFromPriority(priority: string) {
  if (priority === "URGENT" || priority === "CRITICAL") return 85
  if (priority === "HIGH") return 70
  if (priority === "MEDIUM" || priority === "NORMAL") return 45
  return 25
}
