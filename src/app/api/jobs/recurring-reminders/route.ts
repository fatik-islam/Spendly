import { createPrivateKey, sign as cryptoSign, timingSafeEqual } from "node:crypto"
import { connect, constants } from "node:http2"

import { createAdminClient } from "@insforge/sdk"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface EmailJob {
  reminder_id: string
  email: string
  full_name: string | null
  title: string
  body: string
  due_date: string
}

interface PushJob {
  reminder_id: string
  device_token_id: string
  device_token: string
  environment: "sandbox" | "production"
  bundle_id: string
  title: string
  body: string
  due_date: string
}

interface APNsResult {
  ok: boolean
  status: number
  reason: string | null
}

interface FCMJob {
  reminder_id: string
  device_token_id: string
  device_token: string
  package_name: string
  title: string
  body: string
  due_date: string
}

interface FCMResult {
  ok: boolean
  status: number
  reason: string | null
  invalidToken: boolean
}

function createClient() {
  const baseUrl = process.env.INSFORGE_BASE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge admin configuration for reminder delivery.")
  }

  return createAdminClient({ baseUrl, apiKey })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDueDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00Z`))
}

function buildReminderEmail(job: EmailJob) {
  const safeTitle = escapeHtml(job.title)
  const safeBody = escapeHtml(job.body)
  const safeName = escapeHtml(job.full_name?.trim() || "there")
  const safeDate = escapeHtml(formatDueDate(job.due_date))

  return `
    <div style="background:#f4f7fb;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;overflow:hidden;">
        <div style="padding:24px 24px 16px;background:linear-gradient(135deg,#1e3a8a 0%,#06b6d4 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;">Spendly reminder</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;">${safeTitle}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">${safeBody}</p>
          <div style="margin:24px 0;padding:16px 18px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
            <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#475569;">Due date</div>
            <div style="margin-top:8px;font-size:22px;font-weight:700;color:#0f172a;">${safeDate}</div>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">Open Spendly to review the recurring item, record the payment, or move the next due date forward.</p>
        </div>
      </div>
    </div>
  `
}

function secretsMatch(provided: string | null, expected: string) {
  if (!provided) return false
  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
}

function createAPNsProviderToken() {
  const keyID = process.env.APNS_KEY_ID
  const teamID = process.env.APNS_TEAM_ID
  const privateKeyValue = process.env.APNS_PRIVATE_KEY

  if (!keyID || !teamID || !privateKeyValue) return null

  const privateKey = privateKeyValue.replaceAll("\\n", "\n").trim() + "\n"
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyID })).toString("base64url")
  const encodedPayload = Buffer.from(JSON.stringify({
    iss: teamID,
    iat: Math.floor(Date.now() / 1000)
  })).toString("base64url")
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363"
  }).toString("base64url")

  return `${signingInput}.${signature}`
}

async function createFCMAccessToken() {
  const projectID = process.env.FCM_PROJECT_ID
  const clientEmail = process.env.FCM_CLIENT_EMAIL
  const encodedPrivateKey = process.env.FCM_PRIVATE_KEY_BASE64
  const privateKeyValue = process.env.FCM_PRIVATE_KEY ?? (
    encodedPrivateKey ? Buffer.from(encodedPrivateKey, "base64").toString("utf8") : null
  )

  if (!projectID || !clientEmail || !privateKeyValue) return null

  const issuedAt = Math.floor(Date.now() / 1000)
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const encodedPayload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: issuedAt,
    exp: issuedAt + 3600
  })).toString("base64url")
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = cryptoSign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    createPrivateKey(privateKeyValue.replaceAll("\\n", "\n").trim() + "\n")
  ).toString("base64url")

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signature}`
    })
  })
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string
    error_description?: string
  }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? `Google OAuth returned HTTP ${response.status}`)
  }

  return { accessToken: payload.access_token, projectID }
}

