import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/70", className)} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-24" />
      <Skeleton className="mt-5 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  )
}
