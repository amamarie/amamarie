import { notFound, redirect } from "next/navigation"

import { ClientPortalWorkspace, type ClientPortalPage } from "@/components/client-portal/ClientPortalWorkspace"
import { getClientPortalContext } from "@/lib/client-portal"

type ClientPortalSectionPageProps = {
  params?: Promise<{ section?: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const sectionPages: Record<string, ClientPortalPage> = {
  profil: "profil",
  consentements: "consentements",
  messages: "messages",
  documents: "documents",
  analyses: "analyses",
  recommandations: "recommandations",
  conseiller: "conseiller",
  historique: "historique",
}

export default async function ClientPortalSectionPage({ params, searchParams }: ClientPortalSectionPageProps) {
  const resolvedParams = await params
  const activePage = sectionPages[resolvedParams?.section ?? ""]
  if (!activePage) notFound()

  const resolvedSearchParams = await searchParams
  const clientId = Array.isArray(resolvedSearchParams?.clientId) ? resolvedSearchParams.clientId[0] : resolvedSearchParams?.clientId
  const { user, client, isPreview } = await getClientPortalContext(clientId)

  if (!client) {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""
    redirect(`/espace-client${query}`)
  }

  const serializableClient = JSON.parse(JSON.stringify(client))

  return (
    <ClientPortalWorkspace
      userName={user.name}
      userEmail={user.email}
      client={serializableClient}
      isPreview={isPreview}
      activePage={activePage}
    />
  )
}
