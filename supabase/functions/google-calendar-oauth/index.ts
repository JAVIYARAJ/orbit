// google-calendar-oauth — OAuth redirect target (verify_jwt = false).
// Exchanges the auth code for tokens, stores them (encrypted) in
// workspace_integrations under provider='google_calendar', then redirects
// back to the app. Mirrors the github-oauth function's conventions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL       = (Deno.env.get('APP_URL') || 'http://localhost:5173').trim()
const ENC_KEY_HEX   = Deno.env.get('TOKEN_ENC_KEY')!

async function getEncKey(): Promise<CryptoKey> {
  const raw = new Uint8Array(ENC_KEY_HEX.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
}

async function encryptToken(token: string): Promise<string> {
  const key = await getEncKey()
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  const buf = new Uint8Array(12 + enc.byteLength)
  buf.set(iv, 0)
  buf.set(new Uint8Array(enc), 12)
  return btoa(String.fromCharCode(...buf))
}

Deno.serve(async (req) => {
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state') || '' // "workstation_id:user_id"
  const error = url.searchParams.get('error')

  if (error) return Response.redirect(`${APP_URL}?google_error=${encodeURIComponent(error)}`)
  if (!code || !state) return Response.redirect(`${APP_URL}?google_error=missing_params`)

  const [workstation_id, user_id] = state.split(':')
  if (!workstation_id || !user_id) return Response.redirect(`${APP_URL}?google_error=invalid_state`)

  // redirect_uri must exactly match what the browser sent AND what is registered
  // in Google. Build it from the project URL — req.url inside the edge runtime is
  // an internal address, not the public https://<ref>.supabase.co host.
  const redirectUri = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/google-calendar-oauth`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('TOKEN_EXCHANGE_FAILED', tokenRes.status, JSON.stringify(tokenData), 'redirect_uri=', redirectUri)
      const desc = tokenData.error_description || ''
      return Response.redirect(`${APP_URL}?google_error=${encodeURIComponent(tokenData.error || 'token_failed')}&google_desc=${encodeURIComponent(desc)}`)
    }

    const userRes  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const gUser = await userRes.json()

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Google only returns refresh_token on first consent (or with prompt=consent).
    // Preserve the existing one if this re-consent omitted it.
    let refreshEnc: string | null = null
    if (tokenData.refresh_token) {
      refreshEnc = await encryptToken(tokenData.refresh_token)
    } else {
      const { data: existing } = await admin.from('workspace_integrations')
        .select('refresh_token').eq('workstation_id', workstation_id)
        .eq('provider', 'google_calendar').maybeSingle()
      refreshEnc = existing?.refresh_token ?? null
    }

    const accessEnc   = await encryptToken(tokenData.access_token)
    const expiresAt   = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

    const { error: dbErr } = await admin.from('workspace_integrations').upsert({
      workstation_id,
      connected_by:     user_id,
      provider:         'google_calendar',
      access_token:     accessEnc,
      refresh_token:    refreshEnc,
      token_expires_at: expiresAt,
      is_encrypted:     true,
      username:         gUser.email,
      display_name:     gUser.name,
      avatar_url:       gUser.picture,
      email:            gUser.email,
      scopes:           tokenData.scope ? String(tokenData.scope).split(' ') : [],
      metadata:         { sub: gUser.sub },
    }, { onConflict: 'workstation_id,provider' })
    if (dbErr) {
      console.error('DB_UPSERT_FAILED', JSON.stringify(dbErr))
      return Response.redirect(`${APP_URL}?google_error=${encodeURIComponent('db_' + (dbErr.message || 'upsert_failed'))}`)
    }

    return Response.redirect(`${APP_URL}?google=connected`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('OAUTH_CALLBACK_EXCEPTION', msg)
    return Response.redirect(`${APP_URL}?google_error=${encodeURIComponent(msg)}`)
  }
})
