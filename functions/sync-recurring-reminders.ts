import { createAdminClient } from "npm:@insforge/sdk"

interface EmailJob {
  reminder_id: string
  user_id: string
  email: string
  full_name: string | null
  title: string
  body: string
  due_date: string
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

    return new Response(
      JSON.stringify({
        ok: true,
        generatedCount: typeof insertedCount === "number" ? insertedCount : 0,
        queuedEmailJobs: Array.isArray(emailJobs) ? emailJobs.length : 0,
        emailedCount,
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
