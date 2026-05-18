import { NextResponse } from "next/server"

import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15)
}

export async function GET() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 })
  }

  return NextResponse.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title ?? "",
      phone: user.phone ?? "",
      specialties: user.specialties ?? "",
      zones: user.routingTerritories ?? "",
      language: user.routingLanguages ?? "",
      licenseNumber: user.licenseNumber ?? "",
      routingPriority: user.routingPriority,
      avatarUrl: user.avatarUrl ?? "",
      role: user.role,
    },
  })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const firstName = cleanString(body?.firstName)
  const lastName = cleanString(body?.lastName)
  const title = cleanString(body?.title)
  const phone = normalizePhone(cleanString(body?.phone))
  const email = cleanString(body?.email).toLowerCase()
  const specialties = cleanString(body?.specialties).slice(0, 1200)
  const zones = cleanString(body?.zones).slice(0, 800)
  const language = cleanString(body?.language).slice(0, 120)
  const licenseNumber = cleanString(body?.licenseNumber).slice(0, 120)
  const routingPriority = Number(body?.routingPriority)
  const name = `${firstName} ${lastName}`.trim() || user.name

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse courriel invalide." }, { status: 422 })
  }

  if (email && email !== user.email.toLowerCase()) {
    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailOwner && emailOwner.id !== user.id) {
      return NextResponse.json(
        { error: "Ce courriel est déjà utilisé par un autre utilisateur." },
        { status: 409 }
      )
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      email: email || user.email,
      title: title || null,
      phone: phone || null,
      specialties: specialties || null,
      routingTerritories: zones || null,
      routingLanguages: language || null,
      licenseNumber: licenseNumber || null,
      routingPriority: Number.isFinite(routingPriority) ? Math.max(0, Math.min(100, Math.round(routingPriority))) : user.routingPriority,
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      phone: true,
      specialties: true,
      routingTerritories: true,
      routingLanguages: true,
      licenseNumber: true,
      routingPriority: true,
      avatarUrl: true,
      role: true,
    },
  })

  return NextResponse.json({ data: updatedUser })
}
