import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { requireSaasRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

function clientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwardedFor || headerStore.get("x-real-ip") || "unknown"
}

function isIpAllowed(ip: string, allowlist?: string | null) {
  if (!allowlist) return true
  const allowed = allowlist
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return allowed.length === 0 || allowed.includes(ip)
}

export async function requireSuperAdmin() {
  const user = await requireSaasRole(["DEVELOPER"])
  const headerStore = await headers()
  const ip = clientIp(headerStore)
  let profile = await prisma.internalAdminProfile.findUnique({ where: { userId: user.id } })

  if (!profile) {
    profile = await prisma.internalAdminProfile.create({
      data: {
        userId: user.id,
        internalRole: "OWNER",
        status: "ACTIVE",
        twoFactorRequired: true,
      },
    })
  }

  if (profile.status === "SUSPENDED") {
    redirect("/")
  }

  if (!isIpAllowed(ip, profile.ipAllowlist)) {
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: "SUPER_ADMIN_IP_DENIED",
        entityType: "InternalAdminProfile",
        entityId: profile.id,
        ipAddress: ip,
        sensitivityLevel: "HIGH",
        newValue: { internalRole: profile.internalRole, ipAllowlist: "configured" },
      },
    }).catch(() => null)
    redirect("/")
  }

  return { ...user, internalAdminProfile: profile, requestIp: ip }
}
