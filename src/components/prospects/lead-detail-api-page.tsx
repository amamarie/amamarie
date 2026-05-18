"use client"

import {
  Archive,
  CalendarPlus,
  ClipboardList,
  Edit3,
  Mail,
  PhoneCall,
  Loader2,
  MessageSquare,
  Sparkles,
  StickyNote,
  UserCheck,
} from "lucide-react"
import Link from "next/link"
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react"

import { ContentCard, PageShell, StatusBadge } from "@/components/crm/page-shell"
import { ActivityTimeline } from "@/components/activities/ActivityTimeline"
import { AiSummaryPanel } from "@/components/ai/AiSummaryPanel"
import { CallSummaryModal } from "@/components/ai/CallSummaryModal"
import { CommunicationsPanel } from "@/components/communications/CommunicationsPanel"
import { NotesSection, type NoteItem } from "@/components/notes/NotesSection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StatusTone } from "@/types"

type LeadStatusCode =
  | "NEW"
  | "TO_CONTACT"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "CONVERTED"
  | "LOST"
  | "ARCHIVED"

type PriorityCode = "LOW" | "NORMAL" | "HIGH" | "URGENT"
type LeadTab = "overview" | "qualification" | "communications" | "tasks" | "documents" | "history"

type ApiLead = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string
  address: string | null
  source: string
  status: LeadStatusCode
  priority: PriorityCode
  interestType: string | null
  nextAction: string | null
  notes: string | null
  createdAt: string
  lastContactAt: string | null
  convertedAt: string | null
  lostReason: string | null
  lostAt: string | null
  lostNote: string | null
  advisor?: { name: string } | null
  tasks?: {
    id: string
    title: string
    description: string | null
    status: string
    priority: PriorityCode
    dueDate: string | null
  }[]
  noteItems?: NoteItem[]
  calls?: {
    id: string
    phoneNumber: string
    direction: string
    status: string
    duration: number | null
    notes: string | null
    createdAt: string
  }[]
  sms?: {
    id: string
    phoneNumber: string
    direction: string
    body: string
    status: string
    createdAt: string
  }[]
  documents?: {
    id: string
    name: string
    type: string
    status: string
    createdAt: string
  }[]
  leadFormSubmissions?: {
    id: string
    createdAt: string
    syncedToGoogleSheets: boolean
    syncError: string | null
    payload?: {
      [key: string]: unknown
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      interestType?: string
      message?: string
    } | null
    leadForm?: {
      id: string
      name: string
      slug: string
      googleSheetId?: string | null
    } | null
  }[]
  activities?: {
    id: string
    type: string
    title: string
    description: string | null
    createdAt: string
  }[]
}

const statusLabels: Record<LeadStatusCode, { label: string; tone: StatusTone }> = {
  NEW: { label: "Nouveau", tone: "emerald" },
  TO_CONTACT: { label: "À contacter", tone: "amber" },
  CONTACTED: { label: "Contacté", tone: "sky" },
  QUALIFIED: { label: "Qualifié", tone: "sky" },
  PROPOSAL_SENT: { label: "Proposition envoyée", tone: "violet" },
  NEGOTIATION: { label: "En discussion", tone: "amber" },
  WON: { label: "Gagné", tone: "emerald" },
  CONVERTED: { label: "Converti en client", tone: "emerald" },
  LOST: { label: "Perdu", tone: "slate" },
  ARCHIVED: { label: "Archivé", tone: "slate" },
}

const priorityLabels: Record<PriorityCode, { label: string; tone: StatusTone }> = {
  LOW: { label: "Basse", tone: "slate" },
  NORMAL: { label: "Normale", tone: "sky" },
  HIGH: { label: "Haute", tone: "amber" },
  URGENT: { label: "Urgente", tone: "rose" },
}

const sourceLabels: Record<string, string> = {
  INBOUND_CALL: "Appel entrant",
  SMS: "SMS entrant",
  WEBSITE: "Site web",
  REFERRAL: "Référence",
  SOCIAL_MEDIA: "Réseaux sociaux",
  EVENT: "Événement",
  MANUAL: "Import manuel",
  CAMPAIGN: "Campagne",
  OTHER: "Autre",
}

