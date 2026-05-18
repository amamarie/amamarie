import { AppShell } from "@/components/layout/AppShell"

export default function CrossSellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell moduleKey="opportunities">{children}</AppShell>
}
