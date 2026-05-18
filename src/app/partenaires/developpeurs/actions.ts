"use server"

import { redirect } from "next/navigation"

import { developerApiPermissions } from "@/lib/developer-api/catalog"
import { prisma } from "@/lib/prisma"

export async function createDeveloperPartnerRequest(formData: FormData) {
  const companyName = String(formData.get("companyName") ?? "").trim()
  const contactName = String(formData.get("contactName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const website = String(formData.get("website") ?? "").trim() || null
  const useCase = String(formData.get("useCase") ?? "").trim()
  const requestedScopes = formData
    .getAll("requestedScopes")
    .map(String)
    .filter((scope) => scope in developerApiPermissions)

  if (!companyName || !contactName || !email || !useCase) {
    redirect("/partenaires/developpeurs?request=missing")
  }

  await prisma.developerPartnerRequest.create({
    data: {
      companyName,
      contactName,
      email,
      website,
      useCase,
      requestedScopes,
      status: "NEW",
    },
  })

  redirect("/partenaires/developpeurs?request=sent")
}
