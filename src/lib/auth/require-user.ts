import { getCurrentUserWithOrg } from "@/lib/auth"

export async function requireUserWithOrg() {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  if (!user.organizationId) {
    throw new Error("ORGANIZATION_NOT_FOUND")
  }

  return user
}
