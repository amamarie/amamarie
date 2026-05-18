"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Bot, CheckCircle2, Filter, Grid3X3, History, List, Loader2, PhoneCall, Play, Power, PowerOff, RefreshCcw, Search, Sparkles, Trash2, TriangleAlert, Wrench } from "lucide-react"

import { PageShell, StatusBadge } from "@/components/crm/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { automationTriggerLabels } from "@/lib/automation/triggers"

type AutomationRule = {
  id: string
  name: string
  description: string | null
  trigger: keyof typeof automationTriggerLabels
  conditions: unknown
  actions: unknown
  isActive: boolean
  runCount: number
  lastRunAt: string | null
  createdAt: string
  runs?: AutomationRun[]
}

type AutomationRun = {
  id: string
  status: string
  trigger: string
  startedAt: string
  completedAt: string | null
  error: string | null
  actionsExecuted: unknown
}

type AutomationTemplate = {
  id: string
  name: string
  description: string
  trigger: keyof typeof automationTriggerLabels
  actions: unknown
}

type ApiData = {
  rules: AutomationRule[]
  summary: {
    activeRules: number
    runsThisMonth: number
    failedRuns: number
    totalRules: number
  }
}

type AutomationTestResult = {
  evaluatedRules?: number
  matchedRules?: number
  executedRules?: number
  failedRules?: number
  actionsExecuted?: number
}

type AutomationView = "installed" | "active" | "inactive" | "available" | "errors"
type AutomationDisplayMode = "grid" | "list"

const automationViews: Array<{ id: AutomationView; label: string }> = [
  { id: "installed", label: "Installées" },
  { id: "active", label: "Actives" },
  { id: "inactive", label: "Inactives" },
  { id: "available", label: "Disponibles" },
  { id: "errors", label: "Erreurs" },
]

function formatDate(value: string | null) {
  if (!value) return "Jamais"
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function automationRunSteps(value: unknown): Array<{ step: string; status: string; detail?: string; at?: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === "string") return [{ step: item, status: "SUCCESS" }]
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    return [{
      step: String(record.step ?? "Étape"),
      status: String(record.status ?? "SUCCESS"),
      detail: typeof record.detail === "string" ? record.detail : undefined,
      at: typeof record.at === "string" ? record.at : undefined,
    }]
  })
}

async function readResponse(response: Response) {
  const json = await response.json()
  if (!response.ok || !json.ok) {
    throw new Error(json?.error?.message ?? "Action impossible.")
  }
  return json.data
}

