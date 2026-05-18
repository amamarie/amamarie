import { Prisma } from "@prisma/client"

import { fail, ok } from "@/lib/api-response"
import { updateLeadForm } from "@/lib/services/lead-forms"
import { getTenantContext } from "@/lib/tenant"
import { formatValidationError } from "@/lib/validation-error"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const form = await updateLeadForm({
      organizationId,
      advisorId: userId,
      formId: id,
      input: await request.json(),
    })
    return ok(form)
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_FORM_NOT_FOUND") {
      return fail("NOT_FOUND", "Formulaire introuvable.", 404)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("CONFLICT", "Ce slug de formulaire est déjà utilisé.", 409)
    }
    return fail("VALIDATION_ERROR", formatValidationError(error, "Impossible de modifier le formulaire."), 400)
  }
}