const leadPipelineStages: LeadStatusCode[] = ["NEW", "TO_CONTACT", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"]

function formatDate(value?: string | null) {
  if (!value) return "Non défini"
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function customFormAnswers(payload?: Record<string, unknown> | null) {
  const baseKeys = new Set(["firstName", "lastName", "email", "phone", "interestType", "message", "consent"])
  return Object.entries(payload ?? {})
    .filter(([key, value]) => !baseKeys.has(key) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key.replace(/^question_/, "").replace(/_/g, " "), value === true ? "Oui" : String(value)] as const)
}

type ParsedLeadQualification = {
  message: string
  source?: string
  temperature?: string
  intention?: string
  urgency?: string
  probableNeed?: string
  nextAction?: string
  rationale?: string
}

const qualificationLabels = ["Source", "Température", "Intention", "Urgence", "Besoin probable", "Prochaine action", "Raison"] as const

function humanizeQualificationValue(label: string, value?: string) {
  if (!value) return "À confirmer"
  const cleaned = value.trim()

  if (label === "Source") return sourceLabels[cleaned] ?? cleaned
  if (label === "Urgence") return priorityLabels[cleaned as PriorityCode]?.label ?? cleaned

  const intentionLabels: Record<string, string> = {
    INSURANCE_NEED: "Besoin d’assurance",
    INVESTMENT_NEED: "Besoin placement",
    RETIREMENT_NEED: "Retraite",
    BUSINESS_NEED: "Besoin corporatif",
    GENERAL: "À clarifier",
  }

  return intentionLabels[cleaned] ?? cleaned
}

function readQualificationField(text: string, label: (typeof qualificationLabels)[number]) {
  const startToken = `${label}:`
  const start = text.indexOf(startToken)
  if (start === -1) return undefined

  const valueStart = start + startToken.length
  const nextStarts = qualificationLabels
    .filter((candidate) => candidate !== label)
    .map((candidate) => text.indexOf(`${candidate}:`, valueStart))
    .filter((index) => index > valueStart)

  const end = nextStarts.length ? Math.min(...nextStarts) : text.length
  return text.slice(valueStart, end).trim()
}

function parseLeadQualification(notes?: string | null): ParsedLeadQualification | null {
  const normalized = notes?.replace(/\s+/g, " ").trim()
  if (!normalized) return null

  const marker = "--- Qualification automatique FinAdvisor"
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex === -1) {
    return { message: normalized }
  }

  const message = normalized.slice(0, markerIndex).trim()
  const qualificationText = normalized.slice(markerIndex + marker.length).trim()
  const rationale = readQualificationField(qualificationText, "Raison")
    ?.replace(/Validation humaine obligatoire\..*$/i, "")
    .replace(/Aide interne seulement\..*$/i, "")
    .trim()

  return {
    message,
    source: readQualificationField(qualificationText, "Source"),
    temperature: readQualificationField(qualificationText, "Température"),
    intention: readQualificationField(qualificationText, "Intention"),
    urgency: readQualificationField(qualificationText, "Urgence"),
    probableNeed: readQualificationField(qualificationText, "Besoin probable"),
    nextAction: readQualificationField(qualificationText, "Prochaine action"),
    rationale,
  }
}

async function readJson<T>(response: Response) {
  const result = (await response.json()) as { data?: T; error?: string }
  if (!response.ok) {
    throw new Error(result.error ?? "Une erreur est survenue.")
  }
  return result.data as T
}