export function AutomationsPage() {
  const [data, setData] = useState<ApiData | null>(null)
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<AutomationView>("installed")
  const [viewMode, setViewMode] = useState<AutomationDisplayMode>("grid")
  const [search, setSearch] = useState("")
  const [triggerFilter, setTriggerFilter] = useState("")
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null)
  const [historyRuns, setHistoryRuns] = useState<AutomationRun[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesData, templateData] = await Promise.all([
        readResponse(await fetch("/api/automations")),
        readResponse(await fetch("/api/automations/templates")),
      ])
      setData(rulesData)
      setTemplates(templateData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les automatisations.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const uniqueRules = useMemo(() => {
    const seen = new Set<string>()
    return (data?.rules ?? []).filter((rule) => {
      const key = rule.name.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [data?.rules])

  const rulesByTemplateName = useMemo(() => {
    return new Map(uniqueRules.map((rule) => [rule.name, rule]))
  }, [uniqueRules])

  const installedTemplateNames = useMemo(() => {
    return new Set(uniqueRules.map((rule) => rule.name.trim().toLowerCase()))
  }, [uniqueRules])

  const availableTemplates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return templates.filter((template) => {
      const isInstalled = installedTemplateNames.has(template.name.trim().toLowerCase())
      if (isInstalled) return false
      if (triggerFilter && template.trigger !== triggerFilter) return false
      if (!query) return true
      return `${template.name} ${template.description} ${automationTriggerLabels[template.trigger] ?? template.trigger}`.toLowerCase().includes(query)
    })
  }, [installedTemplateNames, search, templates, triggerFilter])

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rules = uniqueRules.filter((rule) => {
      if (view === "active" && !rule.isActive) return false
      if (view === "inactive" && rule.isActive) return false
      if (view === "errors" && !rule.runs?.some((run) => run.status === "FAILED")) return false
      if (triggerFilter && rule.trigger !== triggerFilter) return false
      if (!query) return true
      return `${rule.name} ${rule.description ?? ""} ${automationTriggerLabels[rule.trigger] ?? rule.trigger}`.toLowerCase().includes(query)
    })
    return rules
  }, [search, triggerFilter, uniqueRules, view])

  const activeRules = uniqueRules.filter((rule) => rule.isActive).length
  const inactiveRules = uniqueRules.length - activeRules
  const failedRules = uniqueRules.filter((rule) => rule.runs?.some((run) => run.status === "FAILED")).length
  const duplicateRuleCount = Math.max((data?.rules.length ?? 0) - uniqueRules.length, 0)
  const viewCounts = useMemo<Record<AutomationView, number>>(() => ({
    installed: uniqueRules.length,
    active: activeRules,
    inactive: inactiveRules,
    available: availableTemplates.length,
    errors: failedRules,
  }), [activeRules, availableTemplates.length, failedRules, inactiveRules, uniqueRules.length])

  const summaryCards = useMemo(() => {
    const summary = data?.summary
    return [
      { label: "Actives", value: String(activeRules), detail: "Suivis en fonction", icon: Bot, tone: "emerald" as const },
      { label: "Disponibles", value: String(availableTemplates.length), detail: "Modèles non installés", icon: Sparkles, tone: "sky" as const },
      { label: "Exécutions", value: String(summary?.runsThisMonth ?? 0), detail: "Ce mois-ci", icon: Play, tone: "violet" as const },
      { label: "Erreurs", value: String(summary?.failedRuns ?? 0), detail: failedRules ? `${failedRules} règle(s) touchée(s)` : "Aucune règle en échec", icon: TriangleAlert, tone: "rose" as const },
      { label: "À vérifier", value: String(failedRules + duplicateRuleCount), detail: duplicateRuleCount ? "Règles similaires détectées" : "Surveillance normale", icon: Wrench, tone: "amber" as const },
    ]
  }, [activeRules, availableTemplates.length, data?.summary, duplicateRuleCount, failedRules])

  const toggleRule = async (rule: AutomationRule) => {
    setSavingId(rule.id)
    setError(null)
    setMessage(null)
    try {
      await readResponse(await fetch(`/api/automations/${rule.id}/${rule.isActive ? "disable" : "enable"}`, { method: "PATCH" }))
      setMessage(rule.isActive ? "Automatisation désactivée." : "Automatisation activée.")
      await load()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Action impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const toggleTemplate = async (template: AutomationTemplate) => {
    const existing = rulesByTemplateName.get(template.name)
    if (existing) {
      await toggleRule(existing)
      return
    }

    setSavingId(template.id)
    setError(null)
    setMessage(null)
    try {
      await readResponse(await fetch(`/api/automations/templates/${template.id}/install`, { method: "POST" }))
      setMessage("Automatisation activée.")
      await load()
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "Installation impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const installDefaults = async () => {
    setSavingId("defaults")
    setError(null)
    setMessage(null)
    try {
      const result = await readResponse(await fetch("/api/automations/defaults/install", { method: "POST" }))
      setMessage(
        result.created > 0
          ? `${result.created} automatisation(s) installée(s).`
          : result.updated > 0
            ? `${result.updated} automatisation(s) synchronisée(s).`
            : "Les automatisations par défaut sont déjà installées."
      )
      await load()
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "Installation impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const syncInboundCallN8n = async () => {
    setSavingId("n8n-inbound-call-sync")
    setError(null)
    setMessage(null)
    try {
      await readResponse(await fetch("/api/automations/n8n/inbound-call/sync", { method: "POST" }))
      setMessage("Workflow n8n de réception d’appel synchronisé.")
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Synchronisation n8n impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const syncRetellAssuranceN8n = async () => {
    setSavingId("n8n-retell-assurance-sync")
    setError(null)
    setMessage(null)
    try {
      await readResponse(await fetch("/api/automations/n8n/retell-assurance/sync", { method: "POST" }))
      setMessage("Workflow n8n RetellAI assurance synchronisé.")
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Synchronisation RetellAI n8n impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const testInboundCallN8n = async () => {
    setSavingId("n8n-inbound-call-test")
    setError(null)
    setMessage(null)
    try {
      const result = await readResponse(await fetch("/api/automations/n8n/inbound-call/test", { method: "POST" })) as {
        automation?: AutomationTestResult
        tasks?: Array<{ id: string }>
      }
      setMessage(
        result.automation?.executedRules
          ? `Test appel n8n exécuté: ${result.automation.actionsExecuted ?? 0} action(s), ${result.tasks?.length ?? 0} tâche(s).`
          : "Test appel créé, mais aucune règle n’a été exécutée. Installez les règles par défaut ou activez la règle d’appel."
      )
      await load()
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Test appel n8n impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const testRule = async (rule: AutomationRule) => {
    setSavingId(`test-${rule.id}`)
    setError(null)
    setMessage(null)
    try {
      const result = await readResponse(
        await fetch(`/api/automations/${rule.id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: { title: "Test automatisation" } }),
        })
      ) as AutomationTestResult
      setMessage(
        result.executedRules
          ? `Test exécuté: ${result.actionsExecuted ?? 0} action(s), ${result.executedRules} règle(s).`
          : "Test terminé, mais aucune action n’a été exécutée. Vérifiez que la règle est active."
      )
      await load()
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Test impossible.")
    } finally {
      setSavingId(null)
    }
  }

  const openHistory = async (rule: AutomationRule) => {
    setHistoryRule(rule)
    setHistoryRuns([])
    setHistoryError(null)
    setHistoryLoading(true)
    try {
      const runs = await readResponse(await fetch(`/api/automations/${rule.id}/runs`)) as AutomationRun[]
      setHistoryRuns(runs)
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "Impossible de charger l’historique.")
    } finally {
      setHistoryLoading(false)
    }
  }

  const deleteRule = async (rule: AutomationRule) => {
    const confirmed = window.confirm(`Supprimer l’automatisation « ${rule.name} »? Les anciennes activités CRM restent conservées.`)
    if (!confirmed) return
    setSavingId(`delete-${rule.id}`)
    setError(null)
    setMessage(null)
    try {
      await readResponse(await fetch(`/api/automations/${rule.id}`, { method: "DELETE" }))
      setMessage("Automatisation supprimée.")
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <PageShell eyebrow="Automatisations" title="Centre d’automatisation" description="Pilotez les suivis automatiques, les règles actives et les modèles disponibles." showIntro={false}>
      <div className="w-full min-w-0 max-w-full space-y-5 overflow-hidden">
        {message ? <Notice tone="emerald">{message}</Notice> : null}
        {error ? <Notice tone="rose">{error}</Notice> : null}

        <section className="w-full min-w-0 overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
          <div className="border-b-2 border-emerald-100 bg-white p-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_300px] xl:items-stretch">
              <div className="rounded-[1.75rem] border-2 border-emerald-200 bg-emerald-500 p-5 text-white shadow-[0_8px_0_#16a34a]">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Automatisations CRM</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight">Règles installées et modèles disponibles</h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
                  Une automatisation installée apparaît seulement dans les règles actives ou inactives. Les modèles disponibles excluent les règles déjà installées pour éviter les doublons.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Prospects", "Clients", "Documents", "Tâches", "Conformité"].map((step) => (
                    <span key={step} className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-black text-white">
                      {step}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => { void load() }} disabled={loading}>
                    <RefreshCcw className="size-4" />Rafraîchir
                  </Button>
                  <Button className="rounded-full bg-slate-950 px-5 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={() => void installDefaults()} disabled={savingId === "defaults"}>
                    {savingId === "defaults" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Installer les règles par défaut
                  </Button>
                  <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void syncInboundCallN8n()} disabled={savingId === "n8n-inbound-call-sync"}>
                    {savingId === "n8n-inbound-call-sync" ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
                    Sync appel n8n
                  </Button>
                  <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void syncRetellAssuranceN8n()} disabled={savingId === "n8n-retell-assurance-sync"}>
                    {savingId === "n8n-retell-assurance-sync" ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                    Sync RetellAI
                  </Button>
                  <Button variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={() => void testInboundCallN8n()} disabled={savingId === "n8n-inbound-call-test"}>
                    {savingId === "n8n-inbound-call-test" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Tester appel
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_8px_0_#e2e8f0]">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">État opérationnel</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{activeRules}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">automatisation(s) active(s) dans le CRM.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
                  <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-600">{inactiveRules} inactive(s)</span>
                  <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-600">{availableTemplates.length} modèle(s)</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                  Les règles sont exécutées côté serveur et restent liées aux tâches, documents et activités CRM.
                </p>
              </div>
            </div>

            <AutomationMetricStrip metrics={summaryCards} />
          </div>

          <div className="min-h-[640px] min-w-0 p-5">
            <section className="rounded-[1.75rem] border-2 border-slate-200 bg-slate-50 p-4 shadow-[0_6px_0_#e2e8f0]">
              <div className="grid gap-4 2xl:grid-cols-[minmax(220px,320px)_1fr] 2xl:items-start">
                <div className="min-w-0 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vue actuelle</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-xl font-black text-slate-950">{automationViews.find((item) => item.id === view)?.label ?? "Automatisations"}</p>
                    <span className="rounded-full border-2 border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                      {view === "available" ? availableTemplates.length : filteredRules.length} résultat(s)
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    La vue contrôle l’affichage. Les modèles installés sont exclus de “Disponibles”.
                  </p>
                  <div className="mt-4 inline-flex rounded-full border-2 border-slate-200 bg-slate-50 p-1">
                    <AutomationModeButton active={viewMode === "grid"} label="Grille" icon={Grid3X3} onClick={() => setViewMode("grid")} />
                    <AutomationModeButton active={viewMode === "list"} label="Ligne" icon={List} onClick={() => setViewMode("list")} />
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_auto]">
                    <label className="relative min-w-0">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une automatisation..." className="h-11 rounded-full border-2 bg-white pl-11 font-semibold" />
                    </label>
                    <select
                      value={triggerFilter}
                      onChange={(event) => setTriggerFilter(event.target.value)}
                      className="h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label="Filtrer par déclencheur"
                    >
                      <option value="">Tous déclencheurs</option>
                      {Object.entries(automationTriggerLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Button variant="outline" className="h-11 rounded-full border-2 bg-white px-4 font-black" onClick={() => { setSearch(""); setTriggerFilter("") }}>
                      <Filter className="size-4" />Réinitialiser
                    </Button>
                  </div>

                  <div className="max-w-full overflow-x-auto rounded-full border-2 border-slate-200 bg-white p-1">
                    <div className="flex min-w-max gap-1">
                      {automationViews.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={
                            view === item.id
                              ? "h-10 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-[0_4px_0_#020617]"
                              : "h-10 rounded-full px-4 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                          }
                          onClick={() => setView(item.id)}
                        >
                          <span>{item.label}</span>
                          <span className={view === item.id ? "ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px]" : "ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500"}>
                            {viewCounts[item.id]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {loading ? <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-8 text-sm font-bold text-slate-500">Chargement des automatisations...</div> : null}

            {!loading && view === "available" ? (
              availableTemplates.length === 0 ? (
                <StatePanel title="Aucun modèle disponible" description="Tous les modèles standards sont déjà installés ou le filtre ne retourne aucun résultat." />
              ) : (
                <div className={viewMode === "grid" ? "mt-6 grid min-w-0 gap-3 xl:grid-cols-2" : "mt-6 max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"}>
                  {availableTemplates.map((template) => (
                    <AutomationTemplateCard key={template.id} template={template} displayMode={viewMode} isSaving={savingId === template.id} onInstall={toggleTemplate} />
                  ))}
                </div>
              )
            ) : null}

            {!loading && view !== "available" ? (
              filteredRules.length === 0 ? (
                <StatePanel title="Aucune règle à afficher" description="Changez de vue, réinitialisez la recherche ou installez les règles par défaut." />
              ) : (
                <div className={viewMode === "grid" ? "mt-6 grid min-w-0 gap-3 xl:grid-cols-2" : "mt-6 max-w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"}>
                  {filteredRules.map((rule) => (
                    <AutomationRuleCard key={rule.id} rule={rule} displayMode={viewMode} savingId={savingId} onTest={testRule} onToggle={toggleRule} onHistory={openHistory} onDelete={deleteRule} />
                  ))}
                </div>
              )
            ) : null}
          </div>
        </section>
      </div>
      {historyRule ? (
        <HistoryModal
          rule={historyRule}
          runs={historyRuns}
          isLoading={historyLoading}
          error={historyError}
          onClose={() => {
            setHistoryRule(null)
            setHistoryRuns([])
            setHistoryError(null)
          }}
        />
      ) : null}
    </PageShell>
  )
}

function AutomationModeButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-black text-emerald-700 shadow-sm"
          : "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-black text-slate-500 transition hover:text-slate-950"
      }
      aria-pressed={active}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

function AutomationMetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; detail: string; icon: LucideIcon; tone?: "emerald" | "sky" | "violet" | "amber" | "rose" }> }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-[0_6px_0_#86efac]",
    sky: "bg-sky-50 text-sky-800 border-sky-200 shadow-[0_6px_0_#bae6fd]",
    violet: "bg-violet-50 text-violet-800 border-violet-200 shadow-[0_6px_0_#ddd6fe]",
    amber: "bg-amber-50 text-amber-800 border-amber-200 shadow-[0_6px_0_#fde68a]",
    rose: "bg-rose-50 text-rose-800 border-rose-200 shadow-[0_6px_0_#fecdd3]",
  }

  return (
    <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <div key={metric.label} className={`rounded-[1.5rem] border-2 p-4 ${tones[metric.tone ?? "emerald"]}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-black">{metric.label}</p>
              <Icon className="size-5 shrink-0" />
            </div>
            <p className="mt-3 text-3xl font-black">{metric.value}</p>
            <p className="mt-1 truncate text-xs font-bold opacity-80">{metric.detail}</p>
          </div>
        )
      })}
    </section>
  )
}

function AutomationRuleCard({
  rule,
  displayMode,
  savingId,
  onTest,
  onToggle,
  onHistory,
  onDelete,
}: {
  rule: AutomationRule
  displayMode: AutomationDisplayMode
  savingId: string | null
  onTest: (rule: AutomationRule) => void
  onToggle: (rule: AutomationRule) => void
  onHistory: (rule: AutomationRule) => void
  onDelete: (rule: AutomationRule) => void
}) {
  const hasFailedRun = rule.runs?.some((run) => run.status === "FAILED")
  const failedRun = rule.runs?.find((run) => run.status === "FAILED")

  if (displayMode === "list") {
    return (
      <article className="grid min-w-0 gap-3 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50 xl:grid-cols-[minmax(280px,1fr)_minmax(180px,240px)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={rule.isActive ? "emerald" : "slate"}>{rule.isActive ? "Active" : "Inactive"}</StatusBadge>
            {hasFailedRun ? <StatusBadge tone="rose">Erreur récente</StatusBadge> : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-black text-slate-950">{rule.name}</h3>
          {rule.description ? <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{rule.description}</p> : null}
        </div>

        <div className="min-w-0 text-xs font-semibold leading-5 text-slate-500">
          <p className="truncate">Déclencheur: {automationTriggerLabels[rule.trigger] ?? rule.trigger}</p>
          <p className="truncate">Exécutions: {rule.runCount}</p>
          <p className="truncate">Dernière: {formatDate(rule.lastRunAt)}</p>
          {failedRun?.error ? <p className="truncate text-rose-700">Erreur: {failedRun.error}</p> : null}
        </div>

        <AutomationRuleActions rule={rule} savingId={savingId} onTest={onTest} onToggle={onToggle} onHistory={onHistory} onDelete={onDelete} compact />
      </article>
    )
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-h-full flex-col gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={rule.isActive ? "emerald" : "slate"}>{rule.isActive ? "Active" : "Inactive"}</StatusBadge>
            <StatusBadge tone={hasFailedRun ? "rose" : "sky"}>{automationTriggerLabels[rule.trigger] ?? rule.trigger}</StatusBadge>
            {hasFailedRun ? <StatusBadge tone="rose">Erreur récente</StatusBadge> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-black leading-5 text-slate-950">{rule.name}</h3>
          {rule.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{rule.description}</p> : null}
          <div className="mt-4 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500 sm:grid-cols-2">
            <span className="truncate">{rule.runCount} exécution(s)</span>
            <span className="truncate">Dernière: {formatDate(rule.lastRunAt)}</span>
            <span className="truncate">Créée: {formatDate(rule.createdAt)}</span>
            <span className="truncate">{rule.runs?.length ?? 0} historique(s) récent(s)</span>
          </div>
        </div>

        {rule.runs?.length ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Dernières exécutions</p>
            <div className="mt-2 space-y-2">
              {rule.runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                  <span className={run.status === "SUCCESS" ? "text-emerald-700" : run.status === "FAILED" ? "text-rose-700" : "text-slate-700"}>{run.status}</span>
                  <span className="truncate">{formatDate(run.startedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {failedRun?.error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800">
            <p className="font-black uppercase tracking-wide">Erreur à vérifier</p>
            <p className="mt-1 line-clamp-3">{failedRun.error}</p>
          </div>
        ) : null}

        <AutomationRuleActions rule={rule} savingId={savingId} onTest={onTest} onToggle={onToggle} onHistory={onHistory} onDelete={onDelete} />
      </div>
    </article>
  )
}

function AutomationRuleActions({
  rule,
  savingId,
  compact = false,
  onTest,
  onToggle,
  onHistory,
  onDelete,
}: {
  rule: AutomationRule
  savingId: string | null
  compact?: boolean
  onTest: (rule: AutomationRule) => void
  onToggle: (rule: AutomationRule) => void
  onHistory: (rule: AutomationRule) => void
  onDelete: (rule: AutomationRule) => void
}) {
  const buttonClass = compact ? "h-8 rounded-xl px-2 text-xs" : "rounded-xl"

  return (
    <div className="flex flex-wrap gap-2 xl:justify-end">
      <Button size="sm" variant="outline" className={buttonClass} onClick={() => onTest(rule)} disabled={savingId === `test-${rule.id}`}>
        {savingId === `test-${rule.id}` ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        Tester
      </Button>
      <Button size="sm" variant="outline" className={buttonClass} onClick={() => onToggle(rule)} disabled={savingId === rule.id}>
        {savingId === rule.id ? <Loader2 className="size-4 animate-spin" /> : rule.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
        {rule.isActive ? "Désactiver" : "Activer"}
      </Button>
      <Button size="sm" variant="outline" className={buttonClass} onClick={() => onHistory(rule)} disabled={Boolean(savingId)}>
        <History className="size-4" />
        Historique
      </Button>
      <Button size="sm" variant="outline" className={`${buttonClass} border-rose-200 text-rose-700 hover:bg-rose-50`} onClick={() => onDelete(rule)} disabled={savingId === `delete-${rule.id}`}>
        {savingId === `delete-${rule.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Supprimer
      </Button>
    </div>
  )
}

function AutomationTemplateCard({
  template,
  displayMode,
  isSaving,
  onInstall,
}: {
  template: AutomationTemplate
  displayMode: AutomationDisplayMode
  isSaving: boolean
  onInstall: (template: AutomationTemplate) => void
}) {
  if (displayMode === "list") {
    return (
      <article className="grid min-w-0 gap-3 border-b border-slate-100 p-4 transition last:border-b-0 hover:bg-slate-50 xl:grid-cols-[minmax(280px,1fr)_minmax(180px,240px)_auto] xl:items-center">
        <div className="min-w-0">
          <StatusBadge tone="sky">Disponible</StatusBadge>
          <h3 className="mt-2 truncate text-sm font-black text-slate-950">{template.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{template.description}</p>
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">Déclencheur: {automationTriggerLabels[template.trigger] ?? template.trigger}</p>
        <div className="flex justify-end">
          <Button size="sm" className="h-8 rounded-xl bg-emerald-600 px-2 text-xs hover:bg-emerald-700" onClick={() => onInstall(template)} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Installer
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-h-full flex-col gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="sky">Disponible</StatusBadge>
            <StatusBadge tone="slate">{automationTriggerLabels[template.trigger] ?? template.trigger}</StatusBadge>
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-black leading-5 text-slate-950">{template.name}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-slate-600">{template.description}</p>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => onInstall(template)} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Installer
          </Button>
        </div>
      </div>
    </article>
  )
}

function Notice({ tone, children }: { tone: "emerald" | "rose"; children: React.ReactNode }) {
  return (
    <div className={tone === "emerald" ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"}>
      {children}
    </div>
  )
}

function StatePanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
        <Bot className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  )
}

function HistoryModal({
  rule,
  runs,
  isLoading,
  error,
  onClose,
}: {
  rule: AutomationRule
  runs: AutomationRun[]
  isLoading: boolean
  error: string | null
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Historique ${rule.name}`}>
      <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Historique d’automatisation</p>
              <h2 className="mt-1 truncate text-xl font-black text-slate-950">{rule.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Jusqu’aux 100 dernières exécutions enregistrées.</p>
            </div>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>Fermer</Button>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-500">
              <Loader2 className="size-4 animate-spin text-emerald-600" />
              Chargement de l’historique...
            </div>
          ) : null}

          {error ? <Notice tone="rose">{error}</Notice> : null}

          {!isLoading && !error && runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              Aucune exécution enregistrée pour cette automatisation.
            </div>
          ) : null}

          {!isLoading && !error && runs.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {runs.map((run) => (
                <div key={run.id} className="border-b border-slate-100 p-4 last:border-b-0">
                  <div className="grid gap-3 md:grid-cols-[140px_1fr_170px] md:items-center">
                    <StatusBadge tone={run.status === "SUCCESS" ? "emerald" : run.status === "FAILED" ? "rose" : "slate"}>{run.status}</StatusBadge>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-bold text-slate-950">{automationTriggerLabels[run.trigger as keyof typeof automationTriggerLabels] ?? run.trigger}</p>
                      {run.error ? <p className="mt-1 line-clamp-2 text-xs font-semibold text-rose-700">{run.error}</p> : <p className="mt-1 text-xs font-semibold text-slate-500">Exécution sans erreur enregistrée.</p>}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 md:text-right">{formatDate(run.startedAt)}</p>
                  </div>
                  {automationRunSteps(run.actionsExecuted).length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {automationRunSteps(run.actionsExecuted).map((step, index) => (
                        <div key={`${run.id}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-black uppercase tracking-wide text-slate-500">{step.step}</p>
                            <StatusBadge tone={step.status === "FAILED" ? "rose" : "emerald"}>{step.status}</StatusBadge>
                          </div>
                          {step.detail ? <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600">{step.detail}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
