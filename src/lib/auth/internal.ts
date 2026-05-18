import { createHmac, randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import type { User, UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { sendTransactionalEmail } from "@/lib/email/send"
import {
  normalizeSaasAppRole,
  organizationNameForAppRole,
  userRoleForAppRole,
  type SaasAppRole,
} from "@/lib/auth/app-roles"
import {
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  organizationTypeForSubscriptionPlan,
  subscriptionPlans,
  type SubscriptionCurrencyKey,
  type SubscriptionPlanKey,
  type SubscriptionPricingModeKey,
} from "@/lib/billing/plans"

const scryptAsync = promisify(scrypt)
const SESSION_COOKIE = "finadvisor_internal_session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const MIN_PASSWORD_LENGTH = 8
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000
const MAX_FAILED_AUTH_ATTEMPTS = 5
const AUTH_LOCK_MS = 15 * 60 * 1000

type InternalSessionPayload = {
  userId: string
  exp: number
}

type ResolveInternalUserInput = {
  email: string
  password: string
  role?: SaasAppRole
  name?: string
  redirectUrl?: string
  subscriptionPlan?: SubscriptionPlanKey
  subscriptionPricingMode?: SubscriptionPricingModeKey
  subscriptionCurrency?: SubscriptionCurrencyKey
  mode?: "sign-in" | "sign-up"
}

type PasswordResetInput = {
  email: string
  role?: SaasAppRole
}

type CompletePasswordResetInput = {
  token: string
  password: string
  role?: SaasAppRole
}

type TwoFactorChallengeInput = {
  challengeId: string
  code: string
  role?: SaasAppRole
}

function authSecret() {
  const value = process.env.INTERNAL_AUTH_SECRET

  if (value) return value

  if (process.env.NODE_ENV !== "production") {
    return "finadvisor-dev-internal-auth-secret-change-before-production"
  }

  throw new Error("INTERNAL_AUTH_SECRET is required when internal auth is enabled.")
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function signPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url")
}

function hashAuthToken(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url")
}

function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"
  return configured.replace(/\/+$/, "")
}

function createSixDigitCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  if (!name || !domain) return email
  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`
}

function verifySessionValue(value: string): InternalSessionPayload | null {
  const [payload, signature] = value.split(".")
  if (!payload || !signature) return null

  const expected = signPayload(payload)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as InternalSessionPayload
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

function createSessionValue(userId: string) {
  const payload = base64UrlJson({
    userId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  } satisfies InternalSessionPayload)

  return `${payload}.${signPayload(payload)}`
}

export async function setInternalSessionCookie(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, createSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  })
}

export async function clearInternalSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getInternalSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)?.value
  if (!session) return null

  const payload = verifySessionValue(session)
  if (!payload) return null

  return prisma.user.findUnique({
    where: { id: payload.userId },
  })
}

export function validateInternalPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Le mot de passe doit contenir au moins 8 caractères."
  }

  return null
}

export async function hashInternalPassword(password: string) {
  const salt = randomBytes(18).toString("base64url")
  const derived = (await scryptAsync(password, salt, 64)) as Buffer

  return {
    passwordSalt: salt,
    passwordHash: derived.toString("base64url"),
  }
}

async function verifyInternalPassword(password: string, salt: string, hash: string) {
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  const stored = Buffer.from(hash, "base64url")

  return stored.length === derived.length && timingSafeEqual(stored, derived)
}

async function recordInternalAuthFailure(credential: { id: string; failedLoginCount: number }) {
  const failedLoginCount = credential.failedLoginCount + 1
  const shouldLock = failedLoginCount >= MAX_FAILED_AUTH_ATTEMPTS

  await prisma.internalAuthCredential.update({
    where: { id: credential.id },
    data: {
      failedLoginCount,
      lockedUntil: shouldLock ? new Date(Date.now() + AUTH_LOCK_MS) : null,
    },
  })
}

function assertCredentialNotLocked(credential: { lockedUntil: Date | null }) {
  if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
    throw new Error("Compte temporairement verrouillé après plusieurs essais. Réessayez dans 15 minutes.")
  }
}

export async function requestInternalPasswordReset({ email: rawEmail, role }: PasswordResetInput) {
  const email = normalizeEmail(rawEmail)
  const appRole = normalizeSaasAppRole(role)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Entre d’abord un courriel valide.")
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { internalCredential: true },
  })

  if (!user || !user.internalCredential || !requestedRoleMatchesUser(appRole, user.role)) {
    return { sent: true }
  }

  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashAuthToken(token)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)
  const params = new URLSearchParams()
  params.set("role", appRole)
  params.set("email", email)
  params.set("reset_token", token)
  const resetUrl = `${appBaseUrl()}/sign-in?${params.toString()}`

  await prisma.internalAuthCredential.update({
    where: { id: user.internalCredential.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
      passwordResetRequestedAt: new Date(),
      twoFactorChallengeHash: null,
      twoFactorCodeHash: null,
      twoFactorExpiresAt: null,
      twoFactorRequestedAt: null,
    },
  })

  await sendTransactionalEmail({
    to: email,
    subject: "Réinitialisation de votre mot de passe FinAssuro",
    text: [
      "Bonjour,",
      "",
      "Vous avez demandé la réinitialisation de votre mot de passe FinAssuro.",
      `Lien sécurisé: ${resetUrl}`,
      "",
      "Ce lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.",
    ].join("\n"),
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe FinAssuro.</p>
      <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.</p>
    `,
  })

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
    },
  }).catch(() => null)

  return { sent: true }
}

