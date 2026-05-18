"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type ApprovalStep = {
  id: string
  level: number
  title: string
  status: string
  requiredRole: string | null
  approvedAt: string | Date | null
  rejectedAt: string | Date | null
}

async function readData<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string } }
  if (!response.ok) {
    const message = typeof result.error === "string" ? result.error : result.error?.message
    throw new Error(message ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export function ExceptionApprovalActions({ exceptionId, status, steps }: { exceptionId: string; status: string; steps: ApprovalStep[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function runStep(stepId: string, action: "APPROVE" | "REJECT") {
    setBusy(`${stepId}:${action}`)
    setMessage(null)
    try {
      await readData<unknown>(await fetch(`/api/compliance/approval-steps/${stepId}`, {
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

  async function approveException() {
    setBusy("final")
    setMessage(null)
    try {
      await readData<unknown>(await fetch(`/api/compliance/exceptions/${exceptionId}/approve`, { method: "POST" }))
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approbation finale impossible.")
    } finally {
      setBusy(null)
    }
  }

  const hasRejected = steps.some((step) => step.status === "REJECTED")
  const hasPending = steps.some((step) => step.status !== "APPROVED")
  const finalDisabled = status === "APPROVED" || hasRejected || hasPending

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-3">
        {steps.length > 0 ? (
          steps.map((step) => (
            <div key={step.id} className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Niveau {step.level} · {step.requiredRole ?? "Rôle libre"}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{step.title}</p>
                <p className="text-xs font-semibold text-slate-500">Statut : {step.status}</p>
              </div>
              {step.status === "PENDING" ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={busy !== null} onClick={() => runStep(step.id, "APPROVE")}>
                    {busy === `${step.id}:APPROVE` ? "..." : "Approuver"}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" disabled={busy !== null} onClick={() => runStep(step.id, "REJECT")}>
                    {busy === `${step.id}:REJECT` ? "..." : "Refuser"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-slate-500">Aucun workflow multi-niveaux requis pour cette exception.</p>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-slate-500">
          {status === "APPROVED" ? "Exception approuvée." : hasRejected ? "Une étape a refusé l’exception." : hasPending ? "Approbation finale disponible après tous les niveaux." : "Tous les niveaux sont complétés."}
        </p>
        <Button size="sm" className="rounded-xl" disabled={busy !== null || finalDisabled} onClick={approveException}>
          {busy === "final" ? "..." : "Approuver l’exception"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-sm font-semibold text-rose-600">{message}</p> : null}
    </div>
  )
}
