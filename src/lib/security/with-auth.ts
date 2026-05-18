import type { User } from "@prisma/client"

import { handleApiError } from "@/lib/errors/api-error"
import { requireUserWithOrg } from "@/lib/auth/require-user"

export function withAuth<TContext = unknown>(
  handler: (request: Request, user: User, context: TContext) => Promise<Response>
) {
  return async (request: Request, context: TContext) => {
    try {
      const user = await requireUserWithOrg()
      return handler(request, user, context)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
