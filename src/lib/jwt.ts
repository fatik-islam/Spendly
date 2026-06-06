function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")
}

export function getJwtExpiration(token: string) {
  try {
    const payload = token.split(".")[1]

    if (!payload) {
      return null
    }

    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown }
    return typeof parsed.exp === "number" ? parsed.exp : null
  } catch {
    return null
  }
}

export function isJwtExpiredOrExpiring(token: string, leewaySeconds = 30) {
  const expiration = getJwtExpiration(token)

  if (!expiration) {
    return true
  }

  return expiration <= Math.floor(Date.now() / 1000) + leewaySeconds
}
