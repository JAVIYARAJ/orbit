// Brevo event webhook — receives transactional delivery events (delivered,
// hard_bounce, blocked, spam, …) and updates email_log.status via the
// set_email_status_by_message_id RPC, matched on the Brevo message-id.
//
// Configure in Brevo → Transactional → Settings → Webhook, pointing to:
//   https://<project>.functions.supabase.co/brevo-webhook?token=<BREVO_WEBHOOK_SECRET>
// Deployed with verify_jwt = false; access is gated by the ?token query param.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Brevo event name → our email_log.status. null = record event but keep status.
function mapStatus(event: string): string | null {
  switch ((event || "").toLowerCase()) {
    case "delivered": return "delivered";
    case "hard_bounce":
    case "soft_bounce": return "bounced";
    case "blocked": return "blocked";
    case "spam": return "spam";
    case "invalid_email": return "invalid";
    case "deferred": return "deferred";
    case "error": return "failed";
    case "unique_opened":
    case "opened": return "opened";
    case "click":
    case "clicks": return "clicked";
    default: return null;             // request, unsubscribed, etc.
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Gate on the ?token= query param, verified against the Vault value.
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const { data: tokenOk } = await admin.rpc("verify_brevo_webhook_secret", { p_secret: token });
  if (tokenOk !== true) return json({ error: "Unauthorized" }, 401);

  try {
    const payload = await req.json();
    // Brevo may send a single event object or an array of them.
    const events = Array.isArray(payload) ? payload : [payload];

    let updated = 0;
    for (const ev of events) {
      const messageId = ev["message-id"] ?? ev.messageId ?? null;
      if (!messageId) continue;
      const status = mapStatus(ev.event);
      const { data } = await admin.rpc("set_email_status_by_message_id", {
        p_message_id: String(messageId),
        p_status: status,
        p_event: {
          event: ev.event ?? null,
          date: ev.date ?? ev.ts ?? null,
          reason: ev.reason ?? null,
        },
      });
      updated += Number(data ?? 0);
    }

    return json({ ok: true, updated });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
