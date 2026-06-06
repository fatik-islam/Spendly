export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message
  }

  return fallback
}
