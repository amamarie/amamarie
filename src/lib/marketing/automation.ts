import crypto from "node:crypto"

import { ConsentStatus, Prisma } from "@prisma/client"
import { z } from "zod"

import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"

const riskyMarketingTerms = [
  "rendement garanti",
  "sans risque",
  "garanti sans risque",
  "performance garantie",
  "meilleur placement",
  "produit idéal",
  "conseil personnalisé automatique",
]

export const marketingSegmentSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  preset: z.enum(["ALL_CONSENTED", "RETIREMENT", "INACTIVE_CLIENTS", "PROSPECTS", "MISSING_DOCUMENTS", "CUSTOM"]).default("ALL_CONSENTED"),
  minAge: z.coerce.number().int().min(0).max(120).optional(),
  maxAge: z.coerce.number().int().min(0).max(120).optional(),
  objective: z.string().trim().optional(),
  requireConsent: z.boolean().default(true),
})

export const marketingTemplateSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().default("GENERAL"),
  channel: z.enum(["EMAIL", "SMS", "LINKEDIN"]).default("EMAIL"),
  subject: z.string().trim().max(180).optional(),
  body: z.string().trim().min(10).max(20000),
  sensitive: z.boolean().default(false),
})

export const marketingCampaignSchema = z.object({
  name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  channel: z.enum(["EMAIL", "SMS", "LINKEDIN"]).default("EMAIL"),
  segmentId: z.string().trim().optional(),
  templateId: z.string().trim().optional(),
  subject: z.string().trim().max(180).optional(),
  body: z.string().trim().min(10).max(20000),
  ctaUrl: z.string().url().optional().or(z.literal("")),
  scheduledAt: z.string().datetime().optional().or(z.literal("")),
  timezone: z.string().trim().default("America/Toronto"),
  requestValidation: z.boolean().default(false),
})

export const marketingSequenceSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  trigger: z.enum(["NEW_PROSPECT", "QUOTE_SENT", "INACTIVE_CLIENT", "MISSING_DOCUMENT", "APPOINTMENT_BOOKED"]).default("NEW_PROSPECT"),
  templateId: z.string().trim().optional(),
  exitOnAppointment: z.boolean().default(true),
})

export const marketingSequenceEnrollmentSchema = z.object({
  sequenceId: z.string().trim().min(1),
  segmentId: z.string().trim().optional(),
})

