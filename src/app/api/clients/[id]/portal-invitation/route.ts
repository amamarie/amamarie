import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { buildClientPortalSignUpUrl, sendClientPortalInvitation } from "@/lib/services/client-portal-invitations"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

function contactEmail(client: { emailPrimary?: string | null; email?: string | null; emailSecondary?: string | null }) {
  return client.emailPrimary ?? client.email ?? client.emailSecondary ?? null
}

async function getInvitationClient(id: string, organizationId: string) {
  return prisma.client.findFirst({
    where: { id, organizationId, status: { not: "ARCHIVED" } },
    include: {
      advisor: { select: { id: true, name: true, email: true, organizationId: true } },
    },
  })
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await getInvitationClient(id, organizationId)
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 })

    const email = contactEmail(client)
    if (!email) return NextResponse.json({ error: "Aucun courriel client au dossier." }, { status: 422 })
    const url = buildClientPortalSignUpUrl({
      origin: request.headers.get("origin"),
      email,
      clientId: client.id,
    })

    await prisma.activity.create({
      data: {
        organizationId,
        userId,
        clientId: client.id,
        type: "CLIENT_UPDATED",
        title: "Lien profil client généré",
        description: `Lien du profil client sécurisé préparé pour ${email}.`,
        source: "USER",
        entityType: "Client",
        entityId: client.id,
        metadata: { channel: "CLIENT_PORTAL", action: "COPY_LINK", to: email },
      },
    })

    return NextResponse.json({
      data: {
        url,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: "Impossible de générer le lien espace client." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await getInvitationClient(id, organizationId)
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    if (!contactEmail(client)) return NextResponse.json({ error: "Ajoutez un courriel au dossier client avant d’envoyer l’accès." }, { status: 422 })

    const result = await sendClientPortalInvitation({
      client,
      advisor: client.advisor,
      triggeredByUserId: userId,
      origin: request.headers.get("origin"),
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de renvoyer l’invitation client." }, { status: 400 })
  }
}
