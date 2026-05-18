import { NextResponse } from "next/server"

import { normalizeSaasAppRole } from "@/lib/auth/app-roles"
import {
  hashInternalPassword,
  requestedRoleMatchesUser,
} from "@/lib/auth/internal"
import { isInternalAuthEnabled } from "@/lib/auth-config"
import { prisma } from "@/lib/prisma"

const TEMPORARY_PASSWORD = "FinAssuro2026"

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || !isInternalAuthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "La réinitialisation locale n’est pas activée." },
      { status: 404 }
    )
  }

  const payload = await request.json().catch(() => null)
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : ""
  const role = normalizeSaasAppRole(payload?.role)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Entre d’abord un courriel valide." },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { internalCredential: true },
  })

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Aucun utilisateur ne correspond à ce courriel." },
      { status: 404 }
    )
  }

  if (!requestedRoleMatchesUser(role, user.role) || user.role === "CLIENT") {
    return NextResponse.json(
      { ok: false, error: "Ce compte ne peut pas être réinitialisé depuis cette page." },
      { status: 403 }
    )
  }

  const passwordPayload = await hashInternalPassword(TEMPORARY_PASSWORD)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      internalCredential: user.internalCredential
        ? { update: { ...passwordPayload, passwordUpdatedAt: new Date() } }
        : { create: passwordPayload },
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      action: "SELF_SERVICE_PASSWORD_RESET",
      entityType: "User",
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
    },
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    temporaryPassword: TEMPORARY_PASSWORD,
  })
}
