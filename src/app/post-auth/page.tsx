import { redirect } from "next/navigation"

import { homePathForUserRole } from "@/lib/auth/app-roles"
import { getCurrentUserWithOrg } from "@/lib/auth"

export default async function PostAuthPage() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    redirect("/sign-in")
  }

  redirect(homePathForUserRole(user.role))
}
