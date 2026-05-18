import { NextResponse } from "next/server"
import { ZodError } from "zod"

export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED" || error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    if (error.message === "ORGANIZATION_NOT_FOUND") {
      return NextResponse.json({ error: "Organization not found" }, { status: 403 })
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (error.message === "INVALID_ID") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 })
  }

  return NextResponse.json({ error: "Server error" }, { status: 500 })
}
