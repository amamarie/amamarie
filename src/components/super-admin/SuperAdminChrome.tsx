import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, BarChart3, Building2, Code2, CreditCard, Headset, ListChecks, Settings, ShieldCheck, Sparkles, Users, type LucideIcon } from "lucide-react"

type SuperAdminNavKey = "dashboard" | "clients" | "finance" | "produit" | "support" | "technique" | "securite" | "logs" | "equipe" | "parametres"
type Tone = "emerald" | "rose" | "amber" | "violet" | "slate"

const navLinks = [
  { key: "dashboard", label: "Dashboard", href: "/super-admin", icon: BarChart3 },
  { key: "clients", label: "Clients", href: "/super-admin/clients", icon: Building2 },
  { key: "finance", label: "Finance", href: "/super-admin/finance", icon: CreditCard },
  { key: "produit", label: "Produit", href: "/super-admin/produit", icon: BarChart3 },
  { key: "support", label: "Support", href: "/super-admin/support", icon: Headset },
  { key: "technique", label: "Technique", href: "/super-admin/technique", icon: Code2 },
  { key: "securite", label: "Sécurité", href: "/super-admin/securite", icon: ShieldCheck },
  { key: "logs", label: "Logs", href: "/super-admin/logs", icon: ListChecks },
  { key: "equipe", label: "Équipe", href: "/super-admin/equipe", icon: Users },
  { key: "parametres", label: "Paramètres", href: "/super-admin/parametres", icon: Settings },
] as const

export function SuperAdminHeader({ userName, active }: { userName: string; active: SuperAdminNavKey }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Interfaces
        </Link>
        <nav className="hidden max-w-4xl flex-wrap items-center justify-end gap-1 text-sm font-semibold text-slate-500 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.key} href={link.href} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-950 ${active === link.key ? "bg-violet-50 text-violet-700" : ""}`}>
                <Icon className="size-4" aria-hidden="true" />
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
          <Sparkles className="size-4" aria-hidden="true" />
          {userName}
        </div>
      </div>
    </header>
  )
}

export function SuperAdminIntro({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-violet-700">Super admin interne</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

export function AdminCard({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
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

export function AdminMetric({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: Tone }) {
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

export function AdminPill({ children, tone }: { children: ReactNode; tone: Tone }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-500">{children}</div>
}
