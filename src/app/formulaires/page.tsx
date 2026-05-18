import { AppShell } from "@/components/layout/AppShell"
import { LeadFormsPageClient } from "@/components/lead-forms/LeadFormsPageClient"

export default function LeadFormsPage() {
  return (
    <AppShell moduleKey="lead-forms">
      <LeadFormsPageClient />
    </AppShell>
  )
}
