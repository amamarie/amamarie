import { NextResponse } from "next/server"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"
import { downloadPandaDocDocument } from "@/lib/pandadoc/client"
import { createCrmActivity } from "@/lib/crm-events"
import { sanitizeFileName } from "@/lib/documents/file-validation"
import { syncOpportunityFromAnalysis } from "@/lib/insurance-needs/opportunity-sync"
import { createNotification } from "@/lib/services/notifications"

type PandaDocWebhookPayload = {
  id?: string
  status?: string
  event?: string
  data?: {
    id?: string
    status?: string
    name?: string
    metadata?: Record<string, string>
  }
  document?: {
    id?: string
    status?: string
  }
}

function readPandaDocEvent(payload: PandaDocWebhookPayload) {
  const documentId = payload.data?.id ?? payload.document?.id ?? payload.id
  const status = payload.data?.status ?? payload.document?.status ?? payload.status ?? payload.event
  const metadata = payload.data?.metadata ?? {}
  return { documentId, status, metadata }
}

function parseNotes(notes: string | null) {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { note: notes }
  } catch {
    return { note: notes }
  }
}

function mergePandaDocNotes(notes: string | null, patch: Record<string, unknown>) {
  const current = parseNotes(notes)
  const currentPandaDoc = current.pandaDoc && typeof current.pandaDoc === "object" && !Array.isArray(current.pandaDoc)
    ? current.pandaDoc as Record<string, unknown>
    : {}
  return JSON.stringify({
    ...current,
    pandaDoc: {
      ...currentPandaDoc,
      ...patch,
      lastWebhookAt: new Date().toISOString(),
    },
  })
}

