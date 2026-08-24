import { createAdminClient } from "npm:@insforge/sdk"
import { importPKCS8, SignJWT } from "npm:jose@6"

interface EmailJob {
  reminder_id: string
  user_id: string
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Reminder-Token"
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
  const parsed = new Date(`${date}T00:00:00Z`)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed)
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
          <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
            Open Spendly to review the recurring item, record the payment, or move the next due date forward.
          </p>
        </div>
      </div>
    </div>
  `
}

function createClient() {
  const baseUrl = Deno.env.get("SPENDLY_INSFORGE_BASE_URL") ?? Deno.env.get("INSFORGE_BASE_URL")
  const apiKey = Deno.env.get("SPENDLY_INSFORGE_API_KEY") ?? Deno.env.get("API_KEY") ?? Deno.env.get("INSFORGE_API_KEY")

  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge admin client configuration for reminder sync.")
  }

  return createAdminClient({
    baseUrl,
    apiKey
  })
}

function normalizedPrivateKey(value: string) {
  return value.replaceAll("\\n", "\n").trim() + "\n"
}

async function createAPNsProviderToken() {
  const keyID = Deno.env.get("APNS_KEY_ID")
  const teamID = Deno.env.get("APNS_TEAM_ID")
  const privateKeyValue = Deno.env.get("APNS_PRIVATE_KEY")

  if (!keyID || !teamID || !privateKeyValue) {
    return null
  }

  const privateKey = await importPKCS8(normalizedPrivateKey(privateKeyValue), "ES256")
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyID })
    .setIssuer(teamID)
    .setIssuedAt()
    .sign(privateKey)

  return { token, keyID, teamID }
}

async function sendAPNsNotification(job: PushJob, providerToken: string): Promise<APNsResult> {
  const host = job.environment === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com"
  const response = await fetch(`${host}/3/device/${job.device_token}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${providerToken}`,
      "apns-topic": job.bundle_id,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "apns-collapse-id": `spendly-${job.reminder_id}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: job.title,
          body: job.body
        },
        sound: "default",
        badge: 1,
        "thread-id": "spendly-recurring"
      },
      reminder_id: job.reminder_id,
      destination: "recurring",
      due_date: job.due_date
    })
  })

  if (response.ok) {
    return { ok: true, status: response.status, reason: null }
  }

  const payload = await response.json().catch(() => ({})) as { reason?: string }
  return {
    ok: false,
    status: response.status,
    reason: payload.reason ?? `APNs returned HTTP ${response.status}`
  }
}

async function createFCMAccessToken() {
  const projectID = Deno.env.get("FCM_PROJECT_ID")
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL")
  const encodedPrivateKey = Deno.env.get("FCM_PRIVATE_KEY_BASE64")
  const privateKeyValue = Deno.env.get("FCM_PRIVATE_KEY") ?? (
    encodedPrivateKey
      ? new TextDecoder().decode(Uint8Array.from(atob(encodedPrivateKey), (character) => character.charCodeAt(0)))
      : null
  )
  if (!projectID || !clientEmail || !privateKeyValue) {
    return null
  }

  const privateKey = await importPKCS8(normalizedPrivateKey(privateKeyValue), "RS256")
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey)

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
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

async function sendFCMNotification(job: FCMJob, credentials: { accessToken: string; projectID: string }): Promise<FCMResult> {
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
  if (response.ok) {
    return { ok: true, status: response.status, reason: null, invalidToken: false }
  }
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; status?: string; details?: Array<{ errorCode?: string }> }
  }
  const errorCode = payload.error?.details?.find((detail) => detail.errorCode)?.errorCode
  const reason = errorCode ?? payload.error?.status ?? payload.error?.message ?? `FCM returned HTTP ${response.status}`
  return {
    ok: false,
    status: response.status,
    reason,
    invalidToken: errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT"
  }
}

function getProvidedToken(req: Request) {
  const header = req.headers.get("x-reminder-token")
  if (header) {
    return header
  }

  const authorization = req.headers.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length)
  }

  return null
}

