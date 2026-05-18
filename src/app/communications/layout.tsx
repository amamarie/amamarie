import { AppShell } from "@/components/layout/AppShell"

export default function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell moduleKey="communications">{children}</AppShell>
}
