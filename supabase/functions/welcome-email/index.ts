// Orbit welcome email — invoked by the public.profiles AFTER INSERT trigger
// (via pg_net) whenever a new user signs up. Renders the admin-editable
// 'welcome' template (public.app_email_templates) and sends it via Brevo.
//
// Security: this function is deployed with verify_jwt = false because the DB
// trigger calls it without a user JWT. It instead validates a shared secret
// (x-welcome-secret header) against the WELCOME_HOOK_SECRET env var. The same
// secret lives in Supabase Vault on the database side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WELCOME_HOOK_SECRET = Deno.env.get("WELCOME_HOOK_SECRET") ?? "";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") ?? "Orbit";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const applyVars = (text: string, name: string) =>
  String(text ?? "").replace(/\{name\}/gi, name || "there");

function toParagraphs(message: string): string {
  return String(message ?? "")
    .split(/\n{2,}/)
    .map((para) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">${
        esc(para).replace(/\n/g, "<br>")
      }</p>`)
    .join("");
}

function renderWelcomeEmail(name: string, body: string): string {
  const greeting = name?.trim() ? `Hi ${esc(name.trim())},` : "Hi there,";
  const cta = APP_URL
    ? `<tr><td style="padding:4px 28px 28px;">
         <a href="${esc(APP_URL)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Open Orbit →</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#4f46e5;padding:22px 28px;">
              <span style="font-size:20px;font-weight:700;letter-spacing:-.01em;color:#ffffff;">Orbit</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;font-weight:600;">${greeting}</p>
              ${toParagraphs(body)}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #e2e8f0;background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Sent by the Orbit team${BREVO_SENDER_EMAIL ? ` &middot; ${esc(BREVO_SENDER_EMAIL)}` : ""}.<br>
                You're receiving this because you just created an Orbit account.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Validate the shared secret. Fail closed if it isn't configured.
  const provided = req.headers.get("x-welcome-secret") ?? "";
  if (!WELCOME_HOOK_SECRET || provided !== WELCOME_HOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { user_id, email, name } = await req.json();
    if (!user_id || !email) return json({ error: "Missing user_id or email" }, 400);

    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
      return json({ error: "Email not configured" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Idempotency: skip if a welcome has already been sent to this profile.
    const { data: prof } = await admin
      .from("profiles").select("welcome_sent_at").eq("id", user_id).maybeSingle();
    if (prof?.welcome_sent_at) return json({ ok: true, skipped: "already_sent" });

    // Load the admin-editable template.
    const { data: tpl } = await admin
      .from("app_email_templates").select("subject,body,enabled").eq("key", "welcome").maybeSingle();
    if (!tpl || tpl.enabled === false) return json({ ok: true, skipped: "disabled" });

    const subject = applyVars(tpl.subject || "Welcome to Orbit!", name);
    const htmlContent = renderWelcomeEmail(name, applyVars(tpl.body || "", name));

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email, name: name || undefined }],
        replyTo: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
        subject,
        htmlContent,
        textContent: applyVars(tpl.body || "", name),
      }),
    });

    if (!res.ok) {
      let detail = `Brevo returned ${res.status}`;
      try { const e = await res.json(); if (e?.message) detail = `Brevo: ${e.message}`; } catch { /* noop */ }
      return json({ error: detail }, 502);
    }

    await admin.from("profiles").update({ welcome_sent_at: new Date().toISOString() }).eq("id", user_id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
