import { AutomationsPage } from "@/components/automations/AutomationsPage"
import { AppShell } from "@/components/layout/AppShell"
import { requireSaasRole } from "@/lib/auth/roles"

export default async function AutomationsAliasPage() {
  await requireSaasRole(["OWNER"])

  return (
    <AppShell moduleKey="automations">
      <AutomationsPage />
    </AppShell>
  )
}