export const marketingEmailEventSchema = z.object({
  token: z.string().trim().optional(),
  providerMessageId: z.string().trim().optional(),
  organizationId: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  event: z.enum(["DELIVERED", "BOUNCED", "COMPLAINED", "FAILED"]),
  reason: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const marketingPlaybookSchema = z.object({
  goal: z.enum(["RETIREMENT_REVIEW", "QUOTE_FOLLOW_UP", "INACTIVE_CLIENTS", "MISSING_DOCUMENTS"]).default("RETIREMENT_REVIEW"),
})

const leadFormBaseFields = [
  { name: "firstName", label: "Prénom", type: "text", required: true },
  { name: "lastName", label: "Nom", type: "text", required: true },
  { name: "email", label: "Courriel", type: "email", required: true },
  { name: "phone", label: "Téléphone", type: "tel", required: true },
  { name: "interestType", label: "Sujet principal", type: "select", required: true, options: ["Retraite", "Prévoyance", "Assurance-vie", "Protection famille", "Documents", "Autre"] },
  { name: "message", label: "Message", type: "textarea", required: false },
  { name: "consent", label: "J’accepte d’être contacté au sujet de ma demande.", type: "checkbox", required: true },
]

const starterPlaybooks = {
  RETIREMENT_REVIEW: {
    segmentPreset: "RETIREMENT",
    segmentName: "Playbook - clients retraite à convertir",
    formName: "Demande de bilan retraite",
    formSlug: "bilan-retraite",
    formTitle: "Préparez votre retraite avec un bilan personnalisé",
    formDescription: "Remplissez ce court formulaire pour demander un rendez-vous et faire le point sur vos objectifs retraite.",
    templateName: "Playbook - email bilan retraite",
    campaignName: "Playbook - campagne bilan retraite",
    sequenceName: "Playbook - séquence bilan retraite",
    objective: "Générer des rendez-vous",
    subject: "Et si nous faisions le point sur votre retraite ?",
    body: `Bonjour {{first_name}},

Je vous propose de faire un point simple sur votre situation retraite, vos objectifs et les solutions déjà en place.

Vous pouvez demander un bilan ici :
{{booking_link}}

Vous pouvez gérer vos préférences ici :
{{unsubscribe_link}}

Bien cordialement,`,
  },
  QUOTE_FOLLOW_UP: {
    segmentPreset: "PROSPECTS",
    segmentName: "Playbook - prospects à relancer",
    formName: "Demande de rendez-vous devis",
    formSlug: "relance-devis",
    formTitle: "Une question sur votre devis ?",
    formDescription: "Laissez vos coordonnées pour être rappelé ou choisir un créneau de suivi.",
    templateName: "Playbook - email relance devis",
    campaignName: "Playbook - relance devis",
    sequenceName: "Playbook - séquence relance devis",
    objective: "Relancer des prospects",
    subject: "Avez-vous pu regarder notre proposition ?",
    body: `Bonjour {{first_name}},

Je me permets de revenir vers vous concernant notre dernier échange.

Si vous souhaitez poser vos questions ou faire le point, vous pouvez utiliser ce lien :
{{booking_link}}

Gérer vos préférences :
{{unsubscribe_link}}

Bien cordialement,`,
  },
  INACTIVE_CLIENTS: {
    segmentPreset: "INACTIVE_CLIENTS",
    segmentName: "Playbook - clients inactifs à revoir",
    formName: "Demande de bilan annuel",
    formSlug: "bilan-annuel",
    formTitle: "Planifiez votre bilan annuel",
    formDescription: "Un court point permet de vérifier que vos informations et vos contrats restent à jour.",
    templateName: "Playbook - email clients inactifs",
    campaignName: "Playbook - réactivation clients inactifs",
    sequenceName: "Playbook - séquence clients inactifs",
    objective: "Réactiver des clients inactifs",
    subject: "Et si nous faisions un point annuel ?",
    body: `Bonjour {{first_name}},

Cela fait quelque temps que nous n’avons pas fait le point ensemble.

Je vous propose un échange simple pour vérifier que votre situation, vos objectifs et vos contrats sont toujours à jour :
{{booking_link}}

Désinscription :
{{unsubscribe_link}}

Bien cordialement,`,
  },
  MISSING_DOCUMENTS: {
    segmentPreset: "MISSING_DOCUMENTS",
    segmentName: "Playbook - dossiers incomplets",
    formName: "Dépôt ou demande de document",
    formSlug: "documents-manquants",
    formTitle: "Complétez votre dossier",
    formDescription: "Transmettez vos informations pour finaliser ou mettre à jour votre dossier.",
    templateName: "Playbook - email documents manquants",
    campaignName: "Playbook - relance documents",
    sequenceName: "Playbook - séquence documents manquants",
    objective: "Demander des documents",
    subject: "Un document manque à votre dossier",
    body: `Bonjour {{first_name}},

Il nous manque encore un élément pour compléter votre dossier.

Vous pouvez répondre ou utiliser ce lien pour finaliser votre demande :
{{booking_link}}

Gérer vos préférences :
{{unsubscribe_link}}

Bien cordialement,`,
  },
} satisfies Record<string, {
  segmentPreset: z.infer<typeof marketingSegmentSchema>["preset"]
  segmentName: string
  formName: string
  formSlug: string
  formTitle: string
  formDescription: string
  templateName: string
  campaignName: string
  sequenceName: string
  objective: string
  subject: string
  body: string
}>

type Recipient = {
  clientId?: string | null
  leadId?: string | null
  email: string
  name: string
  consentStatus: "GIVEN" | "MISSING" | "UNSUBSCRIBED" | "PRESSURE_LIMIT"
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null
}

function ageFromDate(date?: Date | null) {
  if (!date) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) age -= 1
  return age
}

function hasMarketingConsent(client: {
  consentGiven: boolean
  consents: Array<{ type: string; status: ConsentStatus; purpose?: { code: string; name: string } | null; purposeText?: string | null; expiresAt?: Date | null }>
}) {
  if (client.consentGiven) return true
  const now = new Date()
  return client.consents.some((consent) => {
    if (consent.status !== ConsentStatus.GIVEN) return false
    if (consent.expiresAt && consent.expiresAt <= now) return false
    const label = `${consent.type} ${consent.purpose?.code ?? ""} ${consent.purpose?.name ?? ""} ${consent.purposeText ?? ""}`.toLowerCase()
    return ["marketing", "prospection", "commercial", "communication", "email", "courriel"].some((token) => label.includes(token))
  })
}

function leadHasContactConsent(submissions: Array<{ payload: Prisma.JsonValue }>) {
  return submissions.some((submission) => {
    const payload = submission.payload as Record<string, unknown> | null
    return payload?.consent === true || payload?.consent === "true" || payload?.marketingConsent === true
  })
}

function renderTemplate(value: string, recipient: Recipient, unsubscribeUrl?: string, trackingUrl?: string, ctaUrl?: string | null) {
  return value
    .replaceAll("{{first_name}}", recipient.name.split(" ")[0] ?? "")
    .replaceAll("{{name}}", recipient.name)
    .replaceAll("{{email}}", recipient.email)
    .replaceAll("{{unsubscribe_link}}", unsubscribeUrl ?? "")
    .replaceAll("{{tracking_pixel}}", trackingUrl ? `<img src="${trackingUrl}" width="1" height="1" alt="" />` : "")
    .replaceAll("{{booking_link}}", ctaUrl ?? "")
}

function isHtmlLike(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function token() {
  return crypto.randomBytes(18).toString("base64url")
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function scoreStatus(score: number) {
  if (score >= 81) return "VERY_HOT"
  if (score >= 61) return "HOT"
  if (score >= 31) return "WARM"
  return "COLD"
}

export function checkMarketingCompliance(input: { subject?: string | null; body: string; channel: string; requestValidation?: boolean }) {
  const text = `${input.subject ?? ""} ${input.body}`.toLowerCase()
  const riskyTerms = riskyMarketingTerms.filter((term) => text.includes(term))
  const hasUnsubscribe = input.channel !== "EMAIL" || input.body.includes("{{unsubscribe_link}}") || input.body.toLowerCase().includes("désinscription")
  const needsReview = Boolean(input.requestValidation || riskyTerms.length > 0 || !hasUnsubscribe)

  return {
    valid: riskyTerms.length === 0 && hasUnsubscribe,
    needsReview,
    riskyTerms,
    checks: [
      { key: "consent", label: "Consentement marketing obligatoire", status: "PASS" },
      { key: "unsubscribe", label: "Lien de désinscription", status: hasUnsubscribe ? "PASS" : "WARN" },
      { key: "risky_terms", label: "Promesses ou conseil sensible", status: riskyTerms.length === 0 ? "PASS" : "REVIEW", riskyTerms },
      { key: "human_validation", label: "Validation humaine avant envoi sensible", status: needsReview ? "REQUIRED" : "PASS" },
    ],
  }
}

export async function estimateSegmentRecipients({ organizationId, criteria }: { organizationId: string; criteria: z.infer<typeof marketingSegmentSchema> }) {
  const recipients = await resolveSegmentRecipients({ organizationId, criteria })
  return recipients.filter((recipient) => recipient.consentStatus === "GIVEN").length
}

export async function createMarketingSegment({ organizationId, input }: { organizationId: string; input: unknown }) {
  const parsed = marketingSegmentSchema.parse(input)
  const estimatedCount = await estimateSegmentRecipients({ organizationId, criteria: parsed })
  return prisma.marketingSegment.create({
    data: {
      organizationId,
      name: parsed.name,
      description: parsed.description,
      criteria: parsed as Prisma.InputJsonValue,
      estimatedCount,
    },
  })
}

export async function createMarketingTemplate({ organizationId, input }: { organizationId: string; input: unknown }) {
  const parsed = marketingTemplateSchema.parse(input)
  const compliance = checkMarketingCompliance({ subject: parsed.subject, body: parsed.body, channel: parsed.channel, requestValidation: parsed.sensitive })
  return prisma.marketingTemplate.create({
    data: {
      organizationId,
      name: parsed.name,
      category: parsed.category,
      channel: parsed.channel,
      subject: parsed.subject,
      body: parsed.body,
      sensitive: parsed.sensitive,
      validationStatus: compliance.needsReview ? "REVIEW_REQUIRED" : "VALIDATED",
      status: compliance.needsReview ? "DRAFT" : "ACTIVE",
      variables: ["{{first_name}}", "{{booking_link}}", "{{unsubscribe_link}}"] as Prisma.InputJsonValue,
    },
  })
}

export async function createMarketingCampaign({ organizationId, userId, input }: { organizationId: string; userId: string; input: unknown }) {
  const parsed = marketingCampaignSchema.parse(input)
  const template = parsed.templateId
    ? await prisma.marketingTemplate.findFirst({ where: { id: parsed.templateId, organizationId } })
    : null
  const subject = parsed.subject || template?.subject || parsed.name
  const body = parsed.body || template?.body || ""
  const compliance = checkMarketingCompliance({ subject, body, channel: parsed.channel, requestValidation: parsed.requestValidation || template?.sensitive === true })
  const segment = parsed.segmentId
    ? await prisma.marketingSegment.findFirst({ where: { id: parsed.segmentId, organizationId } })
    : null

  return prisma.marketingCampaign.create({
    data: {
      organizationId,
      createdById: userId,
      segmentId: segment?.id,
      templateId: template?.id,
      name: parsed.name,
      objective: parsed.objective,
      channel: parsed.channel,
      subject,
      body,
      ctaUrl: parsed.ctaUrl || null,
      timezone: parsed.timezone,
      scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
      status: compliance.needsReview ? "REVIEW_REQUIRED" : parsed.scheduledAt ? "SCHEDULED" : "DRAFT",
      validationStatus: compliance.needsReview ? "REVIEW_REQUIRED" : "VALIDATED",
      complianceChecks: compliance as Prisma.InputJsonValue,
      pressureRules: { maxEmailsPer30Days: 2, excludeScheduledAppointments: true } as Prisma.InputJsonValue,
      stats: { sent: 0, opened: 0, clicked: 0, unsubscribed: 0, skipped: 0, booked: 0, opportunities: 0 } as Prisma.InputJsonValue,
    },
    include: { segment: true, template: true, _count: { select: { sends: true } } },
  })
}

export async function approveMarketingCampaign({ organizationId, userId, role, campaignId }: { organizationId: string; userId: string; role: string; campaignId: string }) {
  if (!["OWNER", "COMPLIANCE", "DEVELOPER"].includes(role)) throw new Error("MARKETING_APPROVAL_FORBIDDEN")
  const campaign = await prisma.marketingCampaign.findFirst({ where: { id: campaignId, organizationId } })
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_FOUND")
  const compliance = checkMarketingCompliance({
    subject: campaign.subject,
    body: campaign.body,
    channel: campaign.channel,
    requestValidation: false,
  })
  if (compliance.riskyTerms.length > 0) throw new Error("MARKETING_RISKY_TERMS")

  return prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: {
      approvedById: userId,
      validationStatus: "VALIDATED",
      status: campaign.scheduledAt ? "SCHEDULED" : "DRAFT",
      complianceChecks: { ...compliance, approvedById: userId, approvedAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
    include: { segment: true, template: true, _count: { select: { sends: true } } },
  })
}

export async function createMarketingSequence({ organizationId, input }: { organizationId: string; input: unknown }) {
  const parsed = marketingSequenceSchema.parse(input)
  const template = parsed.templateId
    ? await prisma.marketingTemplate.findFirst({ where: { id: parsed.templateId, organizationId } })
    : null

  const baseSubject = template?.subject ?? "Faisons le point"
  const baseBody = template?.body ?? `Bonjour {{first_name}},

Je vous propose de faire le point simplement.

Vous pouvez réserver un créneau ici :
{{booking_link}}

Pour gérer vos préférences :
{{unsubscribe_link}}`

  return prisma.marketingSequence.create({
    data: {
      organizationId,
      name: parsed.name,
      description: parsed.description,
      trigger: parsed.trigger,
      status: "ACTIVE",
      exitRules: { appointmentBooked: parsed.exitOnAppointment, unsubscribe: true } as Prisma.InputJsonValue,
      steps: {
        create: [
          {
            position: 1,
            delayDays: 0,
            actionType: "SEND_EMAIL",
            templateId: template?.id,
            subject: baseSubject,
            body: baseBody,
          },
          {
            position: 2,
            delayDays: 3,
            actionType: "SEND_EMAIL",
            subject: "Un court rappel",
            body: `Bonjour {{first_name}},

Je me permets de revenir vers vous au sujet de mon précédent message.

Vous pouvez choisir un créneau ici :
{{booking_link}}

Désinscription :
{{unsubscribe_link}}`,
          },
          {
            position: 3,
            delayDays: 7,
            actionType: "CREATE_TASK",
            condition: { ifNoAppointment: true } as Prisma.InputJsonValue,
            body: "Appeler le prospect si aucun rendez-vous n’a été réservé après la séquence.",
          },
        ],
      },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  })
}

export async function enrollMarketingSequenceSegment({ organizationId, input }: { organizationId: string; input: unknown }) {
  const parsed = marketingSequenceEnrollmentSchema.parse(input)
  const sequence = await prisma.marketingSequence.findFirst({
    where: { id: parsed.sequenceId, organizationId },
    include: { steps: { orderBy: { position: "asc" } } },
  })
  if (!sequence) throw new Error("MARKETING_SEQUENCE_NOT_FOUND")

  const segment = parsed.segmentId
    ? await prisma.marketingSegment.findFirst({ where: { id: parsed.segmentId, organizationId } })
    : null
  const criteria = segment?.criteria ?? { name: "Contacts consentants", preset: "ALL_CONSENTED", requireConsent: true }
  const recipients = await resolveSegmentRecipients({ organizationId, criteria })
  const allowedRecipients = recipients.filter((recipient) => recipient.consentStatus === "GIVEN").slice(0, 500)
  const now = new Date()

  const enrollments = []
  for (const recipient of allowedRecipients) {
    enrollments.push(await prisma.marketingSequenceEnrollment.upsert({
      where: { sequenceId_email: { sequenceId: sequence.id, email: recipient.email } },
      create: {
        organizationId,
        sequenceId: sequence.id,
        clientId: recipient.clientId,
        leadId: recipient.leadId,
        email: recipient.email,
        name: recipient.name,
        status: "ACTIVE",
        currentStepPosition: sequence.steps[0]?.position ?? 1,
        nextRunAt: now,
        metadata: { segmentId: segment?.id ?? null, source: "SEGMENT_ENROLLMENT" } as Prisma.InputJsonValue,
      },
      update: {
        status: "ACTIVE",
        currentStepPosition: sequence.steps[0]?.position ?? 1,
        nextRunAt: now,
        exitedAt: null,
        completedAt: null,
        exitReason: null,
      },
    }))
  }

  return {
    sequenceId: sequence.id,
    enrolled: enrollments.length,
    skipped: recipients.length - allowedRecipients.length,
  }
}

function playbookSlug(base: string, userId: string) {
  const suffix = userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-8) || token().slice(0, 8)
  return `${base}-${suffix}`
}

async function ensurePlaybookLeadForm({ organizationId, userId, definition }: {
  organizationId: string
  userId: string
  definition: (typeof starterPlaybooks)[keyof typeof starterPlaybooks]
}) {
  const existing = await prisma.leadForm.findFirst({
    where: { organizationId, advisorId: userId, name: definition.formName },
    orderBy: { updatedAt: "desc" },
  })
  if (existing) return existing

  const baseSlug = playbookSlug(definition.formSlug, userId)
  const slugExists = await prisma.leadForm.findUnique({ where: { slug: baseSlug }, select: { id: true } })
  const slug = slugExists ? `${baseSlug}-${token().slice(0, 5)}` : baseSlug

  return prisma.leadForm.create({
    data: {
      organizationId,
      advisorId: userId,
      name: definition.formName,
      slug,
      publicTitle: definition.formTitle,
      publicDescription: definition.formDescription,
      successMessage: "Merci. Votre demande a été envoyée au conseiller.",
      fields: leadFormBaseFields as Prisma.InputJsonValue,
    },
  })
}

async function ensurePlaybookTask({ organizationId, userId, title, description }: {
  organizationId: string
  userId: string
  title: string
  description: string
}) {
  const existing = await prisma.task.findFirst({
    where: {
      organizationId,
      assignedToId: userId,
      title,
      status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
    },
    select: { id: true },
  })
  if (existing) return existing

  return prisma.task.create({
    data: {
      organizationId,
      assignedToId: userId,
      createdById: userId,
      type: "FOLLOW_UP",
      title,
      description,
      priority: "HIGH",
      dueDate: new Date(),
      isAutomated: true,
    },
    select: { id: true },
  })
}

export async function createMarketingStarterPlaybook({ organizationId, userId, input }: {
  organizationId: string
  userId: string
  input: unknown
}) {
  const parsed = marketingPlaybookSchema.parse(input)
  const definition = starterPlaybooks[parsed.goal]
  const leadForm = await ensurePlaybookLeadForm({ organizationId, userId, definition })
  const publicFormUrl = `${appBaseUrl()}/f/${leadForm.slug}/contact`
  const bookingUrl = `${appBaseUrl()}/rendez-vous/cabinet/${organizationId}`

  const segment = await prisma.marketingSegment.findFirst({
    where: { organizationId, name: definition.segmentName },
    orderBy: { updatedAt: "desc" },
  }) ?? await createMarketingSegment({
    organizationId,
    input: {
      name: definition.segmentName,
      description: "Segment créé automatiquement depuis le plan débutant marketing.",
      preset: definition.segmentPreset,
      minAge: parsed.goal === "RETIREMENT_REVIEW" ? 45 : 18,
      maxAge: parsed.goal === "RETIREMENT_REVIEW" ? 65 : 90,
      requireConsent: true,
    },
  })

  const template = await prisma.marketingTemplate.findFirst({
    where: { organizationId, name: definition.templateName },
    orderBy: { updatedAt: "desc" },
  }) ?? await createMarketingTemplate({
    organizationId,
    input: {
      name: definition.templateName,
      category: "PLAYBOOK",
      channel: "EMAIL",
      subject: definition.subject,
      body: definition.body,
      sensitive: false,
    },
  })

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { organizationId, name: definition.campaignName },
    include: { segment: true, template: true, _count: { select: { sends: true } } },
    orderBy: { updatedAt: "desc" },
  }) ?? await createMarketingCampaign({
    organizationId,
    userId,
    input: {
      name: definition.campaignName,
      objective: definition.objective,
      channel: "EMAIL",
      segmentId: segment.id,
      templateId: template.id,
      subject: template.subject ?? definition.subject,
      body: template.body,
      ctaUrl: publicFormUrl,
      timezone: "America/Toronto",
      requestValidation: false,
    },
  })

  const sequence = await prisma.marketingSequence.findFirst({
    where: { organizationId, name: definition.sequenceName },
    include: { steps: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  }) ?? await createMarketingSequence({
    organizationId,
    input: {
      name: definition.sequenceName,
      description: "Séquence créée automatiquement: J0 email, J+3 relance, J+7 tâche appel.",
      trigger: parsed.goal === "QUOTE_FOLLOW_UP" ? "QUOTE_SENT" : parsed.goal === "MISSING_DOCUMENTS" ? "MISSING_DOCUMENT" : parsed.goal === "INACTIVE_CLIENTS" ? "INACTIVE_CLIENT" : "NEW_PROSPECT",
      templateId: template.id,
      exitOnAppointment: true,
    },
  })

  const enrollment = await enrollMarketingSequenceSegment({
    organizationId,
    input: { sequenceId: sequence.id, segmentId: segment.id },
  })

  const task = await ensurePlaybookTask({
    organizationId,
    userId,
    title: `Partager le lien marketing - ${definition.formName}`,
    description: `Lien public à partager dans vos emails, LinkedIn ou site web:\n${publicFormUrl}\n\nLien de rendez-vous cabinet:\n${bookingUrl}`,
  })

  await prisma.marketingEvent.create({
    data: {
      organizationId,
      campaignId: campaign.id,
      type: "PLAYBOOK_CREATED",
      source: "MARKETING_PLAYBOOK",
      metadata: {
        goal: parsed.goal,
        segmentId: segment.id,
        templateId: template.id,
        sequenceId: sequence.id,
        leadFormId: leadForm.id,
        publicFormUrl,
        bookingUrl,
        taskId: task.id,
        enrolled: enrollment.enrolled,
        skipped: enrollment.skipped,
      } as Prisma.InputJsonValue,
    },
  })

  return {
    goal: parsed.goal,
    segment,
    template,
    campaign,
    sequence,
    enrollment,
    leadForm: {
      id: leadForm.id,
      name: leadForm.name,
      slug: leadForm.slug,
      publicUrl: publicFormUrl,
    },
    bookingUrl,
    taskId: task.id,
    nextSteps: [
      "Partager le lien public sur votre site, LinkedIn ou dans une signature email.",
      "Connecter Gmail pour envoyer la campagne depuis le SaaS.",
      "Exécuter les séquences dues pour créer les relances J0/J+3/J+7.",
      "Suivre les clics, rendez-vous et prospects chauds dans le tableau marketing.",
    ],
  }
}

export async function enrollLeadInMarketingSequences({
  organizationId,
  leadId,
  email,
  name,
  consent,
  metadata,
}: {
  organizationId: string
  leadId: string
  email?: string | null
  name?: string | null
  consent: boolean
  metadata?: Prisma.InputJsonValue
}) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !consent) return { enrolled: 0, skipped: normalizedEmail ? 1 : 0 }

  const sequences = await prisma.marketingSequence.findMany({
    where: { organizationId, trigger: "NEW_PROSPECT", status: "ACTIVE" },
    include: { steps: { orderBy: { position: "asc" } } },
    take: 20,
  })
  const now = new Date()
  let enrolled = 0

  for (const sequence of sequences) {
    await prisma.marketingSequenceEnrollment.upsert({
      where: { sequenceId_email: { sequenceId: sequence.id, email: normalizedEmail } },
      create: {
        organizationId,
        sequenceId: sequence.id,
        leadId,
        email: normalizedEmail,
        name,
        status: "ACTIVE",
        currentStepPosition: sequence.steps[0]?.position ?? 1,
        nextRunAt: now,
        metadata: {
          source: "LEAD_FORM_SUBMISSION",
          ...(metadata as Record<string, unknown> | undefined),
        } as Prisma.InputJsonValue,
      },
      update: {
        leadId,
        name,
        status: "ACTIVE",
        currentStepPosition: sequence.steps[0]?.position ?? 1,
        nextRunAt: now,
        exitedAt: null,
        completedAt: null,
        exitReason: null,
      },
    })
    enrolled += 1
  }

  await prisma.marketingEvent.create({
    data: {
      organizationId,
      leadId,
      type: "FORM_SUBMITTED",
      source: "LEAD_FORM",
      metadata: {
        email: normalizedEmail,
        name,
        enrolledSequences: enrolled,
        ...(metadata as Record<string, unknown> | undefined),
      } as Prisma.InputJsonValue,
    },
  })

  const existing = await prisma.marketingLeadScore.findUnique({
    where: { organizationId_email: { organizationId, email: normalizedEmail } },
    select: { score: true, signals: true },
  })
  const currentSignals = Array.isArray(existing?.signals) ? existing.signals.filter((item): item is string => typeof item === "string") : []
  const score = Math.max(existing?.score ?? 0, Math.min(100, (existing?.score ?? 0) + 30))
  await prisma.marketingLeadScore.upsert({
    where: { organizationId_email: { organizationId, email: normalizedEmail } },
    create: {
      organizationId,
      leadId,
      email: normalizedEmail,
      name,
      score,
      status: scoreStatus(score),
      signals: ["Formulaire rempli", enrolled > 0 ? "Séquence automatique activée" : "Prospect créé"] as Prisma.InputJsonValue,
      lastSignalAt: now,
    },
    update: {
      leadId,
      name,
      score,
      status: scoreStatus(score),
      signals: Array.from(new Set([...currentSignals, "Formulaire rempli", enrolled > 0 ? "Séquence automatique activée" : "Prospect créé"])).slice(0, 8) as Prisma.InputJsonValue,
      lastSignalAt: now,
    },
  })

  return { enrolled, skipped: sequences.length - enrolled }
}

