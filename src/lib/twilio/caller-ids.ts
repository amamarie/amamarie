import { prisma } from "@/lib/prisma"
import { ensureCommunicationSettings } from "@/lib/services/communications"
import { getTwilioClient } from "@/lib/twilio/client"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

type TwilioOutgoingCallerId = {
  sid?: string
  phoneNumber?: string
  friendlyName?: string
}

type TwilioValidationRequest = {
  validationCode?: string | number | null
}

type TwilioCallerIdClient = {
  outgoingCallerIds: {
    list(options: { phoneNumber: string; limit: number }): Promise<TwilioOutgoingCallerId[]>
  }
  validationRequests: {
    create(options: {
      friendlyName: string
      phoneNumber: string
      statusCallback?: string
      statusCallbackMethod?: "POST"
    }): Promise<TwilioValidationRequest>
  }
}

function getOrganizationTwilioCredentials(settings: { twilioAccountSid?: string | null; twilioAuthToken?: string | null }) {
  return settings.twilioAccountSid && settings.twilioAuthToken
    ? { accountSid: settings.twilioAccountSid, authToken: settings.twilioAuthToken }
    : undefined
}

function getCallerIdClient(credentials?: { accountSid?: string | null; authToken?: string | null }) {
  return getTwilioClient(credentials) as unknown as TwilioCallerIdClient
}

function sanitizeCallerId(record: {
  id: string
  phoneNumber: string
  friendlyName: string | null
  twilioCallerIdSid: string | null
  validationCode: string | null
  status: string
  verifiedAt: Date | null
  lastAttemptAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return record
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
}

async function findTwilioCallerId({
  organizationId,
  phoneNumber,
}: {
  organizationId: string
  phoneNumber: string
}) {
  const settings = await ensureCommunicationSettings(organizationId)
  const client = getCallerIdClient(getOrganizationTwilioCredentials(settings))
  const matches = await client.outgoingCallerIds.list({ phoneNumber, limit: 20 })
  return matches.find((callerId) => normalizePhoneNumber(callerId.phoneNumber) === phoneNumber) ?? matches[0] ?? null
}

export async function listAdvisorTwilioCallerIds({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}) {
  const records = await prisma.advisorTwilioCallerId.findMany({
    where: { organizationId, userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  })
  return records.map(sanitizeCallerId)
}

export async function startAdvisorTwilioCallerIdVerification({
  organizationId,
  userId,
  phoneNumber,
  friendlyName,
}: {
  organizationId: string
  userId: string
  phoneNumber: string
  friendlyName?: string | null
}) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  if (!normalizedPhoneNumber) {
    throw new Error("TWILIO_CALLER_ID_INVALID_PHONE")
  }

  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, organizationId },
    select: { id: true, name: true },
  })
  const label = friendlyName?.trim() || `Numéro personnel - ${user.name}`
  const existingCallerId = await findTwilioCallerId({ organizationId, phoneNumber: normalizedPhoneNumber })

  if (existingCallerId?.sid) {
    const record = await prisma.advisorTwilioCallerId.upsert({
      where: { organizationId_userId_phoneNumber: { organizationId, userId, phoneNumber: normalizedPhoneNumber } },
      create: {
        organizationId,
        userId,
        phoneNumber: normalizedPhoneNumber,
        friendlyName: existingCallerId.friendlyName ?? label,
        twilioCallerIdSid: existingCallerId.sid,
        status: "VERIFIED",
        verifiedAt: new Date(),
        lastAttemptAt: new Date(),
      },
      update: {
        friendlyName: existingCallerId.friendlyName ?? label,
        twilioCallerIdSid: existingCallerId.sid,
        validationCode: null,
        status: "VERIFIED",
        verifiedAt: new Date(),
        lastAttemptAt: new Date(),
      },
    })
    return sanitizeCallerId(record)
  }

  const settings = await ensureCommunicationSettings(organizationId)
  const client = getCallerIdClient(getOrganizationTwilioCredentials(settings))
  const appUrl = getAppUrl()
  const validationRequest = await client.validationRequests.create({
    friendlyName: label,
    phoneNumber: normalizedPhoneNumber,
    ...(appUrl ? {
      statusCallback: `${appUrl}/api/webhooks/twilio/caller-id-validation`,
      statusCallbackMethod: "POST",
    } : {}),
  })
  const record = await prisma.advisorTwilioCallerId.upsert({
    where: { organizationId_userId_phoneNumber: { organizationId, userId, phoneNumber: normalizedPhoneNumber } },
    create: {
      organizationId,
      userId,
      phoneNumber: normalizedPhoneNumber,
      friendlyName: label,
      validationCode: validationRequest.validationCode ? String(validationRequest.validationCode) : null,
      status: "PENDING",
      lastAttemptAt: new Date(),
    },
    update: {
      friendlyName: label,
      validationCode: validationRequest.validationCode ? String(validationRequest.validationCode) : null,
      status: "PENDING",
      lastAttemptAt: new Date(),
    },
  })
  return sanitizeCallerId(record)
}

export async function refreshAdvisorTwilioCallerIdVerification({
  organizationId,
  userId,
  id,
}: {
  organizationId: string
  userId: string
  id: string
}) {
  const record = await prisma.advisorTwilioCallerId.findFirstOrThrow({
    where: { id, organizationId, userId },
  })
  const callerId = await findTwilioCallerId({ organizationId, phoneNumber: record.phoneNumber })

  if (!callerId?.sid) {
    return sanitizeCallerId(record)
  }

  const updated = await prisma.advisorTwilioCallerId.update({
    where: { id: record.id },
    data: {
      friendlyName: callerId.friendlyName ?? record.friendlyName,
      twilioCallerIdSid: callerId.sid,
      validationCode: null,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
  })
  return sanitizeCallerId(updated)
}

export async function updateAdvisorTwilioCallerIdFromCallback({
  phoneNumber,
  twilioCallerIdSid,
  verificationStatus,
}: {
  phoneNumber?: string | null
  twilioCallerIdSid?: string | null
  verificationStatus?: string | null
}) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  const where = {
    OR: [
      ...(twilioCallerIdSid ? [{ twilioCallerIdSid }] : []),
      ...(normalizedPhoneNumber ? [{ phoneNumber: normalizedPhoneNumber }] : []),
    ],
  }

  if (where.OR.length === 0) {
    return { updated: 0 }
  }

  const success = verificationStatus === "success"
  const result = await prisma.advisorTwilioCallerId.updateMany({
    where,
    data: {
      status: success ? "VERIFIED" : "FAILED",
      ...(twilioCallerIdSid ? { twilioCallerIdSid } : {}),
      ...(success ? { verifiedAt: new Date(), validationCode: null } : {}),
    },
  })

  return { updated: result.count }
}
