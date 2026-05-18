"use client"

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Flame,
  GitBranch,
  Gauge,
  Library,
  Link2,
  LayoutDashboard,
  LockKeyhole,
  Loader2,
  Mail,
  MessageSquare,
  MousePointerClick,
  PenLine,
  PhoneCall,
  Rocket,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Segment = {
  id: string
  name: string
  description?: string | null
  estimatedCount: number
  status: string
}

type Template = {
  id: string
  name: string
  subject?: string | null
  body: string
  channel: string
  validationStatus: string
}

type Campaign = {
  id: string
  name: string
  objective: string
  channel: string
  status: string
  validationStatus: string
  scheduledAt?: string | null
  sentAt?: string | null
  stats?: Record<string, number> | null
  segment?: Segment | null
  template?: Template | null
  _count?: { sends: number }
}

type Sequence = {
  id: string
  name: string
  description?: string | null
  trigger: string
  status: string
  steps: Array<{ id: string; position: number; delayDays: number; actionType: string }>
  _count?: { enrollments: number }
}

type LeadScore = {
  id: string
  email: string
  name?: string | null
  score: number
  status: string
  signals?: string[] | null
}

type Overview = {
  segments: Segment[]
  templates: Template[]
  campaigns: Campaign[]
  sequences: Sequence[]
  leadScores: LeadScore[]
  stats: {
    campaigns: number
    segments: number
    templates: number
    sent: number
    opened: number
    clicked: number
    booked: number
    opportunities: number
    skipped: number
    failed: number
    bounced: number
    complained: number
    unsubscribes: number
    activeEnrollments: number
    hotProspects: number
  }
}

type WorkspaceTab = "launch" | "creator" | "sequences" | "channels" | "governance" | "reports" | "leads"
type LaunchStep = 1 | 2 | 3
type CampaignGoalId = "retirement" | "quote" | "inactive" | "documents"
type PlaybookGoal = "RETIREMENT_REVIEW" | "QUOTE_FOLLOW_UP" | "INACTIVE_CLIENTS" | "MISSING_DOCUMENTS"

type PlaybookResult = {
  goal: PlaybookGoal
  enrollment: { enrolled: number; skipped: number }
  leadForm: { id: string; name: string; slug: string; publicUrl: string }
  bookingUrl: string
  nextSteps: string[]
}

async function readData<T>(response: Response) {
  const payload = await response.json() as { ok: boolean; data?: T; error?: { message?: string } }
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Action impossible.")
  return payload.data as T
}

const presetLabels = {
  ALL_CONSENTED: "Contacts consentants",
  RETIREMENT: "Retraite 45-65 ans",
  INACTIVE_CLIENTS: "Clients inactifs 12 mois",
  PROSPECTS: "Prospects formulaire",
  MISSING_DOCUMENTS: "Documents manquants",
  CUSTOM: "Personnalisé",
}

const tabItems: Array<{ id: WorkspaceTab; label: string; icon: LucideIcon }> = [
  { id: "launch", label: "Démarrer", icon: Sparkles },
  { id: "creator", label: "Créateur", icon: PenLine },
  { id: "sequences", label: "Séquences", icon: Workflow },
  { id: "channels", label: "Canaux", icon: MessageSquare },
  { id: "governance", label: "Conformité", icon: ShieldCheck },
  { id: "reports", label: "ROI", icon: BarChart3 },
  { id: "leads", label: "Prospects chauds", icon: Flame },
]

const campaignWizardSteps = [
  { label: "Objectif", detail: "Choisir le résultat métier", icon: Rocket },
  { label: "Segment", detail: "Cibler les contacts consentants", icon: UsersRound },
  { label: "Canal", detail: "Email, SMS, WhatsApp ou LinkedIn", icon: Send },
  { label: "Contenu", detail: "Template, IA, variables et aperçu", icon: PenLine },
  { label: "Conformité", detail: "Consentement, désinscription, validation", icon: ShieldCheck },
  { label: "Planification", detail: "Date, heure, fuseau, pression marketing", icon: CalendarClock },
  { label: "Suivi", detail: "Ouvertures, clics, RDV, opportunités", icon: BarChart3 },
]

