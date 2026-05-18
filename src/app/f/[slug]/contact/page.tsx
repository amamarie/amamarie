import { notFound } from "next/navigation"

import { PublicLeadFormPageClient } from "@/components/lead-forms/PublicLeadFormPageClient"
import { findPublicLeadForm } from "@/lib/services/lead-forms"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function PublicLeadFormPage({ params }: PageProps) {
  const { slug } = await params
  const form = await findPublicLeadForm(slug)
  if (!form) notFound()

  return (
    <PublicLeadFormPageClient
      slug={form.slug}
      title={form.publicTitle}
      description={form.publicDescription}
      advisorName={form.advisor.name}
      organizationName={form.organization.name}
      fields={form.fields}
    />
  )
}
