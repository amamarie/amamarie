import type { DocumentType, UserRole } from "@prisma/client"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { hasAdvisorGmailConnection, sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { sendSmsFromCrm } from "@/lib/services/communications"
import { createTask } from "@/lib/services/tasks"
import { assertAdministrativeSms } from "@/lib/twilio/templates"
import type { requestClientDocumentSchema, requestClientDocumentsSchema } from "@/lib/validations/document"
import type { z } from "zod"

type CurrentUser = { id: string; organizationId: string; role: UserRole; name: string; email: string }
type RequestClientDocumentInput = z.infer<typeof requestClientDocumentSchema>
type RequestClientDocumentsInput = z.infer<typeof requestClientDocumentsSchema>
type RequestDocumentItemInput = RequestClientDocumentsInput["documents"][number]
type DocumentRequestItemForStatus = { status: "PENDING" | "RECEIVED" | "REJECTED" | "WAIVED" | "CANCELLED"; required: boolean }

const DOCUMENT_LABELS: Partial<Record<DocumentType, string>> = {
  GOVERNMENT_ID: "pièce d'identité",
  PROOF_OF_ADDRESS: "preuve d'adresse",
  VOID_CHEQUE: "spécimen de chèque",
  KYC_FORM: "questionnaire profil client",
  RISK_PROFILE: "profil de risque",
  CONSENT_FORM: "formulaire de consentement",
  POLICY_DOCUMENT: "document de police",
  SIGNATURE_PAGE: "page de signature",
  TAX_DOCUMENT: "document fiscal",
}

function contactEmail(client: { emailPrimary?: string | null; email?: string | null; emailSecondary?: string | null }) {
  return client.emailPrimary ?? client.email ?? client.emailSecondary ?? null
}

function contactPhone(client: { phonePrimary?: string | null; phone?: string | null; phoneSecondary?: string | null }) {
  return client.phonePrimary ?? client.phone ?? client.phoneSecondary ?? null
}

function isEmailAddress(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function formatEmailAddress(name: string | null | undefined, email: string) {
  const displayName = (name || "Conseiller FinAssuro").replaceAll('"', "")
  return `${displayName} <${email}>`
}

function emailFromMode() {
  return process.env.EMAIL_FROM_MODE === "agent" ? "agent" : "workspace"
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function buildRequestMessage({
  firstName,
  advisorName,
  documentName,
  dueDate,
}: {
  firstName: string
  advisorName?: string | null
  documentName: string
  dueDate?: Date
}) {
  const deadline = dueDate
    ? ` avant le ${new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "long", day: "numeric" }).format(dueDate)}`
    : ""
  return `Bonjour ${firstName}, pourriez-vous nous transmettre le document suivant${deadline}: ${documentName}? Merci, ${advisorName ?? "votre conseiller"}.`
}

function buildBulkRequestMessage({
  firstName,
  advisorName,
  documentNames,
  dueDate,
}: {
  firstName: string
  advisorName?: string | null
  documentNames: string[]
  dueDate?: Date
}) {
  const deadline = dueDate
    ? ` avant le ${new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "long", day: "numeric" }).format(dueDate)}`
    : ""
  const list = documentNames.map((name) => `- ${name}`).join("\n")
  return `Bonjour ${firstName}, pourriez-vous nous transmettre les documents suivants${deadline}?\n${list}\nMerci, ${advisorName ?? "votre conseiller"}.`
}

function emailHtml(text: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px"><p>${text.replaceAll("\n", "<br />")}</p><p style="color:#475569;font-size:13px">Cette demande concerne uniquement le suivi administratif de votre dossier.</p></div>`
}

async function upsertRequestedDocument({
  user,
  clientId,
  data,
}: {
  user: CurrentUser
  clientId: string
  data: RequestDocumentItemInput & { dueDate?: Date; message?: string }
}) {
  const now = new Date()
  const clientFolder = await ensureClientFolderStructure({ organizationId: user.organizationId, clientId, userId: user.id })
  const existing = data.documentId
    ? await prisma.document.findFirst({
        where: { id: data.documentId, clientId, organizationId: user.organizationId },
      })
    : await prisma.document.findFirst({
        where: {
          clientId,
          organizationId: user.organizationId,
          type: data.type,
          name: data.name,
          status: { in: ["REQUIRED", "REQUESTED", "REJECTED", "EXPIRED"] },
        },
        orderBy: { createdAt: "desc" },
      })

  if (existing) {
    await prisma.document.updateMany({
      where: { id: existing.id, clientId, organizationId: user.organizationId },
      data: {
        name: data.name,
        description: data.description ?? existing.description,
        status: "REQUESTED",
        isRequired: true,
        requiredBy: data.dueDate ?? existing.requiredBy,
        requestedAt: now,
        notes: data.message ?? existing.notes,
        folderId: existing.folderId ?? clientFolder.id,
      },
    })
    return prisma.document.findFirstOrThrow({ where: { id: existing.id, organizationId: user.organizationId } })
  }

  return prisma.document.create({
    data: {
      organizationId: user.organizationId,
      clientId,
      uploadedById: user.id,
      type: data.type,
      status: "REQUESTED",
      visibility: "CLIENT_VISIBLE",
      folderId: clientFolder.id,
      name: data.name,
      description: data.description,
      isRequired: true,
      requiredBy: data.dueDate,
      requestedAt: now,
      notes: data.message,
    },
  })
}

async function getDocumentRequestClient({
  user,
  clientId,
}: {
  user: CurrentUser
  clientId: string
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: user.organizationId },
    include: { advisor: { select: { id: true, name: true, email: true } } },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")
  return client
}

function resolveDocumentName(data: Pick<RequestDocumentItemInput, "name" | "type">) {
  return data.name || DOCUMENT_LABELS[data.type] || "document demandé"
}

function resolveDocumentRequestStatus(items: DocumentRequestItemForStatus[]) {
  const requiredItems = items.filter((item) => item.required && item.status !== "WAIVED" && item.status !== "CANCELLED")
  if (requiredItems.length === 0) return "COMPLETED" as const
  if (requiredItems.every((item) => item.status === "RECEIVED")) return "COMPLETED" as const
  if (requiredItems.some((item) => item.status === "RECEIVED")) return "PARTIALLY_COMPLETED" as const
  return null
}

export async function markDocumentRequestItemsReceived({
  user,
  documentId,
  request,
  source = "advisor_upload",
}: {
  user: Pick<CurrentUser, "id" | "organizationId">
  documentId: string
  request?: Request
  source?: "advisor_upload" | "client_portal"
}) {
  const now = new Date()
  const pendingItems = await prisma.documentRequestItem.findMany({
    where: {
      organizationId: user.organizationId,
      documentId,
      status: { in: ["PENDING", "REJECTED"] },
    },
    select: {
      id: true,
      requestId: true,
      clientId: true,
      name: true,
      status: true,
    },
  })

  if (pendingItems.length === 0) return { updatedItems: 0, updatedRequests: 0, completedRequests: 0 }

  await prisma.documentRequestItem.updateMany({
    where: {
      organizationId: user.organizationId,
      id: { in: pendingItems.map((item) => item.id) },
    },
    data: {
      status: "RECEIVED",
      receivedAt: now,
      rejectedAt: null,
      rejectionReason: null,
    },
  })

  const requestIds = Array.from(new Set(pendingItems.map((item) => item.requestId)))
  let completedRequests = 0

  for (const requestId of requestIds) {
    const documentRequest = await prisma.documentRequest.findFirst({
      where: { id: requestId, organizationId: user.organizationId },
      include: { items: true },
    })
    if (!documentRequest || documentRequest.status === "CANCELLED") continue

    const nextStatus = resolveDocumentRequestStatus(documentRequest.items)
    if (!nextStatus) continue

    const updatedRequest = await prisma.documentRequest.update({
      where: { id: documentRequest.id },
      data: {
        status: nextStatus,
        completedAt: nextStatus === "COMPLETED" ? now : null,
      },
      include: { items: true },
    })
    if (nextStatus === "COMPLETED") completedRequests += 1

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId: updatedRequest.clientId,
      documentId,
      type: "DOCUMENT_STATUS_CHANGED",
      title: nextStatus === "COMPLETED" ? "Demande documentaire complétée" : "Demande documentaire partiellement complétée",
      description:
        nextStatus === "COMPLETED"
          ? "Tous les documents requis de cette demande ont été reçus."
          : "Une partie des documents requis de cette demande a été reçue.",
      entityType: "DocumentRequest",
      entityId: updatedRequest.id,
      source: source === "client_portal" ? "SYSTEM" : "USER",
      metadata: {
        source,
        documentRequestId: updatedRequest.id,
        documentId,
        receivedItemIds: pendingItems.filter((item) => item.requestId === updatedRequest.id).map((item) => item.id),
        receivedAt: now.toISOString(),
        userAgent: request?.headers.get("user-agent") ?? null,
      },
    })
  }

  return { updatedItems: pendingItems.length, updatedRequests: requestIds.length, completedRequests }
}

function resolveDeliveryChannel({
  requestedChannel,
  client,
  emailProviderAvailable,
}: {
  requestedChannel: "SMS" | "EMAIL" | "AUTO"
  emailProviderAvailable?: boolean
  client: {
    preferredContactMethod?: string | null
    phonePrimary?: string | null
    phone?: string | null
    phoneSecondary?: string | null
    emailPrimary?: string | null
    email?: string | null
    emailSecondary?: string | null
  }
}) {
  const emailConfigured = emailProviderAvailable ?? isResendConfigured()
  if (requestedChannel !== "AUTO") return requestedChannel
  if (client.preferredContactMethod === "SMS" && contactPhone(client)) return "SMS"
  if (client.preferredContactMethod === "EMAIL" && contactEmail(client)) return "EMAIL"
  if (contactEmail(client) && emailConfigured) return "EMAIL"
  if (contactPhone(client)) return "SMS"
  return "EMAIL"
}

async function deliverDocumentRequestMessage({
  user,
  clientId,
  client,
  advisor,
  channel,
  subject,
  message,
  activity,
}: {
  user: CurrentUser
  clientId: string
  client: Parameters<typeof resolveDeliveryChannel>[0]["client"]
  advisor: { id?: string | null; name: string; email: string | null }
  channel: "SMS" | "EMAIL" | "AUTO"
  subject: string
  message: string
  activity: {
    title: string
    description: string
    entityType: string
    entityId: string
    documentId?: string
    metadata?: Record<string, unknown>
  }
}) {
  const gmailAvailable = await hasAdvisorGmailConnection({ organizationId: user.organizationId, userId: advisor.id })
  const selectedChannel = resolveDeliveryChannel({ requestedChannel: channel, client, emailProviderAvailable: gmailAvailable || isResendConfigured() })

  if (selectedChannel === "SMS") {
    const phone = contactPhone(client)
    if (!phone) throw new Error("CLIENT_PHONE_MISSING")
    const sms = await sendSmsFromCrm({ user, to: phone, body: message, clientId })
    return { delivery: { channel: "SMS" as const, status: "QUEUED" as const, id: sms.id }, selectedChannel }
  }

  const email = contactEmail(client)
  if (!email) throw new Error("CLIENT_EMAIL_MISSING")
  const advisorEmail = isEmailAddress(advisor.email) ? advisor.email : null
  const gmailResult = advisor.id
    ? await sendAdvisorGmailEmail({
        organizationId: user.organizationId,
        userId: advisor.id,
        to: email,
        subject,
        text: message,
        html: emailHtml(message),
        replyTo: advisorEmail ?? undefined,
      })
    : null

  if (gmailResult) {
    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      clientId,
      type: "EMAIL_SENT",
      title: activity.title,
      description: `${activity.description} Envoyé à ${email} depuis Gmail (${gmailResult.from}).`,
      entityType: activity.entityType,
      entityId: activity.entityId,
      documentId: activity.documentId,
      metadata: {
        ...activity.metadata,
        channel: "EMAIL",
        provider: "GMAIL",
        emailId: gmailResult.id,
        to: email,
        from: gmailResult.from,
      },
    })
    return { delivery: { channel: "EMAIL" as const, status: "SENT" as const, id: gmailResult.id, provider: "GMAIL" as const }, selectedChannel }
  }

  if (!isResendConfigured()) {
    throw new Error("GMAIL_NOT_CONNECTED")
  }

  const emailResult = await sendTransactionalEmail({
    to: email,
    from: advisorEmail && emailFromMode() === "agent" ? formatEmailAddress(advisor.name, advisorEmail) : undefined,
    replyTo: advisorEmail ?? undefined,
    subject,
    text: message,
    html: emailHtml(message),
  })
  await createCrmActivity({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    type: "EMAIL_SENT",
    title: activity.title,
    description: `${activity.description} Envoyé à ${email}${advisorEmail ? ` avec réponse à ${advisorEmail}` : ""}.`,
    entityType: activity.entityType,
    entityId: activity.entityId,
    documentId: activity.documentId,
    metadata: {
      ...activity.metadata,
      channel: "EMAIL",
      emailId: emailResult.id,
      to: email,
      advisorEmail,
      fromMode: emailFromMode(),
    },
  })
  return { delivery: { channel: "EMAIL" as const, status: "SENT" as const, id: emailResult.id }, selectedChannel }
}