const campaignGoals: Array<{
  id: CampaignGoalId
  playbookGoal: PlaybookGoal
  label: string
  detail: string
  preset: keyof typeof presetLabels
  minAge: number
  maxAge: number
  segmentName: string
  templateName: string
  campaignName: string
  objective: string
  subject: string
  body: string
  ctaPlaceholder: string
}> = [
  {
    id: "retirement",
    playbookGoal: "RETIREMENT_REVIEW",
    label: "Bilan retraite",
    detail: "Proposer un rendez-vous aux clients avec objectif retraite.",
    preset: "RETIREMENT",
    minAge: 45,
    maxAge: 65,
    segmentName: "Clients retraite consentants",
    templateName: "Email bilan retraite",
    campaignName: "Campagne bilan retraite",
    objective: "Générer des rendez-vous",
    subject: "Et si nous faisions le point sur votre retraite ?",
    body: `Bonjour {{first_name}},

Je vous propose de faire un point simple sur votre situation retraite, vos objectifs et les solutions déjà en place.

Vous pouvez réserver un créneau ici :
{{booking_link}}

Si vous ne souhaitez plus recevoir ces communications, vous pouvez vous désinscrire ici :
{{unsubscribe_link}}

Bien cordialement,`,
    ctaPlaceholder: "Lien de réservation bilan retraite",
  },
  {
    id: "quote",
    playbookGoal: "QUOTE_FOLLOW_UP",
    label: "Relance devis",
    detail: "Relancer les opportunités ouvertes sans réponse.",
    preset: "PROSPECTS",
    minAge: 18,
    maxAge: 75,
    segmentName: "Prospects à relancer",
    templateName: "Email relance devis",
    campaignName: "Campagne relance devis",
    objective: "Relancer des prospects",
    subject: "Avez-vous pu regarder notre proposition ?",
    body: `Bonjour {{first_name}},

Je me permets de revenir vers vous concernant notre dernier échange.

Si vous souhaitez faire le point ou poser vos questions, vous pouvez choisir un créneau ici :
{{booking_link}}

Vous pouvez gérer vos préférences ici :
{{unsubscribe_link}}

Bien cordialement,`,
    ctaPlaceholder: "Lien de prise de rendez-vous",
  },
  {
    id: "inactive",
    playbookGoal: "INACTIVE_CLIENTS",
    label: "Clients inactifs",
    detail: "Reprendre contact avec les clients sans échange récent.",
    preset: "INACTIVE_CLIENTS",
    minAge: 18,
    maxAge: 85,
    segmentName: "Clients sans contact récent",
    templateName: "Email bilan annuel",
    campaignName: "Campagne clients inactifs",
    objective: "Réactiver des clients inactifs",
    subject: "Et si nous faisions un point annuel ?",
    body: `Bonjour {{first_name}},

Cela fait quelque temps que nous n’avons pas fait le point ensemble.

Je vous propose un échange simple pour vérifier que votre situation, vos objectifs et vos contrats sont toujours à jour.

Réserver un créneau :
{{booking_link}}

Gérer vos préférences :
{{unsubscribe_link}}

Bien cordialement,`,
    ctaPlaceholder: "Lien calendrier bilan annuel",
  },
  {
    id: "documents",
    playbookGoal: "MISSING_DOCUMENTS",
    label: "Documents manquants",
    detail: "Demander les pièces nécessaires aux dossiers incomplets.",
    preset: "MISSING_DOCUMENTS",
    minAge: 18,
    maxAge: 90,
    segmentName: "Dossiers avec documents manquants",
    templateName: "Email document manquant",
    campaignName: "Campagne documents manquants",
    objective: "Demander des documents",
    subject: "Document à compléter pour votre dossier",
    body: `Bonjour {{first_name}},

Il nous manque encore un élément pour compléter votre dossier.

Vous pouvez déposer ou transmettre le document via le lien sécurisé prévu à cet effet.

Pour gérer vos préférences de communication :
{{unsubscribe_link}}

Bien cordialement,`,
    ctaPlaceholder: "Lien sécurisé de dépôt document",
  },
]

const defaultEmail = `Bonjour {{first_name}},

Je vous propose de faire un point simple sur votre situation et vos objectifs.

Vous pouvez réserver un créneau ici :
{{booking_link}}

Si vous ne souhaitez plus recevoir ces communications, vous pouvez vous désinscrire ici :
{{unsubscribe_link}}

Bien cordialement,`

