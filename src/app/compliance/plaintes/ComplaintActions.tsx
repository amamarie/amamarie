"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export function ComplaintActions({ complaintId, status }: { complaintId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: "ACKNOWLEDGE" | "ESCALATE" | "CLOSE" | "REOPEN") {
    setBusy(action)
    setMessage(null)
    try {
      await readData<unknown>(await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }))
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.")
    } finally {
      setBusy(null)
    }
  }

  const isClosed = status === "CLOSED"

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-xl" disabled={busy !== null || isClosed} onClick={() => run("ACKNOWLEDGE")}>
          {busy === "ACKNOWLEDGE" ? "..." : "Accuser réception"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50" disabled={busy !== null || isClosed} onClick={() => run("ESCALATE")}>
          {busy === "ESCALATE" ? "..." : "Escalader"}
        </Button>
        <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={busy !== null || isClosed} onClick={() => run("CLOSE")}>
          {busy === "CLOSE" ? "..." : "Fermer"}
        </Button>
        {isClosed ? (
          <Button size="sm" variant="outline" className="rounded-xl" disabled={busy !== null} onClick={() => run("REOPEN")}>
            {busy === "REOPEN" ? "..." : "Rouvrir"}
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm font-semibold text-rose-600">{message}</p> : null}
    </div>
  )
}