export async function resetInternalPasswordWithToken({ token, password, role }: CompletePasswordResetInput) {
  const appRole = normalizeSaasAppRole(role)
  const passwordError = validateInternalPassword(password)

  if (passwordError) {
    throw new Error(passwordError)
  }

  if (!token || token.length < 24) {
    throw new Error("Lien de réinitialisation invalide.")
  }

  const tokenHash = hashAuthToken(token)
  const credential = await prisma.internalAuthCredential.findFirst({
    where: { passwordResetTokenHash: tokenHash },
    include: { user: true },
  })

  if (
    !credential ||
    !credential.passwordResetExpiresAt ||
    credential.passwordResetExpiresAt.getTime() < Date.now() ||
    !requestedRoleMatchesUser(appRole, credential.user.role)
  ) {
    throw new Error("Lien de réinitialisation expiré ou invalide.")
  }

  const passwordPayload = await hashInternalPassword(password)

  await prisma.internalAuthCredential.update({
    where: { id: credential.id },
    data: {
      ...passwordPayload,
      passwordUpdatedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetRequestedAt: null,
      twoFactorChallengeHash: null,
      twoFactorCodeHash: null,
      twoFactorExpiresAt: null,
      twoFactorRequestedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: credential.user.organizationId,
      userId: credential.user.id,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: credential.user.id,
      newValue: { email: credential.user.email, role: credential.user.role },
    },
  }).catch(() => null)

  return { ok: true }
}

export async function startInternalTwoFactorChallenge(user: User) {
  const credential = await prisma.internalAuthCredential.findUnique({
    where: { userId: user.id },
  })

  if (!credential) {
    throw new Error("Aucun mot de passe interne n’est configuré.")
  }

  assertCredentialNotLocked(credential)

  const challengeId = randomBytes(24).toString("base64url")
  const code = createSixDigitCode()
  const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MS)

  await prisma.internalAuthCredential.update({
    where: { id: credential.id },
    data: {
      twoFactorChallengeHash: hashAuthToken(challengeId),
      twoFactorCodeHash: hashAuthToken(code),
      twoFactorExpiresAt: expiresAt,
      twoFactorRequestedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })

  await sendTransactionalEmail({
    to: user.email,
    subject: "Code de connexion FinAssuro",
    text: [
      "Bonjour,",
      "",
      `Votre code de connexion FinAssuro est: ${code}`,
      "",
      "Ce code expire dans 10 minutes. Ne le partagez avec personne.",
    ].join("\n"),
    html: `
      <p>Bonjour,</p>
      <p>Votre code de connexion FinAssuro est :</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>Ce code expire dans 10 minutes. Ne le partagez avec personne.</p>
    `,
  })

  return {
    challengeId,
    expiresAt,
    email: maskEmail(user.email),
  }
}

