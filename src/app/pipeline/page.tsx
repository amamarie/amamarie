import { LeadPipelinePage } from "@/components/prospects/pipeline/LeadPipelinePage"
import { AppShell } from "@/components/layout/AppShell"

export default function PipelinePage() {
  return (
    <AppShell moduleKey="pipeline">
      <LeadPipelinePage />
    </AppShell>
  )
}
