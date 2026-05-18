import { AppShell } from "@/components/layout/AppShell"
import { TasksApiPage } from "@/components/tasks/tasks-api-page"

export default function TasksPage() {
  return (
    <AppShell moduleKey="tasks">
      <TasksApiPage />
    </AppShell>
  )
}