export function LeadDetailApiPage({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<ApiLead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [callNoteOpen, setCallNoteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LeadTab>("overview")

  const loadLead = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" })
      const data = await readJson<ApiLead>(response)
      setLead(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger le prospect."
      )
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLead()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadLead])

  async function action(
    path: string,
    method: "POST" | "PATCH",
    body?: Record<string, string>
  ) {
    setIsSaving(true)
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      await readJson<unknown>(response)
      await loadLead()
      setNotice({ type: "success", message: "Action enregistree." })
    } catch (actionError) {
      setNotice({
        type: "error",
        message:
          actionError instanceof Error ? actionError.message : "Impossible d'executer l'action.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    await action(`/api/leads/${leadId}`, "PATCH", {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      interestType: String(formData.get("interestType") ?? ""),
      nextAction: String(formData.get("nextAction") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    })
    setEditOpen(false)
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    await action(`/api/leads/${leadId}/notes`, "POST", {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
    })
    setNoteOpen(false)
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    await action(`/api/leads/${leadId}/tasks`, "POST", {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      priority: String(formData.get("priority") ?? "NORMAL"),
      status: "TODO",
    })
    setTaskOpen(false)
  }

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await action(`/api/leads/${leadId}/tasks`, "POST", {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      priority: String(formData.get("priority") ?? "NORMAL"),
      type: String(formData.get("taskType") ?? "FOLLOW_UP"),
      status: "TODO",
    })
    setActivityOpen(false)
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: String(formData.get("subject") ?? ""),
          body: String(formData.get("body") ?? ""),
        }),
      })
      await readJson<unknown>(response)
      await loadLead()
      setEmailOpen(false)
      setNotice({ type: "success", message: "Courriel envoyé au prospect." })
    } catch (emailError) {
      setNotice({
        type: "error",
        message: emailError instanceof Error ? emailError.message : "Impossible d'envoyer le courriel.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: String(formData.get("body") ?? ""),
        }),
      })
      await readJson<unknown>(response)
      await loadLead()
      setSmsOpen(false)
      setNotice({ type: "success", message: "SMS envoyé à Twilio." })
    } catch (smsError) {
      setNotice({
        type: "error",
        message: smsError instanceof Error ? smsError.message : "Impossible d'envoyer le SMS.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function startVoiceQualification() {
    if (!lead) return
    const confirmed = window.confirm(
      "Confirmez-vous que le prospect a donné son consentement à recevoir cet appel de préqualification vocale?"
    )
    if (!confirmed) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/start-voice-qualification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentToCall: true,
          consentToRecording: false,
          preferredLanguage: "fr",
          province: "QC",
          insuranceCategory: lead.interestType ?? "Assurance à déterminer",
          insuranceGoal: lead.nextAction ?? lead.notes ?? "",
        }),
      })
      await readJson<unknown>(response)
      await loadLead()
      setNotice({ type: "success", message: "Qualification vocale lancée. n8n enverra le SMS de préavis puis déclenchera l’appel RetellAI." })
    } catch (voiceError) {
      setNotice({
        type: "error",
        message: voiceError instanceof Error ? voiceError.message : "Impossible de lancer la qualification vocale.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function updateLeadStatus(status: LeadStatusCode) {
    if (status === lead?.status || status === "CONVERTED") return
    await action(`/api/leads/${leadId}/status`, "PATCH", { status })
  }

  if (isLoading) {
    return (
      <PageShell
        eyebrow="Fiche prospect"
        title="Chargement..."
        description="Reçuperation de la fiche prospect."
      >
        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-6 text-sm font-medium text-slate-600 shadow-sm">
          <Loader2 className="mr-2 inline size-4 animate-spin text-emerald-600" />
          Chargement...
        </div>
      </PageShell>
    )
  }

  if (error || !lead) {
    return (
      <PageShell
        eyebrow="Fiche prospect"
        title="Prospect introuvable"
        description="La fiche demandee n'est pas accessible pour votre organisation."
      >
        <StatePanel
          title={error ?? "Prospect introuvable."}
          actionLabel="Retour prospects"
          href="/prospects"
        />
      </PageShell>
    )
  }

  const fullName = `${lead.firstName} ${lead.lastName}`
  const openTasks = (lead.tasks ?? []).filter((task) => task.status !== "DONE")
  const documentsCount = lead.documents?.length ?? 0
  const submissionsCount = lead.leadFormSubmissions?.length ?? 0
  const qualification = parseLeadQualification(lead.notes)
  const readinessItems = [
    Boolean(lead.phone),
    Boolean(lead.email),
    Boolean(lead.interestType),
    Boolean(lead.nextAction),
    submissionsCount > 0,
  ]
  const readinessScore = Math.round((readinessItems.filter(Boolean).length / readinessItems.length) * 100)

  return (
    <PageShell
      eyebrow="Fiche prospect"
      title={fullName}
      description="Fiche complète avec informations, suivis, communications, documents et historique."
      showIntro={false}
    >
      {notice ? <Notice type={notice.type}>{notice.message}</Notice> : null}

      <LeadWorkspaceHeader
        lead={lead}
        onEdit={() => setEditOpen(true)}
        onEmail={() => setEmailOpen(true)}
        onNote={() => setNoteOpen(true)}
        onTask={() => setTaskOpen(true)}
        onActivity={() => setActivityOpen(true)}
        onCallNote={() => setCallNoteOpen(true)}
        onSms={() => setSmsOpen(true)}
        onVoiceQualification={() => void startVoiceQualification()}
        onConvert={() => void action(`/api/leads/${lead.id}/convert`, "POST")}
        onArchive={() => void action(`/api/leads/${lead.id}/archive`, "PATCH")}
        isSaving={isSaving}
      />

      <section className="grid gap-5">
        <LeadPipeline currentStatus={lead.status} onChange={(status) => void updateLeadStatus(status)} />

        <LeadKeyIndicators
          readinessScore={readinessScore}
          openTasksCount={openTasks.length}
          documentsCount={documentsCount}
          submissionsCount={submissionsCount}
          lastContactAt={lead.lastContactAt}
          onQualification={() => setActiveTab("qualification")}
          onCommunications={() => setActiveTab("communications")}
          onTasks={() => setActiveTab("tasks")}
          onDocuments={() => setActiveTab("documents")}
        />

        <LeadTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
          <>
            <section className="grid gap-4 xl:grid-cols-3">
              <ContentCard title="Informations prospect" description="Coordonnées et attribution du dossier.">
                <Info label="Prénom" value={lead.firstName} />
                <Info label="Nom" value={lead.lastName} />
                <Info label="Conseiller" value={lead.advisor?.name ?? "Non assigné"} />
                <Info label="Date création" value={formatDate(lead.createdAt)} />
              </ContentCard>
              <ContentCard title="Contact" description="Canaux disponibles pour le suivi.">
                <Info label="Téléphone" value={lead.phone} />
                <Info label="Courriel" value={lead.email ?? "À compléter"} />
                <Info label="Adresse" value={lead.address ?? "À compléter"} />
                <Info label="Dernier contact" value={formatDate(lead.lastContactAt)} />
              </ContentCard>
              <ContentCard title="Opportunité" description="Contexte commercial à valider.">
                <Info label="Source" value={sourceLabels[lead.source] ?? lead.source} />
                <Info label="Intérêt principal" value={lead.interestType ?? "À définir"} />
                <Info label="Prochaine action" value={lead.nextAction ?? "À définir"} />
                <Info label="Conversion" value={formatDate(lead.convertedAt)} />
                {lead.status === "LOST" ? (
                  <>
                    <Info label="Raison de perte" value={lead.lostReason ?? "Non définie"} />
                    <Info label="Date de perte" value={formatDate(lead.lostAt)} />
                    <Info label="Note de perte" value={lead.lostNote ?? "Aucune note"} />
                  </>
                ) : null}
              </ContentCard>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <ContentCard title="Résumé de qualification" description="Aide interne avant le premier suivi.">
                <LeadQualificationSummary qualification={qualification} compact />
              </ContentCard>
              <NotesSection entity="lead" entityId={lead.id} initialNotes={(lead.noteItems ?? []).slice(0, 3)} onChanged={loadLead} />
            </section>
          </>
        ) : null}

        {activeTab === "qualification" ? (
          <ContentCard title="Réponses formulaire" description="Soumissions, message initial et réponses utiles au suivi.">
            <LeadFormSubmissionsList lead={lead} />
          </ContentCard>
        ) : null}

        {activeTab === "communications" ? <CommunicationsPanel leadId={lead.id} defaultPhone={lead.phone} /> : null}

        {activeTab === "tasks" ? (
          <ContentCard title="Tâches liées" description="Suivis à faire et actions créées par les automatisations.">
            <LeadTasksList tasks={lead.tasks ?? []} />
          </ContentCard>
        ) : null}

        {activeTab === "documents" ? (
          <ContentCard title="Documents liés" description="Documents rattachés au prospect avant conversion client.">
            <LeadDocumentsList documents={lead.documents ?? []} />
          </ContentCard>
        ) : null}

        {activeTab === "history" ? (
          <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <AiSummaryPanel entityType="lead" entityId={lead.id} />
            <ActivityTimeline
              title="Historique"
              description="Toutes les actions importantes du prospect."
              endpoint={`/api/leads/${lead.id}/activities`}
              limit={12}
              defaultOpen
            />
          </section>
        ) : null}
      </section>

      {editOpen ? (
        <Modal title="Modifier le prospect" onClose={() => setEditOpen(false)}>
          <form onSubmit={submitEdit} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="firstName" label="Prenom" required defaultValue={lead.firstName} />
              <Field name="lastName" label="Nom" required defaultValue={lead.lastName} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="phone" label="Téléphone" required defaultValue={lead.phone} />
              <Field name="email" label="Courriel" type="email" defaultValue={lead.email ?? ""} />
            </div>
            <Field name="address" label="Adresse" defaultValue={lead.address ?? ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="interestType" label="Interet principal" defaultValue={lead.interestType ?? ""} />
              <Field name="nextAction" label="Prochaine action" defaultValue={lead.nextAction ?? ""} />
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Notes
              <textarea
                name="notes"
                defaultValue={lead.notes ?? ""}
                rows={5}
                className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <ModalActions isSaving={isSaving} onClose={() => setEditOpen(false)} submitLabel="Modifier" />
          </form>
        </Modal>
      ) : null}

      {noteOpen ? (
        <Modal title="Ajouter une note" onClose={() => setNoteOpen(false)}>
          <form onSubmit={submitNote} className="grid gap-5">
            <Field name="title" label="Titre" />
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Note
              <textarea
                name="content"
                rows={5}
                required
                className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <ModalActions isSaving={isSaving} onClose={() => setNoteOpen(false)} submitLabel="Ajouter" />
          </form>
        </Modal>
      ) : null}

      {taskOpen ? (
        <Modal title="Créer une tâche" onClose={() => setTaskOpen(false)}>
          <form onSubmit={submitTask} className="grid gap-5">
            <Field name="title" label="Titre" required />
            <Field name="description" label="Description" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="dueDate" label="Échéance" type="date" />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Priorité
                <select
                  name="priority"
                  defaultValue="NORMAL"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="LOW">Basse</option>
                  <option value="NORMAL">Normale</option>
                  <option value="HIGH">Haute</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
            </div>
            <ModalActions isSaving={isSaving} onClose={() => setTaskOpen(false)} submitLabel="Créer" />
          </form>
        </Modal>
      ) : null}

      {activityOpen ? (
        <Modal title="Planifier une activité" onClose={() => setActivityOpen(false)}>
          <form onSubmit={submitActivity} className="grid gap-5">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Type d’activité
              <select
                name="taskType"
                defaultValue="CALL"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="FOLLOW_UP">To-Do</option>
                <option value="EMAIL">Email</option>
                <option value="CALL">Appel</option>
                <option value="MEETING">Réunion</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </label>
            <Field name="title" label="Résumé" required />
            <Field name="dueDate" label="Date prévue" type="date" required />
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Priorité
              <select
                name="priority"
                defaultValue="NORMAL"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </label>
            <Field name="description" label="Notes" />
            <ModalActions isSaving={isSaving} onClose={() => setActivityOpen(false)} submitLabel="Planifier" />
          </form>
        </Modal>
      ) : null}

      {emailOpen ? (
        <Modal title="Envoyer un courriel" onClose={() => setEmailOpen(false)}>
          <form onSubmit={submitEmail} className="grid gap-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              Destinataire : <span className="font-black text-slate-900">{lead.email ?? "Aucun courriel défini"}</span>
            </div>
            <Field name="subject" label="Objet" required defaultValue="Suivi administratif" />
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Message
              <textarea
                name="body"
                rows={7}
                required
                defaultValue={`Bonjour ${lead.firstName},\n\nJe vous contacte au sujet de votre demande d'assurance.\n\nCordialement,`}
                className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <ModalActions isSaving={isSaving} onClose={() => setEmailOpen(false)} submitLabel="Envoyer le courriel" />
          </form>
        </Modal>
      ) : null}
      {smsOpen ? (
        <Modal title="Envoyer un SMS" onClose={() => setSmsOpen(false)}>
          <form onSubmit={submitSms} className="grid gap-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              Destinataire : <span className="font-black text-slate-900">{lead.phone}</span>
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Message
              <textarea
                name="body"
                rows={5}
                maxLength={1000}
                required
                defaultValue={`Bonjour ${lead.firstName}, merci pour votre intérêt. Je vous recontacte sous peu.`}
                className="min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <ModalActions isSaving={isSaving} onClose={() => setSmsOpen(false)} submitLabel="Envoyer le SMS" />
          </form>
        </Modal>
      ) : null}
      {callNoteOpen ? <CallSummaryModal entityType="lead" entityId={lead.id} onClose={() => setCallNoteOpen(false)} onSaved={loadLead} /> : null}
    </PageShell>
  )
}

