export function assertValidId(id: unknown): asserts id is string {
  if (!id || typeof id !== "string" || id.trim().length < 2) {
    throw new Error("INVALID_ID")
  }
}
