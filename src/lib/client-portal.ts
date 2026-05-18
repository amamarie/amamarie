import { redirect } from "next/navigation"
import type { Prisma, User } from "@prisma/client"

import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"
import { prisma } from "@/lib/prisma"

export async function getClientPortalUser() {
  const user = await getCurrentUserWithOrg()
  if (!user) redirect("/sign-in")
  if (user.role !== "CLIENT") redirect("/")
  return user
}

export async function getClientPortalApiUser() {
  const user = await getCurrentUserWithOrg()
  if (!user) throw new Error("UNAUTHORIZED")
  if (user.role !== "CLIENT") throw new Error("FORBIDDEN_CLIENT_PORTAL")
  return user
}

export async function findClientPortalRecord(email: string, clientId?: string) {
  const normalizedEmail = email.trim()
  if (!normalizedEmail) return null

  return prisma.client.findFirst({
    where: {
      ...(clientId ? { id: clientId } : {}),
      OR: [
        { email: { equals: normalizedEmail, mode: "insensitive" } },
        { emailPrimary: { equals: normalizedEmail, mode: "insensitive" } },
        { emailSecondary: { equals: normalizedEmail, mode: "insensitive" } },
      ],
      status: { not: "ARCHIVED" },
    },
    include: {
      advisor: { select: { id: true, name: true, email: true, role: true } },
      organization: {
        select: {
          id: true,
          name: true,
          communicationSettings: {
            select: {
              advisorSmsNotificationNumber: true,
              twilioPhoneNumber: true,
            },
          },
        },
      },
      documents: {
        where: {
          status: { not: "ARCHIVED" },
          visibility: "CLIENT_VISIBLE",
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      tasks: {
        where: { status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 8,
      },
      activities: {
        where: {
          type: {
            in: [
              "CLIENT_UPDATED",
              "DOCUMENT_ADDED",
              "DOCUMENT_RECEIVED",
              "DOCUMENT_UPLOADED",
              "DOCUMENT_VALIDATED",
              "NOTE_ADDED",
              "TASK_CREATED",
              "TASK_COMPLETED",
              "KYC_UPDATED",
              "KYC_APPROVED",
              "KYC_SNAPSHOT_CREATED",
              "CONSENT_GIVEN",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      noteItems: {
        where: {
          status: { notIn: ["ARCHIVED", "DELETED"] },
          isSensitive: false,
          title: {
            contains: "portail client",
            mode: "insensitive",
          },
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      kycProfile: true,
      consents: {
        include: {
          purpose: { select: { id: true, code: true, name: true, description: true, isRequiredForService: true } },
          template: { select: { id: true, title: true, version: true, language: true } },
          events: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: [{ givenAt: "desc" }, { createdAt: "desc" }],
      },
      privacyRequests: {
        orderBy: { receivedAt: "desc" },
        take: 8,
      },
      complianceAlerts: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" },
      },
      products: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        take: 6,
      },
      insuranceNeedsAnalyses: {
        where: { status: { in: ["WAITING_CLIENT", "DELIVERED", "COMPLETED", "USED_FOR_SUBMISSION"] } },
        orderBy: [{ analysisDate: "desc" }, { updatedAt: "desc" }],
        take: 5,
        include: {
          reportDocument: true,
          signatureDocument: true,
          results: { orderBy: { createdAt: "desc" }, take: 1 },
          recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      productRecommendations: {
        where: {
          status: { in: ["PRESENTED_TO_CLIENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED", "SIGNED", "LOCKED"] },
          reportDocumentId: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          documents: {
            include: { document: true },
            orderBy: { createdAt: "asc" },
          },
          sourceKycVersion: true,
        },
      },
    },
  })
}

export async function findClientPortalPreviewRecord(user: User, clientId?: string) {
  if (user.role === "CLIENT") {
    return findClientPortalRecord(user.email, clientId)
  }

  if (user.role === "DEVELOPER") {
    redirect("/developpeur")
  }

  const where = {
    organizationId: user.organizationId,
    status: { not: "ARCHIVED" as const },
    ...(clientId ? { id: clientId } : {}),
  }

  const include = {
    advisor: { select: { id: true, name: true, email: true, role: true } },
    organization: {
      select: {
        id: true,
        name: true,
        communicationSettings: {
          select: {
            advisorSmsNotificationNumber: true,
            twilioPhoneNumber: true,
          },
        },
      },
    },
    documents: {
      where: {
        status: { not: "ARCHIVED" },
        visibility: "CLIENT_VISIBLE",
      },
      orderBy: { createdAt: "desc" as const },
      take: 12,
    },
    tasks: {
      where: { status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] } },
      orderBy: [{ dueDate: "asc" as const }, { createdAt: "desc" as const }],
      take: 8,
    },
    activities: {
      where: {
        type: {
          in: [
            "CLIENT_UPDATED",
            "DOCUMENT_ADDED",
            "DOCUMENT_RECEIVED",
            "DOCUMENT_UPLOADED",
            "DOCUMENT_VALIDATED",
            "NOTE_ADDED",
            "TASK_CREATED",
            "TASK_COMPLETED",
            "KYC_UPDATED",
            "KYC_APPROVED",
            "KYC_SNAPSHOT_CREATED",
            "CONSENT_GIVEN",
          ],
        },
      },
      orderBy: { createdAt: "desc" as const },
      take: 10,
    },
    noteItems: {
      where: {
        status: { notIn: ["ARCHIVED", "DELETED"] },
        isSensitive: false,
        title: {
          contains: "portail client",
          mode: "insensitive" as const,
        },
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" as const },
      take: 12,
    },
    kycProfile: true,
    consents: {
      include: {
        purpose: { select: { id: true, code: true, name: true, description: true, isRequiredForService: true } },
        template: { select: { id: true, title: true, version: true, language: true } },
        events: { orderBy: { createdAt: "desc" as const }, take: 3 },
      },
      orderBy: [{ givenAt: "desc" as const }, { createdAt: "desc" as const }],
    },
    privacyRequests: {
      orderBy: { receivedAt: "desc" as const },
      take: 8,
    },
    complianceAlerts: {
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" as const },
    },
    products: {
      where: { status: { not: "ARCHIVED" as const } },
      orderBy: { updatedAt: "desc" as const },
      take: 6,
    },
    insuranceNeedsAnalyses: {
      where: { status: { in: ["WAITING_CLIENT" as const, "DELIVERED" as const, "COMPLETED" as const, "USED_FOR_SUBMISSION" as const] } },
      orderBy: [{ analysisDate: "desc" as const }, { updatedAt: "desc" as const }],
      take: 5,
      include: {
        reportDocument: true,
        signatureDocument: true,
        results: { orderBy: { createdAt: "desc" as const }, take: 1 },
        recommendations: { orderBy: { createdAt: "desc" as const }, take: 1 },
      },
    },
    productRecommendations: {
      where: {
        status: { in: ["PRESENTED_TO_CLIENT" as const, "CLIENT_ACCEPTED" as const, "CLIENT_DECLINED" as const, "SIGNED" as const, "LOCKED" as const] },
        reportDocumentId: { not: null },
      },
      orderBy: { updatedAt: "desc" as const },
      take: 5,
      include: {
        documents: {
          include: { document: true },
          orderBy: { createdAt: "asc" as const },
        },
        sourceKycVersion: true,
      },
    },
  } satisfies Prisma.ClientInclude

  const client = await prisma.client.findFirst({
    where,
    include,
    orderBy: { updatedAt: "desc" },
  })

  if (client || !clientId || process.env.NODE_ENV === "production") {
    return client
  }

  return prisma.client.findFirst({
    where: {
      id: clientId,
      status: { not: "ARCHIVED" },
    },
    include,
    orderBy: { updatedAt: "desc" },
  })
}

export async function getClientPortalContext(clientId?: string, redirectPath?: string) {
  const user = await getCurrentUserWithOrg()
  if (!user) {
    const redirectUrl = redirectPath ?? (clientId ? `/espace-client/profil?clientId=${encodeURIComponent(clientId)}` : "/espace-client")
    redirect(`/sign-in?role=client&redirect_url=${encodeURIComponent(redirectUrl)}`)
  }

  if (user.role !== "CLIENT") {
    redirect(clientId && user.role !== "DEVELOPER" ? `/clients/${encodeURIComponent(clientId)}` : homePathForUserRole(user.role))
  }

  const client = await findClientPortalRecord(user.email, clientId)
  return { user, client, isPreview: false }
}
