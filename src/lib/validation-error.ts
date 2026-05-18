import { ZodError } from "zod"

export function formatValidationError(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => issue.message)
      .filter(Boolean)
      .join(" ")
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
