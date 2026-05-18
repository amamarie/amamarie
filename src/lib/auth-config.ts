export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  )
}

export type AuthProvider = "clerk" | "internal"

export function authProvider(): AuthProvider {
  const configuredProvider =
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? process.env.AUTH_PROVIDER

  if (configuredProvider === "internal") return "internal"
  if (configuredProvider === "clerk") return "clerk"

  return isClerkConfigured() ? "clerk" : "internal"
}

export function isInternalAuthEnabled() {
  return authProvider() === "internal"
}

export function isClerkAuthEnabled() {
  return authProvider() === "clerk" && isClerkConfigured()
}
