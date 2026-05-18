import { AppShell } from "@/components/layout/AppShell"

export default function RecommendationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell moduleKey="recommendations">{children}</AppShell>
}