export default async function syncRecurringReminders(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  const expectedToken = Deno.env.get("REMINDER_SCHEDULE_TOKEN")
  if (expectedToken && getProvidedToken(req) !== expectedToken) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  try {
    const client = createClient()
    const body = (req.headers.get("content-type")?.includes("application/json") ? await req.json().catch(() => ({})) : {}) as {
      limit?: unknown
    }
    const limit = typeof body.limit === "number" ? Math.max(1, Math.min(body.limit, 50)) : 25

    const { data: insertedCount, error: syncError } = await client.database.rpc("generate_recurring_reminders", {
      p_target_user_id: null
    })
    if (syncError) {
      throw syncError
    }

    const { data: emailJobs, error: emailJobsError } = await client.database.rpc("list_pending_recurring_reminder_emails", {
      p_limit: limit
    })
    if (emailJobsError) {
      throw emailJobsError
    }

    let emailedCount = 0
    const failures: Array<{ reminderId: string; email: string; message: string }> = []

    for (const job of (emailJobs ?? []) as EmailJob[]) {
      const { error: emailError } = await client.emails.send({
        to: job.email,
        subject: `Spendly reminder: ${job.title}`,
        html: buildReminderEmail(job),
        from: "Spendly Alerts"
      })

      const updatePayload = emailError
        ? {
            email_last_error: emailError.message
          }
        : {
            email_sent_at: new Date().toISOString(),
            email_last_error: null
          }

      const { error: updateError } = await client.database
        .from("recurring_reminders")
        .update(updatePayload)
        .eq("id", job.reminder_id)

      if (updateError) {
        failures.push({
          reminderId: job.reminder_id,
          email: job.email,
          message: updateError.message
        })
        continue
      }

      if (emailError) {
        failures.push({
          reminderId: job.reminder_id,
          email: job.email,
          message: emailError.message
        })
      } else {
        emailedCount += 1
      }
    }

    const apnsCredentials = await createAPNsProviderToken()
    const configuredEnvironment = (Deno.env.get("APNS_ENVIRONMENT") ?? "production") as "sandbox" | "production"
    let queuedPushJobs = 0
    let pushedCount = 0

    if (apnsCredentials) {
      const { data: pushJobs, error: pushJobsError } = await client.database.rpc(
        "list_pending_recurring_reminder_pushes",
        { p_limit: Math.min(limit * 4, 200) }
      )
      if (pushJobsError) {
        throw pushJobsError
      }

      const eligiblePushJobs = ((pushJobs ?? []) as PushJob[])
        .filter((job) => job.environment === configuredEnvironment)
      queuedPushJobs = eligiblePushJobs.length

      for (const job of eligiblePushJobs) {
        let result: APNsResult
        try {
          result = await sendAPNsNotification(job, apnsCredentials.token)
        } catch (error) {
          result = {
            ok: false,
            status: 0,
            reason: error instanceof Error ? error.message : "APNs request failed"
          }
        }

        const { error: recordError } = await client.database.rpc(
          "record_recurring_reminder_push_result",
          {
            p_reminder_id: job.reminder_id,
            p_device_token_id: job.device_token_id,
            p_sent: result.ok,
            p_error: result.reason
          }
        )

        if (recordError) {
          failures.push({
            reminderId: job.reminder_id,
            email: "push",
            message: recordError.message
          })
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
            failures.push({
              reminderId: job.reminder_id,
              email: "push",
              message: disableError.message
            })
          }
        }

        failures.push({
          reminderId: job.reminder_id,
          email: "push",
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
      if (fcmJobsError) {
        throw fcmJobsError
      }
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
          failures.push({ reminderId: job.reminder_id, email: "fcm", message: recordError.message })
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
            failures.push({ reminderId: job.reminder_id, email: "fcm", message: disableError.message })
          }
        }
        failures.push({
          reminderId: job.reminder_id,
          email: "fcm",
          message: result.reason ?? `FCM returned HTTP ${result.status}`
        })
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        generatedCount: typeof insertedCount === "number" ? insertedCount : 0,
        queuedEmailJobs: Array.isArray(emailJobs) ? emailJobs.length : 0,
        emailedCount,
        apnsConfigured: Boolean(apnsCredentials),
        queuedPushJobs,
        pushedCount,
        fcmConfigured: Boolean(fcmCredentials),
        queuedFCMJobs,
        fcmPushedCount,
        failures
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected reminder sync failure."
    return new Response(JSON.stringify({ error: "REMINDER_SYNC_FAILED", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
}