export async function verifyInternalTwoFactorChallenge({ challengeId, code, role }: TwoFactorChallengeInput) {
  const appRole = normalizeSaasAppRole(role)
  const normalizedCode = code.replace(/\D/g, "")

  if (!challengeId || normalizedCode.length !== 6) {
    throw new Error("Code de vérification invalide.")
  }

  const credential = await prisma.internalAuthCredential.findFirst({
    where: { twoFactorChallengeHash: hashAuthToken(challengeId) },
    include: { user: true },
  })

  if (!credential) {
    throw new Error("Code de vérification expiré ou invalide.")
  }

  assertCredentialNotLocked(credential)

  if (
    !credential.twoFactorCodeHash ||
    !credential.twoFactorExpiresAt ||
    credential.twoFactorExpiresAt.getTime() < Date.now() ||
    !requestedRoleMatchesUser(appRole, credential.user.role)
  ) {
    throw new Error("Code de vérification expiré ou invalide.")
  }

  const providedHash = hashAuthToken(normalizedCode)

  if (!safeTokenEquals(providedHash, credential.twoFactorCodeHash)) {
    await recordInternalAuthFailure(credential)
    throw new Error("Code de vérification invalide.")
  }

  await prisma.internalAuthCredential.update({
    where: { id: credential.id },
    data: {
      twoFactorChallengeHash: null,
      twoFactorCodeHash: null,
      twoFactorExpiresAt: null,
      twoFactorRequestedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastTwoFactorAt: new Date(),
    },
  })

  return credential.user
}

async function findClientForPortalSignup(email: string, redirectUrl?: string) {
  const clientId = clientIdFromRedirectUrl(redirectUrl)

  return prisma.client.findFirst({
    where: {
      ...(clientId ? { id: clientId } : {}),
      status: { not: "ARCHIVED" },
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { emailPrimary: { equals: email, mode: "insensitive" } },
        { emailSecondary: { equals: email, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  })
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  return slug || "finadvisor"
}

function clientIdFromRedirectUrl(redirectUrl?: string) {
  if (!redirectUrl?.startsWith("/")) return null

  try {
    return new URL(redirectUrl, "https://finassuro.local").searchParams.get("clientId")
  } catch {
    return null
  }
}

async function createClientPortalUser(email: string, password: string, name?: string, redirectUrl?: string) {
  const client = await findClientForPortalSignup(email, redirectUrl)

  if (!client) {
    throw new Error("Aucun dossier client actif ne correspond à ce courriel.")
  }

  const passwordPayload = await hashInternalPassword(password)
  const displayName = name?.trim() || `${client.firstName} ${client.lastName}`.trim() || email.split("@")[0]

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: { internalCredential: true },
    })

    if (existing) {
      if (existing.internalCredential) return existing

      return tx.user.update({
        where: { id: existing.id },
        data: {
          organizationId: client.organizationId,
          role: "CLIENT",
          name: displayName,
          internalCredential: { create: passwordPayload },
        },
      })
    }

    return tx.user.create({
      data: {
        organizationId: client.organizationId,
        email,
        name: displayName,
        role: "CLIENT",
        internalCredential: { create: passwordPayload },
      },
    })
  })
}

