import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { AppShell } from "@/components/layout/AppShell"

export default function DashboardRoutePage() {
  return (
    <AppShell moduleKey="dashboard">
      <DashboardPage />
    </AppShell>
  )
}
