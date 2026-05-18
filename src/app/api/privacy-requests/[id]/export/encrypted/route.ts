import { randomBytes, scryptSync, createCipheriv } from "crypto"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { buildPrivacyExportPayload, createZip, privacyExportFiles } from "@/lib/privacy/export"
import { logPrivacyAccessRisk } from "@/lib/privacy/advanced"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function encrypt(buffer: Buffer, passphrase: string) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    algorithm: "AES-256-GCM",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    payload: encrypted.toString("base64"),
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: { role: true } })
    const body = await request.json().catch(() => ({}))
    const generatedPassphrase = randomBytes(18).toString("base64url")
    const passphrase = typeof body.passphrase === "string" && body.passphrase.length >= 12 ? body.passphrase : generatedPassphrase
    const payload = await buildPrivacyExportPayload({ organizationId, userId, requestId: id, request, role: user?.role })
    const zip = createZip(privacyExportFiles(payload))
    const encrypted = encrypt(zip, passphrase)
    await logPrivacyAccessRisk({ organizationId, userId, eventType: "MASS_EXPORT", request, metadata: { privacyRequestId: id, encrypted: true } })
    return ok({
      fileName: `export-portabilite-${id}.zip.aes256gcm.json`,
      encryption: encrypted,
      passphrase: body.passphrase ? undefined : passphrase,
      passphraseNotice: body.passphrase ? "Passphrase fournie par l’utilisateur." : "Passphrase générée une seule fois. Transmettre par canal séparé.",
    })
  } catch (error) {
    return handleApiError(error)
  }
}
