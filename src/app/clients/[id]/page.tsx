import { AppShell } from "@/components/layout/AppShell"
import { ClientDetailApiPage } from "@/components/clients/client-detail-api-page"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <AppShell moduleKey="clients">
      <ClientDetailApiPage clientId={id} />
    </AppShell>
  )
}