async function sendFCMNotification(
  job: FCMJob,
  credentials: { accessToken: string; projectID: string }
): Promise<FCMResult> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${credentials.projectID}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: {
          token: job.device_token,
          notification: { title: job.title, body: job.body },
          data: {
            reminder_id: job.reminder_id,
            destination: "recurring",
            due_date: job.due_date,
            title: job.title,
            body: job.body
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "spendly_reminders",
              sound: "default",
              tag: `spendly-${job.reminder_id}`
            }
          }
        }
      })
    }
  )

  if (response.ok) return { ok: true, status: response.status, reason: null, invalidToken: false }

  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; status?: string; details?: Array<{ errorCode?: string }> }
  }
  const errorCode = payload.error?.details?.find((detail) => detail.errorCode)?.errorCode
  return {
    ok: false,
    status: response.status,
    reason: errorCode ?? payload.error?.status ?? payload.error?.message ?? `FCM returned HTTP ${response.status}`,
    invalidToken: errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT"
  }
}

async function sendAPNsNotification(job: PushJob, providerToken: string): Promise<APNsResult> {
  const authority = job.environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com"
  const payload = JSON.stringify({
    aps: {
      alert: { title: job.title, body: job.body },
      sound: "default",
      badge: 1,
      "thread-id": "spendly-recurring"
    },
    reminder_id: job.reminder_id,
    destination: "recurring",
    due_date: job.due_date
  })

  return await new Promise<APNsResult>((resolve, reject) => {
    const session = connect(authority)
    session.on("error", () => undefined)

    const request = session.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${job.device_token}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": job.bundle_id,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "apns-collapse-id": `spendly-${job.reminder_id}`,
      "content-type": "application/json"
    })

    let status = 0
    let responseBody = ""
    request.setEncoding("utf8")
    request.on("response", (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0)
    })
    request.on("data", (chunk: string) => {
      responseBody += chunk
    })
    request.on("end", () => {
      session.close()
      if (status === 200) {
        resolve({ ok: true, status, reason: null })
        return
      }

      let reason = `APNs returned HTTP ${status}`
      try {
        const parsed = JSON.parse(responseBody) as { reason?: string }
        reason = parsed.reason ?? reason
      } catch {
        // Preserve the HTTP fallback when APNs returns no JSON body.
      }
      resolve({ ok: false, status, reason })
    })
    request.on("error", (error) => {
      session.destroy()
      reject(error)
    })
    request.end(payload)
  })
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.REMINDER_SCHEDULE_TOKEN
  if (!expectedToken || !secretsMatch(request.headers.get("x-reminder-token"), expectedToken)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { limit?: unknown }
    const limit = typeof body.limit === "number" ? Math.max(1, Math.min(body.limit, 50)) : 25
    const client = createClient()

    const { data: insertedCount, error: syncError } = await client.database.rpc("generate_recurring_reminders", {
      p_target_user_id: null
    })
    if (syncError) throw syncError

    const failures: Array<{ reminderId: string; channel: "email" | "push" | "fcm"; message: string }> = []
    const { data: emailJobs, error: emailJobsError } = await client.database.rpc(
      "list_pending_recurring_reminder_emails",
      { p_limit: limit }
    )
    if (emailJobsError) throw emailJobsError

    let emailedCount = 0
    for (const job of (emailJobs ?? []) as EmailJob[]) {
      const { error: emailError } = await client.emails.send({
        to: job.email,
        subject: `Spendly reminder: ${job.title}`,
        html: buildReminderEmail(job),
        from: "Spendly Alerts"
      })

      const { error: updateError } = await client.database
        .from("recurring_reminders")
        .update(emailError
          ? { email_last_error: emailError.message }
          : { email_sent_at: new Date().toISOString(), email_last_error: null })
        .eq("id", job.reminder_id)

      if (updateError || emailError) {
        failures.push({
          reminderId: job.reminder_id,
          channel: "email",
          message: updateError?.message ?? emailError?.message ?? "Email delivery failed"
        })
      } else {
        emailedCount += 1
      }
    }

    const providerToken = createAPNsProviderToken()
    const configuredEnvironment = process.env.APNS_ENVIRONMENT ?? "production"
    let queuedPushJobs = 0
    let pushedCount = 0

    if (providerToken) {
      const { data: pushJobs, error: pushJobsError } = await client.database.rpc(
        "list_pending_recurring_reminder_pushes",
        { p_limit: Math.min(limit * 4, 200) }
      )
      if (pushJobsError) throw pushJobsError

      const eligiblePushJobs = ((pushJobs ?? []) as PushJob[])
        .filter((job) => job.environment === configuredEnvironment)
      queuedPushJobs = eligiblePushJobs.length

      for (const job of eligiblePushJobs) {
        let result: APNsResult
        try {
          result = await sendAPNsNotification(job, providerToken)
        } catch (error) {
          result = {
            ok: false,
            status: 0,
            reason: error instanceof Error ? error.message : "APNs request failed"
          }
        }

        const { error: recordError } = await client.database.rpc("record_recurring_reminder_push_result", {
          p_reminder_id: job.reminder_id,
          p_device_token_id: job.device_token_id,
          p_sent: result.ok,
          p_error: result.reason
        })

        if (recordError) {
          failures.push({ reminderId: job.reminder_id, channel: "push", message: recordError.message })
          continue
        }

        if (result.ok) {
          pushedCount += 1
          continue
        }

        if (["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(result.reason ?? "")) {
          const { error: disableError } = await client.database
            .from("apns_device_tokens")
            .update({ enabled: false })
            .eq("id", job.device_token_id)
          if (disableError) {
            failures.push({ reminderId: job.reminder_id, channel: "push", message: disableError.message })
          }
        }

        failures.push({
          reminderId: job.reminder_id,
          channel: "push",
          message: result.reason ?? `APNs returned HTTP ${result.status}`
        })
      }
    }

    const fcmCredentials = await createFCMAccessToken()
    let queuedFCMJobs = 0
    let fcmPushedCount = 0

    if (fcmCredentials) {
      const { data: fcmJobs, error: fcmJobsError } = await client.database.rpc(
        "list_pending_recurring_reminder_fcm_pushes",
        { p_limit: Math.min(limit * 4, 200) }
      )
      if (fcmJobsError) throw fcmJobsError
      queuedFCMJobs = Array.isArray(fcmJobs) ? fcmJobs.length : 0

      for (const job of (fcmJobs ?? []) as FCMJob[]) {
        let result: FCMResult
        try {
          result = await sendFCMNotification(job, fcmCredentials)
        } catch (error) {
          result = {
            ok: false,
            status: 0,
            reason: error instanceof Error ? error.message : "FCM request failed",
            invalidToken: false
          }
        }

        const { error: recordError } = await client.database.rpc(
          "record_recurring_reminder_fcm_result",
          {
            p_reminder_id: job.reminder_id,
            p_device_token_id: job.device_token_id,
            p_sent: result.ok,
            p_error: result.reason
          }
        )
        if (recordError) {
          failures.push({ reminderId: job.reminder_id, channel: "fcm", message: recordError.message })
          continue
        }
        if (result.ok) {
          fcmPushedCount += 1
          continue
        }
        if (result.invalidToken) {
          const { error: disableError } = await client.database
            .from("fcm_device_tokens")
            .update({ enabled: false })
            .eq("id", job.device_token_id)
          if (disableError) {
            failures.push({ reminderId: job.reminder_id, channel: "fcm", message: disableError.message })
          }
        }
        failures.push({
          reminderId: job.reminder_id,
          channel: "fcm",
          message: result.reason ?? `FCM returned HTTP ${result.status}`
        })
      }
    }

    return NextResponse.json({
      ok: true,
      generatedCount: typeof insertedCount === "number" ? insertedCount : 0,
      queuedEmailJobs: Array.isArray(emailJobs) ? emailJobs.length : 0,
      emailedCount,
      apnsConfigured: Boolean(providerToken),
      queuedPushJobs,
      pushedCount,
      fcmConfigured: Boolean(fcmCredentials),
      queuedFCMJobs,
      fcmPushedCount,
      failures
    })
  } catch (error) {
    return NextResponse.json({
      error: "REMINDER_SYNC_FAILED",
      message: error instanceof Error ? error.message : "Unexpected reminder delivery failure."
    }, { status: 500 })
  }
}
