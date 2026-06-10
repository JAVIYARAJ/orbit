import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, workspace_name, inviter_name, role, invite_url } = await req.json();

    if (!to || !workspace_name || !invite_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, workspace_name, invite_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const BREVO_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_KEY) {
      return new Response(
        JSON.stringify({ error: 'BREVO_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@example.com';
    const SENDER_NAME  = Deno.env.get('BREVO_SENDER_NAME')  ?? 'Orbit';

    // Service client for best-effort audit logging via the log_email RPC.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const subject = `${inviter_name} invited you to ${workspace_name} on Orbit`;
    const logEmail = async (status: string, reason: string, messageId?: string) => {
      try {
        await admin.rpc('log_email', {
          p_kind: 'invite',
          p_to_email: to,
          p_subject: subject,
          p_status: status,
          p_reason: reason,
          p_related_id: null,
          p_provider_message_id: messageId ?? null,
        });
      } catch { /* never block on logging */ }
    };

    const roleLabel: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      member: 'Member',
      viewer: 'Viewer',
    };

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0f0f14;border:1px solid #242430;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:32px 36px;">
            <div style="font-size:11px;font-family:monospace;color:#6a6a78;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px;">ORBIT · TEAM INVITE</div>
            <h1 style="font-size:22px;font-weight:700;color:#f0f0f2;margin:0 0 12px;">You're invited to join ${workspace_name}</h1>
            <p style="font-size:14px;color:#a0a0a8;margin:0 0 8px;">
              <strong style="color:#f0f0f2;">${inviter_name}</strong> has invited you to collaborate on <strong style="color:#f0f0f2;">${workspace_name}</strong>.
            </p>
            <p style="font-size:13px;color:#6a6a78;margin:0 0 28px;">Your role: <strong style="color:#0099ff;">${roleLabel[role] ?? role}</strong></p>
            <a href="${invite_url}" style="display:inline-block;background:#0099ff;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              Accept Invitation
            </a>
            <p style="font-size:11px;color:#45454f;margin:24px 0 0;">This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const resBody = await res.json();

    if (!res.ok) {
      console.error('Brevo error:', JSON.stringify(resBody));
      await logEmail('failed', resBody?.message ? `Brevo: ${resBody.message}` : `Brevo returned ${res.status}`);
      return new Response(
        JSON.stringify({ error: 'Email provider error', detail: resBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logEmail('sent', 'workspace_invite', resBody.messageId);

    return new Response(
      JSON.stringify({ ok: true, messageId: resBody.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('send-invite-email error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