function LeadWorkspaceHeader({
  lead,
  onEdit,
  onEmail,
  onNote,
  onTask,
  onActivity,
  onCallNote,
  onSms,
  onVoiceQualification,
  onConvert,
  onArchive,
  isSaving,
}: {
  lead: ApiLead
  onEdit: () => void
  onEmail: () => void
  onNote: () => void
  onTask: () => void
  onActivity: () => void
  onCallNote: () => void
  onSms: () => void
  onVoiceQualification: () => void
  onConvert: () => void
  onArchive: () => void
  isSaving: boolean
}) {
  const qualification = parseLeadQualification(lead.notes)

  return (
    <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-[0_12px_0_#d9f99d]">
      <div className="border-b-2 border-emerald-100 bg-emerald-500 px-5 py-6 text-white sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/prospects" className="rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white hover:text-emerald-700">
                Prospects
              </Link>
              <StatusBadge tone={statusLabels[lead.status].tone}>{statusLabels[lead.status].label}</StatusBadge>
              <StatusBadge tone={priorityLabels[lead.priority].tone}>{priorityLabels[lead.priority].label}</StatusBadge>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-50">Dossier prospect</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{lead.firstName} {lead.lastName}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-emerald-50">
                Qualification, communications, tâches et documents regroupés dans le même espace de travail.
              </p>
              <LeadQualificationSummary qualification={qualification} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" className="rounded-full bg-slate-950 font-black text-white shadow-[0_6px_0_#020617] hover:bg-slate-800" onClick={onEdit}>
              <Edit3 className="size-4" aria-hidden="true" />
              Modifier
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={onConvert} disabled={isSaving || lead.status === "CONVERTED"}>
              <UserCheck className="size-4" aria-hidden="true" />
              Convertir
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-2 border-white bg-white font-black text-emerald-700 hover:bg-emerald-50" onClick={onArchive} disabled={isSaving || lead.status === "ARCHIVED"}>
              <Archive className="size-4" aria-hidden="true" />
              Archiver
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
        <WorkspaceAction icon={Mail} label="Envoyer email" onClick={onEmail} />
        <WorkspaceAction icon={MessageSquare} label="Envoyer SMS" onClick={onSms} />
        <WorkspaceAction icon={StickyNote} label="Ajouter note" onClick={onNote} />
        <WorkspaceAction icon={ClipboardList} label="Créer tâche" onClick={onTask} />
        <WorkspaceAction icon={CalendarPlus} label="Planifier" onClick={onActivity} />
        <WorkspaceAction icon={PhoneCall} label="Résumer appel" onClick={onCallNote} />
        <WorkspaceAction icon={Sparkles} label="Appel IA" onClick={onVoiceQualification} />
      </div>
    </section>
  )
}

function LeadKeyIndicators({
  readinessScore,
  openTasksCount,
  documentsCount,
  submissionsCount,
  lastContactAt,
  onQualification,
  onCommunications,
  onTasks,
  onDocuments,
}: {
  readinessScore: number
  openTasksCount: number
  documentsCount: number
  submissionsCount: number
  lastContactAt: string | null
  onQualification: () => void
  onCommunications: () => void
  onTasks: () => void
  onDocuments: () => void
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <LeadMetricButton label="Préparation" value={`${readinessScore}%`} detail="Coordonnées, besoin et suivi" icon={Sparkles} tone="emerald" onClick={onQualification} />
      <LeadMetricButton label="Formulaires" value={String(submissionsCount)} detail="Soumissions liées" icon={ClipboardList} tone="sky" onClick={onQualification} />
      <LeadMetricButton label="Tâches" value={String(openTasksCount)} detail="Actions ouvertes" icon={StickyNote} tone={openTasksCount > 0 ? "amber" : "slate"} onClick={onTasks} />
      <LeadMetricButton label="Documents" value={String(documentsCount)} detail="Pièces au dossier" icon={Archive} tone={documentsCount > 0 ? "emerald" : "slate"} onClick={onDocuments} />
      <LeadMetricButton label="Dernier contact" value={formatDate(lastContactAt)} detail="Communications" icon={MessageSquare} tone="violet" onClick={onCommunications} />
    </section>
  )
}

function LeadMetricButton({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Sparkles
  tone: "emerald" | "sky" | "amber" | "violet" | "slate"
  onClick: () => void
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_6px_0_#bbf7d0]",
    sky: "border-sky-200 bg-sky-50 text-sky-900 shadow-[0_6px_0_#bae6fd]",
    amber: "border-amber-200 bg-amber-50 text-amber-900 shadow-[0_6px_0_#fde68a]",
    violet: "border-violet-200 bg-violet-50 text-violet-900 shadow-[0_6px_0_#ddd6fe]",
    slate: "border-slate-200 bg-slate-50 text-slate-800 shadow-[0_6px_0_#e2e8f0]",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.35rem] border-2 p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
        <Icon className="size-5 shrink-0" />
      </div>
      <p className="mt-3 truncate text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </button>
  )
}

function LeadTabs({ activeTab, onChange }: { activeTab: LeadTab; onChange: (tab: LeadTab) => void }) {
  const tabs: { id: LeadTab; label: string }[] = [
    { id: "overview", label: "Vue d’ensemble" },
    { id: "qualification", label: "Qualification" },
    { id: "communications", label: "Communications" },
    { id: "tasks", label: "Tâches" },
    { id: "documents", label: "Documents" },
    { id: "history", label: "Historique" },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={activeTab === tab.id ? "shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm" : "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function LeadFormSubmissionsList({ lead }: { lead: ApiLead }) {
  return (
    <ListState items={lead.leadFormSubmissions ?? []} empty="Aucune réponse de formulaire liée.">
      {(submission) => {
        const payload = submission.payload ?? {}
        return (
          <div key={submission.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList className="size-4 text-emerald-600" />
                  <p className="font-black text-slate-950">{submission.leadForm?.name ?? "Formulaire"}</p>
                  <StatusBadge tone={submission.syncedToGoogleSheets ? "sky" : "amber"}>
                    {submission.syncedToGoogleSheets ? "Sheets synchronisé" : "Sheets en attente"}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {payload.interestType ?? lead.interestType ?? "Intérêt à préciser"}
                </p>
                {payload.message ? <p className="mt-2 rounded-xl bg-white p-3 text-sm font-bold leading-6 text-slate-700 ring-1 ring-slate-100">{payload.message}</p> : null}
                {customFormAnswers(payload).length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {customFormAnswers(payload).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{key}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {submission.syncError ? <p className="mt-2 text-xs font-semibold text-amber-700">{submission.syncError}</p> : null}
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{formatDate(submission.createdAt)}</span>
            </div>
          </div>
        )
      }}
    </ListState>
  )
}

function LeadTasksList({ tasks }: { tasks: NonNullable<ApiLead["tasks"]> }) {
  return (
    <ListState items={tasks} empty="Aucune tâche liée.">
      {(task) => (
        <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-slate-950">{task.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {task.description ?? "Sans description"}
              </p>
            </div>
            <StatusBadge tone={priorityLabels[task.priority].tone}>
              {priorityLabels[task.priority].label}
            </StatusBadge>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {task.status} · {formatDate(task.dueDate)}
          </p>
        </div>
      )}
    </ListState>
  )
}

function LeadDocumentsList({ documents }: { documents: NonNullable<ApiLead["documents"]> }) {
  return (
    <ListState items={documents} empty="Aucun document lié.">
      {(document) => (
        <div key={document.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="font-black text-slate-950">{document.name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {document.type} · {document.status}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(document.createdAt)}</p>
        </div>
      )}
    </ListState>
  )
}

function LeadQualificationSummary({ qualification, compact = false }: { qualification: ParsedLeadQualification | null; compact?: boolean }) {
  if (!qualification) {
    return (
      <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">
        Aucune note principale pour ce prospect.
      </p>
    )
  }

  const hasAutomaticQualification = Boolean(
    qualification.source ||
      qualification.temperature ||
      qualification.intention ||
      qualification.urgency ||
      qualification.probableNeed ||
      qualification.nextAction
  )

  if (!hasAutomaticQualification) {
    return (
      <p className="mt-2 max-w-3xl rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
        {qualification.message}
      </p>
    )
  }

  return (
    <div className={compact ? "space-y-3" : "mt-4 max-w-5xl space-y-3"}>
      <div className="rounded-[1.25rem] border-2 border-white bg-white/85 p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Message du prospect</p>
        <p className="mt-2 text-base font-black leading-7 text-slate-950">
          {qualification.message || "Aucun message libre. Valider le besoin pendant le premier contact."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <QualificationChip label="Source" value={humanizeQualificationValue("Source", qualification.source)} />
        <QualificationChip label="Température" value={qualification.temperature ?? "À confirmer"} />
        <QualificationChip label="Urgence" value={humanizeQualificationValue("Urgence", qualification.urgency)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50/90 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Besoin détecté</p>
          <p className="mt-2 text-sm font-black leading-6 text-emerald-950">
            {qualification.probableNeed ?? humanizeQualificationValue("Intention", qualification.intention)}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-sky-100 bg-sky-50/90 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Prochaine action</p>
          <p className="mt-2 text-sm font-black leading-6 text-sky-950">
            {qualification.nextAction ?? "Contacter le prospect et confirmer le contexte de la demande."}
          </p>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-950">
        <span className="font-black">Validation conseiller requise.</span>{" "}
        {qualification.rationale || "La qualification automatique sert uniquement d’aide interne et ne remplace pas l’analyse professionnelle."}
      </div>
    </div>
  )
}

function QualificationChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border-2 border-white bg-white/85 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-800">{value}</p>
    </div>
  )
}

function LeadPipeline({ currentStatus, onChange }: { currentStatus: LeadStatusCode; onChange: (status: LeadStatusCode) => void }) {
  const currentIndex = Math.max(0, leadPipelineStages.findIndex((stage) => stage === currentStatus))

  return (
    <section className="rounded-[1.75rem] border-2 border-slate-100 bg-white p-4 shadow-[0_8px_0_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Pipeline prospect</p>
          <p className="text-xs font-medium text-slate-500">Nouveau → qualifié → proposition → gagné.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
          {statusLabels[currentStatus].label}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        {leadPipelineStages.map((status, index) => {
          const isDone = index < currentIndex
          const isCurrent = status === currentStatus
          return (
            <button
              key={status}
              type="button"
              onClick={() => onChange(status)}
              className={[
                "min-h-20 rounded-2xl border-2 px-3 py-3 text-left font-bold transition hover:-translate-y-0.5",
                isCurrent ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_6px_0_rgba(5,150,105,0.18)]" : isDone ? "border-sky-200 bg-sky-50 text-sky-950 shadow-[0_5px_0_rgba(2,132,199,0.12)]" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white",
              ].join(" ")}
            >
              <span className="block text-sm font-black">{statusLabels[status].label}</span>
              <span className="mt-1 block text-xs font-medium">{index + 1}/{leadPipelineStages.length}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function LeadWorkspaceTimeline({
  lead,
  onNote,
  onEmail,
  onTask,
  onCallNote,
}: {
  lead: ApiLead
  onNote: () => void
  onEmail: () => void
  onTask: () => void
  onCallNote: () => void
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">Timeline</p>
            <p className="text-xs font-medium text-slate-500">Notes, emails, activités et historique.</p>
          </div>
          <StatusBadge tone="emerald">Vivant</StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniTimelineAction icon={StickyNote} label="Note" onClick={onNote} />
          <MiniTimelineAction icon={Mail} label="Email" onClick={onEmail} />
          <MiniTimelineAction icon={ClipboardList} label="Tâche" onClick={onTask} />
          <MiniTimelineAction icon={PhoneCall} label="Appel" onClick={onCallNote} />
        </div>
      </section>
      <AiSummaryPanel entityType="lead" entityId={lead.id} />
      <ActivityTimeline
        title="Historique"
        description="Toutes les actions importantes du prospect."
        endpoint={`/api/leads/${lead.id}/activities`}
        limit={12}
        defaultOpen
      />
    </aside>
  )
}

function WorkspaceAction({ icon: Icon, label, onClick }: { icon: typeof Mail; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 items-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-[0_6px_0_rgba(5,150,105,0.12)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        <Icon className="size-5" />
      </span>
      <span className="text-sm font-black text-slate-800">{label}</span>
    </button>
  )
}

function MiniTimelineAction({ icon: Icon, label, onClick }: { icon: typeof Mail; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
    >
      <Icon className="mb-2 size-4" />
      {label}
    </button>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function ListState<T>({
  items,
  empty,
  children,
}: {
  items: T[]
  empty: string
  children: (item: T) => ReactNode
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        {empty}
      </div>
    )
  }

  return <div className="space-y-3">{items.map(children)}</div>
}

function Notice({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={
        type === "success"
          ? "rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          : "rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
      }
    >
      {children}
    </div>
  )
}

function StatePanel({
  title,
  actionLabel,
  href,
}: {
  title: string
  actionLabel: string
  href: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
        <Sparkles className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <Button className="mt-5 rounded-2xl" variant="outline" asChild>
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  )
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue = "",
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="h-11 rounded-2xl"
      />
    </label>
  )
}

function ModalActions({
  isSaving,
  onClose,
  submitLabel,
}: {
  isSaving: boolean
  onClose: () => void
  submitLabel: string
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-2 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
      <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
        Annuler
      </Button>
      <Button
        type="submit"
        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
        disabled={isSaving}
      >
        {isSaving ? "Sauvegarde..." : submitLabel}
      </Button>
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-[min(92vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-2xl"
            onClick={onClose}
            aria-label="Fermer la modale"
          >
            Fermer
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
