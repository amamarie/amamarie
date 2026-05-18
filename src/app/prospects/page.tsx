import { AppShell } from "@/components/layout/AppShell"
import { ProspectsApiPage } from "@/components/prospects/prospects-api-page"

export default function ProspectsPage() {
  return (
    <AppShell moduleKey="prospects">
      <ProspectsApiPage />
    </AppShell>
  )
}
