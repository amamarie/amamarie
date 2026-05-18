import { fail, ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { createCrmActivity } from "@/lib/crm-events"
import { canAccessDocumentContent, ensureDocumentVaultSettings } from "@/lib/documents/settings"
import { logDocumentAccess } from "@/lib/documents/vault"
import { prisma } from "@/lib/prisma"
import { getDocumentById } from "@/lib/services/documents"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const tenant = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
    const document = await getDocumentById({ user, id })
    if (!document.storagePath) return fail("NO_FILE", "Aucun fichier n’est lié à ce document.", 404)
    const settings = await ensureDocumentVaultSettings(user.organizationId)
    if (!canAccessDocumentContent({ settings, role: user.role, document })) return fail("DOCUMENT_RESTRICTED", "Téléchargement restreint selon la politique documentaire du cabinet.", 403)

    const bucket = document.storageBucket ?? getDocumentsBucket()
    const { data, error } = await getSupabaseServerClient().storage.from(bucket).createSignedUrl(document.storagePath, 300, {
      download: document.originalFileName ?? document.fileName ?? document.name,
    })
    if (error || !data?.signedUrl) return fail("SIGNED_URL_FAILED", "Impossible de générer le lien temporaire.", 500)

    await logDocumentAccess({
      user,
      document,
      eventType: "DOWNLOAD",
      request,
      purpose: "Téléchargement par utilisateur autorisé",
      metadata: { expiresIn: 300, fileName: document.originalFileName ?? document.fileName ?? document.name },
    })
    await createCrmActivity({ organizationId: user.organizationId, userId: user.id, clientId: document.clientId, leadId: document.leadId, type: "DOCUMENT_DOWNLOADED", title: "Lien de téléchargement généré", description: document.name })
    return ok({ url: data.signedUrl, expiresIn: 300 })
  } catch (error) {
    return handleDocumentError(error)
  }
}