export function MarketingAutomationWorkspace() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof presetLabels>("RETIREMENT")
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("launch")
  const [launchStep, setLaunchStep] = useState<LaunchStep>(1)
  const [selectedGoalId, setSelectedGoalId] = useState<CampaignGoalId>("retirement")
  const [playbookResult, setPlaybookResult] = useState<PlaybookResult | null>(null)

  const selectedTemplate = useMemo(() => overview?.templates[0], [overview])
  const selectedSegment = useMemo(() => overview?.segments[0], [overview])
  const selectedGoal = useMemo(() => campaignGoals.find((goal) => goal.id === selectedGoalId) ?? campaignGoals[0], [selectedGoalId])

  async function loadOverview() {
    setIsLoading(true)
    try {
      setOverview(await readData<Overview>(await fetch("/api/marketing/overview", { cache: "no-store" })))
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger le marketing." })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function submitJson<T>(url: string, body: unknown, success: string) {
    setIsSaving(true)
    setNotice(null)
    try {
      const result = await readData<T>(await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }))
      setNotice({ type: "success", message: success })
      await loadOverview()
      return result
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Action impossible." })
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function createPlaybook(goal: PlaybookGoal) {
    setIsSaving(true)
    setNotice(null)
    try {
      const result = await readData<PlaybookResult>(await fetch("/api/marketing/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      }))
      setPlaybookResult(result)
      setNotice({
        type: "success",
        message: `Tunnel créé: formulaire public, campagne, séquence et ${result.enrollment.enrolled} contact(s) inscrit(s).`,
      })
      await loadOverview()
      setActiveTab("creator")
      return result
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Impossible de créer le tunnel automatique." })
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function createSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const result = await submitJson<Segment>("/api/marketing/segments", {
      name: String(formData.get("name") ?? ""),
      description: "Segment créé depuis l’assistant marketing.",
      preset: selectedPreset,
      minAge: Number(formData.get("minAge") ?? 45),
      maxAge: Number(formData.get("maxAge") ?? 65),
      requireConsent: true,
    }, "Segment créé avec contacts autorisés.")
    if (result) setLaunchStep(2)
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const result = await submitJson<Template>("/api/marketing/templates", {
      name: String(formData.get("name") ?? ""),
      category: "Retraite",
      channel: "EMAIL",
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      sensitive: formData.get("sensitive") === "on",
    }, "Message enregistré avec contrôle conformité.")
    if (result) setLaunchStep(3)
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const result = await submitJson<Campaign>("/api/marketing/campaigns", {
      name: String(formData.get("name") ?? ""),
      objective: String(formData.get("objective") ?? ""),
      channel: "EMAIL",
      segmentId: String(formData.get("segmentId") ?? ""),
      templateId: String(formData.get("templateId") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      ctaUrl: String(formData.get("ctaUrl") ?? ""),
      requestValidation: formData.get("requestValidation") === "on",
    }, "Campagne prête dans votre liste.")
    if (result) setActiveTab("creator")
  }

  async function sendCampaign(campaignId: string) {
    await submitJson(`/api/marketing/campaigns/${campaignId}/send`, {}, "Envoi lancé avec exclusions et consentements tracés.")
  }

  async function approveCampaign(campaignId: string) {
    await submitJson(`/api/marketing/campaigns/${campaignId}/approve`, {}, "Campagne validée.")
  }

  async function createSequence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await submitJson<Sequence>("/api/marketing/sequences", {
      name: String(formData.get("name") ?? ""),
      description: "Séquence créée depuis l’assistant marketing.",
      trigger: String(formData.get("trigger") ?? "NEW_PROSPECT"),
      templateId: String(formData.get("templateId") ?? ""),
      exitOnAppointment: true,
    }, "Séquence J0/J+3/J+7 créée.")
  }

  async function enrollSequence(sequenceId: string) {
    await submitJson(`/api/marketing/sequences/${sequenceId}/enroll`, {
      segmentId: selectedSegment?.id ?? "",
    }, "Segment inscrit dans la séquence.")
  }

  async function processSequences() {
    await submitJson("/api/marketing/sequences/process-due", {}, "Étapes dues exécutées.")
  }

  async function refreshScores() {
    await submitJson("/api/marketing/scores/refresh", {}, "Scores prospects recalculés.")
  }

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>Assistant</Badge>
              <Badge>Consentement</Badge>
              <Badge>RDV</Badge>
            </div>
            <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Centre marketing</h2>
          </div>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => void loadOverview()} disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <LayoutDashboard className="size-4" />}
            Actualiser
          </Button>
        </div>

        {notice ? (
          <div className={notice.type === "success" ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" : "mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900"}>
            {notice.message}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={UsersRound} label="Segments" value={overview?.stats.segments ?? 0} />
          <Metric icon={Mail} label="Envoyés" value={overview?.stats.sent ?? 0} />
          <Metric icon={MousePointerClick} label="Clics" value={overview?.stats.clicked ?? 0} />
          <Metric icon={ShieldCheck} label="Stops" value={overview?.stats.unsubscribes ?? 0} />
          <Metric icon={GitBranch} label="Séquences" value={overview?.stats.activeEnrollments ?? 0} />
          <Metric icon={Flame} label="Chauds" value={overview?.stats.hotProspects ?? 0} />
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="border-b border-slate-200 bg-white p-3 xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            {tabItems.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id
                    ? "flex items-center gap-2 rounded-2xl border border-slate-950 bg-slate-950 px-3 py-3 text-left text-sm font-black text-white"
                    : "flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-black text-slate-700 hover:bg-slate-50"}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="min-h-[520px] p-4">
          {activeTab === "launch" ? (
            <LaunchPanel
              isSaving={isSaving}
              selectedPreset={selectedPreset}
              setSelectedPreset={setSelectedPreset}
              selectedSegment={selectedSegment}
              selectedTemplate={selectedTemplate}
              launchStep={launchStep}
              setLaunchStep={setLaunchStep}
              selectedGoal={selectedGoal}
              setSelectedGoalId={(goalId) => {
                setSelectedGoalId(goalId)
                const goal = campaignGoals.find((item) => item.id === goalId)
                if (goal) setSelectedPreset(goal.preset)
              }}
              overview={overview}
              playbookResult={playbookResult}
              createPlaybook={createPlaybook}
              createSegment={createSegment}
              createTemplate={createTemplate}
              createCampaign={createCampaign}
            />
          ) : null}

          {activeTab === "creator" ? (
            <CampaignCreatorPanel
              overview={overview}
              isSaving={isSaving}
              selectedGoal={selectedGoal}
              setSelectedGoalId={(goalId) => {
                setSelectedGoalId(goalId)
                const goal = campaignGoals.find((item) => item.id === goalId)
                if (goal) setSelectedPreset(goal.preset)
              }}
              selectedPreset={selectedPreset}
              setSelectedPreset={setSelectedPreset}
              selectedSegment={selectedSegment}
              selectedTemplate={selectedTemplate}
              createSegment={createSegment}
              createTemplate={createTemplate}
              createCampaign={createCampaign}
              sendCampaign={sendCampaign}
              approveCampaign={approveCampaign}
            />
          ) : null}

          {activeTab === "sequences" ? (
            <AdvancedSequencesPanel
              overview={overview}
              isSaving={isSaving}
              selectedTemplate={selectedTemplate}
              selectedSegment={selectedSegment}
              createSequence={createSequence}
              enrollSequence={enrollSequence}
              processSequences={processSequences}
            />
          ) : null}

          {activeTab === "channels" ? (
            <ChannelsPanel overview={overview} selectedGoal={selectedGoal} />
          ) : null}

          {activeTab === "governance" ? (
            <GovernancePanel overview={overview} />
          ) : null}

          {activeTab === "reports" ? (
            <ReportsLibraryPanel overview={overview} />
          ) : null}

          {activeTab === "leads" ? (
            <LeadScoresPanel leadScores={overview?.leadScores ?? []} isSaving={isSaving} refreshScores={refreshScores} />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function LaunchPanel({
  isSaving,
  selectedPreset,
  setSelectedPreset,
  selectedSegment,
  selectedTemplate,
  launchStep,
  setLaunchStep,
  selectedGoal,
  setSelectedGoalId,
  overview,
  playbookResult,
  createPlaybook,
  createSegment,
  createTemplate,
  createCampaign,
}: {
  isSaving: boolean
  selectedPreset: keyof typeof presetLabels
  setSelectedPreset: (value: keyof typeof presetLabels) => void
  selectedSegment?: Segment
  selectedTemplate?: Template
  launchStep: LaunchStep
  setLaunchStep: (value: LaunchStep) => void
  selectedGoal: (typeof campaignGoals)[number]
  setSelectedGoalId: (value: CampaignGoalId) => void
  overview: Overview | null
  playbookResult: PlaybookResult | null
  createPlaybook: (goal: PlaybookGoal) => void
  createSegment: (event: FormEvent<HTMLFormElement>) => void
  createTemplate: (event: FormEvent<HTMLFormElement>) => void
  createCampaign: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
          <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
            <Rocket className="size-4" />
            Assistant débutant
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">Quel résultat voulez-vous obtenir ?</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Choisissez un objectif. Le SaaS prépare la cible, le message, la relance automatique, le formulaire lead et le lien de rendez-vous.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {campaignGoals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => setSelectedGoalId(goal.id)}
              className={selectedGoal.id === goal.id
                ? "rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-left shadow-[0_6px_0_#bbf7d0]"
                : "rounded-2xl border-2 border-slate-200 bg-white p-4 text-left shadow-[0_6px_0_#e2e8f0] transition hover:-translate-y-0.5 hover:border-emerald-300"}
            >
              <span className="block text-base font-black text-slate-950">{goal.label}</span>
              <span className="mt-2 block text-sm font-semibold leading-5 text-slate-600">
                {goal.detail}
              </span>
            </button>
          ))}
        </div>

        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-800">
            Réglages avancés: modifier la cible, le message ou la campagne
          </summary>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <WizardButton active={launchStep === 1} done={Boolean(selectedSegment)} label="1. Cible" onClick={() => setLaunchStep(1)} />
            <WizardButton active={launchStep === 2} done={Boolean(selectedTemplate)} label="2. Message" onClick={() => setLaunchStep(2)} />
            <WizardButton active={launchStep === 3} done={Boolean(selectedSegment && selectedTemplate)} label="3. Campagne" onClick={() => setLaunchStep(3)} />
          </div>

          {launchStep === 1 ? (
            <form key={`segment-${selectedGoal.id}`} onSubmit={createSegment} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <PanelTitle number={1} title="Cible" />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Le système exclut les contacts sans consentement marketing valide.
              </p>
              <label className="mt-3 grid gap-1 text-xs font-black uppercase text-slate-500">
                Nom
                <Input name="name" defaultValue={selectedGoal.segmentName} />
              </label>
              <label className="mt-3 grid gap-1 text-xs font-black uppercase text-slate-500">
                Segment
                <select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as keyof typeof presetLabels)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                  {Object.entries(presetLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input name="minAge" type="number" defaultValue={selectedGoal.minAge} />
                <Input name="maxAge" type="number" defaultValue={selectedGoal.maxAge} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={isSaving}>Créer la cible</Button>
                {selectedSegment ? (
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLaunchStep(2)}>
                    Utiliser : {selectedSegment.name}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}

          {launchStep === 2 ? (
            <form key={`template-${selectedGoal.id}-${selectedTemplate?.id ?? "new"}`} onSubmit={createTemplate} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <PanelTitle number={2} title="Message" />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Gardez un message simple, éducatif et orienté rendez-vous.
              </p>
              <Input name="name" defaultValue={selectedGoal.templateName} className="mt-3" />
              <Input name="subject" defaultValue={selectedGoal.subject} className="mt-3" />
              <textarea name="body" defaultValue={selectedGoal.body || selectedTemplate?.body || defaultEmail} rows={7} className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700" />
              <label className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="sensitive" type="checkbox" className="size-4" />
                Demander une validation
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={isSaving}>Enregistrer le message</Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLaunchStep(1)}>Retour</Button>
                {selectedTemplate ? (
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLaunchStep(3)}>
                    Utiliser : {selectedTemplate.name}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}

          {launchStep === 3 ? (
            <form key={`campaign-${selectedGoal.id}-${selectedSegment?.id ?? "segment"}-${selectedTemplate?.id ?? "template"}`} onSubmit={createCampaign} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <PanelTitle number={3} title="Campagne" />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Ajoutez un lien de rendez-vous ou de landing page pour mesurer la conversion.
              </p>
              <Input name="name" defaultValue={selectedGoal.campaignName} className="mt-3" />
              <select name="objective" className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option>{selectedGoal.objective}</option>
                <option>Générer des rendez-vous</option>
                <option>Relancer des prospects</option>
                <option>Réactiver des clients inactifs</option>
                <option>Demander des documents</option>
              </select>
              <select name="segmentId" className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option value={selectedSegment?.id ?? ""}>{selectedSegment?.name ?? "Créez une cible"}</option>
                {overview?.segments.slice(1).map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
              </select>
              <select name="templateId" className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option value={selectedTemplate?.id ?? ""}>{selectedTemplate?.name ?? "Créez un message"}</option>
                {overview?.templates.slice(1).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <input type="hidden" name="subject" value={selectedTemplate?.subject ?? selectedGoal.subject} />
              <input type="hidden" name="body" value={selectedTemplate?.body ?? selectedGoal.body} />
              <Input name="ctaUrl" placeholder={selectedGoal.ctaPlaceholder} className="mt-3" />
              <label className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="requestValidation" type="checkbox" className="size-4" />
                Validation requise
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={isSaving || !selectedSegment || !selectedTemplate}>Créer campagne</Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLaunchStep(2)}>Retour</Button>
              </div>
            </form>
          ) : null}
        </details>
      </div>

      <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-black text-emerald-950">
          <Sparkles className="size-4" />
          Tunnel recommandé
        </p>
        <h3 className="mt-2 text-xl font-black text-slate-950">{selectedGoal.label}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">{selectedGoal.detail}</p>

        <div className="mt-4 grid gap-2">
          <Step checked label="Page de capture lead" />
          <Step checked label="Email avec lien RDV" />
          <Step checked label="Relance J+3" />
          <Step checked label="Tâche conseiller J+7" />
        </div>

        <Button
          type="button"
          className="mt-4 w-full rounded-xl bg-slate-950 font-black text-white hover:bg-slate-800"
          disabled={isSaving}
          onClick={() => createPlaybook(selectedGoal.playbookGoal)}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Créer le tunnel
        </Button>

        {playbookResult ? (
          <div className="mt-4 rounded-2xl border border-emerald-300 bg-white p-3">
            <p className="text-sm font-black text-emerald-800">Tunnel prêt à partager</p>
            <div className="mt-3 grid gap-2">
              <a href={playbookResult.leadForm.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white">
                <ExternalLink className="size-4" />
                Formulaire lead
              </a>
              <a href={playbookResult.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-900">
                <ExternalLink className="size-4" />
                Page rendez-vous
              </a>
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
              {playbookResult.enrollment.enrolled} contact(s) inscrit(s) dans la séquence.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <CompactStat label="Relances" value={overview?.stats.activeEnrollments ?? 0} />
          <CompactStat label="Prospects" value={overview?.stats.hotProspects ?? 0} />
          <CompactStat label="Clics" value={overview?.stats.clicked ?? 0} />
          <CompactStat label="RDV" value={overview?.stats.booked ?? 0} />
        </div>
      </aside>
    </div>
  )
}

function CampaignCreatorPanel({
  overview,
  isSaving,
  selectedGoal,
  setSelectedGoalId,
  selectedPreset,
  setSelectedPreset,
  selectedSegment,
  selectedTemplate,
  createSegment,
  createTemplate,
  createCampaign,
  sendCampaign,
  approveCampaign,
}: {
  overview: Overview | null
  isSaving: boolean
  selectedGoal: (typeof campaignGoals)[number]
  setSelectedGoalId: (value: CampaignGoalId) => void
  selectedPreset: keyof typeof presetLabels
  setSelectedPreset: (value: keyof typeof presetLabels) => void
  selectedSegment?: Segment
  selectedTemplate?: Template
  createSegment: (event: FormEvent<HTMLFormElement>) => void
  createTemplate: (event: FormEvent<HTMLFormElement>) => void
  createCampaign: (event: FormEvent<HTMLFormElement>) => void
  sendCampaign: (id: string) => void
  approveCampaign: (id: string) => void
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Créateur complet</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Campagne en 7 étapes</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Un parcours guidé pour passer de l’objectif au suivi, sans oublier consentement, validation et conversion RDV.
              </p>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">7 étapes</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-7">
            {campaignWizardSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-xl bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">{index + 1}</span>
                    <Icon className="size-4 text-emerald-700" />
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-950">{step.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">{step.detail}</p>
                </div>
              )
            })}
          </div>
        </div>

        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-900">
            Modifier manuellement le segment, le message et les paramètres d’envoi
          </summary>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form onSubmit={createSegment} className="rounded-2xl border border-slate-200 bg-white p-4">
            <PanelTitle number={1} title="Objectif + segment" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {campaignGoals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoalId(goal.id)}
                  className={selectedGoal.id === goal.id
                    ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 text-left text-sm font-black text-emerald-900"
                    : "rounded-2xl border-2 border-slate-200 bg-white p-3 text-left text-sm font-black text-slate-700"}
                >
                  {goal.label}
                </button>
              ))}
            </div>
            <label className="mt-3 grid gap-1 text-xs font-black uppercase text-slate-500">
              Nom du segment
              <Input name="name" defaultValue={selectedGoal.segmentName} />
            </label>
            <label className="mt-3 grid gap-1 text-xs font-black uppercase text-slate-500">
              Règle CRM
              <select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as keyof typeof presetLabels)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                {Object.entries(presetLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Input name="minAge" type="number" defaultValue={selectedGoal.minAge} />
              <Input name="maxAge" type="number" defaultValue={selectedGoal.maxAge} />
            </div>
            <Button className="mt-4 rounded-xl" disabled={isSaving}>Créer / mettre à jour le segment</Button>
          </form>

          <form onSubmit={createTemplate} className="rounded-2xl border border-slate-200 bg-white p-4">
            <PanelTitle number={2} title="Contenu + IA" />
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold leading-5 text-sky-900">
              <Bot className="mb-2 size-5" />
              Zone IA prête: générer une variante email, un objet court ou un post LinkedIn avec validation humaine avant envoi.
            </div>
            <Input name="name" defaultValue={selectedGoal.templateName} className="mt-3" />
            <Input name="subject" defaultValue={selectedGoal.subject} className="mt-3" />
            <textarea name="body" defaultValue={selectedGoal.body || selectedTemplate?.body || defaultEmail} rows={7} className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="rounded-xl whitespace-normal" disabled>
                <Sparkles className="size-4" />
                IA à connecter
              </Button>
              <Button className="rounded-xl" disabled={isSaving}>Enregistrer le template</Button>
            </div>
          </form>
        </div>

        <form onSubmit={createCampaign} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <PanelTitle number={3} title="Canal, conformité, planification et suivi" />
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <ChoiceTile icon={Mail} title="Email" detail="Campagne principale" active />
            <ChoiceTile icon={PhoneCall} title="SMS" detail="Rappel court" />
            <ChoiceTile icon={MessageSquare} title="WhatsApp" detail="Relation suivie" />
            <ChoiceTile icon={Link2} title="LinkedIn" detail="Post manuel" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <Input name="name" defaultValue={selectedGoal.campaignName} />
              <select name="objective" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option>{selectedGoal.objective}</option>
                <option>Générer des rendez-vous</option>
                <option>Relancer des prospects</option>
                <option>Réactiver des clients inactifs</option>
                <option>Demander des documents</option>
              </select>
              <select name="segmentId" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option value={selectedSegment?.id ?? ""}>{selectedSegment?.name ?? "Créez un segment"}</option>
                {overview?.segments.slice(1).map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
              </select>
              <select name="templateId" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                <option value={selectedTemplate?.id ?? ""}>{selectedTemplate?.name ?? "Créez un template"}</option>
                {overview?.templates.slice(1).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <input type="hidden" name="subject" value={selectedTemplate?.subject ?? selectedGoal.subject} />
              <input type="hidden" name="body" value={selectedTemplate?.body ?? selectedGoal.body} />
              <Input name="ctaUrl" placeholder={selectedGoal.ctaPlaceholder} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">Contrôles avant envoi</p>
              <div className="mt-3 grid gap-2">
                <Step checked={Boolean(selectedSegment)} label="Segment CRM sélectionné" />
                <Step checked={Boolean(selectedTemplate)} label="Template validable" />
                <Step checked label="Consentement requis" />
                <Step checked label="Lien de désinscription inclus" />
                <Step checked label="Pression marketing contrôlée" />
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="requestValidation" type="checkbox" className="size-4" />
                Demander validation manager / conformité
              </label>
              <Button className="mt-4 w-full rounded-xl" disabled={isSaving || !selectedSegment || !selectedTemplate}>
                Créer la campagne
              </Button>
            </div>
          </div>
        </form>
        </details>

        <CampaignsPanel campaigns={overview?.campaigns ?? []} isSaving={isSaving} sendCampaign={sendCampaign} approveCampaign={approveCampaign} />
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-black text-slate-950">Aperçu du tunnel</p>
          <div className="mt-4 grid gap-3">
            <FlowNode icon={FileText} title="Landing page / formulaire" detail="Capture le prospect avec consentement." />
            <FlowNode icon={Mail} title="Email J0" detail="Lien vers le calendrier public." />
            <FlowNode icon={GitBranch} title="Relance J+3" detail="Si aucun rendez-vous réservé." />
            <FlowNode icon={PhoneCall} title="Tâche J+7" detail="Appel conseiller prioritaire." />
            <FlowNode icon={BarChart3} title="Suivi ROI" detail="RDV, opportunités et signatures." />
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-black text-amber-950">
            <ShieldCheck className="size-4" />
            Règle métier
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
            L’IA propose. Le conseiller ou le cabinet valide. Aucun conseil personnalisé ne part automatiquement.
          </p>
        </div>
      </aside>
    </div>
  )
}

function AdvancedSequencesPanel({
  overview,
  isSaving,
  selectedTemplate,
  selectedSegment,
  createSequence,
  enrollSequence,
  processSequences,
}: {
  overview: Overview | null
  isSaving: boolean
  selectedTemplate?: Template
  selectedSegment?: Segment
  createSequence: (event: FormEvent<HTMLFormElement>) => void
  enrollSequence: (id: string) => void
  processSequences: () => void
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Builder visuel</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Séquence avec conditions</h3>
          </div>
          <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={processSequences}>
            Exécuter les étapes dues
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <SequenceNode icon={Sparkles} title="Déclencheur" detail="Prospect créé depuis formulaire ou campagne" tone="emerald" />
          <SequenceBranch
            title="J0"
            left="Envoyer email de bienvenue"
            right="Créer tâche si consentement absent"
          />
          <SequenceBranch
            title="Si clic"
            left="Score +15 et notifier conseiller"
            right="Sinon relance J+3"
          />
          <SequenceBranch
            title="Si RDV réservé"
            left="Sortir de la séquence"
            right="Sinon tâche appel J+7"
          />
        </div>
      </div>

      <SequencesPanel
        overview={overview}
        isSaving={isSaving}
        selectedTemplate={selectedTemplate}
        selectedSegment={selectedSegment}
        createSequence={createSequence}
        enrollSequence={enrollSequence}
        processSequences={processSequences}
      />
    </div>
  )
}

function ChannelsPanel({ overview, selectedGoal }: { overview: Overview | null; selectedGoal: (typeof campaignGoals)[number] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PanelBlock title="Landing page builder" icon={FileText} detail="Créer une page simple avec formulaire, preuve, consentement et bouton RDV.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Aperçu</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{selectedGoal.label}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{selectedGoal.detail}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Prénom" />
            <Input placeholder="Téléphone" />
            <Input placeholder="Email" className="sm:col-span-2" />
          </div>
          <div className="mt-4 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-black leading-tight text-white shadow-[0_4px_0_#16a34a]">
            Bouton public: Demander mon bilan
          </div>
        </div>
      </PanelBlock>

      <PanelBlock title="IA email / LinkedIn" icon={Bot} detail="Générer, relire, valider, puis envoyer ou publier manuellement.">
        <div className="grid gap-3">
          <ChoiceTile icon={Mail} title="Email IA" detail="Objet + corps + CTA RDV" active />
          <ChoiceTile icon={Link2} title="Post LinkedIn" detail="3 variantes + hashtags" />
          <ChoiceTile icon={MessageSquare} title="SMS / WhatsApp" detail="Relances courtes avec consentement" />
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
          Attention intégrée: les messages sensibles restent en validation humaine avant envoi.
        </div>
      </PanelBlock>

      <PanelBlock title="Centre de préférences" icon={Settings2} detail="Gérer newsletter, invitations, rappels RDV, retraite, prévoyance et désinscription.">
        <PreferenceRows />
      </PanelBlock>

      <PanelBlock title="Publication et tracking" icon={MousePointerClick} detail="Suivi ouvertures, clics, bounces, plaintes spam et conversion RDV.">
        <div className="grid grid-cols-2 gap-2">
          <CompactStat label="Ouverts" value={overview?.stats.opened ?? 0} />
          <CompactStat label="Clics" value={overview?.stats.clicked ?? 0} />
          <CompactStat label="Bounces" value={overview?.stats.bounced ?? 0} />
          <CompactStat label="Plaintes" value={overview?.stats.complained ?? 0} />
        </div>
      </PanelBlock>
    </div>
  )
}

function GovernancePanel({ overview }: { overview: Overview | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <PanelBlock title="Workflow conformité" icon={ShieldCheck} detail="Brouillon, relecture, modifications, validation, planification, archivage.">
        <div className="grid gap-3 md:grid-cols-5">
          {["Brouillon", "En relecture", "Corrections", "Validé", "Archivé"].map((status, index) => (
            <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <span className="grid size-7 place-items-center rounded-xl bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">{index + 1}</span>
              <p className="mt-3 text-sm font-black text-slate-950">{status}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          Mots à risque surveillés: rendement garanti, sans risque, recommandation personnalisée, conseil non documenté.
        </div>
      </PanelBlock>

      <div className="space-y-4">
        <PanelBlock title="Pression marketing" icon={Gauge} detail="Éviter la surcharge commerciale.">
          <GaugeRow label="Emails max / mois" value="2" />
          <GaugeRow label="SMS marketing" value="Consentement requis" />
          <GaugeRow label="Exclusion automatique" value="RDV déjà prévu" />
          <GaugeRow label="Désinscrits" value={`${overview?.stats.unsubscribes ?? 0}`} />
        </PanelBlock>
        <PanelBlock title="Permissions par rôle" icon={LockKeyhole} detail="Qui peut créer, valider, envoyer ou exporter.">
          <RoleRows />
        </PanelBlock>
      </div>
    </div>
  )
}

function ReportsLibraryPanel({ overview }: { overview: Overview | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <PanelBlock title="Rapports ROI" icon={BarChart3} detail="Relier campagne, clic, RDV, opportunité et signature.">
        <div className="grid gap-3 md:grid-cols-4">
          <CompactStat label="Envoyés" value={overview?.stats.sent ?? 0} />
          <CompactStat label="Clics" value={overview?.stats.clicked ?? 0} />
          <CompactStat label="RDV" value={overview?.stats.booked ?? 0} />
          <CompactStat label="Opportunités" value={overview?.stats.opportunities ?? 0} />
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          {(overview?.campaigns ?? []).slice(0, 5).map((campaign) => (
            <div key={campaign.id} className="grid gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 last:border-b-0 md:grid-cols-[1fr_repeat(4,80px)]">
              <span className="font-black text-slate-950">{campaign.name}</span>
              <span>{campaign.stats?.sent ?? 0} env.</span>
              <span>{campaign.stats?.clicked ?? 0} clics</span>
              <span>{campaign.stats?.booked ?? 0} RDV</span>
              <span>{campaign.stats?.opportunities ?? 0} opp.</span>
            </div>
          ))}
          {overview?.campaigns.length === 0 ? <EmptyState title="Aucun rapport" detail="Les résultats apparaissent après les premiers envois." /> : null}
        </div>
      </PanelBlock>

      <div className="space-y-4">
        <PanelBlock title="Bibliothèque de contenus" icon={Library} detail="Emails, SMS, LinkedIn, landing pages, scripts d’appel.">
          <LibraryRows />
        </PanelBlock>
        <PanelBlock title="Script d’appel dynamique" icon={PhoneCall} detail="Proposé quand un prospect devient chaud.">
          <ol className="grid gap-2 text-sm font-semibold leading-6 text-slate-700">
            <li>1. Rappeler le contexte de la demande.</li>
            <li>2. Valider le besoin et l’urgence.</li>
            <li>3. Proposer un rendez-vous de 30 minutes.</li>
          </ol>
        </PanelBlock>
      </div>
    </div>
  )
}

function CampaignsPanel({ campaigns, isSaving, sendCampaign, approveCampaign }: { campaigns: Campaign[]; isSaving: boolean; sendCampaign: (id: string) => void; approveCampaign: (id: string) => void }) {
  if (!campaigns.length) return <EmptyState title="Aucune campagne" detail="Créez d’abord une cible et un message depuis l’onglet Créer." />

  return (
    <div className="grid gap-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusLabel value={campaign.status} validation={campaign.validationStatus} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{campaign.segment?.name ?? "Contacts consentants"}</span>
            </div>
            <p className="mt-2 font-black text-slate-950">{campaign.name}</p>
            <p className="text-sm font-semibold text-slate-500">{campaign.objective}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600">
              <span>{campaign.stats?.sent ?? 0} envoyés</span>
              <span>{campaign.stats?.opened ?? 0} ouverts</span>
              <span>{campaign.stats?.clicked ?? 0} clics</span>
              <span>{campaign.stats?.booked ?? 0} RDV</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {campaign.validationStatus === "REVIEW_REQUIRED" ? (
              <Button type="button" variant="outline" className="rounded-xl" disabled={isSaving} onClick={() => approveCampaign(campaign.id)}>
                <ShieldCheck className="size-4" />
                Valider
              </Button>
            ) : null}
            <Button type="button" className="rounded-xl" disabled={isSaving || campaign.validationStatus === "REVIEW_REQUIRED"} onClick={() => sendCampaign(campaign.id)}>
              <Send className="size-4" />
              Envoyer
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SequencesPanel({
  overview,
  isSaving,
  selectedTemplate,
  selectedSegment,
  createSequence,
  enrollSequence,
  processSequences,
}: {
  overview: Overview | null
  isSaving: boolean
  selectedTemplate?: Template
  selectedSegment?: Segment
  createSequence: (event: FormEvent<HTMLFormElement>) => void
  enrollSequence: (id: string) => void
  processSequences: () => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={createSequence} className="rounded-2xl border border-slate-200 bg-white p-4">
        <PanelTitle number={1} title="Nouvelle séquence" />
        <Input name="name" defaultValue="Séquence nouveau prospect retraite" className="mt-3" />
        <select name="trigger" className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
          <option value="NEW_PROSPECT">Nouveau prospect</option>
          <option value="QUOTE_SENT">Devis envoyé</option>
          <option value="INACTIVE_CLIENT">Client inactif</option>
          <option value="MISSING_DOCUMENT">Document manquant</option>
          <option value="APPOINTMENT_BOOKED">Rendez-vous réservé</option>
        </select>
        <select name="templateId" className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
          <option value={selectedTemplate?.id ?? ""}>{selectedTemplate?.name ?? "Créez un message"}</option>
          {overview?.templates.slice(1).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <Button className="mt-4 w-full rounded-xl" disabled={isSaving || !selectedTemplate}>Créer</Button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="font-black text-slate-950">Séquences</p>
          <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={processSequences}>Exécuter</Button>
        </div>
        <div className="divide-y divide-slate-200">
          {overview?.sequences.length ? overview.sequences.map((sequence) => (
            <div key={sequence.id} className="grid gap-2 px-4 py-3 text-sm font-semibold text-slate-700 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-black text-slate-950">{sequence.name}</p>
                <p className="text-xs text-slate-500">{sequence.trigger} · {sequence._count?.enrollments ?? 0} inscrits · {sequence.steps.length} étapes</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isSaving || !selectedSegment} onClick={() => enrollSequence(sequence.id)}>
                Inscrire cible
              </Button>
            </div>
          )) : <EmptyState title="Aucune séquence" detail="Créez une séquence pour automatiser J0, J+3 et J+7." />}
        </div>
      </div>
    </div>
  )
}

function LeadScoresPanel({ leadScores, isSaving, refreshScores }: { leadScores: LeadScore[]; isSaving: boolean; refreshScores: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-black text-slate-950">Prospects chauds</p>
        <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isSaving} onClick={refreshScores}>Recalculer</Button>
      </div>
      <div className="divide-y divide-slate-200">
        {leadScores.length ? leadScores.slice(0, 10).map((score) => (
          <div key={score.id} className="grid gap-2 px-4 py-3 text-sm font-semibold text-slate-700 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="font-black text-slate-950">{score.name || score.email}</p>
              <p className="text-xs text-slate-500">{Array.isArray(score.signals) ? score.signals.slice(0, 4).join(" · ") : "Engagement détecté"}</p>
            </div>
            <span className={score.score >= 61 ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>
              {score.score}/100 · {score.status}
            </span>
          </div>
        )) : <EmptyState title="Aucun prospect chaud" detail="Les scores apparaissent après un envoi, une ouverture, un clic ou un rendez-vous." />}
      </div>
    </div>
  )
}

function ChoiceTile({ icon: Icon, title, detail, active = false }: { icon: LucideIcon; title: string; detail: string; active?: boolean }) {
  return (
    <div className={active ? "rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3" : "rounded-2xl border-2 border-slate-200 bg-white p-3"}>
      <Icon className={active ? "size-5 text-emerald-700" : "size-5 text-slate-500"} />
      <p className="mt-2 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">{detail}</p>
    </div>
  )
}

function FlowNode({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-slate-200">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function SequenceNode({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string; tone?: "emerald" | "slate" }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-200">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="text-sm font-semibold text-emerald-900">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function SequenceBranch({ title, left, right }: { title: string; left: string; right: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-900">
          Oui: {left}
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-900">
          Non: {right}
        </div>
      </div>
    </div>
  )
}

function PanelBlock({ icon: Icon, title, detail, children }: { icon: LucideIcon; title: string; detail: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{detail}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PreferenceRows() {
  return (
    <div className="grid gap-2">
      {["Newsletter", "Invitations à des bilans", "Rappels de rendez-vous", "Informations retraite", "Informations prévoyance"].map((label, index) => (
        <label key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
          <span>{label}</span>
          <input type="checkbox" defaultChecked={index < 3} className="size-4" />
        </label>
      ))}
      <Button type="button" variant="outline" className="rounded-xl whitespace-normal" disabled>Centre à connecter</Button>
    </div>
  )
}

function GaugeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 text-sm last:border-b-0">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  )
}

function RoleRows() {
  const roles = [
    ["Admin", "Tout gérer"],
    ["Manager", "Valider et envoyer"],
    ["Conseiller", "Créer pour ses contacts"],
    ["Assistant", "Préparer brouillons"],
    ["Compliance", "Valider contenus"],
  ]
  return (
    <div className="grid gap-2">
      {roles.map(([role, access]) => (
        <div key={role} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-black text-slate-950">{role}</span>
          <span className="font-semibold text-slate-500">{access}</span>
        </div>
      ))}
    </div>
  )
}

function LibraryRows() {
  const items = ["Emails", "SMS", "Posts LinkedIn", "Landing pages", "Séquences", "Scripts d’appel"]
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-black text-slate-700">
          {item}
        </div>
      ))}
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{children}</span>
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <Icon className="size-4 text-emerald-700" />
      <p className="mt-2 text-[11px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function PanelTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">{number}</span>
      <h3 className="font-black text-slate-950">{title}</h3>
    </div>
  )
}

function Step({ checked, label }: { checked: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-black text-emerald-950">
      <CheckCircle2 className={checked ? "size-4 text-emerald-700" : "size-4 text-emerald-300"} />
      {label}
    </p>
  )
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function WizardButton({ active, done, label, onClick }: { active: boolean; done: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "flex min-h-11 items-center justify-between gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-left text-sm font-black leading-tight text-white"
        : "flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-left text-sm font-black leading-tight text-emerald-950 ring-1 ring-emerald-200"}
    >
      <span>{label}</span>
      <CheckCircle2 className={done ? "size-4 opacity-100" : "size-4 opacity-25"} />
    </button>
  )
}

function StatusLabel({ value, validation }: { value: string; validation: string }) {
  const blocked = validation === "REVIEW_REQUIRED" || value === "BLOCKED"
  return (
    <span className={blocked ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800" : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800"}>
      {blocked ? "Validation requise" : value}
    </span>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
      <p className="font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  )
}
