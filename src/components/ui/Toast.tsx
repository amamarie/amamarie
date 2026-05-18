import { CheckCircle2, CircleAlert } from "lucide-react"
import type { ReactNode } from "react"

type ToastProps = {
  type?: "success" | "error"
  children: ReactNode
}

export function Toast({ type = "success", children }: ToastProps) {
  const Icon = type === "success" ? CheckCircle2 : CircleAlert
  return (
    <div className={type === "success" ? "rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" : "rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}