async function createWorkspaceUser(
  email: string,
  password: string,
  appRole: SaasAppRole,
  name?: string,
  subscriptionPlan?: SubscriptionPlanKey,
  subscriptionPricingMode?: SubscriptionPricingModeKey,
  subscriptionCurrency?: SubscriptionCurrencyKey
) {
  if (process.env.INTERNAL_AUTH_ALLOW_SIGNUP !== "true") {
    throw new Error("La création libre d’un accès conseiller est désactivée. Utilise un utilisateur existant ou active INTERNAL_AUTH_ALLOW_SIGNUP.")
  }

  const passwordPayload = await hashInternalPassword(password)
  const displayName = name?.trim() || email.split("@")[0] || "Utilisateur"
  const organizationId = `internal-org-${randomUUID()}`
  const organizationName = organizationNameForAppRole(appRole, displayName, email)
  const organizationSlug = `internal-${slugify(email)}-${randomUUID().slice(0, 8)}`
  const role = userRoleForAppRole(appRole)
  const resolvedPlan = appRole === "advisor" ? normalizeSubscriptionPlan(subscriptionPlan) : "ESSENTIEL"
  const resolvedPricingMode = appRole === "advisor" ? normalizeSubscriptionPricingMode(subscriptionPricingMode) : "standard"
  const resolvedCurrency = appRole === "advisor" ? normalizeSubscriptionCurrency(subscriptionCurrency) : "EUR"

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: organizationId,
        name: organizationName,
        slug: organizationSlug,
        organizationType: organizationTypeForSubscriptionPlan(resolvedPlan),
        subscriptionPlan: resolvedPlan,
        subscriptionPricingMode: resolvedPricingMode,
        subscriptionCurrency: resolvedCurrency,
        advisorSeatLimit: subscriptionPlans[resolvedPlan].defaultSeatLimit,
      },
    })

    return tx.user.create({
      data: {
        organizationId: organization.id,
        email,
        name: displayName,
        role,
        internalCredential: { create: passwordPayload },
      },
    })
  })
}

async function attachBootstrapCredential(user: User, password: string) {
  const bootstrapPassword = process.env.INTERNAL_AUTH_BOOTSTRAP_PASSWORD
  if (!bootstrapPassword || password !== bootstrapPassword) {
    return null
  }

  const passwordPayload = await hashInternalPassword(password)

  return prisma.user.update({
    where: { id: user.id },
    data: {
      internalCredential: {
        create: passwordPayload,
      },
    },
  })
}

export async function resolveInternalAuthUser({
  email: rawEmail,
  password,
  role,
  name,
  redirectUrl,
  subscriptionPlan,
  subscriptionPricingMode,
  subscriptionCurrency,
  mode = "sign-in",
}: ResolveInternalUserInput) {
  const email = normalizeEmail(rawEmail)
  const appRole = normalizeSaasAppRole(role)
  const passwordError = validateInternalPassword(password)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Adresse courriel invalide.")
  }

  if (passwordError) {
    throw new Error(mode === "sign-in" ? "Courriel ou mot de passe invalide." : passwordError)
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { internalCredential: true },
  })

  if (!existingUser) {
    if (appRole === "client") {
      return createClientPortalUser(email, password, name, redirectUrl)
    }

    return createWorkspaceUser(email, password, appRole, name, subscriptionPlan, subscriptionPricingMode, subscriptionCurrency)
  }

  if (!existingUser.internalCredential) {
    if (appRole === "client") {
      const client = await findClientForPortalSignup(email, redirectUrl)

      if (client) {
        const passwordPayload = await hashInternalPassword(password)

        return prisma.user.update({
          where: { id: existingUser.id },
          data: {
            internalCredential: {
              create: passwordPayload,
            },
          },
        })
      }
    }

    if (mode === "sign-up" && existingUser.role === "CLIENT") {
      return createClientPortalUser(email, password, name, redirectUrl)
    }

    const bootstrappedUser = await attachBootstrapCredential(existingUser, password)
    if (bootstrappedUser) return bootstrappedUser

    throw new Error("Cet utilisateur existe, mais aucun mot de passe interne n’est configuré.")
  }

  assertCredentialNotLocked(existingUser.internalCredential)

  const isValid = await verifyInternalPassword(
    password,
    existingUser.internalCredential.passwordSalt,
    existingUser.internalCredential.passwordHash
  )

  if (!isValid) {
    await recordInternalAuthFailure(existingUser.internalCredential)
    throw new Error("Courriel ou mot de passe invalide.")
  }

  if (mode === "sign-up") {
    throw new Error("Un accès existe déjà pour ce courriel. Utilise la connexion.")
  }

  return existingUser
}

export function requestedRoleMatchesUser(role: SaasAppRole | undefined, userRole: UserRole) {
  const appRole = normalizeSaasAppRole(role)
  if (appRole === "client") return userRole !== "DEVELOPER"
  if (appRole === "developer") return userRole === "DEVELOPER"
  return userRole !== "CLIENT" && userRole !== "DEVELOPER"
}