function isPandaDocFailureStatus(status: string) {
  return [
    "document.declined",
    "document.expired",
    "document.deleted",
    "document.voided",
    "document.rejected",
    "document.failed",
    "declined",
    "expired",
    "failed",
  ].includes(status)
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

async function findReportDocument(documentId: string, metadata: Record<string, string>) {
  if (metadata.reportDocumentId) {
    const document = await prisma.document.findUnique({ where: { id: metadata.reportDocumentId }, include: { client: true } })
    if (document) return document
  }
  return prisma.document.findFirst({
    where: {
      notes: { contains: documentId },
    },
    include: { client: true },
  })
}

async function archiveSignedPdf({
  reportDocument,
  pandaDocDocumentId,
}: {
  reportDocument: Awaited<ReturnType<typeof findReportDocument>>
  pandaDocDocumentId: string
}) {
  if (!reportDocument) return null
  const signedPdf = await downloadPandaDocDocument(pandaDocDocumentId)
  const fileName = sanitizeFileName(`signe-${reportDocument.fileName ?? reportDocument.name}.pdf`)
  const notes = parseNotes(reportDocument.notes)
  const isRecommendation = typeof notes.recommendationId === "string"
  const hasSupabaseStorage = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  const bucket = hasSupabaseStorage ? getDocumentsBucket() : null
  const storagePath = hasSupabaseStorage
    ? `${reportDocument.organizationId}/clients/${reportDocument.clientId ?? "sans-client"}/signatures/${fileName}`
    : null
  let fileUrl: string | null = null

  if (hasSupabaseStorage && bucket && storagePath) {
    const { error } = await getSupabaseServerClient()
      .storage
      .from(bucket)
      .upload(storagePath, signedPdf, {
        contentType: "application/pdf",
        upsert: true,
      })
    if (error) throw new Error(error.message)
  } else {
    const publicDir = path.join(process.cwd(), "public", "generated", "signatures")
    await mkdir(publicDir, { recursive: true })
    await writeFile(path.join(publicDir, fileName), signedPdf)
    fileUrl = `/generated/signatures/${fileName}`
  }

  return prisma.document.create({
    data: {
      organizationId: reportDocument.organizationId,
      clientId: reportDocument.clientId,
      uploadedById: reportDocument.uploadedById,
      folderId: reportDocument.folderId,
      type: "SIGNATURE_PAGE",
      status: "VALIDATED",
      visibility: "CLIENT_VISIBLE",
      name: `${isRecommendation ? "Recommandation signée" : "Analyse des besoins signée"} - ${reportDocument.name}`,
      description: isRecommendation
        ? "Document signé classé comme preuve de remise de la recommandation documentée."
        : "Document signé classé comme preuve de remise de l’analyse des besoins.",
      fileName,
      originalFileName: fileName,
      fileUrl,
      url: fileUrl,
      storageBucket: bucket,
      storagePath,
      storageProvider: hasSupabaseStorage ? "SUPABASE" : "LOCAL_PUBLIC",
      mimeType: "application/pdf",
      fileSize: signedPdf.byteLength,
      receivedAt: new Date(),
      validatedAt: new Date(),
      parentDocumentId: reportDocument.id,
      notes: JSON.stringify({
        categoryLabel: isRecommendation ? "Recommandation documentée signée" : "Analyse des besoins signée",
        recommendationId: typeof notes.recommendationId === "string" ? notes.recommendationId : undefined,
        pandaDoc: { documentId: pandaDocDocumentId, status: "document.completed", completedAt: new Date().toISOString() },
      }),
    },
  })
}

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.PANDADOC_WEBHOOK_SECRET?.trim()
    const requestUrl = new URL(request.url)
    const providedSecret = request.headers.get("x-finadvisor-webhook-secret") ?? requestUrl.searchParams.get("secret")
    if (configuredSecret && providedSecret !== configuredSecret) {
      return NextResponse.json({ error: "Webhook non autorisé." }, { status: 401 })
    }

    const payload = await request.json() as PandaDocWebhookPayload
    const { documentId, status, metadata } = readPandaDocEvent(payload)
    if (!documentId) return NextResponse.json({ error: "Document PandaDoc manquant." }, { status: 400 })

    const reportDocument = await findReportDocument(documentId, metadata)
    if (!reportDocument) return NextResponse.json({ ok: true, ignored: true, reason: "DOCUMENT_NOT_LINKED" })

    const normalizedStatus = status ?? "unknown"
    const isCompleted = normalizedStatus === "document.completed" || normalizedStatus === "completed"
    const isFailure = isPandaDocFailureStatus(normalizedStatus)
    const signedDocument = isCompleted
      ? await archiveSignedPdf({ reportDocument, pandaDocDocumentId: documentId })
      : null

    const nextReportNotes = mergePandaDocNotes(reportDocument.notes, {
      documentId,
      status: normalizedStatus,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      signedDocumentId: signedDocument?.id,
    })
    await prisma.document.update({
      where: { id: reportDocument.id },
      data: {
        status: isCompleted ? "VALIDATED" : isFailure ? "REJECTED" : reportDocument.status,
        notes: nextReportNotes,
        validatedAt: isCompleted ? new Date() : reportDocument.validatedAt,
        rejectedAt: isFailure ? new Date() : reportDocument.rejectedAt,
        rejectedReason: isFailure ? `Statut PandaDoc: ${normalizedStatus}` : reportDocument.rejectedReason,
      },
    })

    const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
      where: { reportDocumentId: reportDocument.id },
      select: { id: true, clientId: true, organizationId: true, advisorId: true, status: true, deliveredAt: true },
    })
    if (analysis) {
      const now = new Date()
      await prisma.insuranceNeedsAnalysis.update({
        where: { id: analysis.id },
        data: isCompleted
          ? {
              status: "DELIVERED",
              deliveredAt: analysis.deliveredAt ?? now,
              signatureDocumentId: signedDocument?.id ?? reportDocument.id,
              signedAt: now,
              clientConfirmedAt: now,
            }
          : isFailure
            ? { status: "WAITING_CLIENT" }
            : { status: "WAITING_CLIENT" },
      })
      if (isCompleted) {
        await syncOpportunityFromAnalysis({ organizationId: analysis.organizationId, userId: analysis.advisorId, analysisId: analysis.id })
        await createNotification({
          organizationId: analysis.organizationId,
          userId: analysis.advisorId ?? undefined,
          type: "DOCUMENT_REQUIRED",
          priority: "HIGH",
          title: "Analyse signée",
          message: `Le client ${reportDocument.client ? `${reportDocument.client.firstName} ${reportDocument.client.lastName}`.trim() : ""} a signé l’analyse des besoins. Le PDF signé est disponible au dossier.`,
          actionLabel: "Ouvrir l’analyse",
          actionUrl: `/clients/${analysis.clientId}?tab=needs&analysisId=${analysis.id}`,
          entityType: "InsuranceNeedsAnalysis",
          entityId: analysis.id,
          clientId: analysis.clientId,
          documentId: signedDocument?.id ?? reportDocument.id,
          metadata: { signedDocumentId: signedDocument?.id, reportDocumentId: reportDocument.id, pandaDocDocumentId: documentId },
        })
      }
      let resolvedAlertId: string | null = null
      let completedTaskCount = 0
      if (isCompleted) {
        const alert = await prisma.complianceAlert.findFirst({
          where: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            type: "INSURANCE_NEEDS_ANALYSIS_NOT_DELIVERED",
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true },
        })
        if (alert) {
          resolvedAlertId = alert.id
          await prisma.complianceAlert.update({
            where: { id: alert.id },
            data: {
              status: "RESOLVED",
              resolvedAt: new Date(),
              resolvedById: analysis.advisorId,
            },
          })
        }
        const tasks = await prisma.task.findMany({
          where: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
            OR: [
              { title: "Réviser et envoyer l’analyse des besoins au client" },
              { title: "Remettre l’analyse des besoins avant livraison" },
            ],
          },
          select: { id: true },
        })
        completedTaskCount = tasks.length
        if (tasks.length) {
          await prisma.task.updateMany({
            where: { id: { in: tasks.map((task) => task.id) } },
            data: {
              status: "DONE",
              completedAt: new Date(),
              outcome: "Rapport signé par le client via PandaDoc et archivé automatiquement.",
            },
          })
        }
      }
      let followUpTaskId: string | null = null
      let openAlertId: string | null = null
      if (isFailure) {
        const alert = await prisma.complianceAlert.findFirst({
          where: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            type: "INSURANCE_NEEDS_ANALYSIS_NOT_DELIVERED",
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true },
        }) ?? await prisma.complianceAlert.create({
          data: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            type: "INSURANCE_NEEDS_ANALYSIS_NOT_DELIVERED",
            severity: "CRITICAL",
            status: "OPEN",
            title: "Signature de l’analyse des besoins non complétée",
            description: `PandaDoc a retourné le statut ${normalizedStatus}. Le rapport daté n’est pas remis/signé; la livraison de police doit rester bloquée.`,
            actionLabel: "Renvoyer au client",
            actionUrl: `/clients/${analysis.clientId}?tab=needs&analysisId=${analysis.id}`,
          },
          select: { id: true },
        })
        openAlertId = alert.id
        await prisma.complianceAlert.update({
          where: { id: alert.id },
          data: {
            severity: "CRITICAL",
            status: "OPEN",
            title: "Signature de l’analyse des besoins non complétée",
            description: `PandaDoc a retourné le statut ${normalizedStatus}. Le rapport daté n’est pas remis/signé; la livraison de police doit rester bloquée.`,
            actionLabel: "Renvoyer au client",
            actionUrl: `/clients/${analysis.clientId}?tab=needs&analysisId=${analysis.id}`,
          },
        })
        const task = await prisma.task.findFirst({
          where: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            title: "Relancer la signature de l’analyse des besoins",
            status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
          },
          select: { id: true },
        }) ?? await prisma.task.create({
          data: {
            organizationId: analysis.organizationId,
            clientId: analysis.clientId,
            assignedToId: analysis.advisorId,
            createdById: analysis.advisorId,
            alertId: alert.id,
            type: "COMPLIANCE",
            priority: "URGENT",
            status: "TODO",
            dueDate: new Date(),
            isAutomated: true,
            title: "Relancer la signature de l’analyse des besoins",
            description: `Le document PandaDoc n’a pas été complété (${normalizedStatus}). Vérifier la raison, corriger au besoin et renvoyer le rapport au client.`,
          },
          select: { id: true },
        })
        followUpTaskId = task.id
      }
      await prisma.auditLog.create({
        data: {
          organizationId: analysis.organizationId,
          userId: analysis.advisorId,
          clientId: analysis.clientId,
          entityType: "InsuranceNeedsAnalysis",
          entityId: analysis.id,
          action: isCompleted ? "PANDADOC_SIGNATURE_COMPLETED" : isFailure ? "PANDADOC_SIGNATURE_FAILED" : "PANDADOC_STATUS_UPDATED",
          newValue: { documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id, resolvedAlertId, completedTaskCount, followUpTaskId, openAlertId },
        },
      })
      await createCrmActivity({
        organizationId: analysis.organizationId,
        userId: analysis.advisorId,
        clientId: analysis.clientId,
        documentId: signedDocument?.id ?? reportDocument.id,
        type: isCompleted ? "DOCUMENT_VALIDATED" : isFailure ? "DOCUMENT_REJECTED" : "DOCUMENT_STATUS_CHANGED",
        title: isCompleted ? "Signé par le client" : isFailure ? "Signature à relancer" : "Statut PandaDoc mis à jour",
        description: isCompleted
          ? "Le PDF signé a été archivé automatiquement au dossier client, la tâche conseiller a été fermée et l’alerte conformité a été résolue."
          : isFailure
            ? "La signature n’est pas complétée. Une tâche urgente de relance a été créée et le dossier reste bloqué."
            : normalizedStatus,
        source: "AUTOMATION",
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        metadata: { pandaDocDocumentId: documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id, resolvedAlertId, completedTaskCount, followUpTaskId, openAlertId },
      })
    }

    const recommendationConditions = [
      metadata.recommendationId ? { id: metadata.recommendationId } : null,
      { reportDocumentId: reportDocument.id },
    ].filter((condition): condition is { id: string } | { reportDocumentId: string } => Boolean(condition))
    const recommendation = await prisma.productRecommendation.findFirst({
      where: {
        organizationId: reportDocument.organizationId,
        OR: recommendationConditions,
      },
      select: {
        id: true,
        clientId: true,
        advisorId: true,
        status: true,
        title: true,
        metadata: true,
        presentedToClientAt: true,
      },
    })
    if (recommendation) {
      const now = new Date()
      const currentMetadata = parseNotes(JSON.stringify(recommendation.metadata ?? {}))
      const recommendationPandaDoc = {
        documentId,
        status: normalizedStatus,
        reportDocumentId: reportDocument.id,
        signedDocumentId: signedDocument?.id,
        completedAt: isCompleted ? now.toISOString() : undefined,
        failedAt: isFailure ? now.toISOString() : undefined,
      }
      await prisma.productRecommendation.update({
        where: { id: recommendation.id },
        data: isCompleted
          ? {
              status: "SIGNED",
              clientSignedAt: now,
              presentedToClientAt: recommendation.presentedToClientAt ?? now,
              metadata: toJson({
                ...currentMetadata,
                pandaDoc: recommendationPandaDoc,
              }),
            }
          : {
              status: isFailure ? "PRESENTED_TO_CLIENT" : recommendation.status,
              presentedToClientAt: recommendation.presentedToClientAt ?? now,
              metadata: toJson({
                ...currentMetadata,
                pandaDoc: recommendationPandaDoc,
              }),
            },
      })
      if (isCompleted && signedDocument) {
        await prisma.recommendationDocument.create({
          data: {
            organizationId: reportDocument.organizationId,
            recommendationId: recommendation.id,
            clientId: recommendation.clientId,
            documentId: signedDocument.id,
            documentType: "SIGNATURE",
            deliveredToClient: true,
            deliveredAt: now,
            deliveryMethod: "SECURE_EMAIL",
            clientAcknowledgedAt: now,
            notes: JSON.stringify({ pandaDoc: recommendationPandaDoc }),
          },
        })
      }
      let resolvedAlertId: string | null = null
      let completedTaskCount = 0
      if (isCompleted) {
        const alert = await prisma.complianceAlert.findFirst({
          where: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            type: "RECOMMENDATION_SIGNATURE_FAILED",
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true },
        })
        if (alert) {
          resolvedAlertId = alert.id
          await prisma.complianceAlert.update({
            where: { id: alert.id },
            data: {
              status: "RESOLVED",
              resolvedAt: now,
              resolvedById: recommendation.advisorId,
            },
          })
        }
        const tasks = await prisma.task.findMany({
          where: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
            OR: [
              { recommendationId: recommendation.id },
              { title: "Relancer la signature de la recommandation" },
            ],
          },
          select: { id: true },
        })
        completedTaskCount = tasks.length
        if (tasks.length) {
          await prisma.task.updateMany({
            where: { id: { in: tasks.map((task) => task.id) } },
            data: {
              status: "DONE",
              completedAt: now,
              outcome: "Recommandation signée par le client via PandaDoc et archivée automatiquement.",
            },
          })
        }
      }
      let followUpTaskId: string | null = null
      let openAlertId: string | null = null
      if (isFailure) {
        const alert = await prisma.complianceAlert.findFirst({
          where: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            type: "RECOMMENDATION_SIGNATURE_FAILED",
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true },
        }) ?? await prisma.complianceAlert.create({
          data: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            type: "RECOMMENDATION_SIGNATURE_FAILED",
            severity: "HIGH",
            status: "OPEN",
            title: "Signature de recommandation à relancer",
            description: `PandaDoc a retourné le statut ${normalizedStatus}. La recommandation reste présentée au client, mais la preuve signée n’est pas complète.`,
            actionLabel: "Ouvrir la recommandation",
            actionUrl: `/clients/${recommendation.clientId}?tab=recommendations&recommendationId=${recommendation.id}`,
          },
          select: { id: true },
        })
        openAlertId = alert.id
        await prisma.complianceAlert.update({
          where: { id: alert.id },
          data: {
            severity: "HIGH",
            status: "OPEN",
            title: "Signature de recommandation à relancer",
            description: `PandaDoc a retourné le statut ${normalizedStatus}. La recommandation reste présentée au client, mais la preuve signée n’est pas complète.`,
            actionLabel: "Ouvrir la recommandation",
            actionUrl: `/clients/${recommendation.clientId}?tab=recommendations&recommendationId=${recommendation.id}`,
          },
        })
        const task = await prisma.task.findFirst({
          where: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            recommendationId: recommendation.id,
            title: "Relancer la signature de la recommandation",
            status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] },
          },
          select: { id: true },
        }) ?? await prisma.task.create({
          data: {
            organizationId: reportDocument.organizationId,
            clientId: recommendation.clientId,
            assignedToId: recommendation.advisorId,
            createdById: recommendation.advisorId,
            alertId: alert.id,
            recommendationId: recommendation.id,
            type: "COMPLIANCE",
            priority: "HIGH",
            status: "TODO",
            dueDate: now,
            isAutomated: true,
            title: "Relancer la signature de la recommandation",
            description: `Le document PandaDoc de recommandation n’a pas été complété (${normalizedStatus}). Vérifier la raison et relancer le client au besoin.`,
          },
          select: { id: true },
        })
        followUpTaskId = task.id
      }
      if (isCompleted) {
        await createNotification({
          organizationId: reportDocument.organizationId,
          userId: recommendation.advisorId ?? undefined,
          type: "DOCUMENT_REQUIRED",
          priority: "HIGH",
          title: "Recommandation signée",
          message: `Le client ${reportDocument.client ? `${reportDocument.client.firstName} ${reportDocument.client.lastName}`.trim() : ""} a signé la recommandation documentée. Le PDF signé est disponible au dossier.`,
          actionLabel: "Ouvrir la recommandation",
          actionUrl: `/clients/${recommendation.clientId}?tab=recommendations&recommendationId=${recommendation.id}`,
          entityType: "ProductRecommendation",
          entityId: recommendation.id,
          clientId: recommendation.clientId,
          documentId: signedDocument?.id ?? reportDocument.id,
          metadata: { signedDocumentId: signedDocument?.id, reportDocumentId: reportDocument.id, pandaDocDocumentId: documentId },
        })
      }
      await prisma.auditLog.create({
        data: {
          organizationId: reportDocument.organizationId,
          userId: recommendation.advisorId,
          clientId: recommendation.clientId,
          entityType: "ProductRecommendation",
          entityId: recommendation.id,
          action: isCompleted ? "RECOMMENDATION_SIGNATURE_COMPLETED" : isFailure ? "RECOMMENDATION_SIGNATURE_FAILED" : "RECOMMENDATION_SIGNATURE_STATUS_UPDATED",
          newValue: { documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id, resolvedAlertId, completedTaskCount, followUpTaskId, openAlertId },
        },
      })
      await prisma.recommendationAuditLog.create({
        data: {
          organizationId: reportDocument.organizationId,
          recommendationId: recommendation.id,
          clientId: recommendation.clientId,
          userId: recommendation.advisorId,
          eventType: isCompleted ? "SIGNEE_CLIENT_PANDADOC" : isFailure ? "SIGNATURE_PANDADOC_A_RELANCER" : "STATUT_PANDADOC_MIS_A_JOUR",
          newValue: { documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id, resolvedAlertId, completedTaskCount, followUpTaskId, openAlertId },
        },
      })
      await createCrmActivity({
        organizationId: reportDocument.organizationId,
        userId: recommendation.advisorId,
        clientId: recommendation.clientId,
        documentId: signedDocument?.id ?? reportDocument.id,
        type: isCompleted ? "DOCUMENT_VALIDATED" : isFailure ? "DOCUMENT_REJECTED" : "DOCUMENT_STATUS_CHANGED",
        title: isCompleted ? "Recommandation signée par le client" : isFailure ? "Signature de recommandation à relancer" : "Statut PandaDoc de recommandation mis à jour",
        description: isCompleted
          ? "Le PDF signé de la recommandation a été archivé automatiquement au dossier client."
          : isFailure
            ? "La signature de la recommandation n’est pas complétée. Une tâche de relance a été créée."
            : normalizedStatus,
        source: "AUTOMATION",
        entityType: "ProductRecommendation",
        entityId: recommendation.id,
        metadata: { pandaDocDocumentId: documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id, resolvedAlertId, completedTaskCount, followUpTaskId, openAlertId },
      })
    }

    return NextResponse.json({ ok: true, data: { documentId, status: normalizedStatus, signedDocumentId: signedDocument?.id ?? null } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook PandaDoc impossible à traiter." }, { status: 400 })
  }
}