async function resolveSegmentRecipients({ organizationId, criteria }: { organizationId: string; criteria: unknown }): Promise<Recipient[]> {
  const parsed = marketingSegmentSchema.catch({
    name: "Segment",
    preset: "ALL_CONSENTED",
    requireConsent: true,
  }).parse(criteria)

  const [clients, leads, unsubscribes, recentSends] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      include: {
        consents: { include: { purpose: true } },
        documents: { select: { status: true }, take: 20 },
      },
      take: 1000,
    }),
    prisma.lead.findMany({
      where: { organizationId, status: { notIn: ["ARCHIVED", "LOST", "CONVERTED"] } },
      include: { leadFormSubmissions: { select: { payload: true }, take: 5, orderBy: { createdAt: "desc" } } },
      take: 1000,
    }),
    prisma.marketingUnsubscribe.findMany({ where: { organizationId, channel: "EMAIL" }, select: { email: true } }),
    prisma.marketingSend.findMany({
      where: { organizationId, sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { email: true },
    }),
  ])

  const unsubscribedEmails = new Set(unsubscribes.map((item) => normalizeEmail(item.email)).filter(Boolean))
  const sendCounts = new Map<string, number>()
  for (const send of recentSends) {
    const email = normalizeEmail(send.email)
    if (email) sendCounts.set(email, (sendCounts.get(email) ?? 0) + 1)
  }

  const clientRecipients = clients
    .filter((client) => {
      if (parsed.preset === "RETIREMENT") {
        const age = ageFromDate(client.dateOfBirth)
        if (age !== null && (age < (parsed.minAge ?? 45) || age > (parsed.maxAge ?? 65))) return false
        const text = `${client.goals ?? ""}`.toLowerCase()
        return age !== null || text.includes("retraite") || text.includes("retirement") || text.includes("per")
      }
      if (parsed.preset === "INACTIVE_CLIENTS") {
        return !client.lastInteractionDate || client.lastInteractionDate < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      }
      if (parsed.preset === "MISSING_DOCUMENTS") {
        return client.documents.some((document) => ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"].includes(document.status))
      }
      if (parsed.preset === "PROSPECTS") return false
      return true
    })
    .map<Recipient | null>((client) => {
      const email = normalizeEmail(client.emailPrimary ?? client.email)
      const consent = hasMarketingConsent(client)
      return email ? {
        clientId: client.id,
        email,
        name: `${client.firstName} ${client.lastName}`.trim(),
        consentStatus: !consent ? "MISSING" as const : unsubscribedEmails.has(email) ? "UNSUBSCRIBED" as const : (sendCounts.get(email) ?? 0) >= 2 ? "PRESSURE_LIMIT" as const : "GIVEN" as const,
      } : null
    })
    .filter((recipient): recipient is Recipient => Boolean(recipient))

  const leadRecipients = leads
    .filter((lead) => parsed.preset === "PROSPECTS" || parsed.preset === "ALL_CONSENTED")
    .map<Recipient | null>((lead) => {
      const email = normalizeEmail(lead.email)
      const consent = leadHasContactConsent(lead.leadFormSubmissions)
      return email ? {
        leadId: lead.id,
        email,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        consentStatus: !consent ? "MISSING" as const : unsubscribedEmails.has(email) ? "UNSUBSCRIBED" as const : (sendCounts.get(email) ?? 0) >= 2 ? "PRESSURE_LIMIT" as const : "GIVEN" as const,
      } : null
    })
    .filter((recipient): recipient is Recipient => Boolean(recipient))

  const seen = new Set<string>()
  return [...clientRecipients, ...leadRecipients].filter((recipient) => {
    if (seen.has(recipient.email)) return false
    seen.add(recipient.email)
    return true
  })
}

