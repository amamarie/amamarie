import { fail, handleApiError, ok } from "@/lib/api-response"
import { findClientPortalRecord, getClientPortalApiUser } from "@/lib/client-portal"
import { createCrmActivity } from "@/lib/crm-events"
import { canPreviewMimeType } from "@/lib/documents/file-validation"
import { prisma } from "@/lib/prisma"
import { getDocumentsBucket, getSupabaseServerClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const { id } = await params
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode") === "download" ? "download" : "preview"

    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: client.organizationId,
        clientId: client.id,
        status: { not: "ARCHIVED" },
        visibility: "CLIENT_VISIBLE",
      },
    })
    if (!document) return fail("DOCUMENT_NOT_FOUND", "Document introuvable dans votre dossier client.", 404)
    if (!document.storagePath) return fail("NO_FILE", "Aucun fichier n’est lié à ce document.", 404)
    if (mode === "preview" && !canPreviewMimeType(document.mimeType)) {
      return fail("PREVIEW_UNAVAILABLE", "Aperçu non disponible pour ce type de fichier. Utilisez le téléchargement.", 400)
    }

    const bucket = document.storageBucket ?? getDocumentsBucket()
    const { data, error } = await getSupabaseServerClient().storage.from(bucket).createSignedUrl(
      document.storagePath,
      300,
      mode === "download"
        ? { download: document.originalFileName ?? document.fileName ?? document.name }
        : undefined
    )
    if (error || !data?.signedUrl) return fail("SIGNED_URL_FAILED", "Impossible de générer le lien temporaire.", 500)

    await createCrmActivity({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      documentId: document.id,
      type: mode === "download" ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_PREVIEWED",
      title: mode === "download" ? "Document téléchargé depuis le portail client" : "Document consulté depuis le portail client",
      description: document.name,
      source: "WEBHOOK",
      metadata: { channel: "CLIENT_PORTAL" },
    })

    return ok({ url: data.signedUrl, expiresIn: 300, mimeType: document.mimeType })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
