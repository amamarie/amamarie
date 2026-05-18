export function PriorityScoreIndicator({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{score}/100</span>
    </div>
  )
}