export async function resolveCampaignRecipients({ organizationId, campaignId }: { organizationId: string; campaignId: string }) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { segment: true },
  })
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_FOUND")
  const criteria = campaign.segment?.criteria ?? { name: "Contacts consentants", preset: "ALL_CONSENTED", requireConsent: true }
  const recipients = await resolveSegmentRecipients({ organizationId, criteria })
  return { campaign, recipients }
}

export async function sendMarketingCampaign({ organizationId, userId, campaignId }: { organizationId: string; userId: string; campaignId: string }) {
  const { campaign, recipients } = await resolveCampaignRecipients({ organizationId, campaignId })
  if (campaign.validationStatus === "REVIEW_REQUIRED") throw new Error("MARKETING_VALIDATION_REQUIRED")

  const now = new Date()
  const baseUrl = appBaseUrl()
  const createdSends = []
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const recipient of recipients.slice(0, 500)) {
    const unsubscribeToken = token()
    const send = await prisma.marketingSend.create({
      data: {
        organizationId,
        campaignId,
        clientId: recipient.clientId,
        leadId: recipient.leadId,
        email: recipient.email,
        name: recipient.name,
        consentStatus: recipient.consentStatus,
        unsubscribeToken,
        status: recipient.consentStatus === "GIVEN" ? "QUEUED" : "SKIPPED",
        errorCode: recipient.consentStatus === "GIVEN" ? null : recipient.consentStatus,
      },
    })
    createdSends.push(send)
    if (recipient.consentStatus !== "GIVEN") {
      skipped += 1
      continue
    }

    const unsubscribeUrl = `${baseUrl}/api/marketing/preferences/${send.unsubscribeToken}`
    const trackingUrl = `${baseUrl}/api/marketing/track/open/${send.unsubscribeToken}`
    const clickUrl = campaign.ctaUrl ? `${baseUrl}/api/marketing/track/click/${send.unsubscribeToken}?url=${encodeURIComponent(campaign.ctaUrl)}` : ""
    const subject = renderTemplate(campaign.subject ?? campaign.name, recipient, unsubscribeUrl, trackingUrl, clickUrl)
    const body = renderTemplate(campaign.body, recipient, unsubscribeUrl, trackingUrl, clickUrl)
    const html = isHtmlLike(body)
      ? `${body}${trackingUrl ? `<img src="${trackingUrl}" width="1" height="1" alt="" />` : ""}<p><a href="${unsubscribeUrl}">Se désinscrire</a></p>`
      : undefined
    const text = html ? body.replace(/<[^>]+>/g, " ") : `${body}\n\nSe désinscrire: ${unsubscribeUrl}`

    try {
      const provider = campaign.channel === "EMAIL"
        ? await sendAdvisorGmailEmail({ organizationId, userId, to: recipient.email, subject, text, html })
        : null
      if (!provider && campaign.channel === "EMAIL") throw new Error("GMAIL_NOT_CONNECTED")
      await prisma.marketingSend.update({
        where: { id: send.id },
        data: { status: "SENT", sentAt: now, providerMessageId: provider?.id ?? null },
      })
      await prisma.marketingEvent.create({
        data: { organizationId, campaignId, sendId: send.id, clientId: recipient.clientId, leadId: recipient.leadId, type: "SENT", metadata: { email: recipient.email } },
      })
      sent += 1
    } catch (error) {
      await prisma.marketingSend.update({
        where: { id: send.id },
        data: { status: "FAILED", errorCode: "SEND_FAILED", errorMessage: error instanceof Error ? error.message : "Send failed" },
      })
      failed += 1
    }
  }

  const status = sent > 0 ? "SENT" : failed > 0 ? "BLOCKED" : "SKIPPED"
  const stats = { sent, skipped, failed, total: recipients.length, opened: 0, clicked: 0, unsubscribed: 0, booked: 0, opportunities: 0 }
  const updatedCampaign = await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: { status, sentAt: sent > 0 ? now : null, stats: stats as Prisma.InputJsonValue },
    include: { segment: true, template: true, _count: { select: { sends: true } } },
  })
  return { campaign: updatedCampaign, stats, sends: createdSends }
}

