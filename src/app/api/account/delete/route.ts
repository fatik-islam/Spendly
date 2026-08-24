import { createClient } from "@insforge/sdk"
import { NextResponse } from "next/server"

type AuthenticatedClaims = {
  sub: string
  role: "authenticated"
}

function authenticatedClaims(token: string): AuthenticatedClaims | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      sub?: unknown
      role?: unknown
    }
    if (payload.role !== "authenticated" || typeof payload.sub !== "string" || !payload.sub) {
      return null
    }
    return { sub: payload.sub, role: payload.role }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")
  const userToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null

  if (!userToken) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const claims = authenticatedClaims(userToken)
  if (!claims || userToken === process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { confirmation?: unknown }
  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "CONFIRMATION_REQUIRED", message: "Type DELETE to confirm permanent deletion." },
      { status: 400 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "SERVER_CONFIGURATION_ERROR" }, { status: 500 })
  }

  const userClient = createClient({ baseUrl, edgeFunctionToken: userToken })
  const { data: userData, error: userError } = await userClient.auth.getCurrentUser()
  const userID = userData?.user?.id
  if (userError || !userID || userID !== claims.sub) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const deletion = await fetch(`${baseUrl}/api/auth/users`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ userIds: [userID] })
  })

  const deletionResult = await deletion.json().catch(() => ({})) as {
    message?: string
    deletedCount?: number
  }
  if (!deletion.ok || deletionResult.deletedCount !== 1) {
    return NextResponse.json(
      {
        error: "ACCOUNT_DELETION_FAILED",
        message: deletionResult.message ?? "The account could not be deleted."
      },
      { status: deletion.ok ? 409 : deletion.status >= 500 ? 502 : deletion.status }
    )
  }

  return NextResponse.json({ ok: true, deleted: true })
}
