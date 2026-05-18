import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Code2, type LucideIcon } from "lucide-react"

type DeveloperNavKey = "vue" | "api" | "cabinets" | "plans" | "journal"
type Tone = "emerald" | "rose" | "amber" | "violet" | "slate"

const navLinks = [
  { key: "vue", label: "Vue", href: "/developpeur" },
  { key: "api", label: "API", href: "/developpeur/api" },
  { key: "cabinets", label: "Cabinets", href: "/developpeur/cabinets" },
  { key: "plans", label: "Plans", href: "/developpeur/plans" },
  { key: "journal", label: "Journal", href: "/developpeur/journal" },
] as const

export function DeveloperHeader({ userName, active }: { userName: string; active: DeveloperNavKey }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Interfaces
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 text-sm font-semibold text-slate-500 md:flex">
            {navLinks.map((link) => (
              <Link key={link.key} href={link.href} className={`rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-950 ${active === link.key ? "bg-violet-50 text-violet-700" : ""}`}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
            <Code2 className="size-4" aria-hidden="true" />
            {userName}
          </div>
        </div>
      </div>
    </header>
  )
}

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-violet-700">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

export function SectionCard({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="text-xs font-semibold uppercase text-slate-500">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatusPill({ children, tone }: { children: ReactNode; tone: Tone }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>
}

export function CompactMetric({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: Tone }) {
  const iconClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className={`inline-flex size-9 items-center justify-center rounded-xl ${iconClasses[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}