export async function requestClientDocument({
  user,
  clientId,
  data,
}: {
  user: CurrentUser
  clientId: string
  data: RequestClientDocumentInput
}) {
  const client = await getDocumentRequestClient({ user, clientId })
  const advisor = client.advisor ?? { id: user.id, name: user.name, email: user.email }
  const documentName = resolveDocumentName(data)
  const message = data.message?.trim() || buildRequestMessage({
    firstName: client.firstName,
    advisorName: advisor.name,
    documentName,
    dueDate: data.dueDate,
  })

  assertAdministrativeSms(message)

  const document = await upsertRequestedDocument({ user, clientId, data: { ...data, name: documentName, message } })
  const documentRequest = await prisma.documentRequest.create({
    data: {
      organizationId: user.organizationId,
      clientId,
      requestedById: user.id,
      title: `Demande de document - ${documentName}`,
      message,
      status: "SENT",
      channel: data.channel,
      dueDate: data.dueDate,
      sentAt: new Date(),
      metadata: { deliveryMode: data.channel, legacyDocumentId: document.id },
      items: {
        create: {
          organizationId: user.organizationId,
          clientId,
          documentId: document.id,
          documentType: document.type,
          name: documentName,
          description: data.description,
          required: true,
          status: "PENDING",
        },
      },
    },
    include: { items: true },
  })
  const subject = `Document demandé: ${documentName}`
  const { delivery } = await deliverDocumentRequestMessage({
    user,
    clientId,
    client,
    advisor,
    channel: data.channel,
    subject,
    message,
    activity: {
      title: "Courriel de demande de document envoyé",
      description: `${documentName} demandé au client.`,
      entityType: "DocumentRequest",
      entityId: documentRequest.id,
      documentId: document.id,
      metadata: { documentName, documentRequestId: documentRequest.id },
    },
  })

  const dueDate = data.dueDate ?? addDays(3)
  const task = await createTask({
    organizationId: user.organizationId,
    userId: user.id,
    data: {
      title: `Suivi document - ${documentName}`,
      description: `Vérifier la réception du document demandé au client.${delivery ? ` Canal: ${delivery.channel}.` : ""}`,
      type: "DOCUMENT",
      priority: "HIGH",
      status: "TODO",
      dueDate,
      clientId,
      assignedToId: client.advisorId ?? user.id,
      isAutomated: true,
    },
  })

  await createCrmActivity({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    documentId: document.id,
    taskId: task.id,
    type: "DOCUMENT_STATUS_CHANGED",
    title: "Demande de document envoyée",
    description: `${documentName} demandé par ${delivery?.channel === "SMS" ? "SMS" : "courriel"}.`,
    entityType: "Document",
    entityId: document.id,
    metadata: { channel: delivery?.channel, deliveryId: delivery?.id, documentRequestId: documentRequest.id },
  })

  await runAutomationsForEvent({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    event: "DOCUMENT_STATUS_CHANGED",
    title: "Demande de document envoyée",
    description: documentName,
    entityType: "document",
    entityId: document.id,
    payload: {
      documentId: document.id,
      documentRequestId: documentRequest.id,
      documentName,
      documentType: document.type,
      status: document.status,
      channel: delivery?.channel ?? null,
      taskId: task.id,
    },
  })

  return { document, documentRequest, task, delivery, message }
}

