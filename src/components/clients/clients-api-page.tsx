"use client"

import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  Edit3,
  FilePlus2,
  Grid2X2,
  List,
  Loader2,
  Mail,
  PackagePlus,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Trash2,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { FormEvent, ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { StatusTone } from "@/types"

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT_CONVERTED" | "REVIEW_NEEDED" | "ARCHIVED"
type RiskProfile = "CONSERVATIVE" | "MODERATE" | "BALANCED" | "GROWTH" | "AGGRESSIVE" | "UNKNOWN"

type ClientChild = {
  name?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  age?: number | null
}

type ApiClient = {
  id: string
  firstName: string
  lastName: string
  clientNumber: string | null
  gender: string | null
  email: string | null
  phone: string
  phonePrimary: string | null
  phoneSecondary: string | null
  emailPrimary: string | null
  emailSecondary: string | null
  preferredContactMethod: string | null
  preferredContactTime: string | null
  address: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string | null
  occupation: string | null
  employer: string | null
  employmentStatus: string | null
  yearsAtJob: number | null
  incomeRange: string | null
  isSelfEmployed: boolean
  annualIncome: number | null
  approximateIncome: number | null
  profileType: string | null
  familyStatus: string | null
  dependents: number | null
  dependentsCount: number | null
  dependentsDetails: string | null
  spouseName: string | null
  spouseGender: string | null
  spouseDateOfBirth: string | null
  children: ClientChild[] | null
  hasChildren: boolean
  status: ClientStatus
  riskProfile: RiskProfile | null
  netWorth: number | null
  liquidAssets: number | null
  liabilities: number | null
  savingsRate: number | null
  financialGoals: string | null
  primaryGoal: string | null
  investmentHorizon: string | null
  retirementGoal: boolean
  protectionNeeds: boolean
  goals: string | null
  notes: string | null
  source: string | null
  referredBy: string | null
  relationshipStartDate: string | null
  lastContactAt: string | null
  nextReviewDate: string | null
  lastInteractionType: string | null
  lastInteractionDate: string | null
  totalInteractions: number
  kycCompleted: boolean
  kycDate: string | null
  identityVerified: boolean
  complianceStatus: string | null
  consentGiven: boolean
  dateOfBirth: string | null
  createdAt: string
  updatedAt: string
  advisor?: { id: string; name: string } | null
  products?: { id: string; renewalAt: string | null; status: string }[]
  tasks?: { id: string; status: string; dueDate: string | null }[]
  documents?: { id: string; type: string; status: string }[]
}

type Filters = {
  q: string
  status: string
  riskProfile: string
  advisorId: string
}

type Meta = { page: number; pageSize: number; total: number }
type ClientSegment = "all" | "active" | "incomplete" | "today" | "renewals" | "review" | "missing-docs" | "opportunities" | "archived"

const emptyFilters: Filters = { q: "", status: "", riskProfile: "", advisorId: "" }

const segmentCopy: Record<ClientSegment, { title: string; description: string; empty: string }> = {
  all: {
    title: "Tous les clients",
    description: "Portefeuille, conformité, suivis et documents dans une seule vue.",
    empty: "Aucun client pour le moment.",
  },
  active: {
    title: "Clients actifs",
    description: "Tous les dossiers non archivés suivis dans le portefeuille.",
    empty: "Aucun client actif dans le portefeuille.",
  },
  incomplete: {
    title: "Dossiers incomplets",
    description: "Clients dont le profil client, les documents ou les données clés ne sont pas assez complets.",
    empty: "Aucun dossier incomplet selon les règles actuelles.",
  },
  today: {
    title: "Relances aujourd’hui",
    description: "Clients avec au moins une tâche ouverte due aujourd’hui.",
    empty: "Aucune relance client prévue aujourd’hui.",
  },
  renewals: {
    title: "Renouvellements proches",
    description: "Clients avec un produit à renouveler dans les 30 prochains jours.",
    empty: "Aucun renouvellement client dans les 30 prochains jours.",
  },
  review: {
    title: "Révisions requises",
    description: "Clients marqués comme nécessitant une révision du dossier.",
    empty: "Aucun client en révision requise.",
  },
  "missing-docs": {
    title: "Documents manquants",
    description: "Clients sans document lié au dossier.",
    empty: "Tous les clients visibles ont au moins un document lié.",
  },
  opportunities: {
    title: "Opportunités à qualifier",
    description: "Clients avec revue requise, aucun produit ou aucune date de révision planifiée.",
    empty: "Aucune opportunité client à qualifier pour le moment.",
  },
  archived: {
    title: "Clients archivés",
    description: "Dossiers retirés du portefeuille actif, conservés pour l’historique et la conformité.",
    empty: "Aucun client archivé.",
  },
}

const statusOptions: { value: ClientStatus; label: string; tone: StatusTone }[] = [
  { value: "ACTIVE", label: "Actif", tone: "emerald" },
  { value: "REVIEW_NEEDED", label: "Révision requise", tone: "amber" },
  { value: "INACTIVE", label: "Inactif", tone: "slate" },
  { value: "PROSPECT_CONVERTED", label: "Prospect converti", tone: "sky" },
  { value: "ARCHIVED", label: "Archivé", tone: "slate" },
]

const riskOptions: { value: RiskProfile; label: string; tone: StatusTone }[] = [
  { value: "UNKNOWN", label: "Inconnu", tone: "slate" },
  { value: "CONSERVATIVE", label: "Conservateur", tone: "emerald" },
  { value: "MODERATE", label: "Modéré", tone: "sky" },
  { value: "BALANCED", label: "Équilibré", tone: "violet" },
  { value: "GROWTH", label: "Croissance", tone: "amber" },
  { value: "AGGRESSIVE", label: "Audacieux", tone: "rose" },
]

function statusMeta(status: string) {
  return statusOptions.find((item) => item.value === status) ?? statusOptions[0]
}

function riskMeta(risk?: string | null) {
  return riskOptions.find((item) => item.value === risk) ?? riskOptions[0]
}

function formatDate(value?: string | null) {
  if (!value) return "À compléter"
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function maskEmail(value?: string | null) {
  if (!value) return "Courriel à compléter"
  const [name, domain] = value.split("@")
  if (!domain) return value
  return `${name.slice(0, 2)}***@${domain}`
}

function getClientCompletionScore(client: ApiClient) {
  const checks = [
    Boolean(client.firstName && client.lastName),
    Boolean(client.phonePrimary ?? client.phone),
    Boolean(client.emailPrimary ?? client.email),
    Boolean(client.preferredContactMethod),
    Boolean(client.addressLine1 ?? client.address),
    Boolean(client.dateOfBirth),
    Boolean(client.familyStatus),
    Boolean(client.occupation),
    Boolean(client.annualIncome ?? client.approximateIncome),
    Boolean(client.primaryGoal),
    Boolean(client.riskProfile && client.riskProfile !== "UNKNOWN"),
    client.kycCompleted,
    client.identityVerified,
    client.consentGiven,
    (client.documents ?? []).length > 0,
    (client.products ?? []).length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getComplianceMeta(client: ApiClient) {
  if (client.kycCompleted && client.identityVerified && client.consentGiven) {
    return { label: "Conforme", tone: "emerald" as const, score: 100 }
  }

  const missing = [
    !client.kycCompleted,
    !client.identityVerified,
    !client.consentGiven,
  ].filter(Boolean).length

  if (missing >= 2) return { label: "Bloqué", tone: "rose" as const, score: 0 }
  return { label: "À compléter", tone: "amber" as const, score: 60 }
}

function getNextClientAction(client: ApiClient) {
  if (!client.kycCompleted) return "Compléter le profil client"
  if (!client.identityVerified) return "Vérifier l’identité"
  if (!client.consentGiven) return "Obtenir le consentement"
  if ((client.documents ?? []).length === 0) return "Demander un document"
  if (!client.riskProfile || client.riskProfile === "UNKNOWN") return "Évaluer le profil de risque"
  if ((client.products ?? []).length === 0) return "Ajouter un produit"
  if (!client.nextReviewDate) return "Planifier la révision"
  return "Aucune action urgente"
}

function getClientPriority(client: ApiClient) {
  const action = getNextClientAction(client)
  if (action.includes("profil client") || action.includes("identité") || action.includes("consentement")) {
    return { label: "Haute", tone: "rose" as const }
  }
  if (client.status === "REVIEW_NEEDED" || action.includes("Demander")) {
    return { label: "Importante", tone: "amber" as const }
  }
  return { label: "Normale", tone: "sky" as const }
}

function isDueToday(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function hasRenewalSoon(client: ApiClient) {
  return (client.products ?? []).some((product) => {
    if (!product.renewalAt) return false
    const diffDays = (new Date(product.renewalAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 30
  })
}

function hasOpenTaskToday(client: ApiClient) {
  return (client.tasks ?? []).some((task) => task.status !== "DONE" && isDueToday(task.dueDate))
}

function hasClientOpportunity(client: ApiClient) {
  return client.status === "REVIEW_NEEDED" || (client.products ?? []).length === 0 || !client.nextReviewDate
}

function isIncompleteClient(client: ApiClient) {
  return getClientCompletionScore(client) < 70
}

function matchesSegment(client: ApiClient, segment: ClientSegment) {
  if (segment === "all") return client.status !== "ARCHIVED"
  if (segment === "active") return client.status !== "ARCHIVED"
  if (segment === "archived") return client.status === "ARCHIVED"
  if (client.status === "ARCHIVED") return false
  if (segment === "incomplete") return isIncompleteClient(client)
  if (segment === "today") return hasOpenTaskToday(client)
  if (segment === "renewals") return hasRenewalSoon(client)
  if (segment === "review") return client.status === "REVIEW_NEEDED"
  if (segment === "missing-docs") return (client.documents ?? []).length === 0
  if (segment === "opportunities") return hasClientOpportunity(client)
  return true
}

function buildQuery(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "25" })
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim())
  })
  return params.toString()
}

async function readJson<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string | { message?: string }; meta?: Meta }
  const message = typeof result.error === "string" ? result.error : result.error?.message
  if (!response.ok) throw new Error(message ?? "Une erreur est survenue.")
  return { data: result.data as T, meta: result.meta }
}

