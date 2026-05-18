import type { ReactNode } from "react"

import { AppLayout } from "@/components/layout/AppLayout"
import type { ModuleKey } from "@/lib/billing/plans"

type AppShellProps = {
  children: ReactNode
  moduleKey?: ModuleKey
}

export function AppShell({ children, moduleKey }: AppShellProps) {
  return <AppLayout moduleKey={moduleKey}>{children}</AppLayout>
}
