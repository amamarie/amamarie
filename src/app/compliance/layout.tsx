import { AppShell } from "@/components/layout/AppShell"

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell moduleKey="compliance">{children}</AppShell>
}
