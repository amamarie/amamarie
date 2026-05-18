import { AppShell } from "@/components/layout/AppShell"
import { PrioritiesPageClient } from "@/components/priorities/PrioritiesPageClient"

export default function PrioritiesPage() {
  return (
    <AppShell moduleKey="priorities">
      <PrioritiesPageClient />
    </AppShell>
  )
}
