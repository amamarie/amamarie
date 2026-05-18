import type { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"

import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"

export async function requireSaasRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    redirect("/sign-in")
  }

  if (!allowedRoles.includes(user.role)) {
    redirect(homePathForUserRole(user.role))
  }

  return user
}
