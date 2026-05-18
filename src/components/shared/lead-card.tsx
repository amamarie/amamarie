import Link from "next/link"

import { StatusBadge } from "@/components/shared/status-badge"
import type { Lead } from "@/types"

export function LeadCard({ lead }: { lead: Lead }) {
  const name = `${lead.firstName} ${lead.lastName}`

  return (
    <Link
      href={`/prospects/${lead.id}`}
      className="block rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-[0_8px_0_#d9f99d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{lead.interest}</p>
        </div>
        <StatusBadge tone={lead.tone}>{lead.status}</StatusBadge>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{lead.nextAction}</p>
    </Link>
  )
}