async function ensureSequenceCampaign({ organizationId, userId, sequenceId, name }: { organizationId: string; userId: string; sequenceId: string; name: string }) {
  const existing = await prisma.marketingCampaign.findFirst({ where: { organizationId, sequenceId } })
  if (existing) return existing
  return prisma.marketingCampaign.create({
    data: {
      organizationId,
      createdById: userId,
      sequenceId,
      name: `Séquence - ${name}`,
      objective: "Nurturing automatisé",
      channel: "EMAIL",
      status: "ACTIVE",
      subject: name,
      body: "Campagne technique utilisée pour tracer les envois de séquence.",
      validationStatus: "VALIDATED",
      stats: { sent: 0, opened: 0, clicked: 0, unsubscribed: 0, skipped: 0, booked: 0, opportunities: 0 } as Prisma.InputJsonValue,
    },
  })
}

async function sendSequenceEmailStep({ organizationId, userId, campaignId, enrollment, subject, body }: {
  organizationId: string
  userId: string
  campaignId: string
  enrollment: { clientId: string | null; leadId: string | null; email: string; name: string | null }
  subject: string
  body: string
}) {
  const unsubscribe = await prisma.marketingUnsubscribe.findFirst({ where: { organizationId, email: enrollment.email, channel: "EMAIL" } })
  const unsubscribeToken = token()
  const send = await prisma.marketingSend.create({
    data: {
      organizationId,
      campaignId,
      clientId: enrollment.clientId,
      leadId: enrollment.leadId,
      email: enrollment.email,
      name: enrollment.name,
      consentStatus: unsubscribe ? "UNSUBSCRIBED" : "GIVEN",
      unsubscribeToken,
      status: unsubscribe ? "SKIPPED" : "QUEUED",
      errorCode: unsubscribe ? "UNSUBSCRIBED" : null,
    },
  })
  if (unsubscribe) return { status: "SKIPPED" as const, send }

  const baseUrl = appBaseUrl()
  const recipient: Recipient = {
    clientId: enrollment.clientId,
    leadId: enrollment.leadId,
    email: enrollment.email,
    name: enrollment.name ?? enrollment.email,
    consentStatus: "GIVEN",
  }
  const unsubscribeUrl = `${baseUrl}/api/marketing/preferences/${send.unsubscribeToken}`
  const trackingUrl = `${baseUrl}/api/marketing/track/open/${send.unsubscribeToken}`
  const renderedSubject = renderTemplate(subject, recipient, unsubscribeUrl, trackingUrl)
  const renderedBody = renderTemplate(body, recipient, unsubscribeUrl, trackingUrl)
  const html = isHtmlLike(renderedBody)
    ? `${renderedBody}<img src="${trackingUrl}" width="1" height="1" alt="" /><p><a href="${unsubscribeUrl}">Gérer mes préférences</a></p>`
    : undefined
  const text = html ? renderedBody.replace(/<[^>]+>/g, " ") : `${renderedBody}\n\nGérer mes préférences: ${unsubscribeUrl}`

  try {
    const provider = await sendAdvisorGmailEmail({ organizationId, userId, to: enrollment.email, subject: renderedSubject, text, html })
    if (!provider) throw new Error("GMAIL_NOT_CONNECTED")
    await prisma.marketingSend.update({
      where: { id: send.id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: provider.id },
    })
    await prisma.marketingEvent.create({
      data: { organizationId, campaignId, sendId: send.id, clientId: enrollment.clientId, leadId: enrollment.leadId, type: "SEQUENCE_STEP_SENT", metadata: { email: enrollment.email } },
    })
    return { status: "SENT" as const, send }
  } catch (error) {
    await prisma.marketingSend.update({
      where: { id: send.id },
      data: { status: "FAILED", errorCode: "SEND_FAILED", errorMessage: error instanceof Error ? error.message : "Send failed" },
    })
    return { status: "FAILED" as const, send }
  }
}

