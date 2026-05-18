import { AppShell } from "@/components/layout/AppShell"
import { PrivacyAdvancedSettingsPage } from "@/components/settings/PrivacyAdvancedSettingsPage"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"
import { redirect } from "next/navigation"

export default async function PrivacySettingsPage() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    redirect("/sign-in?role=advisor&redirect_url=%2Fparametres%2Fconfidentialite")
  }

  if (user.role !== "OWNER") {
    redirect(homePathForUserRole(user.role))
  }

  return (
    <AppShell moduleKey="settings">
      <PrivacyAdvancedSettingsPage />
    </AppShell>
  )
}
