import { AppShell } from "@/components/layout/AppShell"
import { LeadDetailApiPage } from "@/components/prospects/lead-detail-api-page"

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <AppShell moduleKey="prospects">
      <LeadDetailApiPage leadId={id} />
    </AppShell>
  )
}