export async function processDueMarketingSequences({ organizationId, userId }: { organizationId: string; userId: string }) {
  const dueEnrollments = await prisma.marketingSequenceEnrollment.findMany({
    where: { organizationId, status: "ACTIVE", nextRunAt: { lte: new Date() } },
    include: { sequence: { include: { steps: { orderBy: { position: "asc" } } } } },
    orderBy: { nextRunAt: "asc" },
    take: 50,
  })

  let processed = 0
  let sent = 0
  let tasksCreated = 0
  let exited = 0

  for (const enrollment of dueEnrollments) {
    const exitRules = enrollment.sequence.exitRules as Record<string, unknown> | null
    if (exitRules?.appointmentBooked) {
      const booking = await prisma.booking.findFirst({
        where: {
          organizationId,
          clientEmail: enrollment.email,
          createdAt: { gte: enrollment.startedAt },
          status: { notIn: ["CANCELLED", "EXPIRED"] },
        },
        select: { id: true },
      })
      if (booking) {
        await prisma.marketingSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "EXITED", exitedAt: new Date(), exitReason: "APPOINTMENT_BOOKED" },
        })
        exited += 1
        continue
      }
    }

    const step = enrollment.sequence.steps.find((item) => item.position === enrollment.currentStepPosition)
    if (!step) {
      await prisma.marketingSequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      })
      continue
    }

    const campaign = await ensureSequenceCampaign({ organizationId, userId, sequenceId: enrollment.sequenceId, name: enrollment.sequence.name })
    if (step.actionType === "SEND_EMAIL") {
      const result = await sendSequenceEmailStep({
        organizationId,
        userId,
        campaignId: campaign.id,
        enrollment,
        subject: step.subject ?? enrollment.sequence.name,
        body: step.body ?? "Bonjour {{first_name}},\n\nJe vous propose de faire le point.\n\n{{unsubscribe_link}}",
      })
      if (result.status === "SENT") sent += 1
    }

    if (step.actionType === "CREATE_TASK") {
      await prisma.task.create({
        data: {
          organizationId,
          assignedToId: userId,
          createdById: userId,
          clientId: enrollment.clientId,
          leadId: enrollment.leadId,
          type: "CALL",
          title: `Appeler ${enrollment.name ?? enrollment.email}`,
          description: step.body ?? "Prospect engagé dans une séquence marketing.",
          priority: "HIGH",
          dueDate: new Date(),
          isAutomated: true,
        },
      })
      tasksCreated += 1
    }

    const nextStep = enrollment.sequence.steps.find((item) => item.position > step.position)
    await prisma.marketingSequenceEnrollment.update({
      where: { id: enrollment.id },
      data: nextStep ? {
        currentStepPosition: nextStep.position,
        nextRunAt: addDays(new Date(), nextStep.delayDays),
        lastRunAt: new Date(),
      } : {
        status: "COMPLETED",
        completedAt: new Date(),
        lastRunAt: new Date(),
      },
    })
    processed += 1
  }

  await refreshMarketingLeadScores({ organizationId })
  return { processed, sent, tasksCreated, exited }
}

export async function sendDueMarketingCampaigns({ organizationId, userId }: { organizationId: string; userId: string }) {
  const dueCampaigns = await prisma.marketingCampaign.findMany({
    where: {
      organizationId,
      status: "SCHEDULED",
      validationStatus: "VALIDATED",
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  })

  const results = []
  for (const campaign of dueCampaigns) {
    try {
      results.push(await sendMarketingCampaign({ organizationId, userId, campaignId: campaign.id }))
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "BLOCKED",
          stats: { failed: 1, error: error instanceof Error ? error.message : "Scheduled send failed" } as Prisma.InputJsonValue,
        },
      })
    }
  }
  return { processed: results.length, results }
}

