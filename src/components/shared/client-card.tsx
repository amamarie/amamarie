import Link from "next/link"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Client } from "@/types"

export function ClientCard({ client }: { client: Client }) {
  const name = `${client.firstName} ${client.lastName}`

  return (
    <Link
      href={`/clients/${client.id}`}
      className="block rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-[0_8px_0_#d9f99d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{client.occupation}</p>
        </div>
        <StatusBadge tone={client.tone}>{client.riskLevel}</StatusBadge>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">
        Prochaine revision: {client.nextReview}
      </p>
    </Link>
  )
}
