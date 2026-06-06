// google-calendar-proxy — browser-facing proxy (verify_jwt = true).
// Loads the workspace's Google tokens server-side, refreshes the access token
// when expired, and proxies Calendar API v3 calls. The `sync` action runs the
// two-way sync engine. Mirrors github-proxy's auth + response conventions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENC_KEY_HEX   = Deno.env.get('TOKEN_ENC_KEY')!
const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const GCAL = 'https://www.googleapis.com/calendar/v3'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// ── AES-GCM token crypto (same scheme as github-proxy) ───────────────────────
async function getEncKey(usage: KeyUsage): Promise<CryptoKey> {
  const raw = new Uint8Array(ENC_KEY_HEX.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [usage])
}
async function encryptToken(token: string): Promise<string> {
  const key = await getEncKey('encrypt')
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  const buf = new Uint8Array(12 + enc.byteLength)
  buf.set(iv, 0); buf.set(new Uint8Array(enc), 12)
  return btoa(String.fromCharCode(...buf))
}
async function decryptToken(encrypted: string): Promise<string> {
  const key = await getEncKey('decrypt')
  const buf = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12))
  return new TextDecoder().decode(dec)
}

class ReconnectError extends Error {}

// Notify the person who connected the integration that it needs reconnecting
// (deduped to once per day). Uses the service-role client (bypasses RLS).
async function notifyReconnect(admin: any, workstationId: string) {
  try {
    const { data: integ } = await admin.from('workspace_integrations')
      .select('connected_by').eq('workstation_id', workstationId).eq('provider', 'google_calendar').maybeSingle()
    const uid = integ?.connected_by
    if (!uid) return
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const { data: existing } = await admin.from('notifications').select('id')
      .eq('user_id', uid).eq('type', 'integration_reconnect_needed').eq('workstation_id', workstationId)
      .gte('created_at', since.toISOString()).limit(1)
    if (existing && existing.length) return
    await admin.from('notifications').insert({
      user_id: uid, actor_id: uid, type: 'integration_reconnect_needed', workstation_id: workstationId,
      entity_type: 'integration', entity_id: 'google_calendar', title: 'Google Calendar',
      preview: 'Reconnect Google Calendar to resume sync', meta: { provider: 'google_calendar' },
    })
  } catch (_) { /* best-effort */ }
}

// Returns a valid access token, refreshing + persisting it when near expiry.
async function getValidToken(admin: any, workstationId: string): Promise<string> {
  const { data: integ } = await admin.from('workspace_integrations')
    .select('access_token, refresh_token, token_expires_at, is_encrypted')
    .eq('workstation_id', workstationId).eq('provider', 'google_calendar').maybeSingle()
  if (!integ?.access_token) throw new Error('NOT_CONNECTED')

  let access = integ.is_encrypted ? await decryptToken(integ.access_token) : integ.access_token
  const expMs = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0
  if (expMs - Date.now() > 60_000) return access

  // Needs refresh.
  if (!integ.refresh_token) throw new ReconnectError('no_refresh_token')
  const refresh = integ.is_encrypted ? await decryptToken(integ.refresh_token) : integ.refresh_token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new ReconnectError(data.error || 'refresh_failed')

  access = data.access_token
  await admin.from('workspace_integrations').update({
    access_token: await encryptToken(access),
    token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }).eq('workstation_id', workstationId).eq('provider', 'google_calendar')
  return access
}