async function refreshCampaignStats({ campaignId }: { campaignId: string }) {
  const sends = await prisma.marketingSend.findMany({ where: { campaignId } })
  const stats = {
    total: sends.length,
    sent: sends.filter((send) => Boolean(send.sentAt) || ["SENT", "OPENED", "DELIVERED"].includes(send.status)).length,
    opened: sends.filter((send) => send.openedAt).length,
    clicked: sends.filter((send) => send.clickedAt).length,
    unsubscribed: sends.filter((send) => send.unsubscribedAt).length,
    skipped: sends.filter((send) => send.status === "SKIPPED").length,
    failed: sends.filter((send) => send.status === "FAILED").length,
    bounced: sends.filter((send) => send.bouncedAt).length,
    complained: sends.filter((send) => send.complainedAt).length,
    booked: sends.filter((send) => send.bookedAt).length,
    opportunities: sends.filter((send) => send.opportunityId).length,
  }
  await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { stats: stats as Prisma.InputJsonValue } })
  return stats
}

export async function trackMarketingEvent({ token: unsubscribeToken, type, url, metadata }: { token: string; type: "OPENED" | "CLICKED" | "UNSUBSCRIBED"; url?: string | null; metadata?: Prisma.InputJsonValue }) {
  const send = await prisma.marketingSend.findUnique({ where: { unsubscribeToken } })
  if (!send) return null
  const dateField = type === "OPENED" ? { openedAt: new Date(), status: send.status === "SENT" ? "OPENED" : send.status } : type === "CLICKED" ? { clickedAt: new Date() } : { unsubscribedAt: new Date(), status: "UNSUBSCRIBED" }
  const [updated] = await Promise.all([
    prisma.marketingSend.update({ where: { id: send.id }, data: dateField }),
    prisma.marketingEvent.create({
      data: {
        organizationId: send.organizationId,
        campaignId: send.campaignId,
        sendId: send.id,
        clientId: send.clientId,
        leadId: send.leadId,
        type,
        url,
        metadata,
      },
    }),
  ])
  if (type === "UNSUBSCRIBED") {
    await prisma.marketingUnsubscribe.upsert({
      where: { organizationId_email_channel: { organizationId: send.organizationId, email: send.email, channel: "EMAIL" } },
      create: { organizationId: send.organizationId, email: send.email, token: unsubscribeToken, channel: "EMAIL" },
      update: { token: unsubscribeToken },
    })
  }
  if (send.campaignId) await refreshCampaignStats({ campaignId: send.campaignId })
  await refreshMarketingLeadScores({ organizationId: send.organizationId })
  return updated
}

export async function updateMarketingPreferences({ token: unsubscribeToken, unsubscribeAll, metadata }: { token: string; unsubscribeAll: boolean; metadata?: Prisma.InputJsonValue }) {
  const send = await prisma.marketingSend.findUnique({ where: { unsubscribeToken } })
  if (!send) return null

  if (!unsubscribeAll) {
    await prisma.marketingEvent.create({
      data: {
        organizationId: send.organizationId,
        campaignId: send.campaignId,
        sendId: send.id,
        clientId: send.clientId,
        leadId: send.leadId,
        type: "PREFERENCES_UPDATED",
        metadata,
      },
    })
    return send
  }

  return trackMarketingEvent({ token: unsubscribeToken, type: "UNSUBSCRIBED", metadata })
}

export async function applyMarketingEmailEvent({ input }: { input: unknown }) {
  const parsed = marketingEmailEventSchema.parse(input)
  const email = normalizeEmail(parsed.email)
  const send = parsed.token
    ? await prisma.marketingSend.findUnique({ where: { unsubscribeToken: parsed.token } })
    : parsed.providerMessageId
      ? await prisma.marketingSend.findFirst({
          where: {
            providerMessageId: parsed.providerMessageId,
            ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
          },
          orderBy: { createdAt: "desc" },
        })
      : email && parsed.organizationId
        ? await prisma.marketingSend.findFirst({
            where: { organizationId: parsed.organizationId, email },
            orderBy: { createdAt: "desc" },
          })
        : null

  if (!send) throw new Error("MARKETING_SEND_NOT_FOUND")

  const now = new Date()
  const updateData: Prisma.MarketingSendUpdateInput = {
    errorCode: parsed.event === "FAILED" ? "EMAIL_FAILED" : parsed.event === "BOUNCED" ? "EMAIL_BOUNCED" : parsed.event === "COMPLAINED" ? "SPAM_COMPLAINT" : null,
    errorMessage: parsed.reason ?? null,
    metadata: {
      ...((send.metadata as Record<string, unknown> | null) ?? {}),
      lastEmailEvent: parsed.event,
      lastEmailEventAt: now.toISOString(),
      providerMessageId: parsed.providerMessageId,
      webhook: parsed.metadata ?? {},
    } as Prisma.InputJsonValue,
  }

  if (parsed.event === "DELIVERED") {
    updateData.status = send.status === "QUEUED" ? "SENT" : send.status
    updateData.sentAt = send.sentAt ?? now
  }
  if (parsed.event === "FAILED") {
    updateData.status = "FAILED"
  }
  if (parsed.event === "BOUNCED") {
    updateData.status = "BOUNCED"
    updateData.bouncedAt = now
  }
  if (parsed.event === "COMPLAINED") {
    updateData.status = "COMPLAINED"
    updateData.complainedAt = now
    updateData.unsubscribedAt = send.unsubscribedAt ?? now
  }

  const updated = await prisma.marketingSend.update({ where: { id: send.id }, data: updateData })
  await prisma.marketingEvent.create({
    data: {
      organizationId: send.organizationId,
      campaignId: send.campaignId,
      sendId: send.id,
      clientId: send.clientId,
      leadId: send.leadId,
      type: parsed.event === "COMPLAINED" ? "SPAM_COMPLAINT" : parsed.event,
      source: "EMAIL_PROVIDER",
      metadata: {
        reason: parsed.reason,
        providerMessageId: parsed.providerMessageId,
        webhook: parsed.metadata ?? {},
      } as Prisma.InputJsonValue,
    },
  })

  if (parsed.event === "COMPLAINED") {
    await prisma.marketingUnsubscribe.upsert({
      where: { organizationId_email_channel: { organizationId: send.organizationId, email: send.email, channel: "EMAIL" } },
      create: {
        organizationId: send.organizationId,
        email: send.email,
        token: send.unsubscribeToken,
        channel: "EMAIL",
        reason: parsed.reason,
        source: "SPAM_COMPLAINT",
      },
      update: {
        token: send.unsubscribeToken,
        reason: parsed.reason,
        source: "SPAM_COMPLAINT",
      },
    })
  }

  await refreshCampaignStats({ campaignId: send.campaignId })
  await refreshMarketingLeadScores({ organizationId: send.organizationId })
  return updated
}

