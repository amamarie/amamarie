import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/assurance",
  "/client",
  "/f(.*)",
  "/rendez-vous(.*)",
  "/api/public(.*)",
  "/api/webhooks(.*)",
])

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()
  await auth.protect()
  return NextResponse.next()
})

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const provider =
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? process.env.AUTH_PROVIDER

  if (provider === "internal") {
    return NextResponse.next()
  }

  return clerkProxy(request, event)
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
}
