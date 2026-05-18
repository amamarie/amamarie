import { AppShell } from "@/components/layout/AppShell"

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell moduleKey="notifications">{children}</AppShell>
}