function opportunityCategoryFromService(service: string) {
  const normalized = service.toLowerCase()
  if (normalized.includes("retraite") || normalized.includes("per") || normalized.includes("retirement")) return "RETIREMENT" as const
  if (normalized.includes("prévoyance") || normalized.includes("protection") || normalized.includes("famille")) return "PROTECTION" as const
  if (normalized.includes("assurance-vie") || normalized.includes("placement") || normalized.includes("patrimoine")) return "INVESTMENT" as const
  return "REVIEW_OPPORTUNITY" as const
}

export async function markMarketingBookingConversion({
  marketingToken,
  bookingId,
  taskId,
  clientId,
  leadId,
  advisorId,
  service,
  createOpportunity,
}: {
  marketingToken?: string | null
  bookingId?: string | null
  taskId?: string | null
  clientId?: string | null
  leadId?: string | null
  advisorId?: string | null
  service: string
  createOpportunity?: boolean
}) {
  if (!marketingToken) return null
  const send = await prisma.marketingSend.findUnique({ where: { unsubscribeToken: marketingToken } })
  if (!send) return null

  let opportunityId: string | null = null
  if (createOpportunity && clientId) {
    const existing = await prisma.crossSellOpportunity.findFirst({
      where: {
        organizationId: send.organizationId,
        clientId,
        status: { notIn: ["WON", "LOST", "ARCHIVED", "DISMISSED"] },
        ruleKey: `marketing_booking_${send.campaignId}`,
      },
      select: { id: true },
    })
    const opportunity = existing ?? await prisma.crossSellOpportunity.create({
      data: {
        organizationId: send.organizationId,
        clientId,
        advisorId,
        category: opportunityCategoryFromService(service),
        priority: "HIGH",
        status: "OPEN",
        title: `Opportunité issue du marketing - ${service}`,
        description: "Rendez-vous réservé après clic sur une campagne marketing.",
        rationale: "Attribution automatique campagne → rendez-vous.",
        actionLabel: "Préparer le rendez-vous",
        actionUrl: "/calendrier",
        ruleKey: `marketing_booking_${send.campaignId}`,
        confidence: 0.75,
        metadata: { marketingSendId: send.id, marketingCampaignId: send.campaignId, bookingId, taskId } as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    opportunityId = opportunity.id
  }

  const updated = await prisma.marketingSend.update({
    where: { id: send.id },
    data: {
      bookedAt: new Date(),
      clientId: clientId ?? send.clientId,
      leadId: leadId ?? send.leadId,
      opportunityId,
      metadata: {
        bookingId,
        taskId,
        service,
        advisorId,
        attribution: "BOOKING_PUBLIC_PAGE",
      } as Prisma.InputJsonValue,
    },
  })
  await prisma.marketingEvent.create({
    data: {
      organizationId: send.organizationId,
      campaignId: send.campaignId,
      sendId: send.id,
      clientId: clientId ?? send.clientId,
      leadId: leadId ?? send.leadId,
      type: opportunityId ? "BOOKING_AND_OPPORTUNITY_CREATED" : "BOOKING_CREATED",
      metadata: { bookingId, taskId, service, opportunityId } as Prisma.InputJsonValue,
    },
  })
  await refreshCampaignStats({ campaignId: send.campaignId })
  await refreshMarketingLeadScores({ organizationId: send.organizationId })
  return { send: updated, opportunityId }
}

export async function refreshMarketingLeadScores({ organizationId }: { organizationId: string }) {
  const sends = await prisma.marketingSend.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 1000,
  })

  const grouped = new Map<string, typeof sends>()
  for (const send of sends) {
    const email = normalizeEmail(send.email)
    if (!email) continue
    grouped.set(email, [...(grouped.get(email) ?? []), send])
  }

  const scores = []
  for (const [email, items] of grouped) {
    let score = 0
    const signals: string[] = []
    const latest = items[0]
    for (const item of items) {
      if (item.sentAt) {
        score += 2
        signals.push("Email envoyé")
      }
      if (item.openedAt) {
        score += 5
        signals.push("Email ouvert")
      }
      if (item.clickedAt) {
        score += 15
        signals.push("Lien cliqué")
      }
      if (item.bookedAt) {
        score += 50
        signals.push("Rendez-vous réservé")
      }
      if (item.opportunityId) {
        score += 40
        signals.push("Opportunité créée")
      }
      if (item.status === "FAILED") {
        score -= 20
        signals.push("Erreur d’envoi")
      }
      if (item.unsubscribedAt || item.status === "UNSUBSCRIBED") {
        score -= 100
        signals.push("Désinscription")
      }
      if (item.bouncedAt || item.complainedAt) {
        score -= 100
        signals.push("Bounce ou plainte spam")
      }
    }
    const boundedScore = Math.max(0, Math.min(100, score))
    const record = await prisma.marketingLeadScore.upsert({
      where: { organizationId_email: { organizationId, email } },
      create: {
        organizationId,
        clientId: latest.clientId,
        leadId: latest.leadId,
        email,
        name: latest.name,
        score: boundedScore,
        status: scoreStatus(boundedScore),
        signals: Array.from(new Set(signals)).slice(0, 8) as Prisma.InputJsonValue,
        lastSignalAt: latest.updatedAt,
      },
      update: {
        clientId: latest.clientId,
        leadId: latest.leadId,
        name: latest.name,
        score: boundedScore,
        status: scoreStatus(boundedScore),
        signals: Array.from(new Set(signals)).slice(0, 8) as Prisma.InputJsonValue,
        lastSignalAt: latest.updatedAt,
      },
    })
    scores.push(record)
  }
  return scores.sort((a, b) => b.score - a.score)
}

export async function getMarketingOverview({ organizationId }: { organizationId: string }) {
  await refreshMarketingLeadScores({ organizationId })
  const [segments, templates, campaigns, sequences, enrollments, leadScores, sends, unsubscribes] = await Promise.all([
    prisma.marketingSegment.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.marketingTemplate.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.marketingCampaign.findMany({ where: { organizationId }, include: { segment: true, template: true, _count: { select: { sends: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.marketingSequence.findMany({ where: { organizationId }, include: { steps: { orderBy: { position: "asc" } }, _count: { select: { enrollments: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.marketingSequenceEnrollment.findMany({ where: { organizationId, status: "ACTIVE" }, orderBy: { nextRunAt: "asc" }, take: 20 }),
    prisma.marketingLeadScore.findMany({ where: { organizationId, score: { gte: 31 } }, orderBy: { score: "desc" }, take: 20 }),
    prisma.marketingSend.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.marketingUnsubscribe.count({ where: { organizationId } }),
  ])
  const stats = {
    campaigns: campaigns.length,
    segments: segments.length,
    templates: templates.length,
    sent: sends.filter((send) => Boolean(send.sentAt) || ["SENT", "OPENED", "DELIVERED"].includes(send.status)).length,
    opened: sends.filter((send) => send.openedAt).length,
    clicked: sends.filter((send) => send.clickedAt).length,
    booked: sends.filter((send) => send.bookedAt).length,
    opportunities: sends.filter((send) => send.opportunityId).length,
    skipped: sends.filter((send) => send.status === "SKIPPED").length,
    failed: sends.filter((send) => send.status === "FAILED").length,
    bounced: sends.filter((send) => send.bouncedAt).length,
    complained: sends.filter((send) => send.complainedAt).length,
    unsubscribes,
    activeEnrollments: enrollments.length,
    hotProspects: leadScores.filter((score) => ["HOT", "VERY_HOT"].includes(score.status)).length,
  }
  return { segments, templates, campaigns, sequences, enrollments, leadScores, stats }
}
