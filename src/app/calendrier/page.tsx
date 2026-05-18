import { AdvisorCalendarPage } from "@/components/calendar/AdvisorCalendarPage"
import { AppShell } from "@/components/layout/AppShell"

export default function CalendarPage() {
  return (
    <AppShell moduleKey="calendar">
      <AdvisorCalendarPage />
    </AppShell>
  )
}