// ── Google Calendar helpers ──────────────────────────────────────────────────
function gReq(token: string, path: string, method = 'GET', body: unknown = null, extra: Record<string,string> = {}) {
  return fetch(GCAL + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
async function gJson(token: string, path: string, method = 'GET', body: unknown = null) {
  const r = await gReq(token, path, method, body)
  if (!r.ok) throw new Error(`google ${r.status}: ${await r.text()}`)
  return r.json()
}
function gList(token: string, calId: string, timeMin: string, timeMax: string) {
  const qs = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeMin, timeMax })
  return gJson(token, `/calendars/${encodeURIComponent(calId)}/events?${qs}`)
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
function buildResource(item: any) {
  const r: any = {
    summary: item.title || '(untitled)',
    description: item.description || '',
    extendedProperties: { private: { orbit_kind: item.kind, orbit_id: String(item.orbit_id) } },
  }
  if (item.location) r.location = item.location
  if (item.all_day) {
    const start = String(item.starts_at).slice(0, 10)
    let end = item.ends_at ? String(item.ends_at).slice(0, 10) : start
    if (end <= start) end = addDay(start)
    r.start = { date: start }; r.end = { date: end }
  } else {
    r.start = { dateTime: item.starts_at }; r.end = { dateTime: item.ends_at }
  }
  if (item.recurrence_rule) r.recurrence = ['RRULE:' + item.recurrence_rule]
  return r
}

// Update an existing Google event; Orbit is source of truth, so on an etag
// conflict (412) we refetch the live etag and force the write. 404/410 => recreate.
async function patchEvent(token: string, calId: string, eventId: string, resource: any, etag?: string) {
  const path = `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`
  let res = await gReq(token, path, 'PATCH', resource, etag ? { 'If-Match': etag } : {})
  if (res.status === 412) {
    const fresh = await gJson(token, path, 'GET')
    res = await gReq(token, path, 'PATCH', resource, fresh.etag ? { 'If-Match': fresh.etag } : {})
  }
  if (res.status === 404 || res.status === 410) {
    return gJson(token, `/calendars/${encodeURIComponent(calId)}/events`, 'POST', resource)
  }
  if (!res.ok) throw new Error(`google ${res.status}: ${await res.text()}`)
  return res.json()
}

async function runSync(admin: any, token: string, workstationId: string) {
  let pushed = 0, pulled = 0, deleted = 0
  const errors: any[] = []

  // PUSH: Orbit -> Google
  const { data: pending } = await admin.rpc('get_pending_pushes', { p_workstation_id: workstationId })
  for (const item of (pending || [])) {
    const calId = item.google_calendar_id || 'primary'
    try {
      if (item.deleted) {
        if (item.google_event_id) {
          await gReq(token, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(item.google_event_id)}`, 'DELETE').catch(() => {})
        }
        await admin.rpc('delete_event_link', { p_workstation_id: workstationId, p_orbit_kind: item.kind, p_orbit_id: String(item.orbit_id) })
        deleted++
        continue
      }
      const resource = buildResource(item)
      const g = item.google_event_id
        ? await patchEvent(token, calId, item.google_event_id, resource, item.etag)
        : await gJson(token, `/calendars/${encodeURIComponent(calId)}/events`, 'POST', resource)
      await admin.rpc('upsert_event_link', { p_workstation_id: workstationId, p_data: {
        orbit_kind: item.kind, orbit_id: String(item.orbit_id), google_calendar_id: calId,
        google_event_id: g.id, etag: g.etag, orbit_updated_at: item.orbit_updated_at, google_updated_at: g.updated,
      }})
      pushed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ orbit_id: item.orbit_id, error: msg })
      await admin.rpc('mark_link_error', { p_workstation_id: workstationId, p_orbit_kind: item.kind, p_orbit_id: String(item.orbit_id), p_error: msg }).catch(() => {})
    }
  }

  // PULL: Google -> Orbit
  const timeMin = new Date(Date.now() - 60 * 86400000).toISOString()
  const timeMax = new Date(Date.now() + 180 * 86400000).toISOString()
  const listed = await gList(token, 'primary', timeMin, timeMax)

  // Load existing links so we can detect Google-side edits of Orbit-owned events.
  const { data: links } = await admin.from('calendar_event_links')
    .select('orbit_kind, orbit_id, google_event_id, google_updated_at')
    .eq('workstation_id', workstationId)
  const linkByGid: Record<string, any> = {}
  for (const l of (links || [])) linkByGid[l.google_event_id] = l

  const rows: any[] = []
  for (const ev of (listed.items || [])) {
    const owned = ev.extendedProperties?.private?.orbit_id
    const allDay = !!ev.start?.date
    const startsAt = allDay ? `${ev.start.date}T00:00:00Z` : ev.start?.dateTime
    const endsAt   = allDay ? `${ev.end.date}T00:00:00Z`   : ev.end?.dateTime

    if (owned) {
      // Orbit-owned. Only native events flow back; tasks/projects stay Orbit-managed.
      const kind = ev.extendedProperties?.private?.orbit_kind
      const link = linkByGid[ev.id]
      // Recurring series stay Orbit-managed: instances carry recurringEventId and
      // share one orbit_id, so we never write them back onto the master.
      const isRecurring = !!ev.recurringEventId || !!ev.recurrence
      if (kind === 'event' && !isRecurring && link && ev.updated && ev.updated !== link.google_updated_at && ev.status !== 'cancelled') {
        // Changed in Google since our last sync (and not re-pushed this run) → apply back.
        const orbitMeetLink =
          ev.hangoutLink ||
          ev.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
          null
        await admin.rpc('apply_google_to_event', { p_workstation_id: workstationId, p_data: {
          orbit_id: owned, title: ev.summary || '(no title)', description: ev.description || '',
          location: ev.location || null, starts_at: startsAt, ends_at: endsAt, all_day: allDay,
          etag: ev.etag || null, google_updated_at: ev.updated || null, meet_link: orbitMeetLink,
        }})
        pulled++
      }
      continue // never cache Orbit-owned events
    }

    // Extract Google Meet link: prefer hangoutLink, fall back to conferenceData video entry.
    const meetLink: string | null =
      ev.hangoutLink ||
      ev.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
      null

    // Normalise attendees to a compact shape (no PII beyond what Google already returns).
    const attendees = (ev.attendees as any[] | undefined)?.map((a: any) => ({
      email:          a.email        || null,
      displayName:    a.displayName  || null,
      responseStatus: a.responseStatus || 'needsAction',
      organizer:      a.organizer    === true,
      self:           a.self         === true,
    })) ?? null

    // Standalone Google event → display-only cache.
    rows.push({
      google_calendar_id: 'primary', google_event_id: ev.id, summary: ev.summary || '(no title)',
      description: ev.description || null, location: ev.location || null,
      starts_at: startsAt, ends_at: endsAt,
      all_day: allDay, html_link: ev.htmlLink || null, etag: ev.etag || null,
      google_updated_at: ev.updated || null, status: ev.status || 'confirmed',
      attendees, meet_link: meetLink,
    })
    pulled++
  }
  if (rows.length) await admin.rpc('upsert_google_cache', { p_workstation_id: workstationId, p_events: rows })

  // Reconcile deletions: drop cached events in this window that Google no longer returns.
  const keepIds = rows.map(r => r.google_event_id)
  await admin.rpc('prune_google_cache', { p_workstation_id: workstationId, p_from: timeMin, p_to: timeMax, p_keep: keepIds })

  return { pushed, pulled, deleted, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { action, workstation_id, calendarId = 'primary', timeMin, timeMax, eventId, event } = await req.json()
    if (!workstation_id) return json({ error: 'workstation_id required' }, 400)

    const authHeader = req.headers.get('Authorization')!
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: membership } = await admin.from('workstation_members')
      .select('role').eq('workstation_id', workstation_id).eq('user_id', user.id).maybeSingle()
    if (!membership) return json({ error: 'Unauthorized' }, 403)

    let token: string
    try {
      token = await getValidToken(admin, workstation_id)
    } catch (e) {
      if (e instanceof ReconnectError) { await notifyReconnect(admin, workstation_id); return json({ status: 403 }, 200) }
      if (e instanceof Error && e.message === 'NOT_CONNECTED') return json({ error: 'Google Calendar not connected' }, 404)
      throw e
    }

    switch (action) {
      case 'list': {
        const data = await gList(token, calendarId, timeMin, timeMax)
        return json({ data, status: 200 })
      }
      case 'insert': {
        const data = await gJson(token, `/calendars/${encodeURIComponent(calendarId)}/events`, 'POST', event)
        return json({ data, status: 200 })
      }
      case 'update': {
        const data = await gJson(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, 'PATCH', event)
        return json({ data, status: 200 })
      }
      case 'delete': {
        await gReq(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, 'DELETE')
        return json({ data: null, status: 200 })
      }
      case 'sync': {
        const data = await runSync(admin, token, workstation_id)
        return json({ data, status: 200 })
      }
      default:
        return json({ error: `unknown action: ${action}` }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
