import { AppShell } from "@/components/layout/AppShell"
import { SmartRemindersPageClient } from "@/components/smart-reminders/SmartRemindersPageClient"

export default function SmartRemindersPage() {
  return (
    <AppShell moduleKey="smart-reminders">
      <SmartRemindersPageClient />
    </AppShell>
  )
}
