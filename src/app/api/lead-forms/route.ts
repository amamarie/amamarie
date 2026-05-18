import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createLeadForm, listLeadForms } from "@/lib/services/lead-forms"
import { getTenantContext } from "@/lib/tenant"
import { formatValidationError } from "@/lib/validation-error"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const forms = await listLeadForms({ organizationId, advisorId: userId })
    return ok(forms)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const form = await createLeadForm({
      organizationId,
      advisorId: userId,
      input: await request.json(),
    })
    return ok(form, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("CONFLICT", "Ce slug de formulaire est déjà utilisé.", 409)
    }
    return fail("VALIDATION_ERROR", formatValidationError(error, "Impossible de créer le formulaire."), 400)
  }
}