export async function requestClientDocuments({
  user,
  clientId,
  data,
}: {
  user: CurrentUser
  clientId: string
  data: RequestClientDocumentsInput
}) {
  const client = await getDocumentRequestClient({ user, clientId })
  const advisor = client.advisor ?? { id: user.id, name: user.name, email: user.email }
  const documentItems = data.documents.map((document) => ({
    ...document,
    name: resolveDocumentName(document),
  }))
  const documentNames = documentItems.map((document) => document.name)
  const message = data.message?.trim() || buildBulkRequestMessage({
    firstName: client.firstName,
    advisorName: advisor.name,
    documentNames,
    dueDate: data.dueDate,
  })

  assertAdministrativeSms(message)

  const documents = []
  for (const item of documentItems) {
    documents.push(await upsertRequestedDocument({
      user,
      clientId,
      data: {
        ...item,
        dueDate: data.dueDate,
        message,
      },
    }))
  }
  const documentRequest = await prisma.documentRequest.create({
    data: {
      organizationId: user.organizationId,
      clientId,
      requestedById: user.id,
      title: documents.length === 1 ? `Demande de document - ${documents[0]?.name ?? "Document"}` : `Demande de documents - ${documents.length} pièces`,
      message,
      status: "SENT",
      channel: data.channel,
      dueDate: data.dueDate,
      sentAt: new Date(),
      metadata: { deliveryMode: data.channel, legacyDocumentIds: documents.map((document) => document.id) },
      items: {
        create: documents.map((document) => ({
          organizationId: user.organizationId,
          clientId,
          documentId: document.id,
          documentType: document.type,
          name: document.name,
          description: document.description,
          required: true,
          status: "PENDING" as const,
        })),
      },
    },
    include: { items: true },
  })

  const subject = documents.length === 1 ? `Document demandé: ${documents[0]?.name ?? "document"}` : `${documents.length} documents demandés`
  const primaryDocument = documents[0]
  const { delivery } = await deliverDocumentRequestMessage({
    user,
    clientId,
    client,
    advisor,
    channel: data.channel,
    subject,
    message,
    activity: {
      title: "Courriel de demande de documents envoyé",
      description: `${documents.length} document${documents.length > 1 ? "s" : ""} demandé${documents.length > 1 ? "s" : ""} au client.`,
      entityType: "DocumentRequest",
      entityId: documentRequest.id,
      documentId: primaryDocument?.id,
      metadata: { documentRequestId: documentRequest.id, documentIds: documents.map((document) => document.id), documentNames },
    },
  })

  const dueDate = data.dueDate ?? addDays(3)
  const task = await createTask({
    organizationId: user.organizationId,
    userId: user.id,
    data: {
      title: documents.length === 1 ? `Suivi document - ${documents[0]?.name ?? "Document"}` : `Suivi documents - ${documents.length} pièces demandées`,
      description: `Vérifier la réception des documents demandés au client.${delivery ? ` Canal: ${delivery.channel}.` : ""}\n${documentNames.map((name) => `- ${name}`).join("\n")}`,
      type: "DOCUMENT",
      priority: "HIGH",
      status: "TODO",
      dueDate,
      clientId,
      assignedToId: client.advisorId ?? user.id,
      isAutomated: true,
    },
  })

  await createCrmActivity({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    documentId: primaryDocument?.id,
    taskId: task.id,
    type: "DOCUMENT_STATUS_CHANGED",
    title: "Demande de documents envoyée",
    description: `${documents.length} document${documents.length > 1 ? "s" : ""} demandé${documents.length > 1 ? "s" : ""} par ${delivery?.channel === "SMS" ? "SMS" : "courriel"}.`,
    entityType: "DocumentRequest",
    entityId: documentRequest.id,
    metadata: { channel: delivery?.channel, deliveryId: delivery?.id, documentRequestId: documentRequest.id, documentIds: documents.map((document) => document.id), documentNames },
  })

  await runAutomationsForEvent({
    organizationId: user.organizationId,
    userId: user.id,
    clientId,
    event: "DOCUMENT_STATUS_CHANGED",
    title: "Demande de documents envoyée",
    description: documentNames.join(", "),
    entityType: "document",
    entityId: primaryDocument?.id ?? clientId,
    payload: {
      documentIds: documents.map((document) => document.id),
      documentRequestId: documentRequest.id,
      documentNames,
      status: "REQUESTED",
      channel: delivery?.channel ?? null,
      taskId: task.id,
    },
  })

  return { documents, documentRequest, task, delivery, message }
}
