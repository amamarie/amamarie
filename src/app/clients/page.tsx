import { ClientsApiPage } from "@/components/clients/clients-api-page"
import { AppShell } from "@/components/layout/AppShell"

export default function ClientsPage() {
  return (
    <AppShell moduleKey="clients">
      <ClientsApiPage />
    </AppShell>
  )
}
