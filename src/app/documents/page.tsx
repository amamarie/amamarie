import { DocumentsPageClient } from "@/components/documents/DocumentsPageClient"
import { AppShell } from "@/components/layout/AppShell"

export default function DocumentsPage() {
  return (
    <AppShell moduleKey="documents">
      <DocumentsPageClient />
    </AppShell>
  )
}