export function ClientsApiPage() {
  const [clients, setClients] = useState<ApiClient[]>([])
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [activeSegment, setActiveSegment] = useState<ClientSegment>("all")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 25, total: 0 })
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [formClient, setFormClient] = useState<ApiClient | "new" | null>(null)
  const [noteClient, setNoteClient] = useState<ApiClient | null>(null)
  const [taskClient, setTaskClient] = useState<ApiClient | null>(null)
  const [documentClient, setDocumentClient] = useState<ApiClient | null>(null)
  const [productClient, setProductClient] = useState<ApiClient | null>(null)
  const [archivedClient, setArchiveClient] = useState<ApiClient | null>(null)

  const loadClients = useCallback(async (nextFilters = filters, nextPage = page) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/clients?${buildQuery(nextFilters, nextPage)}`, { cache: "no-store" })
      const result = await readJson<ApiClient[]>(response)
      setClients(result.data)
      setMeta(result.meta ?? { page: nextPage, pageSize: 25, total: result.data.length })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les clients.")
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadClients(filters, page), 250)
    return () => window.clearTimeout(timer)
  }, [filters, page, loadClients])

  const advisors = useMemo(() => {
    const map = new Map<string, string>()
    clients.forEach((client) => {
      if (client.advisor?.id) map.set(client.advisor.id, client.advisor.name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [clients])

  const activeClients = clients.filter((client) => client.status !== "ARCHIVED")
  const archivedClients = clients.filter((client) => client.status === "ARCHIVED")
  const hasActiveFilters = Object.values(filters).some((value) => value.trim() !== "") || activeSegment !== "all"
  const baseClients = filters.status === "ARCHIVED" || activeSegment === "archived" ? archivedClients : clients
  const displayedClients = baseClients.filter((client) => matchesSegment(client, activeSegment))
  const reviewCount = activeClients.filter((client) => client.status === "REVIEW_NEEDED").length
  const renewalSoon = activeClients.filter(hasRenewalSoon).length
  const missingDocs = activeClients.filter((client) => (client.documents ?? []).length === 0).length
  const incompleteDossiers = activeClients.filter(isIncompleteClient).length
  const tasksToday = activeClients.reduce(
    (count, client) => count + (client.tasks ?? []).filter((task) => task.status !== "DONE" && isDueToday(task.dueDate)).length,
    0
  )
  const averageCompliance = activeClients.length
    ? Math.round(activeClients.reduce((sum, client) => sum + getComplianceMeta(client).score, 0) / activeClients.length)
    : 0
  const averageCompletion = activeClients.length
    ? Math.round(activeClients.reduce((sum, client) => sum + getClientCompletionScore(client), 0) / activeClients.length)
    : 0
  const openOpportunities = activeClients.filter(hasClientOpportunity).length

  const strictActiveCount = activeClients.filter((client) => client.status === "ACTIVE").length
  const metrics = [
    { label: "Clients actifs", value: String(activeClients.length), detail: `${strictActiveCount} actif${strictActiveCount > 1 ? "s" : ""} · ${activeClients.length} dossiers suivis`, icon: UserPlus, segment: "active" as const, tone: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-[0_6px_0_#86efac]" },
    { label: "Dossiers incomplets", value: String(incompleteDossiers), detail: "Afficher les dossiers à compléter", icon: ShieldAlert, segment: "incomplete" as const, tone: "bg-amber-50 text-amber-800 border-amber-200 shadow-[0_6px_0_#fde68a]" },
    { label: "Relances aujourd’hui", value: String(tasksToday), detail: "Afficher les clients à relancer", icon: CalendarClock, segment: "today" as const, tone: "bg-sky-50 text-sky-800 border-sky-200 shadow-[0_6px_0_#bae6fd]" },
    { label: "Renouvellements", value: String(renewalSoon), detail: "Afficher les échéances proches", icon: PackagePlus, segment: "renewals" as const, tone: "bg-violet-50 text-violet-800 border-violet-200 shadow-[0_6px_0_#ddd6fe]" },
    { label: "Opportunités", value: String(openOpportunities), detail: "Afficher les actions utiles", icon: BriefcaseBusiness, segment: "opportunities" as const, tone: "bg-rose-50 text-rose-800 border-rose-200 shadow-[0_6px_0_#fecdd3]" },
    { label: "Conformité", value: `${averageCompliance}%`, detail: `${reviewCount} révision${reviewCount > 1 ? "s" : ""} à surveiller`, icon: BadgeCheck, segment: "review" as const, tone: "bg-lime-50 text-lime-800 border-lime-200 shadow-[0_6px_0_#bef264]" },
  ]
  const activeSegmentCopy = segmentCopy[activeSegment]

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1)
    if (key === "status" && value === "ARCHIVED") setActiveSegment("archived")
    if (key === "status" && value !== "ARCHIVED" && activeSegment === "archived") setActiveSegment("all")
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function selectSegment(segment: ClientSegment) {
    setPage(1)
    setActiveSegment(segment)
    if (segment === "archived") {
      setFilters((current) => ({ ...current, status: "ARCHIVED" }))
    } else if (filters.status === "ARCHIVED") {
      setFilters((current) => ({ ...current, status: "" }))
    }
  }

  async function saveClient(payload: Record<string, string>, client?: ApiClient) {
    setIsSaving(true)
    setNotice(null)
    try {
      const response = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await readJson<ApiClient>(response)
      setFormClient(null)
      if (client) {
        setNotice({ type: "success", message: "Client modifié." })
        await loadClients(filters, page)
      } else {
        setFilters(emptyFilters)
        setPage(1)
        setNotice({ type: "success", message: "Client créé et ajouté à la liste." })
        await loadClients(emptyFilters, 1)
      }
    } catch (saveError) {
      setNotice({ type: "error", message: saveError instanceof Error ? saveError.message : "Impossible de sauvegarder." })
    } finally {
      setIsSaving(false)
    }
  }

  async function postClientAction(path: string, payload?: Record<string, string>) {
    setIsSaving(true)
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      })
      await readJson<unknown>(response)
      setNotice({ type: "success", message: "Action enregistrée." })
      await loadClients(filters, page)
      return true
    } catch (actionError) {
      setNotice({ type: "error", message: actionError instanceof Error ? actionError.message : "Action impossible." })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function archiveSelectedClient() {
    if (!archivedClient) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/clients/${archivedClient.id}`, { method: "DELETE" })
      await readJson<unknown>(response)
      setArchiveClient(null)
      setNotice({ type: "success", message: "Client supprimé de la liste active." })
      await loadClients(filters, page)
    } catch (archiveError) {
      setNotice({ type: "error", message: archiveError instanceof Error ? archiveError.message : "Suppression impossible." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell
      eyebrow="Portefeuille client"
      title="Clients"
      description="Une vue claire pour suivre les dossiers, produits, tâches, documents et alertes de conformité."
      showIntro={false}
    >
      {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}

      <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
        <div className="border-b-2 border-emerald-100 bg-white p-5">
          <ClientPortfolioHero
            activeCount={activeClients.length}
            averageCompletion={averageCompletion}
            averageCompliance={averageCompliance}
            reviewCount={reviewCount}
            renewalSoon={renewalSoon}
            missingDocs={missingDocs}
            onCreate={() => setFormClient("new")}
            onRefresh={() => void loadClients(filters, page)}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => selectSegment(metric.segment)}
                  className={`rounded-[1.5rem] border-2 p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${metric.tone} ${activeSegment === metric.segment ? "ring-2 ring-slate-950" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">{metric.label}</p>
                    <Icon className="size-5 shrink-0" />
                  </div>
                  <p className="mt-3 text-3xl font-black tracking-tight">{metric.value}</p>
                  <p className="mt-1 text-xs font-bold opacity-80">{metric.detail}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-[640px] p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Emplacement actuel</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{activeSegmentCopy.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {activeSegmentCopy.description} {displayedClients.length > 0 ? `${displayedClients.length} dossier${displayedClients.length > 1 ? "s" : ""} affiché${displayedClients.length > 1 ? "s" : ""}.` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full border-2 font-black" onClick={() => void loadClients(filters, page)}>
                <RefreshCw className="size-4" />
                Rafraîchir
              </Button>
              <Button type="button" className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={() => setFormClient("new")}>
                <UserPlus className="size-4" />
                Nouveau client
              </Button>
            </div>
          </div>

          <ClientFilters
            filters={filters}
            advisors={advisors}
            viewMode={viewMode}
            onChange={updateFilter}
            activeSegment={activeSegment}
            onSegmentChange={selectSegment}
            onReset={() => {
              setPage(1)
              setActiveSegment("all")
              setFilters(emptyFilters)
            }}
            onViewModeChange={setViewMode}
            onCreate={() => setFormClient("new")}
          />

          {isLoading ? (
            <LoadingState label="Chargement des clients..." />
          ) : error ? (
            <StatePanel title={error} actionLabel="Réessayer" onAction={() => void loadClients()} />
          ) : displayedClients.length === 0 ? (
            <StatePanel
              title={hasActiveFilters ? "Aucun résultat" : "Aucun client pour le moment."}
              description={hasActiveFilters ? activeSegmentCopy.empty : "Ajoutez votre premier client pour centraliser ses informations, ses suivis, ses documents et ses opportunités."}
              actionLabel={hasActiveFilters ? "Réinitialiser les filtres" : "Nouveau client"}
              onAction={() => {
                if (hasActiveFilters) {
                  setPage(1)
                  setActiveSegment("all")
                  setFilters(emptyFilters)
                } else {
                  setFormClient("new")
                }
              }}
            />
          ) : viewMode === "table" ? (
            <ClientTable
              clients={displayedClients}
              onEdit={(client) => setFormClient(client)}
              onProduct={(client) => setProductClient(client)}
              onTask={(client) => setTaskClient(client)}
              onNote={(client) => setNoteClient(client)}
              onDocument={(client) => setDocumentClient(client)}
              onArchive={(client) => setArchiveClient(client)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedClients.map((client) => (
                <ClientCardView
                  key={client.id}
                  client={client}
                  onEdit={() => setFormClient(client)}
                  onProduct={() => setProductClient(client)}
                  onTask={() => setTaskClient(client)}
                  onNote={() => setNoteClient(client)}
                  onDocument={() => setDocumentClient(client)}
                  onArchive={() => setArchiveClient(client)}
                />
              ))}
            </div>
          )}
          <PaginationControls meta={meta} onPrevious={() => setPage((current) => Math.max(current - 1, 1))} onNext={() => setPage((current) => Math.min(current + 1, Math.max(Math.ceil(meta.total / meta.pageSize), 1)))} />
        </div>
      </section>

      {formClient ? <ClientFormModal client={formClient === "new" ? null : formClient} isSaving={isSaving} onClose={() => setFormClient(null)} onSave={saveClient} /> : null}
      {noteClient ? <SimpleTextModal title="Ajouter une note" textareaLabel="Note" isSaving={isSaving} onClose={() => setNoteClient(null)} onSave={async (payload) => { if (await postClientAction(`/api/clients/${noteClient.id}/notes`, payload)) setNoteClient(null) }} /> : null}
      {taskClient ? <TaskModal client={taskClient} isSaving={isSaving} onClose={() => setTaskClient(null)} onSave={async (payload) => { if (await postClientAction(`/api/clients/${taskClient.id}/tasks`, payload)) setTaskClient(null) }} /> : null}
      {documentClient ? <DocumentModal isSaving={isSaving} onClose={() => setDocumentClient(null)} onSave={async (payload) => { if (await postClientAction(`/api/clients/${documentClient.id}/documents`, payload)) setDocumentClient(null) }} /> : null}
      {productClient ? <ProductModal client={productClient} isSaving={isSaving} onClose={() => setProductClient(null)} onSave={async (payload) => { if (await postClientAction(`/api/clients/${productClient.id}/financial-products`, payload)) setProductClient(null) }} /> : null}
      {archivedClient ? <ConfirmModal title="Supprimer le client de la liste active" description={`${archivedClient.firstName} ${archivedClient.lastName} sera retiré du portefeuille actif. Le dossier restera disponible dans le filtre Archivé pour conserver l’historique et la conformité.`} confirmLabel="Supprimer" isSaving={isSaving} onClose={() => setArchiveClient(null)} onConfirm={archiveSelectedClient} /> : null}
    </PageShell>
  )
}

function ClientPortfolioHero({ activeCount, averageCompletion, averageCompliance, reviewCount, renewalSoon, missingDocs, onCreate, onRefresh }: {
  activeCount: number
  averageCompletion: number
  averageCompliance: number
  reviewCount: number
  renewalSoon: number
  missingDocs: number
  onCreate: () => void
  onRefresh: () => void
}) {
  const stages = ["Profil", "Profil client", "Docs", "Analyse", "Reco", "Suivi"]

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-stretch">
      <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-50">SPACE CLIENTS</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight">Tout suivre au bon client, au bon moment</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
          Les clients, profils client, documents, tâches, produits et recommandations restent connectés dans un seul espace de travail.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stages.map((stage) => (
            <span key={stage} className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-black text-white">
              {stage}
            </span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={onRefresh}>
            <RefreshCw className="size-4" />
            Rafraîchir
          </Button>
          <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={onCreate}>
            <UserPlus className="size-4" />
            Nouveau client
          </Button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Préparation moyenne</p>
        <p className="mt-2 text-4xl font-black text-slate-950">{averageCompletion}%</p>
        <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${averageCompletion}%` }} />
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          {activeCount} dossiers clients · conformité moyenne {averageCompliance}%.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-amber-700">{reviewCount}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Révisions</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-violet-700">{renewalSoon}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Renouv.</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2">
            <p className="text-lg font-black text-rose-700">{missingDocs}</p>
            <p className="text-[10px] font-black uppercase text-slate-400">Docs</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClientFilters({ filters, advisors, viewMode, activeSegment, onChange, onSegmentChange, onReset, onViewModeChange, onCreate }: {
  filters: Filters
  advisors: { id: string; name: string }[]
  viewMode: "table" | "cards"
  activeSegment: ClientSegment
  onChange: (key: keyof Filters, value: string) => void
  onSegmentChange: (segment: ClientSegment) => void
  onReset: () => void
  onViewModeChange: (mode: "table" | "cards") => void
  onCreate: () => void
}) {
  const quickSegments = [
    { label: "Tous", segment: "all" as const },
    { label: "Dossiers incomplets", segment: "incomplete" as const },
    { label: "Relances aujourd’hui", segment: "today" as const },
    { label: "Révisions requises", segment: "review" as const },
    { label: "Documents manquants", segment: "missing-docs" as const },
    { label: "Renouvellements proches", segment: "renewals" as const },
    { label: "Opportunités", segment: "opportunities" as const },
    { label: "Archivés", segment: "archived" as const },
  ]

  return (
    <div className="mb-5 space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={filters.q} onChange={(event) => onChange("q", event.target.value)} placeholder="Rechercher un client, police, téléphone ou courriel..." className="h-12 rounded-full border-2 bg-slate-50 pl-10 text-sm font-semibold shadow-inner" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-12 rounded-full bg-emerald-500 px-5 font-black text-white shadow-[0_6px_0_#16a34a] hover:bg-emerald-600" onClick={onCreate}><UserPlus className="size-4" />Nouveau client</Button>
          <Button type="button" variant={viewMode === "cards" ? "default" : "outline"} className={viewMode === "cards" ? "h-12 rounded-full bg-slate-950 px-4 font-black" : "h-12 rounded-full border-2 px-4 font-black"} onClick={() => onViewModeChange("cards")}><Grid2X2 className="size-4" />Cartes</Button>
          <Button type="button" variant={viewMode === "table" ? "default" : "outline"} className={viewMode === "table" ? "h-12 rounded-full bg-slate-950 px-4 font-black" : "h-12 rounded-full border-2 px-4 font-black"} onClick={() => onViewModeChange("table")}><List className="size-4" />Liste</Button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickSegments.map((segment) => (
          <button
            key={segment.label}
            type="button"
            onClick={() => onSegmentChange(segment.segment)}
            className={activeSegment === segment.segment
              ? "shrink-0 rounded-full border-2 border-slate-950 bg-slate-950 px-3 py-2 text-xs font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              : "shrink-0 rounded-full border-2 border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"}
          >
            {segment.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <SelectFilter label="Statut" value={filters.status} onChange={(value) => onChange("status", value)} options={statusOptions.map(({ value, label }) => ({ value, label }))} />
        <SelectFilter label="Risque" value={filters.riskProfile} onChange={(value) => onChange("riskProfile", value)} options={riskOptions.map(({ value, label }) => ({ value, label }))} />
        <SelectFilter label="Conseiller" value={filters.advisorId} onChange={(value) => onChange("advisorId", value)} options={advisors.map(({ id, name }) => ({ value: id, label: name }))} />
        <Button type="button" variant="outline" className="h-11 rounded-full border-2 font-black" onClick={onReset}>Réinitialiser</Button>
      </div>
    </div>
  )
}

function ClientTable({ clients, onEdit, onProduct, onTask, onNote, onDocument, onArchive }: {
  clients: ApiClient[]
  onEdit: (client: ApiClient) => void
  onProduct: (client: ApiClient) => void
  onTask: (client: ApiClient) => void
  onNote: (client: ApiClient) => void
  onDocument: (client: ApiClient) => void
  onArchive: (client: ApiClient) => void
}) {
  return (
    <div className="overflow-x-auto rounded-[1.75rem] border-2 border-slate-200 bg-white shadow-[0_8px_0_#f1f5f9]">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/90">
            <TableHead>Client</TableHead>
            <TableHead>Dossier</TableHead>
            <TableHead>Conformité</TableHead>
            <TableHead>Portefeuille</TableHead>
            <TableHead>Suivi</TableHead>
            <TableHead>Priorité</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => {
            const score = getClientCompletionScore(client)
            const compliance = getComplianceMeta(client)
            const priority = getClientPriority(client)
            const nextAction = getNextClientAction(client)
            const productsCount = client.products?.length ?? 0
            const documentsCount = client.documents?.length ?? 0
            const openTasks = client.tasks?.filter((task) => task.status !== "DONE").length ?? 0

            return (
              <TableRow key={client.id} className="align-top hover:bg-emerald-50/30">
                <TableCell className="min-w-80 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-[0_4px_0_#cbd5e1]">
                      {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <Link className="font-black text-slate-950 hover:text-emerald-700" href={`/clients/${client.id}`}>
                        {client.firstName} {client.lastName}
                      </Link>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {maskEmail(client.emailPrimary ?? client.email)} · {client.phonePrimary ?? client.phone}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ClientStatusBadge status={client.status} />
                        <RiskProfileBadge risk={client.riskProfile} />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-56 py-4">
                  <CompletionBar value={score} />
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {client.kycCompleted ? "Profil client complété" : "Profil client à compléter"} · {documentsCount} doc{documentsCount > 1 ? "s" : ""}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <StatusBadge tone={compliance.tone}>{compliance.label}</StatusBadge>
                    <p className="text-xs font-semibold text-slate-500">{compliance.score}/100 · {client.consentGiven ? "Consentement OK" : "Consentement requis"}</p>
                  </div>
                </TableCell>
                <TableCell className="min-w-44 py-4">
                  <p className="font-black text-slate-950">{productsCount} produit{productsCount > 1 ? "s" : ""}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{productsCount > 0 ? "Portefeuille à suivre" : "Potentiel à qualifier"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{documentsCount} document{documentsCount > 1 ? "s" : ""}</p>
                </TableCell>
                <TableCell className="min-w-64 py-4">
                  <p className="font-black text-slate-950">{nextAction}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Dernier contact: {formatDate(client.lastContactAt ?? client.lastInteractionDate)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{openTasks} tâche{openTasks > 1 ? "s" : ""} ouverte{openTasks > 1 ? "s" : ""} · {client.advisor?.name ?? "À assigner"}</p>
                </TableCell>
                <TableCell><StatusBadge tone={priority.tone}>{priority.label}</StatusBadge></TableCell>
                <TableCell className="py-4">
                  <div className="flex min-w-64 flex-wrap gap-2">
                    <Button size="sm" className="rounded-full bg-slate-950 font-black hover:bg-slate-800" asChild><Link href={`/clients/${client.id}`}>Ouvrir</Link></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2" onClick={() => onProduct(client)} aria-label={`Ajouter un produit pour ${client.firstName} ${client.lastName}`}><PackagePlus className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2" onClick={() => onNote(client)} aria-label={`Ajouter une note pour ${client.firstName} ${client.lastName}`}><StickyNote className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2" onClick={() => onTask(client)} aria-label={`Créer une tâche pour ${client.firstName} ${client.lastName}`}><ClipboardList className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2" onClick={() => onDocument(client)} aria-label={`Ajouter un document pour ${client.firstName} ${client.lastName}`}><FilePlus2 className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2" onClick={() => onEdit(client)} aria-label={`Modifier ${client.firstName} ${client.lastName}`}><Edit3 className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" className="rounded-full border-2 text-rose-700 hover:border-rose-200 hover:bg-rose-50" onClick={() => onArchive(client)} aria-label={`Supprimer ${client.firstName} ${client.lastName} de la liste active`}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function CompletionBar({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-sky-500" : "bg-amber-500"
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{value} % complété</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`${tone} h-full rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ClientCardView({ client, onEdit, onProduct, onTask, onNote, onDocument, onArchive }: { client: ApiClient; onEdit: () => void; onProduct: () => void; onTask: () => void; onNote: () => void; onDocument: () => void; onArchive: () => void }) {
  const documentsCount = client.documents?.length ?? 0
  const productsCount = client.products?.length ?? 0
  const tasksCount = client.tasks?.filter((task) => task.status !== "DONE").length ?? 0

  return (
    <article className="group rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-[0_8px_0_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-[0_9px_0_rgba(5,150,105,0.14)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-950">{client.firstName} {client.lastName}</h3>
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-500"><Phone className="size-3.5 text-emerald-600" />{client.phonePrimary ?? client.phone}</p>
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-500"><Mail className="size-3.5 text-sky-600" />{client.emailPrimary ?? client.email ?? "Courriel non défini"}</p>
          </div>
        </div>
        <ClientStatusBadge status={client.status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <ClientCardMetric label="Produits" value={productsCount} />
        <ClientCardMetric label="Tâches" value={tasksCount} />
        <ClientCardMetric label="Docs" value={documentsCount} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RiskProfileBadge risk={client.riskProfile} />
        <StatusBadge tone={documentsCount === 0 ? "rose" : "emerald"}>{documentsCount === 0 ? "Docs à créer" : "Docs liés"}</StatusBadge>
      </div>
      <p className="mt-4 min-h-10 line-clamp-2 text-sm font-medium leading-5 text-slate-600">{client.financialGoals ?? client.goals ?? client.notes ?? "Objectifs à définir"}</p>
      <div className="mt-4 grid grid-cols-6 gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onProduct} aria-label={`Ajouter un produit pour ${client.firstName} ${client.lastName}`}><PackagePlus className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onNote}><StickyNote className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onTask}><ClipboardList className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onDocument}><FilePlus2 className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onEdit}><Edit3 className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full text-rose-700 hover:border-rose-200 hover:bg-rose-50" onClick={onArchive}><Trash2 className="size-4" /></Button>
      </div>
      <Button className="mt-3 w-full rounded-full bg-slate-950 font-black hover:bg-slate-800" asChild><Link href={`/clients/${client.id}`}>Ouvrir le cockpit</Link></Button>
    </article>
  )
}

function ClientCardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <p className="text-lg font-black text-slate-950">{value}</p>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

const financialGoalOptions = [
  { value: "", label: "Non défini" },
  { value: "RETIREMENT", label: "Retraite" },
  { value: "WEALTH_BUILDING", label: "Croissance du patrimoine" },
  { value: "PROTECTION", label: "Protection familiale" },
  { value: "TAX_OPTIMIZATION", label: "Optimisation fiscale" },
  { value: "EDUCATION", label: "Études des enfants" },
  { value: "BUSINESS_PROTECTION", label: "Protection d'entreprise" },
  { value: "ESTATE_PLANNING", label: "Planification successorale" },
  { value: "OTHER", label: "Autre objectif" },
]

const personGenderOptions = [
  { value: "", label: "Non défini" },
  { value: "FEMALE", label: "Femme" },
  { value: "MALE", label: "Homme" },
  { value: "NON_BINARY", label: "Non binaire" },
  { value: "UNDISCLOSED", label: "Préfère ne pas répondre" },
]

const genderOptions = [
  { value: "", label: "À compléter" },
  { value: "FEMALE", label: "Femme" },
  { value: "MALE", label: "Homme" },
  { value: "NON_BINARY", label: "Non binaire" },
  { value: "UNDISCLOSED", label: "Préfère ne pas répondre" },
]

const provinceOptions = [
  { value: "", label: "À compléter" },
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "NU", label: "Nunavut" },
]

const countryOptions = [
  { value: "Canada", label: "Canada" },
  { value: "États-Unis", label: "États-Unis" },
  { value: "France", label: "France" },
  { value: "Autre", label: "Autre" },
]

const clientSourceOptions = [
  { value: "", label: "À compléter" },
  { value: "REFERRAL", label: "Référence client" },
  { value: "WEBSITE", label: "Formulaire web" },
  { value: "PHONE", label: "Appel entrant" },
  { value: "SMS", label: "SMS entrant" },
  { value: "EMAIL", label: "Courriel entrant" },
  { value: "GOOGLE_SHEETS", label: "Google Sheets" },
  { value: "EVENT", label: "Événement / séminaire" },
  { value: "SOCIAL", label: "Réseaux sociaux" },
  { value: "CLIENT_PORTAL", label: "Portail client" },
  { value: "OTHER", label: "Autre" },
]

const clientSourceLabels = Object.fromEntries(clientSourceOptions.map((option) => [option.value, option.label]))

const complianceStatusOptions = [
  { value: "", label: "À compléter" },
  { value: "READY", label: "Prêt" },
  { value: "IN_REVIEW", label: "En révision conseiller" },
  { value: "MISSING_DATA", label: "Données manquantes" },
  { value: "CONSENT_MISSING", label: "Consentement manquant" },
  { value: "ID_NOT_VERIFIED", label: "Identité non vérifiée" },
  { value: "AML_REVIEW", label: "AML / LBA à revoir" },
  { value: "BLOCKED", label: "Bloqué" },
]

const yesNoStatusOptions = [
  { value: "false", label: "Non" },
  { value: "true", label: "Oui" },
]

type ChildDraft = {
  id: string
  name: string
  dateOfBirth: string
  gender: string
}

function digitsOnly(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

function formatPhoneInput(value?: string | null) {
  const digits = digitsOnly(value).slice(0, 11)
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (local.length <= 3) return local
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`
  const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`
  return digits.length === 11 && digits.startsWith("1") ? `+1 ${formatted}` : formatted
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function calculateAge(dateValue: string) {
  if (!dateValue) return ""
  const birthDate = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(birthDate.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1
  return age >= 0 ? `${age} an${age > 1 ? "s" : ""}` : ""
}

function isValidDateInput(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function buildDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("fr-CA", { month: "long" }).format(new Date(2026, month, 1))
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function compactLines(lines: Array<string | undefined>) {
  return lines.map((line) => line?.trim()).filter(Boolean).join("\n")
}

function normalizeClientChildren(children?: ClientChild[] | null): ChildDraft[] {
  if (!Array.isArray(children) || children.length === 0) return []
  return children.map((child, index) => ({
    id: `${Date.now()}-${index}`,
    name: child.name ?? "",
    dateOfBirth: child.dateOfBirth?.slice(0, 10) ?? "",
    gender: child.gender ?? "",
  }))
}

function ClientFormModal({ client, isSaving, onClose, onSave }: {
  client: ApiClient | null
  isSaving: boolean
  onClose: () => void
  onSave: (payload: Record<string, string>, client?: ApiClient) => Promise<void>
}) {
  const savedChildren = normalizeClientChildren(client?.children)
  const initialChildrenCount = Math.max(savedChildren.length, client?.dependentsCount ?? client?.dependents ?? 0, client?.hasChildren ? 1 : 0)
  const [hasSpouse, setHasSpouse] = useState(Boolean(client?.spouseName || client?.spouseGender || client?.spouseDateOfBirth || client?.familyStatus === "MARRIED" || client?.familyStatus === "COMMON_LAW"))
  const [hasChildren, setHasChildren] = useState(initialChildrenCount > 0)
  const [children, setChildren] = useState<ChildDraft[]>(() => {
    if (savedChildren.length > 0) return savedChildren
    const count = initialChildrenCount > 0 ? initialChildrenCount : 1
    return Array.from({ length: count }, (_, index) => ({ id: `${Date.now()}-${index}`, name: "", dateOfBirth: "", gender: "" }))
  })
  const relationReadiness = [
    {
      label: "Origine du client",
      done: Boolean(client?.source),
      detail: client?.source ? (clientSourceLabels[client.source] ?? client.source) : "Source à documenter",
    },
    {
      label: "Relation active",
      done: Boolean(client?.relationshipStartDate),
      detail: client?.relationshipStartDate ? `Début ${formatDate(client.relationshipStartDate)}` : "Date de début manquante",
    },
    {
      label: "Suivi récent",
      done: Boolean(client?.lastContactAt),
      detail: client?.lastContactAt ? `Dernier contact ${formatDate(client.lastContactAt)}` : "Aucun dernier contact inscrit",
    },
    {
      label: "Révision planifiée",
      done: Boolean(client?.nextReviewDate),
      detail: client?.nextReviewDate ? `Prochaine révision ${formatDate(client.nextReviewDate)}` : "Date de revue à planifier",
    },
    {
      label: "Profil client",
      done: Boolean(client?.kycCompleted),
      detail: client?.kycCompleted ? `Complété${client.kycDate ? ` le ${formatDate(client.kycDate)}` : ""}` : "Profil client à compléter",
    },
    {
      label: "Identité et consentement",
      done: Boolean(client?.identityVerified && client?.consentGiven),
      detail: `${client?.identityVerified ? "Identité vérifiée" : "Identité non vérifiée"} · ${client?.consentGiven ? "Consentement actif" : "Consentement manquant"}`,
    },
  ]
  const relationReadyCount = relationReadiness.filter((item) => item.done).length

  function updateChild(id: string, field: keyof ChildDraft, value: string) {
    setChildren((current) => current.map((child) => child.id === id ? { ...child, [field]: value } : child))
  }

  function addChild() {
    setHasChildren(true)
    setChildren((current) => [...current, { id: `${Date.now()}-${current.length}`, name: "", dateOfBirth: "", gender: "" }])
  }

  function removeChild(id: string) {
    setChildren((current) => {
      const next = current.filter((child) => child.id !== id)
      if (next.length === 0) {
        setHasChildren(false)
        return [{ id: `${Date.now()}-0`, name: "", dateOfBirth: "", gender: "" }]
      }
      return next
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>

    payload.phonePrimary = digitsOnly(payload.phonePrimary)
    payload.phoneSecondary = digitsOnly(payload.phoneSecondary)
    payload.emailPrimary = normalizeEmail(payload.emailPrimary)
    payload.emailSecondary = normalizeEmail(payload.emailSecondary)
    payload.email = normalizeEmail(payload.email)
    payload.hasChildren = hasChildren ? "true" : "false"

    if (!hasSpouse) {
      payload.spouseName = ""
      payload.spouseGender = ""
      payload.spouseDateOfBirth = ""
    }

    const childRows = hasChildren
      ? children
          .map((child) => ({
            name: String(formData.get(`childName_${child.id}`) ?? "").trim(),
            dateOfBirth: String(formData.get(`childDateOfBirth_${child.id}`) ?? "").trim(),
            gender: String(formData.get(`childGender_${child.id}`) ?? "").trim(),
            age: calculateAge(String(formData.get(`childDateOfBirth_${child.id}`) ?? "").trim()).replace(/\D/g, ""),
          }))
          .filter((child) => child.name || child.dateOfBirth || child.gender)
      : []

    payload.children = JSON.stringify(childRows.map((child) => ({
      name: child.name,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
      age: child.age ? Number(child.age) : undefined,
    })))
    payload.dependentsCount = hasChildren ? String(Math.max(childRows.length, Number(payload.dependentsCount || 0), 1)) : "0"
    payload.dependents = payload.dependentsCount

    const childrenDetails = childRows.length > 0
      ? `Enfants:\n${childRows.map((child, index) => {
          const age = calculateAge(child.dateOfBirth)
          return `${index + 1}. ${child.name || "Nom à compléter"}${child.gender ? ` | genre: ${child.gender}` : ""}${child.dateOfBirth ? ` | naissance: ${child.dateOfBirth}` : ""}${age ? ` | âge: ${age}` : ""}`
        }).join("\n")}`
      : undefined

    payload.dependentsDetails = compactLines([
      String(formData.get("familyNotes") ?? ""),
      childrenDetails,
    ])

    await onSave(payload, client ?? undefined)
  }
  return (
    <Modal title={client ? "Modifier le client" : "Nouveau client"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-5">
        <SectionTitle>Identité</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><Field name="firstName" label="Prenom" required defaultValue={client?.firstName} /><Field name="lastName" label="Nom" required defaultValue={client?.lastName} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field name="clientNumber" label="No client interne" defaultValue={client?.clientNumber ?? ""} /><SelectField name="gender" label="Genre" defaultValue={client?.gender ?? ""} options={genderOptions} /></div>
        <Field name="dateOfBirth" label="Date de naissance" type="date" defaultValue={client?.dateOfBirth?.slice(0, 10) ?? ""} />
        <SectionTitle>Coordonnées</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><PhoneField name="phonePrimary" label="Téléphone principal" required defaultValue={client?.phonePrimary ?? client?.phone} /><PhoneField name="phoneSecondary" label="Téléphone secondaire (optionnel)" defaultValue={client?.phoneSecondary ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><EmailField name="emailPrimary" label="Courriel principal" defaultValue={client?.emailPrimary ?? client?.email ?? ""} /><EmailField name="emailSecondary" label="Courriel secondaire (optionnel)" defaultValue={client?.emailSecondary ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="preferredContactMethod" label="Contact préféré" defaultValue={client?.preferredContactMethod ?? ""} options={[{ value: "", label: "Non défini" }, { value: "PHONE", label: "Téléphone" }, { value: "EMAIL", label: "Courriel" }, { value: "SMS", label: "SMS" }]} /><SelectField name="preferredContactTime" label="Moment préféré" defaultValue={client?.preferredContactTime ?? ""} options={[{ value: "", label: "Non défini" }, { value: "MORNING", label: "Matin" }, { value: "AFTERNOON", label: "Après-midi" }, { value: "EVENING", label: "Soir" }]} /></div>
        <SectionTitle>Adresse</SectionTitle>
        <Field name="addressLine1" label="Adresse ligne 1" defaultValue={client?.addressLine1 ?? client?.address ?? ""} />
        <Field name="addressLine2" label="Adresse ligne 2" defaultValue={client?.addressLine2 ?? ""} />
        <div className="grid gap-4 sm:grid-cols-4"><Field name="city" label="Ville" defaultValue={client?.city ?? ""} /><SelectField name="province" label="Province" defaultValue={client?.province ?? ""} options={provinceOptions} /><Field name="postalCode" label="Code postal" defaultValue={client?.postalCode ?? ""} /><SelectField name="country" label="Pays" defaultValue={client?.country ?? "Canada"} options={countryOptions} /></div>
        <SectionTitle>Situation personnelle et professionnelle</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="familyStatus" label="Situation familiale" defaultValue={client?.familyStatus ?? ""} options={[{ value: "", label: "À compléter" }, { value: "SINGLE", label: "Célibataire" }, { value: "MARRIED", label: "Marié(e)" }, { value: "COMMON_LAW", label: "Conjoint(e) de fait" }, { value: "DIVORCED", label: "Divorcé(e)" }, { value: "WIDOWED", label: "Veuf/veuve" }, { value: "OTHER", label: "Autre" }]} /><Field name="dependentsCount" label="Personnes à charge" type="number" defaultValue={client?.dependentsCount?.toString() ?? client?.dependents?.toString() ?? ""} /></div>

        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Conjoint(e)
              <select value={hasSpouse ? "true" : "false"} onChange={(event) => setHasSpouse(event.target.value === "true")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Enfants
              <select value={hasChildren ? "true" : "false"} onChange={(event) => setHasChildren(event.target.value === "true")} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </label>
          </div>

          {hasSpouse ? (
            <div className="grid gap-4 rounded-2xl border border-white bg-white p-4 shadow-sm sm:grid-cols-3">
              <Field name="spouseName" label="Nom du/de la conjoint(e)" defaultValue={client?.spouseName ?? ""} />
              <SelectField name="spouseGender" label="Genre du/de la conjoint(e)" defaultValue={client?.spouseGender ?? ""} options={genderOptions} />
              <Field name="spouseDateOfBirth" label="Date de naissance du/de la conjoint(e)" type="date" defaultValue={client?.spouseDateOfBirth?.slice(0, 10) ?? ""} />
            </div>
          ) : (
            <>
              <input type="hidden" name="spouseName" value="" />
              <input type="hidden" name="spouseGender" value="" />
              <input type="hidden" name="spouseDateOfBirth" value="" />
            </>
          )}

          {hasChildren ? (
            <div className="grid gap-3">
              {children.map((child, index) => {
                const age = calculateAge(child.dateOfBirth)
                return (
                  <div key={child.id} className="grid gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                    <Field name={`childName_${child.id}`} label={`Enfant ${index + 1} - prénom`} defaultValue={child.name} />
                    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                      Date de naissance
                      <Input name={`childDateOfBirth_${child.id}`} type="date" value={child.dateOfBirth} onChange={(event) => updateChild(child.id, "dateOfBirth", event.target.value)} className="h-11 rounded-2xl" />
                      <span className="text-xs font-semibold text-slate-500">{age ? `Âge calculé : ${age}` : "L'âge se calcule automatiquement."}</span>
                    </label>
                    <SelectField name={`childGender_${child.id}`} label="Genre" defaultValue={child.gender} options={genderOptions} />
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="h-11 rounded-2xl text-rose-700 hover:border-rose-200 hover:bg-rose-50" onClick={() => removeChild(child.id)}>
                        Retirer
                      </Button>
                    </div>
                  </div>
                )
              })}
              <div>
                <Button type="button" variant="outline" className="rounded-full" onClick={addChild}>Ajouter un enfant</Button>
              </div>
            </div>
          ) : null}

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Notes familiales complémentaires
            <textarea name="familyNotes" defaultValue={client?.dependentsDetails ?? ""} rows={3} className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Ex.: garde partagée, enfant à charge particulière, précision sur le ménage." />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3"><Field name="occupation" label="Occupation" defaultValue={client?.occupation ?? ""} /><Field name="employer" label="Employeur" defaultValue={client?.employer ?? ""} /><SelectField name="employmentStatus" label="Statut d'emploi" defaultValue={client?.employmentStatus ?? ""} options={[{ value: "", label: "À compléter" }, { value: "EMPLOYED", label: "Employé(e)" }, { value: "SELF_EMPLOYED", label: "Travailleur autonome" }, { value: "BUSINESS_OWNER", label: "Entrepreneur / propriétaire" }, { value: "INCORPORATED", label: "Incorporé(e)" }, { value: "UNEMPLOYED", label: "Sans emploi" }, { value: "RETIRED", label: "Retraité(e)" }, { value: "STUDENT", label: "Étudiant(e)" }, { value: "OTHER", label: "Autre" }]} /></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field name="yearsAtJob" label="Années en poste" type="number" defaultValue={client?.yearsAtJob?.toString() ?? ""} /><Field name="annualIncome" label="Revenu annuel" type="number" defaultValue={client?.annualIncome?.toString() ?? client?.approximateIncome?.toString() ?? ""} /><SelectField name="incomeRange" label="Fourchette de revenu" defaultValue={client?.incomeRange ?? ""} options={[{ value: "", label: "À compléter" }, { value: "0-49999", label: "Moins de 50 000 $" }, { value: "50000-99999", label: "50 000 $ à 99 999 $" }, { value: "100000-149999", label: "100 000 $ à 149 999 $" }, { value: "150000-249999", label: "150 000 $ à 249 999 $" }, { value: "250000+", label: "250 000 $ et plus" }]} /></div>

        <SectionTitle>Profil financier et objectifs</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3"><SelectField name="profileType" label="Type de dossier" defaultValue={client?.profileType ?? "INDIVIDUAL"} options={[{ value: "INDIVIDUAL", label: "Personne physique" }, { value: "BUSINESS", label: "Entreprise / société" }, { value: "TRUST", label: "Fiducie" }, { value: "ESTATE", label: "Succession" }, { value: "HOUSEHOLD", label: "Ménage / famille" }, { value: "NON_PROFIT", label: "OBNL / association" }, { value: "OTHER", label: "Autre" }]} /><SelectField name="status" label="Statut client" defaultValue={client?.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Actif" }, { value: "REVIEW_NEEDED", label: "Révision requise" }, { value: "INACTIVE", label: "Inactif" }, { value: "PROSPECT_CONVERTED", label: "Prospect converti" }, { value: "ARCHIVED", label: "Archivé" }]} /><SelectField name="riskProfile" label="Profil de risque" defaultValue={client?.riskProfile ?? "UNKNOWN"} options={riskOptions.map(({ value, label }) => ({ value, label }))} /></div>
        <div className="grid gap-4 sm:grid-cols-4"><Field name="netWorth" label="Valeur nette" type="number" defaultValue={client?.netWorth?.toString() ?? ""} /><Field name="liquidAssets" label="Actifs liquides" type="number" defaultValue={client?.liquidAssets?.toString() ?? ""} /><Field name="liabilities" label="Dettes" type="number" defaultValue={client?.liabilities?.toString() ?? ""} /><Field name="savingsRate" label="Taux épargne %" type="number" defaultValue={client?.savingsRate?.toString() ?? ""} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><SelectField name="primaryGoal" label="Objectif financier principal" defaultValue={client?.primaryGoal ?? ""} options={financialGoalOptions} /><SelectField name="investmentHorizon" label="Horizon" defaultValue={client?.investmentHorizon ?? ""} options={[{ value: "", label: "À compléter" }, { value: "SHORT_TERM", label: "Court terme" }, { value: "MEDIUM_TERM", label: "Moyen terme" }, { value: "LONG_TERM", label: "Long terme" }]} /></div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Détails sur les objectifs financiers
          <textarea name="financialGoals" defaultValue={client?.financialGoals ?? client?.goals ?? ""} rows={4} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" placeholder="Ex.: protéger la famille, rembourser l'hypothèque, préparer la retraite, épargner pour les études, priorités et montants cibles." />
        </label>
        <SectionTitle>Relation et conformité</SectionTitle>
        <div className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-950">Préparation relation et conformité</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Cette section pilote la source du dossier, les dates de suivi, le statut du profil client, la vérification d’identité et le consentement.
              </p>
            </div>
            <StatusBadge tone={relationReadyCount === relationReadiness.length ? "emerald" : relationReadyCount >= 4 ? "amber" : "rose"}>
              {relationReadyCount}/{relationReadiness.length} prêts
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {relationReadiness.map((item) => (
              <ComplianceMiniCheck key={item.label} label={item.label} detail={item.detail} done={item.done} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField name="source" label="Origine du client" defaultValue={client?.source ?? ""} options={clientSourceOptions} />
          <Field name="referredBy" label="Référence / provenance précise" defaultValue={client?.referredBy ?? ""} placeholder="Nom du référent, campagne, événement ou note interne" />
          <Field name="relationshipStartDate" label="Début de la relation" type="date" defaultValue={client?.relationshipStartDate?.slice(0, 10) ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="lastContactAt" label="Dernier contact documenté" type="date" defaultValue={client?.lastContactAt?.slice(0, 10) ?? ""} />
          <Field name="nextReviewDate" label="Prochaine révision prévue" type="date" defaultValue={client?.nextReviewDate?.slice(0, 10) ?? ""} />
          <Field name="kycDate" label="Date de confirmation du profil client" type="date" defaultValue={client?.kycDate?.slice(0, 10) ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <SelectField name="kycCompleted" label="Profil client complété" defaultValue={client?.kycCompleted ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="identityVerified" label="Identité vérifiée" defaultValue={client?.identityVerified ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="consentGiven" label="Consentement actif" defaultValue={client?.consentGiven ? "true" : "false"} options={yesNoStatusOptions} />
          <SelectField name="complianceStatus" label="Statut de conformité" defaultValue={client?.complianceStatus ?? ""} options={complianceStatusOptions} />
        </div>

        <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Règle opérationnelle</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Une recommandation devrait être basée sur un profil client complété, une identité vérifiée lorsque requise, un consentement actif et une prochaine révision planifiée.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Notes internes<textarea name="notes" defaultValue={client?.notes ?? ""} rows={4} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label>
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel={client ? "Modifier" : "Créer"} />
      </form>
    </Modal>
  )
}

function SimpleTextModal({ title, textareaLabel, isSaving, onClose, onSave }: { title: string; textareaLabel: string; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string>) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({ title: String(data.get("title") ?? ""), content: String(data.get("content") ?? "") })
  }
  return <Modal title={title} onClose={onClose}><form onSubmit={submit} className="grid gap-5"><Field name="title" label="Titre" /><label className="grid gap-1.5 text-sm font-medium text-slate-700">{textareaLabel}<textarea name="content" rows={5} required className="min-h-32 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" /></label><ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Ajouter" /></form></Modal>
}

function TaskModal({ client, isSaving, onClose, onSave }: { client: ApiClient; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string>) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({ title: String(data.get("title") ?? ""), description: String(data.get("description") ?? ""), dueDate: String(data.get("dueDate") ?? ""), priority: String(data.get("priority") ?? "NORMAL"), status: "TODO" })
  }
  return <Modal title={`Créer une tâche - ${client.firstName} ${client.lastName}`} onClose={onClose}><form onSubmit={submit} className="grid gap-5"><Field name="title" label="Titre" required /><Field name="description" label="Description" /><div className="grid gap-4 sm:grid-cols-2"><Field name="dueDate" label="Échéance" type="date" /><SelectField name="priority" label="Priorité" defaultValue="NORMAL" options={[{ value: "LOW", label: "Basse" }, { value: "NORMAL", label: "Normale" }, { value: "HIGH", label: "Haute" }, { value: "URGENT", label: "Urgente" }]} /></div><ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Créer" /></form></Modal>
}

function DocumentModal({ isSaving, onClose, onSave }: { isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string>) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({ name: String(data.get("name") ?? ""), type: String(data.get("type") ?? "OTHER"), status: String(data.get("status") ?? "REQUIRED"), description: String(data.get("description") ?? "") })
  }
  return (
    <Modal title="Demander ou ajouter un document" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Marquez un document comme demandé au client, ou ajoutez-le comme reçu/validé si vous l&apos;avez déjà.
        </div>
        <Field name="name" label="Nom du document" required defaultValue="Document client" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="type" label="Type de document" defaultValue="KYC_FORM" options={[{ value: "KYC_FORM", label: "Formulaire profil client" }, { value: "GOVERNMENT_ID", label: "Pièce d’identité" }, { value: "PROPOSAL", label: "Proposition" }, { value: "POLICY_DOCUMENT", label: "Police / contrat" }, { value: "CONSENT_FORM", label: "Consentement" }, { value: "INVESTMENT_STATEMENT", label: "Relevé de placement" }, { value: "SIGNATURE_PAGE", label: "Signature" }, { value: "OTHER", label: "Autre" }]} />
          <SelectField name="status" label="Statut" defaultValue="REQUIRED" options={[{ value: "REQUIRED", label: "Requis" }, { value: "REQUESTED", label: "Demandé" }, { value: "RECEIVED", label: "Reçu" }, { value: "VALIDATED", label: "Validé" }, { value: "REJECTED", label: "Rejeté" }, { value: "EXPIRED", label: "Expiré" }]} />
        </div>
        <Field name="description" label="Description ou référence interne" />
        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Enregistrer le document" />
      </form>
    </Modal>
  )
}

function ProductModal({ client, isSaving, onClose, onSave }: { client: ApiClient; isSaving: boolean; onClose: () => void; onSave: (payload: Record<string, string>) => Promise<void> }) {
  const defaultReviewDate = useMemo(() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() + 1)
    return date.toISOString().slice(0, 10)
  }, [])
  const [category, setCategory] = useState("INSURANCE")
  const [status, setStatus] = useState("ACTIVE")
  const [localError, setLocalError] = useState<string | null>(null)
  const typeOptions = category === "INSURANCE"
    ? [
        { value: "LIFE_INSURANCE", label: "Assurance vie" },
        { value: "DISABILITY_INSURANCE", label: "Assurance invalidité" },
        { value: "CRITICAL_ILLNESS", label: "Maladie grave" },
        { value: "HEALTH_INSURANCE", label: "Assurance santé" },
        { value: "GROUP_INSURANCE", label: "Assurance collective" },
        { value: "LONG_TERM_CARE", label: "Soins longue durée" },
        { value: "TRAVEL_INSURANCE", label: "Assurance voyage" },
        { value: "OTHER_INSURANCE", label: "Autre assurance" },
      ]
    : category === "INVESTMENT"
      ? [
          { value: "RRSP", label: "REER" },
          { value: "TFSA", label: "CELI" },
          { value: "RESP", label: "REEE" },
          { value: "FHSA", label: "CELIAPP" },
          { value: "NON_REGISTERED", label: "Compte non enregistré" },
          { value: "MUTUAL_FUND", label: "Fonds commun" },
          { value: "SEGREGATED_FUND", label: "Fonds distinct" },
          { value: "GIC", label: "CPG" },
          { value: "ANNUITY", label: "Rente" },
          { value: "OTHER_INVESTMENT", label: "Autre placement" },
        ]
      : [{ value: "OTHER", label: "Autre produit" }]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, String(value)])) as Record<string, string>
    const hasIdentifier = [payload.productName, payload.company, payload.policyNumber, payload.contractNumber, payload.accountNumber].some((value) => value?.trim())
    if (!hasIdentifier) {
      setLocalError("Ajoutez au moins un nom de produit, une compagnie, un numéro de police, de contrat ou de compte.")
      return
    }
    setLocalError(null)
    await onSave(payload)
  }

  return (
    <Modal title={`Ajouter un produit - ${client.firstName} ${client.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <p className="font-semibold text-emerald-950">Produit existant ou nouvelle opportunité?</p>
          <p className="mt-1">
            Pour une police ou un compte déjà détenu, gardez le statut <strong>Actif</strong>. Pour une nouvelle recommandation, choisissez <strong>En attente</strong> ou <strong>Proposition en préparation</strong>; le CRM appliquera alors les validations KYC/conformité.
          </p>
        </div>

        <section className="grid gap-4">
          <SectionTitle>Identification</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Catégorie
              <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="INSURANCE">Assurance</option>
                <option value="INVESTMENT">Placement</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <SelectField key={category} name="type" label="Type de produit" defaultValue={typeOptions[0]?.value ?? "OTHER"} options={typeOptions} />
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Statut
              <select name="status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <option value="ACTIVE">Actif - déjà en vigueur</option>
                <option value="PENDING">En attente - recommandation</option>
                <option value="UNDER_REVIEW">Proposition en préparation</option>
                <option value="LAPSED">Échu</option>
                <option value="CANCELLED">Annulé</option>
                <option value="EXPIRED">Expiré</option>
                <option value="TRANSFERRED">Transféré</option>
              </select>
            </label>
          </div>
          {status !== "ACTIVE" ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900">
              Ce statut représente une recommandation ou une proposition. Si le profil client n’est pas prêt, l’ajout peut être bloqué ou mis en révision.
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="company" label="Compagnie ou institution" placeholder="Ex. Beneva, Manuvie, RBC" />
            <Field name="productName" label="Nom du produit" placeholder="Ex. Vie temporaire 20 ans, REER équilibré" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="policyNumber" label="No police" />
            <Field name="contractNumber" label="No contrat" />
            <Field name="accountNumber" label="No compte" />
          </div>
        </section>

        <section className="grid gap-4">
          <SectionTitle>{category === "INSURANCE" ? "Protection et prime" : category === "INVESTMENT" ? "Valeur et contribution" : "Montants"}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="premium" label="Prime" type="number" />
            <SelectField name="premiumFrequency" label="Fréquence prime" defaultValue="" options={frequencyOptions("À compléter")} />
            <Field name="coverageAmount" label="Couverture" type="number" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="accountValue" label="Valeur actuelle" type="number" />
            <Field name="contributionAmount" label="Contribution" type="number" />
            <SelectField name="contributionFrequency" label="Fréquence contribution" defaultValue="" options={frequencyOptions("À compléter")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="commissionAmount" label="Commission estimée" type="number" />
            <SelectField name="commissionType" label="Type commission" defaultValue="" options={[{ value: "", label: "À compléter" }, { value: "FIRST_YEAR", label: "Première année" }, { value: "RENEWAL", label: "Renouvellement" }, { value: "TRAILER", label: "Suivi" }, { value: "FLAT", label: "Forfaitaire" }, { value: "UNKNOWN", label: "Inconnue" }]} />
            <Field name="currency" label="Devise" defaultValue="CAD" />
          </div>
        </section>

        <section className="grid gap-4">
          <SectionTitle>Dates et suivi</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="effectiveDate" label="Entrée en vigueur" type="date" />
            <Field name="renewalAt" label="Renouvellement" type="date" />
            <Field name="nextReviewAt" label="Prochaine révision" type="date" defaultValue={defaultReviewDate} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="primaryBeneficiary" label="Bénéficiaire principal" />
            <Field name="contingentBeneficiary" label="Bénéficiaire subsidiaire" />
          </div>
          <TextArea name="notes" label="Notes produit" placeholder="Décision client, document reçu, particularité de la police ou du compte." />
        </section>

        {localError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{localError}</div> : null}

        <ModalActions isSaving={isSaving} onClose={onClose} submitLabel="Ajouter au portefeuille" />
      </form>
    </Modal>
  )
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-bold normal-case tracking-normal text-slate-700 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><option value="">Tous</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function SelectField({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: { value: string; label: string }[] }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<select name={name} defaultValue={defaultValue} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function TextArea({ name, label, defaultValue = "", placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={4} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
    </label>
  )
}

function frequencyOptions(emptyLabel: string) {
  return [
    { value: "", label: emptyLabel },
    { value: "WEEKLY", label: "Hebdomadaire" },
    { value: "BIWEEKLY", label: "Aux deux semaines" },
    { value: "MONTHLY", label: "Mensuelle" },
    { value: "QUARTERLY", label: "Trimestrielle" },
    { value: "SEMI_ANNUAL", label: "Semestrielle" },
    { value: "ANNUAL", label: "Annuelle" },
    { value: "ONE_TIME", label: "Paiement unique" },
    { value: "IRREGULAR", label: "Irrégulière" },
    { value: "UNKNOWN", label: "Inconnue" },
  ]
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0"><h3 className="text-sm font-semibold text-slate-950">{children}</h3></div>
}

function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  required,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  if (type === "date") {
    return <DateField name={name} label={label} defaultValue={defaultValue ?? ""} required={required} />
  }

  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<Input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} className="h-11 rounded-2xl" /></label>
}

function PhoneField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type="tel"
        inputMode="tel"
        pattern="(\\+?1\\s?)?\\(?[0-9]{3}\\)?[\\s.-]?[0-9]{3}[\\s.-]?[0-9]{4}"
        defaultValue={formatPhoneInput(defaultValue)}
        required={required}
        maxLength={17}
        onInput={(event) => {
          event.currentTarget.value = formatPhoneInput(event.currentTarget.value)
        }}
        className="h-11 rounded-2xl"
        placeholder="(438) 500-0678"
      />
      <span className="text-xs font-semibold text-slate-500">Format accepté : (438) 500-0678 ou +1 (438) 500-0678.</span>
    </label>
  )
}

function EmailField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type="email"
        inputMode="email"
        defaultValue={normalizeEmail(defaultValue)}
        required={required}
        className="h-11 rounded-2xl"
        placeholder="nom@exemple.ca"
        onBlur={(event) => {
          event.currentTarget.value = normalizeEmail(event.currentTarget.value)
        }}
      />
      <span className="text-xs font-semibold text-slate-500">Format requis : nom@domaine.ca.</span>
    </label>
  )
}

function DateField({ name, label, defaultValue = "", required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const inputId = useId()
  const today = new Date()
  const initialDate = defaultValue && isValidDateInput(defaultValue) ? new Date(`${defaultValue}T00:00:00`) : today
  const [value, setValue] = useState(defaultValue ?? "")
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const selectedDay = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getDate() : null
  const selectedMonth = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getMonth() : null
  const selectedYear = isValidDateInput(value) ? new Date(`${value}T00:00:00`).getFullYear() : null
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const calendarOffset = firstDay === 0 ? 6 : firstDay - 1
  const dayCount = daysInMonth(viewYear, viewMonth)
  const currentYear = today.getFullYear()
  const years = Array.from({ length: 131 }, (_, index) => currentYear + 20 - index)

  function handleManualChange(nextValue: string) {
    setValue(nextValue)
    if (isValidDateInput(nextValue)) {
      const date = new Date(`${nextValue}T00:00:00`)
      setViewYear(date.getFullYear())
      setViewMonth(date.getMonth())
    }
  }

  function selectDay(day: number) {
    setValue(buildDateValue(viewYear, viewMonth, day))
    setIsOpen(false)
  }

  function moveMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-JJ"
          pattern="\d{4}-\d{2}-\d{2}"
          value={value}
          onChange={(event) => handleManualChange(event.target.value)}
          required={required}
          className="h-11 rounded-2xl pl-10 pr-12"
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          aria-label={isOpen ? "Fermer le calendrier" : "Ouvrir le calendrier"}
          title={isOpen ? "Fermer le calendrier" : "Ouvrir le calendrier"}
        >
          <CalendarDays className="size-4" />
        </button>
      </div>
      {isOpen ? (
        <div className="relative z-50 mt-2 w-full min-w-[22rem] max-w-[24rem] rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.14)] max-sm:min-w-0 max-sm:max-w-full">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => moveMonth(-1)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50" aria-label="Mois précédent">‹</button>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <select value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
              </select>
              <select value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => moveMonth(1)} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50" aria-label="Mois suivant">›</button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`} className="grid h-7 place-items-center">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: calendarOffset }, (_, index) => <span key={`empty-${index}`} className="h-10" />)}
            {Array.from({ length: dayCount }, (_, index) => {
              const day = index + 1
              const isSelected = selectedDay === day && selectedMonth === viewMonth && selectedYear === viewYear
              return (
                <button key={day} type="button" onClick={() => selectDay(day)} className={isSelected ? "grid h-10 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white" : "grid h-10 place-items-center rounded-xl text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"}>
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => handleManualChange(buildDateValue(today.getFullYear(), today.getMonth(), today.getDate()))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Aujourd’hui</button>
            <button type="button" onClick={() => { setValue(""); setIsOpen(false) }} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Effacer</button>
          </div>
        </div>
      ) : null}
      <span className="text-xs font-normal leading-5 text-slate-500">Écrire la date ou utiliser le calendrier. Format : AAAA-MM-JJ.</span>
    </div>
  )
}

function ComplianceMiniCheck({ label, detail, done }: { label: string; detail: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white bg-white/80 p-3">
      <span className={done ? "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white" : "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700"}>
        {done ? "✓" : "!"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-950">{label}</span>
        <span className="block text-xs font-medium leading-5 text-slate-500">{detail}</span>
      </span>
    </div>
  )
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const meta = statusMeta(status)
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

function RiskProfileBadge({ risk }: { risk?: string | null }) {
  const meta = riskMeta(risk)
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

function PaginationControls({ meta, onPrevious, onNext }: { meta: Meta; onPrevious: () => void; onNext: () => void }) {
  const totalPages = Math.max(Math.ceil(meta.total / meta.pageSize), 1)
  return <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600"><span>Page {meta.page} / {totalPages} - {meta.total} clients</span><div className="flex gap-2"><Button variant="outline" className="rounded-2xl" disabled={meta.page <= 1} onClick={onPrevious}>Précédent</Button><Button variant="outline" className="rounded-2xl" disabled={meta.page >= totalPages} onClick={onNext}>Suivant</Button></div></div>
}

function Notice({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  return <div className={type === "success" ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"}>{children}</div>
}

function LoadingState({ label }: { label: string }) {
  return <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Loader2 className="size-4 animate-spin text-emerald-600" />{label}</div>{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />)}</div>
}

function StatePanel({ title, description, actionLabel, onAction }: { title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100"><Sparkles className="size-5" /></div><h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>{description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p> : null}{actionLabel ? <Button className="mt-5 rounded-2xl" variant="outline" onClick={onAction}>{actionLabel}</Button> : null}</div>
}

function ModalActions({ isSaving, onClose, submitLabel }: { isSaving: boolean; onClose: () => void; submitLabel: string }) {
  return <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>Annuler</Button><Button type="submit" className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>{isSaving ? "Sauvegarde..." : submitLabel}</Button></div>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}><div className="flex h-[min(94vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><Button type="button" variant="outline" className="h-9 rounded-2xl" onClick={onClose}>Fermer</Button></div><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div></div></div>
}

function ConfirmModal({ title, description, confirmLabel, isSaving, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; isSaving: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={onClose}><div className="w-full max-w-md rounded-[1.5rem] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]" onMouseDown={(event) => event.stopPropagation()}><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" className="rounded-2xl" onClick={onClose} disabled={isSaving}>Annuler</Button><Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void onConfirm()} disabled={isSaving}>{isSaving ? "Traitement..." : confirmLabel}</Button></div></div></div>
}
